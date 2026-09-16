"""Audit season-relative offensive context without fitting or rewriting player data."""
import argparse
import csv
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

from audit_possessions import ROOT, FIELDS, number

CORE_FIELDS = ("minutes", "points", "assists", "fieldGoalAttempts", "freeThrowAttempts", "turnovers")


def fingerprint(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def season_rates(rows):
    totals = {}
    coverage = {}
    for field in CORE_FIELDS:
        observed = [row for row in rows if row["stats"][field] is not None]
        coverage[field] = {"observedRows": len(observed), "totalRows": len(rows)}
        totals[field] = sum(row["games"] * row["stats"][field] for row in rows) if len(observed) == len(rows) else None
    shots = None if any(totals[field] is None for field in ("points", "fieldGoalAttempts", "freeThrowAttempts")) else totals["fieldGoalAttempts"] + 0.44 * totals["freeThrowAttempts"]
    used = shots + totals["turnovers"] if shots is not None and totals["turnovers"] is not None else None
    minutes = totals["minutes"]
    per36 = lambda value: 36 * value / minutes if value is not None and minutes else None
    return {"totals": totals, "coverage": coverage,
            "shotPointsPerEnd": totals["points"] / shots if shots else None,
            "trueShootingProxy": totals["points"] / (2 * shots) if shots else None,
            "shotEndsPer36": per36(shots), "usedEndsPer36": per36(used),
            "turnoverShare": totals["turnovers"] / used if used else None,
            "assistsPer36": per36(totals["assists"]), "pointsPer36": per36(totals["points"])}


def relative_peak(selected, baselines):
    observed_points = observed_shots = observed_assists = minutes = 0.0
    expected_points = expected_shots = expected_assists = 0.0
    observed_used = observed_turnovers = expected_used = expected_turnovers = 0.0
    shooting_ready = workload_ready = assists_ready = turnover_ready = True
    for row in selected:
        stats, games = row["stats"], row["games"]
        baseline = baselines[row["season"]]
        exposure = games * stats["minutes"]
        shots = games * (stats["fieldGoalAttempts"] + 0.44 * stats["freeThrowAttempts"])
        points = games * stats["points"]
        minutes += exposure
        observed_points += points
        observed_shots += shots
        observed_assists += games * stats["assists"]
        if baseline["shotPointsPerEnd"] is None:
            shooting_ready = False
        else:
            expected_points += shots * baseline["shotPointsPerEnd"]
        if baseline["shotEndsPer36"] is None:
            workload_ready = False
        else:
            expected_shots += exposure * baseline["shotEndsPer36"] / 36
        if baseline["assistsPer36"] is None:
            assists_ready = False
        else:
            expected_assists += exposure * baseline["assistsPer36"] / 36
        if stats["turnovers"] is None or baseline["turnoverShare"] is None or baseline["usedEndsPer36"] is None:
            turnover_ready = False
        else:
            turnovers = games * stats["turnovers"]
            used = shots + turnovers
            observed_turnovers += turnovers
            observed_used += used
            expected_turnovers += used * baseline["turnoverShare"]
            expected_used += exposure * baseline["usedEndsPer36"] / 36
    assert minutes > 0 and observed_shots > 0
    return {"shotEfficiencyRatio": observed_points / expected_points if shooting_ready and expected_points else None,
            "trueShootingDelta": (observed_points - expected_points) / (2 * observed_shots) if shooting_ready else None,
            "shotWorkloadRatio": observed_shots / expected_shots if workload_ready and expected_shots else None,
            "assistRateRatio": observed_assists / expected_assists if assists_ready and expected_assists else None,
            "usedWorkloadRatio": observed_used / expected_used if turnover_ready and expected_used else None,
            "turnoverShareDelta": (observed_turnovers - expected_turnovers) / observed_used if turnover_ready and observed_used else None,
            "turnoverComparisonAvailable": turnover_ready,
            "exposure": {"minutes": minutes, "shotEnds": observed_shots,
                         "expectedPointsAtSeasonRates": expected_points if shooting_ready else None,
                         "expectedShotEndsAtSeasonRates": expected_shots if workload_ready else None}}


def self_test():
    stats = dict(minutes=20.0, points=12.0, assists=2.0, fieldGoalAttempts=10.0, freeThrowAttempts=0.0, turnovers=2.0)
    first = {"season": 2000, "games": 10, "stats": stats}
    second = {"season": 2001, "games": 20, "stats": {**stats, "minutes": 30.0, "points": 10.0}}
    baselines = {2000: season_rates([first]), 2001: season_rates([second])}
    equal = relative_peak([first, second], baselines)
    for field in ("shotEfficiencyRatio", "shotWorkloadRatio", "assistRateRatio", "usedWorkloadRatio"):
        assert math.isclose(equal[field], 1, abs_tol=1e-12)
    assert math.isclose(equal["trueShootingDelta"], 0, abs_tol=1e-12)
    assert math.isclose(equal["turnoverShareDelta"], 0, abs_tol=1e-12)
    stronger = relative_peak([{**first, "stats": {**stats, "points": 14.0}}, second], baselines)
    assert math.isclose(stronger["shotEfficiencyRatio"], 340 / 320)
    assert math.isclose(stronger["trueShootingDelta"], 20 / 600)
    missing = {**second, "stats": {**second["stats"], "turnovers": None}}
    incomplete = season_rates([first, missing])
    assert incomplete["turnoverShare"] is None and incomplete["trueShootingProxy"] is not None
    partial = relative_peak([first, missing], baselines)
    assert not partial["turnoverComparisonAvailable"] and partial["usedWorkloadRatio"] is None
    zero = season_rates([{**first, "stats": {**stats, "turnovers": 0.0}}])
    assert zero["turnoverShare"] == 0
    print("Era audit self-checks passed: exposure weighting, relative neutrality, missingness and zero.")


def build_report():
    audit_path = ROOT / "docs/MID_IQ_POSSESSION_INPUT_AUDIT_1.json"
    audit = json.loads(audit_path.read_text(encoding="utf-8"))
    assert audit["version"] == "mid-iq-possession-input-audit-1"
    for path, sha in audit["sourceSha256"].items():
        assert fingerprint(ROOT / path) == sha, f"Stale input audit source: {path}"
    assert fingerprint(ROOT / "scripts/data_pipeline/audit_possessions.py") == audit["auditImplementationSha256"]
    hashes = {**audit["sourceSha256"], "data/raw/Team Summaries.csv": fingerprint(ROOT / "data/raw/Team Summaries.csv"),
              "docs/MID_IQ_POSSESSION_INPUT_AUDIT_1.json": fingerprint(audit_path),
              "scripts/data_pipeline/audit_possessions.py": audit["auditImplementationSha256"]}
    selected_years = {row["season"] for player in audit["players"] for row in player["selected"]}
    grouped = defaultdict(list)
    seen = set()
    excluded_aggregate_rows = 0
    with (ROOT / "data/raw/Player Per Game.csv").open(encoding="utf-8", newline="") as source:
        for line, row in enumerate(csv.DictReader(source), 2):
            season = int(row["season"])
            if row["lg"] != "NBA" or season not in selected_years:
                continue
            if row["team"].endswith("TM") or row["team"] == "TOT":
                excluded_aggregate_rows += 1
                continue
            games = number(row["g"])
            assert games is not None
            if games == 0:
                continue
            key = (season, row["player_id"], row["team"])
            assert key not in seen, f"Duplicate NBA stint: {key}"
            seen.add(key)
            grouped[season].append({"games": games, "team": row["team"], "csvLine": line,
                                    "stats": {field: number(row[FIELDS[field]]) for field in CORE_FIELDS}})
    teams = defaultdict(dict)
    with (ROOT / "data/raw/Team Summaries.csv").open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source):
            season = int(row["season"])
            if row["lg"] != "NBA" or season not in selected_years:
                continue
            if row["team"] == "League Average":
                assert row["abbreviation"] == "NA"
                continue
            abbreviation = row["abbreviation"]
            assert abbreviation not in teams[season], f"Duplicate team-season: {season} {abbreviation}"
            teams[season][abbreviation] = row
    baselines = {}
    for season in sorted(selected_years):
        rows = grouped[season]
        assert rows and teams[season], f"Missing season coverage: {season}"
        actual_teams = {row["team"] for row in rows}
        assert actual_teams == set(teams[season]), f"Team coverage mismatch: {season}"
        result = season_rates(rows)
        regulation_minutes = 240 * sum(float(row["w"]) + float(row["l"]) for row in teams[season].values())
        result.update(season=season, playerTeamRows=len(rows), teams=len(actual_teams),
                      sourceCsvLines=[row["csvLine"] for row in rows],
                      regulationPlayerMinutes=regulation_minutes,
                      playerMinutesToRegulationRatio=result["totals"]["minutes"] / regulation_minutes if result["totals"]["minutes"] is not None else None,
                      teamTurnoverRateRows=sum(number(row["tov_percent"]) is not None for row in teams[season].values()))
        baselines[season] = result
    players = [{"id": player["id"], "peakYears": player["peakYears"],
                **relative_peak(player["selected"], baselines)} for player in audit["players"]]
    for path, sha in hashes.items():
        assert fingerprint(ROOT / path) == sha, f"Source changed during audit: {path}"
    return {"version": "mid-iq-era-baseline-audit-1", "scope": "offline-season-context-audit",
            "sourceSha256": hashes, "implementationSha256": fingerprint(Path(__file__)),
            "excludedAggregateRows": excluded_aggregate_rows, "seasonCount": len(baselines),
            "shootingComparablePlayers": sum(player["shotEfficiencyRatio"] is not None for player in players),
            "turnoverComparablePlayers": sum(player["turnoverComparisonAvailable"] for player in players),
            "seasons": list(baselines.values()), "players": players,
            "method": "Pool all NBA team-stint games times per-game values without rotation or draft-pool filters. Exclude TOT/nTM aggregates. Compare each frozen peak against its own seasons, weighting efficiency by shot events and workload by minutes.",
            "limitations": ["Player per-game rounding makes league totals approximate. Team sets and regulation-minute totals are cross-checks, not exact possession reconstruction.",
                            "Any missing league field makes that season's dependent metric unavailable; no complete-case subset or imputation.",
                            "0.44 FTA is an explicit proxy. Player turnovers omit team-only events; team turnover rates are coverage evidence only, not replacement values.",
                            "League means include the evaluated players. This is descriptive normalization, not independent prediction or causal era portability.",
                            "Workload and assist ratios describe observed activity, not maximum capacity, skill or a load-efficiency curve.",
                            "No new win predictions, parameter fit, changed peak selections, live ratings or validation families."]}


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
    output_path = Path(args.output)
    if output_path.exists():
        parser.error("Refusing to overwrite an existing era audit.")
    report = build_report()
    with output_path.open("x", encoding="utf-8") as output:
        json.dump(report, output, indent=2, allow_nan=False)
        output.write("\n")
    print(json.dumps({key: report[key] for key in ("version", "seasonCount", "excludedAggregateRows", "shootingComparablePlayers", "turnoverComparablePlayers")}, indent=2))
    for row in report["seasons"]:
        if row["season"] % 10 == 0 or row["season"] == report["seasons"][-1]["season"]:
            print(row["season"], {key: row[key] for key in ("trueShootingProxy", "shotEndsPer36", "turnoverShare", "playerMinutesToRegulationRatio")})


if __name__ == "__main__":
    main()