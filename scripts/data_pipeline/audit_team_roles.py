"""Lagged team-season turnover diagnostics, not a fitted or live lineup model."""
import argparse
import csv
import json
import math
import platform
from collections import defaultdict
from pathlib import Path

from audit_era_baselines import fingerprint
from audit_possessions import ROOT, FIELDS, number

SPLITS = {"shot-only": (1.0, 0.0), "half-fixed": (0.5, 0.0),
          "split-roles": (0.5, 0.5), "mixed-fixed": (0.25, 0.5)}
ALLOCATIONS = ("prior-roles", "observed-shares", "observed-passing-volume")
PROTOCOL = {
    "version": "team-role-protocol-1",
    "seasons": [1979, 2026],
    "reference": "Previous season league rates only; no target turnover rate enters predictions.",
    "priorPlayer": "Pool all positive-game NBA team stints in previous year, excluding TOT/nTM; require >=20 games and >=500 minutes.",
    "exposure": "Actual target team minutes supply player weights. Not a preseason forecast or observed five-player lineup.",
    "zeroMinutes": "Exclude zero-minute, zero-count target stints from allocation and list them; retain their games in prior-season eligibility. Reject nonzero counts at zero minutes.",
    "fallback": "League-average prior rates for missing/ineligible prior seasons; explicit modeled assumption, not raw-data imputation.",
    "coverage": "All teams and a predeclared >=90% target-minute coverage cohort; unsupported policies stay excluded and counted.",
    "splits": {name: {"shot": split[0], "passing": split[1]} for name, split in SPLITS.items()},
    "allocations": list(ALLOCATIONS),
    "prior-roles": "Prior rate times target minutes for both requested shares; fixed100 passing units.",
    "observed-shares": "Actual target shot/assist count shares, but fixed100 passing units. Outcome-conditioned diagnostic.",
    "observed-passing-volume": "Actual target shares and passing budget100*(target AST/min)/(prior league AST/min). Does not use target TOV.",
    "accounting": "Uncapped sequential passing then shots; 100 shot-plus-player-turnover proxy events. Passing units never score.",
    "target": "100*pooled player TOV/(FGA+0.44FTA+pooled player TOV); team-summary tov_percent is a separate rounded cross-check.",
    "baseline": "Previous league turnover share, identical for all teams in a target season.",
    "partitions": {"earlier": [1979, 2012], "later": [2013, 2026]},
    "selection": "No fitting, hyperparameter selection or roster-band evaluation. Later years are already-exposed source data, not fresh release validation.",
    "comparisons": "Equal-team paired MSE differences, normal1.96 intervals clustered by target season; no multiplicity correction.",
}


def estimate(players, reference, split, allocation):
    shot_fraction, pass_fraction = split
    assert allocation in ALLOCATIONS
    assert shot_fraction >= 0 and pass_fraction >= 0 and shot_fraction + pass_fraction <= 1
    assert all(math.isfinite(value) and value > 0 for value in reference.values())
    total_minutes = math.fsum(player["after"]["minutes"] for player in players)
    assert total_minutes > 0
    turnover_share = reference["turnovers"] / (reference["shots"] + reference["turnovers"])
    nominal = []
    for player in players:
        weight = player["after"]["minutes"] / total_minutes
        rates = player["priorRates"]
        assert all(math.isfinite(value) and value >= 0 for value in rates.values())
        nominal.append({"shots": 100 * weight * (1 - turnover_share) * rates["shots"] / reference["shots"],
                        "passing": 100 * weight * rates["assists"] / reference["assists"],
                        "turnovers": 100 * weight * turnover_share * rates["turnovers"] / reference["turnovers"]})
    if any(player["shots"] <= 0 for player in nominal):
        return {"status": "unsupported", "reason": "zero-prior-shot-exposure"}
    shot_weights = [player["shots"] for player in nominal] if allocation == "prior-roles" else [player["after"]["shots"] for player in players]
    pass_weights = [player["passing"] for player in nominal] if allocation == "prior-roles" else [player["after"]["assists"] for player in players]
    shot_sum, pass_sum = math.fsum(shot_weights), math.fsum(pass_weights)
    if shot_sum <= 0 or pass_sum <= 0:
        return {"status": "unsupported", "reason": "empty-role-demand"}
    if any(player["passing"] == 0 and (pass_weights[index] > 0 or pass_fraction * player["turnovers"] > 0)
           for index, player in enumerate(nominal)):
        return {"status": "unsupported", "reason": "zero-prior-passing-exposure"}
    passing_budget = 100.0 if allocation != "observed-passing-volume" else (
        100 * math.fsum(player["after"]["assists"] for player in players) / total_minutes / reference["assists"])
    fixed = math.fsum((1 - shot_fraction - pass_fraction) * player["turnovers"] for player in nominal)
    passing = math.fsum(pass_fraction * player["turnovers"] * passing_budget * pass_weights[index] / pass_sum / player["passing"]
                        if player["passing"] > 0 else 0 for index, player in enumerate(nominal))
    available = 100 - fixed - passing
    if not math.isfinite(available) or available < 0:
        return {"status": "unsupported", "reason": "passing-cost-exceeds-event-budget"}
    cost = math.fsum(shot_weights[index] / shot_sum * (1 + shot_fraction * player["turnovers"] / player["shots"])
                     for index, player in enumerate(nominal))
    shots = available / cost
    shot_turnovers = math.fsum(shots * shot_weights[index] / shot_sum * shot_fraction * player["turnovers"] / player["shots"]
                              for index, player in enumerate(nominal))
    turnovers = fixed + passing + shot_turnovers
    assert math.isclose(shots + turnovers, 100, abs_tol=1e-10)
    assert all(math.isfinite(value) and value >= 0 for value in (shots, turnovers, passing_budget))
    return {"status": "evaluated", "turnoverEnds": turnovers, "shotEnds": shots,
            "passingBudget": passing_budget, "fixedTurnovers": fixed,
            "shotLinkedTurnovers": shot_turnovers, "passingLinkedTurnovers": passing}


def self_test():
    reference = {"shots": 0.44, "assists": 0.1, "turnovers": 0.06}
    players = [{"priorRates": dict(reference), "after": {"minutes": 20.0, "shots": 8.8, "assists": 2.0, "turnovers": 1.2}}
               for _ in range(5)]
    for split in SPLITS.values():
        for allocation in ALLOCATIONS:
            result = estimate(players, reference, split, allocation)
            assert math.isclose(result["turnoverEnds"], 12, abs_tol=1e-10)
            changed = [{**player, "after": {**player["after"], "turnovers": 999}} for player in players]
            assert result == estimate(changed, reference, split, allocation)
            assert result == estimate(list(reversed(players)), reference, split, allocation)
    more_assists = [{**player, "after": {**player["after"], "assists": 4.0}} for player in players]
    fixed = estimate(more_assists, reference, SPLITS["split-roles"], "observed-shares")
    volume = estimate(more_assists, reference, SPLITS["split-roles"], "observed-passing-volume")
    assert math.isclose(fixed["turnoverEnds"], 12, abs_tol=1e-10)
    assert volume["passingBudget"] == 200 and volume["turnoverEnds"] > fixed["turnoverEnds"]
    assert estimate(more_assists, reference, SPLITS["shot-only"], "observed-shares") == estimate(players, reference, SPLITS["shot-only"], "observed-shares")
    zeros = [{**player, "priorRates": {**reference, "assists": 0}} for player in players]
    assert estimate(zeros, reference, SPLITS["split-roles"], "observed-shares")["status"] == "unsupported"
    large = [{**player, "after": {**player["after"], "assists": 1000}} for player in players]
    assert estimate(large, reference, SPLITS["split-roles"], "observed-passing-volume")["reason"] == "passing-cost-exceeds-event-budget"
    measured = metrics([1, 3], [2, 1])
    assert measured == {"teams": 2, "bias": -0.5, "mae": 1.5, "rmse": math.sqrt(2.5)}
    comparison = paired([{"season": 2000, "targetTurnoverEnds": 0}, {"season": 2001, "targetTurnoverEnds": 0}], [1, 2], [0, 0])
    assert comparison["meanSquaredErrorDifference"] == 2.5
    assert comparison["interval95"] == [2.5 - 1.96 * 1.5, 2.5 + 1.96 * 1.5]
    assert comparison["seasonClusters"] == 2
    print("Team-role self-checks passed: neutral accounting, target isolation, permutation, volume sensitivity, unsupported costs and clustered metrics.")


def load_teams():
    source_path = ROOT / "docs/MID_IQ_ROLE_ALLOCATION_1.json"
    source = json.loads(source_path.read_text(encoding="utf-8"))
    assert source["version"] == "mid-iq-role-allocation-1"
    hashes = {**source["sourceSha256"], "docs/MID_IQ_ROLE_ALLOCATION_1.json": fingerprint(source_path),
              "src/engine/role-allocation.ts": source["implementationSha256"],
              "src/engine/calibrate-roles.ts": source["evaluatorSha256"]}
    for path, expected in hashes.items():
        assert fingerprint(ROOT / path) == expected, f"Stale team-role source: {path}"
    era = json.loads((ROOT / "docs/MID_IQ_ERA_BASELINE_AUDIT_1.json").read_text(encoding="utf-8"))
    references = {}
    for season in era["seasons"]:
        if season["season"] < 1978:
            continue
        totals = season["totals"]
        references[season["season"]] = {
            "shots": (totals["fieldGoalAttempts"] + 0.44 * totals["freeThrowAttempts"]) / totals["minutes"],
            "assists": totals["assists"] / totals["minutes"], "turnovers": totals["turnovers"] / totals["minutes"]}
    player_seasons, team_seasons = defaultdict(list), defaultdict(list)
    zero_minute_stints = []
    seen = set()
    with (ROOT / "data/raw/Player Per Game.csv").open(encoding="utf-8", newline="") as handle:
        for line, row in enumerate(csv.DictReader(handle), 2):
            season = int(row["season"])
            if row["lg"] != "NBA" or not 1978 <= season <= 2026 or row["team"] == "TOT" or row["team"].endswith("TM"):
                continue
            games = number(row["g"])
            assert games is not None
            if games == 0:
                continue
            key = (season, row["team"], row["player_id"])
            assert key not in seen, f"Duplicate stint: {key}"
            seen.add(key)
            values = {field: number(row[FIELDS[field]]) for field in ("minutes", "assists", "turnovers", "fieldGoalAttempts", "freeThrowAttempts")}
            assert all(value is not None for value in values.values()), f"Missing modern stint input: {key}"
            totals = {field: games * values[field] for field in ("minutes", "assists", "turnovers")}
            totals["shots"] = games * (values["fieldGoalAttempts"] + 0.44 * values["freeThrowAttempts"])
            stint = {"playerId": row["player_id"], "team": row["team"], "csvLine": line, "games": games, **totals}
            player_seasons[(season, row["player_id"])].append(stint)
            if totals["minutes"] == 0:
                assert all(totals[field] == 0 for field in ("shots", "assists", "turnovers")), f"Nonzero counts at zero minutes: {key}"
                zero_minute_stints.append({"season": season, **stint})
                continue
            team_seasons[(season, row["team"])].append(stint)
    summaries = {}
    with (ROOT / "data/raw/Team Summaries.csv").open(encoding="utf-8", newline="") as handle:
        for line, row in enumerate(csv.DictReader(handle), 2):
            if row["lg"] == "NBA" and 1979 <= int(row["season"]) <= 2026 and row["team"] != "League Average":
                key = (int(row["season"]), row["abbreviation"])
                assert key not in summaries
                summaries[key] = {"csvLine": line, "turnoverPercent": number(row["tov_percent"])}
    assert set(summaries) == {key for key in team_seasons if key[0] >= 1979}
    rows = []
    for (season, team), stints in sorted(team_seasons.items()):
        if season < 1979:
            continue
        reference = references[season - 1]
        players = []
        for stint in sorted(stints, key=lambda row: row["playerId"]):
            prior = player_seasons.get((season - 1, stint["playerId"]), [])
            prior_minutes = math.fsum(row["minutes"] for row in prior)
            prior_games = math.fsum(row["games"] for row in prior)
            eligible = prior_minutes >= 500 and prior_games >= 20
            rates = {field: math.fsum(row[field] for row in prior) / prior_minutes for field in reference} if eligible else dict(reference)
            players.append({"playerId": stint["playerId"], "afterCsvLine": stint["csvLine"],
                            "priorCsvLines": [row["csvLine"] for row in prior], "priorMinutes": prior_minutes, "priorGames": prior_games,
                            "fallback": None if eligible else "no-prior-season" if not prior else "insufficient-prior-exposure",
                            "priorRates": rates, "after": {field: stint[field] for field in ("minutes", "shots", "assists", "turnovers")}})
        totals = {field: math.fsum(player["after"][field] for player in players) for field in ("minutes", "shots", "assists", "turnovers")}
        covered = math.fsum(player["after"]["minutes"] for player in players if player["fallback"] is None) / totals["minutes"]
        scenarios = {f"{name}:{allocation}": estimate(players, reference, split, allocation)
                     for name, split in SPLITS.items() for allocation in ALLOCATIONS}
        rows.append({"season": season, "team": team, "reference": reference, "players": players, "totals": totals,
                     "priorMinuteCoverage": covered, "targetTurnoverEnds": 100 * totals["turnovers"] / (totals["shots"] + totals["turnovers"]),
                     "leaguePrediction": 100 * reference["turnovers"] / (reference["shots"] + reference["turnovers"]),
                     "teamSummary": summaries[(season, team)], "scenarios": scenarios})
    return rows, hashes, zero_minute_stints


def metrics(actual, predictions):
    errors = [prediction - target for prediction, target in zip(predictions, actual, strict=True)]
    assert errors
    return {"teams": len(errors), "bias": math.fsum(errors) / len(errors),
            "mae": math.fsum(abs(error) for error in errors) / len(errors),
            "rmse": math.sqrt(math.fsum(error * error for error in errors) / len(errors))}


def paired(rows, first, second):
    differences = [(prediction - row["targetTurnoverEnds"]) ** 2 - (baseline - row["targetTurnoverEnds"]) ** 2
                   for row, prediction, baseline in zip(rows, first, second, strict=True)]
    mean = math.fsum(differences) / len(rows)
    groups = defaultdict(list)
    for row, difference in zip(rows, differences, strict=True):
        groups[row["season"]].append(difference - mean)
    clusters = len(groups)
    assert clusters > 1
    variance = clusters / (clusters - 1) * math.fsum(math.fsum(values) ** 2 for values in groups.values()) / len(rows) ** 2
    radius = 1.96 * math.sqrt(variance)
    return {"meanSquaredErrorDifference": mean, "interval95": [mean - radius, mean + radius], "seasonClusters": clusters}


def summarize(rows):
    result = {}
    for period, (first, last) in PROTOCOL["partitions"].items():
        for coverage in ("all", "at-least-90-percent"):
            selected = [row for row in rows if first <= row["season"] <= last
                        and (coverage == "all" or row["priorMinuteCoverage"] >= 0.9)]
            common = [row for row in selected if all(scenario["status"] == "evaluated" for scenario in row["scenarios"].values())]
            predictions = {"league": [row["leaguePrediction"] for row in common]}
            predictions.update({key: [row["scenarios"][key]["turnoverEnds"] for row in common] for key in common[0]["scenarios"]})
            actual = [row["targetTurnoverEnds"] for row in common]
            models = {name: metrics(actual, values) for name, values in predictions.items()}
            comparisons = {f"{name}-minus-league": paired(common, values, predictions["league"])
                           for name, values in predictions.items() if name != "league"}
            for split in SPLITS:
                for candidate, baseline in (("observed-shares", "prior-roles"), ("observed-passing-volume", "observed-shares")):
                    comparisons[f"{split}:{candidate}-minus-{baseline}"] = paired(common, predictions[f"{split}:{candidate}"], predictions[f"{split}:{baseline}"])
            for allocation in ALLOCATIONS:
                comparisons[f"split-roles-minus-shot-only:{allocation}"] = paired(common, predictions[f"split-roles:{allocation}"], predictions[f"shot-only:{allocation}"])
            result[f"{period}:{coverage}"] = {"eligibleTeams": len(selected), "commonTeams": len(common),
                                             "unsupportedTeams": len(selected) - len(common), "models": models, "comparisons": comparisons}
    return result


def build_report():
    rows, hashes, zero_minute_stints = load_teams()
    unsupported = defaultdict(int)
    for row in rows:
        for scenario in row["scenarios"].values():
            if scenario["status"] != "evaluated":
                unsupported[scenario["reason"]] += 1
    measured = [row for row in rows if row["teamSummary"]["turnoverPercent"] is not None]
    report = {"version": "mid-iq-team-role-study-1", "scope": "lagged-team-season-budget-diagnostics", "protocol": PROTOCOL,
              "runtime": {"python": platform.python_version()}, "sourceSha256": hashes,
              "implementationSha256": fingerprint(Path(__file__)), "teamSeasons": len(rows),
              "zeroMinuteStints": zero_minute_stints,
              "unsupportedScenarios": dict(sorted(unsupported.items())), "rows": rows, "evaluations": summarize(rows),
              "teamSummaryCrossCheck": metrics([row["teamSummary"]["turnoverPercent"] for row in measured],
                                                [row["targetTurnoverEnds"] for row in measured]),
              "limitations": [
                  "Season aggregates are not observed five-player units. Actual target minutes and, in two diagnostics, target shots/assists are conditioned on.",
                  "No target turnovers or target-season league turnovers enter player rates, references, requested allocations or budgets.",
                  "Fallback is explicit league-average modeled exposure; high-coverage teams still contain up to10% fallback minutes and can be selected nonrandomly.",
                  "Uncapped transport can imply unsustainable individual roles. Zero prior passing/shot exposures and excessive costs remain unsupported, not repaired.",
                  "Player per-game rounding, team-only turnovers and proxy0.44FTA prevent exact team-summary reconciliation; no possession-level labels.",
                  "Observed passing volume tests a different per-minute target, not an empirically established passing budget or causal response.",
                  "Later-season data were already exposed by prior studies. No tuned winner, new validation families, live changes or full-game claims."]}
    for path, expected in hashes.items():
        assert fingerprint(ROOT / path) == expected, f"Source changed during team-role study: {path}"
    return report


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
        parser.error("Refusing to overwrite an existing team-role study.")
    report = build_report()
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(report, handle, indent=2, allow_nan=False)
        handle.write("\n")
    print(json.dumps({"teamSeasons": report["teamSeasons"], "unsupportedScenarios": report["unsupportedScenarios"],
                      "teamSummaryCrossCheck": report["teamSummaryCrossCheck"],
                      "later": report["evaluations"]["later:at-least-90-percent"]}, indent=2))


if __name__ == "__main__":
    main()