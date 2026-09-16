"""Lagged player-input validation against team offense, not game-engine fitting."""
import argparse
import csv
import json
import math
import platform
from collections import defaultdict
from pathlib import Path

import numpy as np

from audit_era_baselines import fingerprint
from audit_possessions import ROOT, FIELDS, number
from predict_offense import fit_ridge, predict
from audit_team_roles import metrics

COUNTS = ("points", "fieldGoals", "fieldGoalAttempts", "freeThrowAttempts", "assists",
          "turnovers", "offensiveRebounds", "threePointAttempts")
PROFILE = ["shootingEfficiency", "shotWorkload", "turnoverRate", "offensiveReboundRate", "threePointRate"]
MODELS = {"combinedIndex": ["combinedIndex"], "separateCreation": ["separateCreation"],
          "profile": PROFILE, "profileAndCreation": PROFILE + ["assistRate", "leadAssists", "leadScoring"]}
PROTOCOL = {
    "version": "historical-team-offense-1", "years": [1981, 2026], "trainingLastSeason": 2012,
    "coverageBoundary": "Prior inputs start in 1980, the first NBA three-point season; 1979/1980 targets excluded before fitting, rather than zero-filling missing prior 3PA.",
    "target": "Team o_rtg minus same-season equal-team mean o_rtg. Current league mean defines labels only.",
    "playerInputs": "Previous-season NBA non-TOT/non-nTM stints pooled by player; >=20 games and >=500 minutes.",
    "exposure": "Actual target-team minutes weight profiles and choose five highest-minute players; target scoring/assists never enter features.",
    "fallback": "Prior-season pooled league per-minute rates for missing/ineligible players; coverage recorded by target minutes.",
    "indices": "Top-five prior per36 PTS and AST adjusted by 100/prior equal-team mean pace. FG% from pooled makes/attempts. No coaches or benchmark records.",
    "combinedIndex": "0.2 mean(PTS*FG%+AST) + 0.8 top3mean(PTS*FG%+AST).",
    "separateCreation": "0.2 mean(PTS*FG%) + 0.8 top3mean(PTS*FG%) + 0.6 max(AST) + 0.4 mean(AST).",
    "profiles": "All-roster target-minute-weighted prior rates: PTS/(FGA+0.44FTA) relative to prior league; shot/turnover/ORB/3PA/AST per36; top-five lead AST and PTS*FG%.",
    "fit": "Fixed ridge alpha=1; training-only standardization and intercept using existing predict_offense helpers; no tuning.",
    "baselines": "Training mean and previous same-abbreviation team's relative o_rtg, with zero for expansion/missing history.",
    "evaluation": "Equal-team metrics; all teams and >=90% prior-minute coverage; later periods 2013-2026, 2013-2019, 2020-2026.",
    "comparisons": "Paired squared-error differences with season-cluster normal 95% intervals; no multiplicity correction.",
    "isolation": "No roster benchmarks, game outcomes, fitted roster parameters or target player production used as predictors.",
    "exposureWarning": "Later raw seasons were exposed in prior studies; temporal holdout from this fit is not fresh independent validation.",
}


def core(values):
    assert len(values) == 5
    return 0.2 * math.fsum(values) / 5 + 0.8 * math.fsum(sorted(values, reverse=True)[:3]) / 3


def features_for(players, reference, pace):
    total_minutes = math.fsum(player["minutes"] for player in players)
    rates = {field: math.fsum(player["minutes"] * player["rates"][field] for player in players) / total_minutes
             for field in COUNTS}
    leaders = sorted(players, key=lambda player: (-player["minutes"], player["id"]))[:5]
    factor = 36 * 100 / pace
    scoring = [player["rates"]["points"] * factor * player["rates"]["fieldGoals"]
               / player["rates"]["fieldGoalAttempts"] if player["rates"]["fieldGoalAttempts"] > 0 else 0 for player in leaders]
    assists = [player["rates"]["assists"] * factor for player in leaders]
    shots = rates["fieldGoalAttempts"] + 0.44 * rates["freeThrowAttempts"]
    reference_shots = reference["fieldGoalAttempts"] + 0.44 * reference["freeThrowAttempts"]
    assert shots > 0 and reference_shots > 0
    return {"combinedIndex": core([score + assist for score, assist in zip(scoring, assists, strict=True)]),
            "separateCreation": core(scoring) + 0.6 * max(assists) + 0.4 * math.fsum(assists) / 5,
            "shootingEfficiency": rates["points"] / shots - reference["points"] / reference_shots,
            "shotWorkload": shots * factor, "turnoverRate": rates["turnovers"] * factor,
            "offensiveReboundRate": rates["offensiveRebounds"] * factor,
            "threePointRate": rates["threePointAttempts"] * factor,
            "assistRate": rates["assists"] * factor, "leadAssists": max(assists), "leadScoring": max(scoring)}


def load_rows():
    summaries, season_offense, season_pace = {}, defaultdict(list), defaultdict(list)
    with (ROOT / "data/raw/Team Summaries.csv").open(encoding="utf-8", newline="") as handle:
        for raw in csv.DictReader(handle):
            season = int(raw["season"])
            if raw["lg"] != "NBA" or not 1980 <= season <= 2026 or raw["team"] == "League Average":
                continue
            offense, pace = number(raw["o_rtg"]), number(raw["pace"])
            assert offense is not None and pace is not None and pace > 0
            key = (season, raw["abbreviation"])
            assert key not in summaries
            summaries[key] = offense
            season_offense[season].append(offense)
            season_pace[season].append(pace)
    relative = {key: value - math.fsum(season_offense[key[0]]) / len(season_offense[key[0]])
                for key, value in summaries.items()}
    player_seasons, team_seasons, league = defaultdict(list), defaultdict(list), defaultdict(list)
    seen, zero_minutes = set(), 0
    with (ROOT / "data/raw/Player Per Game.csv").open(encoding="utf-8", newline="") as handle:
        for line, raw in enumerate(csv.DictReader(handle), 2):
            season = int(raw["season"])
            if raw["lg"] != "NBA" or not 1980 <= season <= 2026 or raw["team"] == "TOT" or raw["team"].endswith("TM"):
                continue
            games = number(raw["g"])
            assert games is not None
            if games == 0:
                continue
            values = {field: number(raw[FIELDS[field]]) for field in ("minutes",) + COUNTS}
            assert all(value is not None for value in values.values()), f"Missing input at CSV line {line}"
            key = (season, raw["team"], raw["player_id"])
            assert key not in seen
            seen.add(key)
            stint = {"id": raw["player_id"], "line": line, "games": games,
                     **{field: games * value for field, value in values.items()}}
            player_seasons[(season, raw["player_id"])].append(stint)
            league[season].append(stint)
            if stint["minutes"] == 0:
                assert all(stint[field] == 0 for field in COUNTS)
                zero_minutes += 1
            else:
                team_seasons[(season, raw["team"])].append(stint)
    assert {key for key in summaries if key[0] >= 1981} == {key for key in team_seasons if key[0] >= 1981}
    rows = []
    for (season, team), stints in sorted(team_seasons.items()):
        if season < 1981:
            continue
        league_minutes = math.fsum(stint["minutes"] for stint in league[season - 1])
        reference = {field: math.fsum(stint[field] for stint in league[season - 1]) / league_minutes for field in COUNTS}
        players = []
        for stint in stints:
            prior = player_seasons.get((season - 1, stint["id"]), [])
            minutes = math.fsum(entry["minutes"] for entry in prior)
            games = math.fsum(entry["games"] for entry in prior)
            eligible = minutes >= 500 and games >= 20
            rates = {field: math.fsum(entry[field] for entry in prior) / minutes for field in COUNTS} if eligible else dict(reference)
            players.append({"id": stint["id"], "minutes": stint["minutes"], "rates": rates,
                            "fallback": not eligible, "targetCsvLine": stint["line"], "priorCsvLines": [entry["line"] for entry in prior]})
        assert len(players) >= 5
        coverage = math.fsum(player["minutes"] for player in players if not player["fallback"]) / math.fsum(player["minutes"] for player in players)
        features = features_for(players, reference, math.fsum(season_pace[season - 1]) / len(season_pace[season - 1]))
        assert all(math.isfinite(value) for value in features.values())
        rows.append({"season": season, "team": team, "priorMinuteCoverage": coverage, "features": features,
                     "target": relative[(season, team)], "targetOrtg": summaries[(season, team)],
                     "persistence": relative.get((season - 1, team), 0), "missingTeamHistory": (season - 1, team) not in relative,
                     "players": players})
    return rows, zero_minutes


def paired(rows, first, second):
    differences = [(candidate - row["target"]) ** 2 - (baseline - row["target"]) ** 2
                   for row, candidate, baseline in zip(rows, first, second, strict=True)]
    average = math.fsum(differences) / len(rows)
    clusters = defaultdict(float)
    for row, difference in zip(rows, differences, strict=True):
        clusters[row["season"]] += difference - average
    count = len(clusters)
    assert count > 1
    error = math.sqrt(count / (count - 1) * math.fsum(value ** 2 for value in clusters.values()) / len(rows) ** 2)
    return {"meanSquaredErrorDifference": average, "interval95": [average - 1.96 * error, average + 1.96 * error], "seasonClusters": count}


def self_test():
    reference = dict.fromkeys(COUNTS, 0.1)
    reference.update(points=0.5, fieldGoals=0.2, fieldGoalAttempts=0.4)
    players = [{"id": str(index), "minutes": 100, "rates": dict(reference)} for index in range(5)]
    original = features_for(players, reference, 100)
    assert features_for(list(reversed(players)), reference, 100) == original
    assert math.isclose(original["combinedIndex"], original["separateCreation"])
    changed = [{**player, "targetPoints": 999, "targetAssists": 999, "targetTurnovers": 999} for player in players]
    assert features_for(changed, reference, 100) == original
    assert math.isclose(core([1, 2, 3, 4, 5]), 3.8)
    assert np.allclose(predict([[1.0]], fit_ridge([[0.0], [2.0]], [0.0, 2.0])), [1.0])
    print("Passed: feature permutation, identical profiles, target-production isolation, core weights and ridge prediction.")


def build_report():
    paths = ["data/raw/Player Per Game.csv", "data/raw/Team Summaries.csv",
             "scripts/data_pipeline/predict_offense.py", "scripts/data_pipeline/audit_team_roles.py",
             "scripts/data_pipeline/audit_possessions.py", "scripts/data_pipeline/audit_era_baselines.py"]
    hashes = {path: fingerprint(ROOT / path) for path in paths}
    rows, zero_minutes = load_rows()
    train = [row for row in rows if row["season"] <= 2012]
    assert train and all(row["season"] < 2013 for row in train)
    fitted = {name: fit_ridge([[row["features"][field] for field in fields] for row in train],
                              [row["target"] for row in train]) for name, fields in MODELS.items()}
    training_mean = math.fsum(row["target"] for row in train) / len(train)
    for row in rows:
        row["predictions"] = {"mean": training_mean, "persistence": row["persistence"],
                              **{name: float(predict([[row["features"][field] for field in MODELS[name]]], fit)[0])
                                 for name, fit in fitted.items()}}
    evaluations = {}
    for period, bounds in {"training": (1981, 2012), "later": (2013, 2026), "laterEarly": (2013, 2019), "laterRecent": (2020, 2026)}.items():
        for cohort in ("all", "coverage90"):
            selected = [row for row in rows if bounds[0] <= row["season"] <= bounds[1]
                        and (cohort == "all" or row["priorMinuteCoverage"] >= 0.9)]
            assert selected
            predictions = {name: [row["predictions"][name] for row in selected] for name in selected[0]["predictions"]}
            comparisons = [(name, "mean") for name in MODELS] + [("separateCreation", "combinedIndex"),
                          ("profile", "combinedIndex"), ("profileAndCreation", "profile"), ("profileAndCreation", "persistence")]
            evaluations[f"{period}:{cohort}"] = {"teams": len(selected),
                "models": {name: metrics([row["target"] for row in selected], values) for name, values in predictions.items()},
                "comparisons": {f"{first}-minus-{second}": paired(selected, predictions[first], predictions[second]) for first, second in comparisons}}
    for path, expected in hashes.items():
        assert fingerprint(ROOT / path) == expected
    return {"version": "mid-iq-historical-team-offense-1", "scope": "offline-input-validity-study", "protocol": PROTOCOL,
            "runtime": {"python": platform.python_version(), "numpy": np.__version__}, "sourceSha256": hashes,
            "implementationSha256": fingerprint(Path(__file__)), "teamSeasons": len(rows), "trainingTeams": len(train),
            "zeroMinuteStints": zero_minutes, "models": MODELS, "fitted": fitted, "evaluations": evaluations, "rows": rows,
            "limitations": ["Not an exact game-engine validation: top-five by target minutes, prior per36 inputs, no coaches, no franchise-decade peaks and no observed five-player units.",
                            "Actual target minutes condition the estimates; not a preseason forecast or causal creation-capacity estimate.",
                            "FG% times points already scored is a heuristic; ridge comparisons test predictive information, not a physical possession model.",
                            "Team and player per-game statistics are rounded; prior-team baseline does not remap relocated abbreviations. Missing history falls back to zero.",
                            "2026 records are evaluated as stored, not independently verified. Temporal holdouts are previously exposed data; no release approval or benchmark tuning."]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output", nargs="?")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.output or Path(args.output).exists():
        parser.error("Provide a new, unused output path.")
    self_test()
    report = build_report()
    with Path(args.output).open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(report, handle, indent=2, allow_nan=False)
        handle.write("\n")
    print(json.dumps({"teamSeasons": report["teamSeasons"], "trainingTeams": report["trainingTeams"],
                      "later": report["evaluations"]["later:all"], "highCoverage": report["evaluations"]["later:coverage90"]}, indent=2))


if __name__ == "__main__":
    main()