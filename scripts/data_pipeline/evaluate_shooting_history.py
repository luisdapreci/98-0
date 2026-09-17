"""Fixed lagged shooting-history experiment with unchanged possession allocation."""
import argparse
import csv
import json
from research_files import parse_research_json
import math
from collections import defaultdict
from pathlib import Path

from audit_era_baselines import fingerprint
from audit_possessions import ROOT, FIELDS, number
from audit_team_offense import paired
from audit_team_roles import metrics
from diagnose_possession_offense import project, score, PERIODS

WEIGHTS = (1.0, 0.5, 0.25)
PRIOR_SHOTS = 500.0
METHODS = ("frozen", "singleShrunk", "multiPooled", "multiShrunk")
PROTOCOL = {
    "version": "shooting-history-protocol-1",
    "scope": "One fixed offline shooting-component experiment. No lineup, turnover, rebound, benchmark, live-rule or coefficient fitting changes.",
    "history": "Previous three NBA seasons only, pooled non-TOT/non-nTM stints by identity. Raw PTS and FGA+0.44FTA totals; no target production, season-gap bridging or era adjustment.",
    "recencyWeights": list(WEIGHTS), "priorEquivalentShots": PRIOR_SHOTS,
    "formula": "multiPooled=sum(weight*PTS)/sum(weight*shotEvents); multiShrunk=(sum(weight*PTS)+500*priorLeagueEfficiency)/(sum(weight*shotEvents)+500).",
    "prior": "Previous season all-NBA pooled PTS/shotEvents. Includes the player's own prior data; no target-season league efficiency is used.",
    "controls": "Frozen one-season rates; singleShrunk uses only last season with the same 500-shot prior; multiPooled has no shrinkage. No grid search or later-result adjustment.",
    "sampleSize": "Effective exposure=sum(recencyWeight*shotEvents), a discount-weighted pseudo-count, not a formal independent-sample size. Shrink weight=exposure/(exposure+500).",
    "eligibility": "Update only players eligible under the frozen previous-season >=20 games/500 minutes rule. Preserve original fallback for everyone else. Older positive-game stints contribute without a second eligibility filter.",
    "projection": "Change only PTS/min to frozen shotEvents/min times estimated efficiency. Preserve FGA, FTA, TOV, ORB, all target-minute weights, top-five identities and whole-roster aggregation.",
    "primary": "multiShrunk minus frozen: later2013-2026 wholeRoster all-team centered official-ORTG MSE; report paired season-cluster interval. This is previously exposed temporal evaluation, not fresh validation.",
    "secondary": "Raw shooting-efficiency errors, topFive representation, >=90% coverage, earlier1981-2012, laterEarly2013-2019 and laterRecent2020-2026; controls isolate history pooling and shrinkage.",
    "centering": "Subtract full equal-team model-prediction season mean before selecting cohorts, identical to frozen prototype; no scoring outcomes used for centering.",
    "uncertainty": "Normal95% season-cluster paired MSE intervals; no multiplicity correction. Secondary intervals exploratory, particularly seven-season splits.",
    "stop": "Report fixed comparisons. No refit, parameter selection, automatic gameplay integration or release claim.",
}


def load_history():
    players, league = defaultdict(list), defaultdict(list)
    seen = set()
    with (ROOT / "data/raw/Player Per Game.csv").open(encoding="utf-8", newline="") as handle:
        for line, raw in enumerate(csv.DictReader(handle), 2):
            season = int(raw["season"])
            if raw["lg"] != "NBA" or not 1978 <= season <= 2025 or raw["team"] == "TOT" or raw["team"].endswith("TM"):
                continue
            games = number(raw["g"])
            assert games is not None
            if games == 0:
                continue
            key = (season, raw["player_id"], raw["team"])
            assert key not in seen
            seen.add(key)
            values = {field: number(raw[FIELDS[field]]) for field in ("minutes", "points", "fieldGoalAttempts", "freeThrowAttempts")}
            assert all(value is not None for value in values.values()), f"Missing shooting history at {line}"
            entry = {"season": season, "csvLine": line, "games": games, "minutes": games * values["minutes"],
                     "points": games * values["points"], "shots": games * (values["fieldGoalAttempts"] + 0.44 * values["freeThrowAttempts"])}
            if entry["minutes"] == 0:
                assert entry["points"] == entry["shots"] == 0
            players[(season, raw["player_id"])].append(entry)
            league[season].append(entry)
    baselines = {season: math.fsum(entry["points"] for entry in entries) / math.fsum(entry["shots"] for entry in entries)
                 for season, entries in league.items()}
    return players, baselines


def estimate(player_id, season, history, reference):
    selected = [{**entry, "weight": weight} for lag, weight in enumerate(WEIGHTS, 1)
                for entry in history.get((season - lag, player_id), [])]
    assert all(season - 3 <= entry["season"] < season for entry in selected)
    recent = [entry for entry in selected if entry["season"] == season - 1]
    shots = math.fsum(entry["shots"] * entry["weight"] for entry in selected)
    points = math.fsum(entry["points"] * entry["weight"] for entry in selected)
    recent_shots = math.fsum(entry["shots"] for entry in recent)
    recent_points = math.fsum(entry["points"] for entry in recent)
    assert recent_shots > 0 and shots >= recent_shots and reference > 0
    values = {"frozen": recent_points / recent_shots,
              "singleShrunk": (recent_points + PRIOR_SHOTS * reference) / (recent_shots + PRIOR_SHOTS),
              "multiPooled": points / shots,
              "multiShrunk": (points + PRIOR_SHOTS * reference) / (shots + PRIOR_SHOTS)}
    assert all(math.isfinite(value) and value >= 0 for value in values.values())
    return {"efficiencies": values, "weightedShots": shots, "recentShots": recent_shots,
            "dataWeight": shots / (shots + PRIOR_SHOTS), "priorLeagueEfficiency": reference,
            "history": selected}


def replace_shooting(players, estimates, method):
    result = []
    for player in players:
        rates = dict(player["rates"])
        if not player["fallback"] and method != "frozen":
            shots = rates["fieldGoalAttempts"] + 0.44 * rates["freeThrowAttempts"]
            rates["points"] = shots * estimates[player["id"]]["efficiencies"][method]
        result.append({**player, "rates": rates})
    return result


def self_test():
    entry = {"season": 2000, "shots": 100.0, "points": 120.0}
    history = {(2000, "player"): [entry], (1999, "player"): [{**entry, "season": 1999, "points": 80.0}]}
    measured = estimate("player", 2001, history, 1.0)
    assert math.isclose(measured["efficiencies"]["multiPooled"], 160 / 150)
    assert math.isclose(measured["efficiencies"]["multiShrunk"], 660 / 650)
    assert 1 < measured["efficiencies"]["singleShrunk"] < measured["efficiencies"]["frozen"]
    contaminated = {**history, (2001, "player"): [{**entry, "season": 2001, "points": 99999}],
                    (1997, "player"): [{**entry, "season": 1997, "points": 99999}]}
    assert estimate("player", 2001, contaminated, 1.0) == measured
    large = {(2000, "player"): [{**entry, "shots": 10000, "points": 12000}]}
    assert estimate("player", 2001, large, 1.0)["efficiencies"]["singleShrunk"] > measured["efficiencies"]["singleShrunk"]
    rates = dict(points=0.6, fieldGoalAttempts=0.5, freeThrowAttempts=0, turnovers=0.05, offensiveRebounds=0.04)
    players = [{"id": str(index), "minutes": 100, "rates": dict(rates), "fallback": index == 0} for index in range(5)]
    estimates = {player["id"]: measured for player in players if not player["fallback"]}
    original = json.dumps(players, sort_keys=True)
    changed = replace_shooting(players, estimates, "multiShrunk")
    assert changed[0] == players[0] and json.dumps(players, sort_keys=True) == original
    for before, after in zip(players, changed, strict=True):
        assert {key: value for key, value in before["rates"].items() if key != "points"} == {
            key: value for key, value in after["rates"].items() if key != "points"}
    for model in ("topFive", "wholeRoster"):
        before, net_before = project(players, model)
        after, net_after = project(changed, model)
        assert net_before == net_after and before["turnovers"] == after["turnovers"] and before["rebounds"] == after["rebounds"]
    print("Passed weighted pooling, shrinkage/exposure response, future-data isolation, fixed fallbacks, unchanged allocation and input immutability.")


def summarize(rows):
    comparisons = (("singleShrunk", "frozen"), ("multiPooled", "frozen"), ("multiShrunk", "frozen"),
                   ("multiShrunk", "multiPooled"), ("multiShrunk", "singleShrunk"))
    result = {}
    for outcome, predictions, target in (("teamOffense", "predictions", "target"), ("shooting", "shooting", "observedShooting")):
        actual = [row[target] for row in rows]
        series = {name: [row[predictions][name] for row in rows] for name in METHODS}
        paired_rows = [{"season": row["season"], "target": row[target]} for row in rows]
        result[outcome] = {"models": {name: metrics(actual, values) for name, values in series.items()},
                           "comparisons": {f"{candidate}-minus-{baseline}": paired(paired_rows, series[candidate], series[baseline])
                                           for candidate, baseline in comparisons}}
    return {"teams": len(rows), **result}


def build_report():
    history_path = "docs/research/mid-iq/MID_IQ_HISTORICAL_TEAM_OFFENSE_1.json"
    diagnostic_path = "docs/research/mid-iq/MID_IQ_POSSESSION_ERROR_DIAGNOSTIC_1.json"
    history = parse_research_json((ROOT / history_path).read_text(encoding="utf-8"))
    diagnostic = parse_research_json((ROOT / diagnostic_path).read_text(encoding="utf-8"))
    assert history["version"] == "mid-iq-historical-team-offense-1"
    assert diagnostic["version"] == "mid-iq-possession-error-diagnostic-1"
    hashes = {**diagnostic["sourceSha256"], diagnostic_path: fingerprint(ROOT / diagnostic_path),
              "scripts/data_pipeline/diagnose_possession_offense.py": diagnostic["implementationSha256"]}
    for path, expected in hashes.items():
        assert fingerprint(ROOT / path) == expected, f"Stale source: {path}"
    source_history, baselines = load_history()
    frozen = {(row["season"], row["team"], row["model"]): row for row in diagnostic["rows"]}
    estimates, rows = {}, []
    for source in history["rows"]:
        season = source["season"]
        player_estimates = {}
        for player in source["players"]:
            if player["fallback"]:
                continue
            key = f"{season}:{player['id']}"
            if key not in estimates:
                estimates[key] = {"season": season, "id": player["id"], **estimate(player["id"], season, source_history, baselines[season - 1])}
            measured = estimates[key]
            recent = [entry for entry in measured["history"] if entry["season"] == season - 1]
            assert sorted(entry["csvLine"] for entry in recent) == sorted(player["priorCsvLines"])
            assert math.fsum(entry["games"] for entry in recent) >= 20 and math.fsum(entry["minutes"] for entry in recent) >= 500
            rates = player["rates"]
            assert math.isclose(measured["efficiencies"]["frozen"], rates["points"] / (rates["fieldGoalAttempts"] + 0.44 * rates["freeThrowAttempts"]), abs_tol=1e-10)
            player_estimates[player["id"]] = measured
        for model in ("topFive", "wholeRoster"):
            control = frozen[(season, source["team"], model)]
            raw, shooting = {}, {}
            for method in METHODS:
                revised = replace_shooting(source["players"], player_estimates, method)
                ratios, net = project(revised, model)
                assert math.isclose(75 / net, control["fixedWorkload"], abs_tol=1e-10)
                for field in ("turnovers", "rebounds"):
                    assert ratios[field] == control["projected"][field]
                raw[method], shooting[method] = score(ratios), ratios["shooting"]
                if method == "frozen":
                    assert ratios == control["projected"]
            rows.append({"season": season, "team": source["team"], "model": model, "coverage": source["priorMinuteCoverage"],
                         "target": control["target"], "observedShooting": control["observed"]["shooting"],
                         "frozenPrediction": control["prediction"], "fixedWorkload": control["fixedWorkload"],
                         "raw": raw, "shooting": shooting,
                         "estimateKeys": [f"{season}:{player['id']}" for player in source["players"] if not player["fallback"]]})
    groups = defaultdict(list)
    for row in rows:
        groups[(row["season"], row["model"])].append(row)
    for group in groups.values():
        means = {name: math.fsum(row["raw"][name] for row in group) / len(group) for name in METHODS}
        for row in group:
            row["predictions"] = {name: row["raw"][name] - means[name] for name in METHODS}
            assert math.isclose(row["predictions"]["frozen"], row["frozenPrediction"], abs_tol=1e-9)
    evaluations = {}
    for period, (first, last) in PERIODS.items():
        for model in ("topFive", "wholeRoster"):
            for cohort in ("all", "coverage90"):
                selected = [row for row in rows if first <= row["season"] <= last and row["model"] == model
                            and (cohort == "all" or row["coverage"] >= 0.9)]
                evaluations[f"{period}:{model}:{cohort}"] = summarize(selected)
    for path, expected in hashes.items():
        assert fingerprint(ROOT / path) == expected, f"Changed source: {path}"
    return {"version": "mid-iq-shooting-history-1", "protocol": PROTOCOL,
            "sourceSha256": hashes, "implementationSha256": fingerprint(Path(__file__)),
            "teamSeasons": len(history["rows"]), "playerSeasonEstimates": len(estimates),
            "evaluations": evaluations, "rows": rows, "estimates": estimates,
            "limitations": ["Fixed decay and 500-shot pseudo-count are hypotheses, not estimated optimal values or a calibrated Bayesian posterior.",
                            "Past shooting pools changing roles and shot mixes without age or injury adjustments. League prior is not role-specific; temporal era shifts are not removed.",
                            "Frozen eligibility means this does not test replacing missing historical game inputs or using older history to rescue ineligible players.",
                            "Actual target minutes and synthetic top-five/whole-roster units remain assumptions. No benchmark predictions, roster acceptance, win conversion or live changes.",
                            "Later seasons are previously exposed data; repeated research and secondary comparisons limit independent evidential strength. 2026 evaluated as stored."]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output", nargs="?")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    self_test()
    if args.self_test:
        return
    if not args.output or Path(args.output).exists():
        parser.error("Provide a new unused output path.")
    report = build_report()
    with Path(args.output).open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(report, handle, indent=2, allow_nan=False)
        handle.write("\n")
    print(json.dumps({"teamSeasons": report["teamSeasons"], "playerSeasonEstimates": report["playerSeasonEstimates"],
                      "primary": report["evaluations"]["later:wholeRoster:all"]}, indent=2))


if __name__ == "__main__":
    main()