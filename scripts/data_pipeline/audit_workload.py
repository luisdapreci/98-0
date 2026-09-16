"""Descriptive workload/efficiency associations, not causal congestion calibration."""
import argparse
import csv
import json
import math
import statistics
from collections import Counter, defaultdict
from pathlib import Path

from audit_era_baselines import CORE_FIELDS, fingerprint, relative_peak
from audit_possessions import ROOT, FIELDS, number

PROTOCOL = {
    "seasonRange": [1978, 2026], "minimumGames": 20, "minimumMinutes": 500,
    "stableAgeRange": [20, 34], "stableMinutesRatio": [0.8, 1.2],
    "eras": [[1978, 1999], [2000, 2012], [2013, 2026]],
    "largeWorkloadChange": 0.2,
    "weighting": "Equal weight per player-season or consecutive pair; no peak or draft-pool filtering.",
    "regression": "OLS with intercept; player-cluster CR1 slope SE, normal 1.96 interval; no causal interpretation.",
}


def association(rows, outcome):
    count = len(rows)
    clusters = {row["playerId"] for row in rows}
    if count < 3 or len(clusters) < 2:
        return {"observations": count, "players": len(clusters), "status": "insufficient-data"}
    workload = [row["workload"] for row in rows]
    values = [row[outcome] for row in rows]
    mean_workload = statistics.mean(workload)
    centered_sum = sum((value - mean_workload) ** 2 for value in workload)
    if centered_sum <= 1e-12:
        return {"observations": count, "players": len(clusters), "status": "constant-workload"}
    fit = statistics.linear_regression(workload, values)
    scores = defaultdict(float)
    residual_sum = 0.0
    for row in rows:
        residual = row[outcome] - fit.intercept - fit.slope * row["workload"]
        residual_sum += residual ** 2
        scores[row["playerId"]] += (row["workload"] - mean_workload) * residual
    correction = len(clusters) / (len(clusters) - 1) * (count - 1) / (count - 2)
    variance = correction * sum(score ** 2 for score in scores.values()) / centered_sum ** 2
    standard_error = math.sqrt(variance)
    mean_outcome = statistics.mean(values)
    total_sum = sum((value - mean_outcome) ** 2 for value in values)
    return {"observations": count, "players": len(clusters), "status": "estimated",
            "meanWorkload": mean_workload, "meanOutcome": mean_outcome,
            "slope": fit.slope, "intercept": fit.intercept, "clusterStandardError": standard_error,
            "slopeInterval95": [fit.slope - 1.96 * standard_error, fit.slope + 1.96 * standard_error],
            "rSquared": 1 - residual_sum / total_sum if total_sum > 0 else None,
            "percentagePointsPerQuarterWorkload": 25 * fit.slope}


def consecutive_pairs(seasons):
    by_player = defaultdict(list)
    for row in seasons:
        by_player[row["playerId"]].append(row)
    pairs = []
    for identity in sorted(by_player):
        ordered = sorted(by_player[identity], key=lambda row: row["season"])
        for before, after in zip(ordered, ordered[1:]):
            if after["season"] != before["season"] + 1:
                continue
            minutes_ratio = after["minutesPerGame"] / before["minutesPerGame"]
            same_team = len(before["teams"]) == 1 and before["teams"] == after["teams"]
            stable = same_team and all(PROTOCOL["stableAgeRange"][0] <= age <= PROTOCOL["stableAgeRange"][1]
                                       for age in (before["age"], after["age"]))
            stable = stable and PROTOCOL["stableMinutesRatio"][0] <= minutes_ratio <= PROTOCOL["stableMinutesRatio"][1]
            pairs.append({"playerId": identity, "beforeSeason": before["season"], "season": after["season"],
                          "workload": after["workload"] - before["workload"],
                          "shooting": after["shooting"] - before["shooting"],
                          "turnovers": after["turnovers"] - before["turnovers"],
                          "sameTeam": same_team, "stable": stable, "minutesRatio": minutes_ratio})
    return pairs


def self_test():
    rows = [{"playerId": f"player{index // 2}", "workload": float(index), "shooting": 2 + 3 * index}
            for index in range(6)]
    fitted = association(rows, "shooting")
    assert math.isclose(fitted["slope"], 3) and math.isclose(fitted["intercept"], 2)
    assert fitted["clusterStandardError"] < 1e-12
    noisy = [{**row, "shooting": row["shooting"] + (index % 3) * 0.1} for index, row in enumerate(rows)]
    assert association(noisy, "shooting")["clusterStandardError"] > 0
    assert association([{**row, "workload": 1} for row in rows], "shooting")["status"] == "constant-workload"
    base = {"playerId": "same", "season": 2000, "age": 25, "minutesPerGame": 30,
            "teams": ["BOS"], "workload": 1, "shooting": 0.05, "turnovers": 0.01}
    after = {**base, "season": 2001, "age": 26, "workload": 1.3, "shooting": 0.03}
    pair = consecutive_pairs([after, base])[0]
    assert pair["stable"] and math.isclose(pair["workload"], 0.3) and math.isclose(pair["shooting"], -0.02)
    assert not consecutive_pairs([base, {**after, "teams": ["BOS", "LAL"]}])[0]["stable"]
    assert not consecutive_pairs([base, {**after, "minutesPerGame": 40}])[0]["stable"]
    assert consecutive_pairs([base, {**after, "season": 2002}]) == []
    print("Workload self-checks passed: slope, clustered residuals, stable controls and consecutive pairing.")


def build_report():
    era_path = ROOT / "docs/MID_IQ_ERA_BASELINE_AUDIT_1.json"
    era = json.loads(era_path.read_text(encoding="utf-8"))
    assert era["version"] == "mid-iq-era-baseline-audit-1"
    hashes = {**era["sourceSha256"], "docs/MID_IQ_ERA_BASELINE_AUDIT_1.json": fingerprint(era_path),
              "scripts/data_pipeline/audit_era_baselines.py": era["implementationSha256"]}
    for path, sha in hashes.items():
        assert fingerprint(ROOT / path) == sha, f"Stale workload source: {path}"
    baselines = {row["season"]: row for row in era["seasons"]}
    grouped = defaultdict(list)
    seen = set()
    excluded = Counter()
    with (ROOT / "data/raw/Player Per Game.csv").open(encoding="utf-8", newline="") as source:
        for line, raw in enumerate(csv.DictReader(source), 2):
            season = int(raw["season"])
            if raw["lg"] != "NBA" or not PROTOCOL["seasonRange"][0] <= season <= PROTOCOL["seasonRange"][1]:
                continue
            if raw["team"] == "TOT" or raw["team"].endswith("TM"):
                excluded["aggregateRows"] += 1
                continue
            games = number(raw["g"])
            assert games is not None
            if games == 0:
                excluded["zeroGameRows"] += 1
                continue
            key = (raw["player_id"], season, raw["team"])
            assert key not in seen, f"Duplicate stint: {key}"
            seen.add(key)
            grouped[(raw["player_id"], season)].append({"season": season, "games": games,
                "team": raw["team"], "age": number(raw["age"]), "csvLine": line,
                "stats": {field: number(raw[FIELDS[field]]) for field in CORE_FIELDS}})
    seasons = []
    for (identity, season), rows in sorted(grouped.items()):
        if any(row["age"] is None or any(value is None for value in row["stats"].values()) for row in rows):
            excluded["incompletePlayerSeasons"] += 1
            continue
        games = sum(row["games"] for row in rows)
        minutes = sum(row["games"] * row["stats"]["minutes"] for row in rows)
        if games < PROTOCOL["minimumGames"] or minutes < PROTOCOL["minimumMinutes"]:
            excluded["lowExposurePlayerSeasons"] += 1
            continue
        assert len({row["age"] for row in rows}) == 1, f"Inconsistent season age: {identity} {season}"
        context = relative_peak(rows, baselines)
        assert context["turnoverComparisonAvailable"]
        seasons.append({"playerId": identity, "season": season, "age": rows[0]["age"],
                        "games": games, "minutes": minutes, "minutesPerGame": minutes / games,
                        "teams": sorted(row["team"] for row in rows), "csvLines": [row["csvLine"] for row in rows],
                        "workload": context["shotWorkloadRatio"], "shooting": context["trueShootingDelta"],
                        "turnovers": context["turnoverShareDelta"]})
    pairs = consecutive_pairs(seasons)
    cohorts = {"crossSection": seasons, "consecutiveChanges": pairs,
               "sameTeamChanges": [row for row in pairs if row["sameTeam"]],
               "stableChanges": [row for row in pairs if row["stable"]]}
    summaries = {}
    for name, rows in cohorts.items():
        summaries[name] = {"shooting": association(rows, "shooting"), "turnovers": association(rows, "turnovers")}
    era_sensitivity = []
    for low, high in PROTOCOL["eras"]:
        rows = [row for row in cohorts["stableChanges"] if low <= row["beforeSeason"] and row["season"] <= high]
        era_sensitivity.append({"years": [low, high], "shooting": association(rows, "shooting"), "turnovers": association(rows, "turnovers")})
    directional = []
    for direction in ("decreased", "similar", "increased"):
        threshold = PROTOCOL["largeWorkloadChange"]
        rows = [row for row in cohorts["stableChanges"] if
                ("decreased" if row["workload"] <= -threshold else "increased" if row["workload"] >= threshold else "similar") == direction]
        directional.append({"direction": direction, "pairs": len(rows), "players": len({row["playerId"] for row in rows}),
                            "meanWorkloadChange": statistics.mean(row["workload"] for row in rows) if rows else None,
                            "meanShootingChange": statistics.mean(row["shooting"] for row in rows) if rows else None,
                            "meanTurnoverChange": statistics.mean(row["turnovers"] for row in rows) if rows else None})
    for path, sha in hashes.items():
        assert fingerprint(ROOT / path) == sha, f"Source changed during workload study: {path}"
    return {"version": "mid-iq-workload-study-1", "scope": "observational-season-associations", "protocol": PROTOCOL,
            "sourceSha256": hashes, "implementationSha256": fingerprint(Path(__file__)), "excluded": dict(excluded),
            "summaries": summaries, "eraSensitivity": era_sensitivity, "stableDirectionalGroups": directional,
            "seasonObservations": seasons, "consecutivePairs": pairs,
            "limitations": ["No causal congestion coefficient or maximum-capacity estimate. Workload is observed, not randomized.",
                            "Stable raw-team labels, ages and minutes do not control teammates, injuries, role changes or aging; team renames conservatively leave the stable subset.",
                            "Workload and efficiency share a shot-event denominator, inducing measurement dependence. Rounded rates and league baselines add error.",
                            "Player-cluster normal intervals allow within-player dependence but not all shared team/season shocks. Multiple exploratory comparisons are not independent confirmatory tests.",
                            "Consecutive-pair inclusion requires surviving the exposure filter in both seasons; selection and regression-to-mean remain.",
                            "Same-season league reference includes the players. Era splits are sensitivity checks, not held-out validation.",
                            "No benchmark win bands, peak selection, historical turnover imputation or live model changes."]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output", nargs="?")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.output:
        parser.error("A new output path is required.")
    path = Path(args.output)
    if path.exists():
        parser.error("Refusing to overwrite an existing workload study.")
    report = build_report()
    with path.open("x", encoding="utf-8") as output:
        json.dump(report, output, indent=2, allow_nan=False)
        output.write("\n")
    print(json.dumps({key: report[key] for key in ("excluded", "summaries", "eraSensitivity", "stableDirectionalGroups")}, indent=2))


if __name__ == "__main__":
    main()