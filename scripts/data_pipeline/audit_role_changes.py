"""Observed offensive role changes, not causal turnover-response calibration."""
import argparse
import csv
import json
from research_files import parse_research_json
import math
import platform
from collections import defaultdict
from pathlib import Path

import numpy as np

from audit_era_baselines import fingerprint
from audit_possessions import ROOT, FIELDS
from predict_offense import fit_ridge, metrics, paired_difference, predict, split_indices

CONTEXT = ["priorShots", "priorAssists", "priorTurnovers", "age", "minutesChange"]
MODEL_FIELDS = {"context": CONTEXT, "shots": CONTEXT + ["shotChange"],
                "shotsAndAssists": CONTEXT + ["shotChange", "assistChange"]}
PROTOCOL = {
    "version": "role-change-protocol-1",
    "cohort": "All 11775 consecutive pairs from workload study 1; both years >=20 games and >=500 minutes.",
    "rateUnits": "Shots=FGA+0.44FTA, assists and turnovers per36; subtract each season's league rate before differencing.",
    "models": ["fixedTurnovers", "shotLinkedTurnovers", "context", "shots", "shotsAndAssists"],
    "modelFields": MODEL_FIELDS,
    "conditioning": "Observed after-season shots, assists and minutes changes are allowed. This is conditional association, not a preseason forecast.",
    "fixedTurnovers": "Hold raw prior TOV/36 fixed; subtract the actual change in league TOV/36 for the relative-change prediction.",
    "shotLinkedTurnovers": "Scale raw prior TOV/36 by raw after/prior shot rate; subtract actual league TOV/36 change.",
    "fit": "Reuse training-only standardized ridge alpha1 for conditional evaluations. No tuning; no clipping of predictions.",
    "splits": ["unseenPlayers", "futureSeasons", "unseenFuturePlayers"],
    "trainingLastTargetSeason": 2012,
    "heldOutPlayerRule": "int(SHA256(UTF8(playerId)),16)%5==0; same already-exposed partitions as prediction study1.",
    "comparison": "shots minus context; shotsAndAssists minus shots; paired equal-pair MSE with player-cluster normal intervals.",
    "descriptiveFit": "Unpenalized OLS intercept with shotChange and assistChange only; player-cluster CR1 covariance, normal1.96 intervals.",
    "cohorts": ["all", "sameTeam", "stable", "changedSingleTeamStableExposure"],
    "stableExposure": "Ages20-34 both years, after/prior mpg ratio0.8-1.2 inclusive; sameTeam/stable flags reuse workload study1.",
    "teamChange": "Both seasons single raw-team label, different labels; renames may look like changes. Not randomized teammate treatment.",
    "eras": [[1978, 1999], [2000, 2012], [2013, 2026]],
    "directionalThresholds": {"shotChange": 2.0, "assistChange": 1.0},
    "directions": "decreased if <=-threshold, increased if >=threshold, similar otherwise; all nine stable-cohort cells retained.",
}


def direction(value, threshold):
    return "decreased" if value <= -threshold else "increased" if value >= threshold else "similar"


def load_rows():
    prediction_path = ROOT / "docs/research/mid-iq/MID_IQ_OFFENSE_PREDICTION_1.json"
    prediction = parse_research_json(prediction_path.read_text(encoding="utf-8"))
    assert prediction["version"] == "mid-iq-offense-prediction-1"
    hashes = {**prediction["sourceSha256"], "docs/research/mid-iq/MID_IQ_OFFENSE_PREDICTION_1.json": fingerprint(prediction_path),
              "scripts/data_pipeline/predict_offense.py": prediction["implementationSha256"]}
    for path, expected in hashes.items():
        assert fingerprint(ROOT / path) == expected, f"Stale role-change source: {path}"
    workload = parse_research_json((ROOT / "docs/research/mid-iq/MID_IQ_WORKLOAD_STUDY_1.json").read_text(encoding="utf-8"))
    era = parse_research_json((ROOT / "docs/research/mid-iq/MID_IQ_ERA_BASELINE_AUDIT_1.json").read_text(encoding="utf-8"))
    baselines = {row["season"]: row for row in era["seasons"]}
    with (ROOT / "data/raw/Player Per Game.csv").open(encoding="utf-8", newline="") as source:
        raw = dict(enumerate(csv.DictReader(source), 2))
    seasons = {}
    for observation in workload["seasonObservations"]:
        stints = [raw[line] for line in observation["csvLines"]]
        assert all(row["player_id"] == observation["playerId"] and int(row["season"]) == observation["season"] for row in stints)
        assert sorted(row["team"] for row in stints) == observation["teams"]
        totals = {field: math.fsum(float(row["g"]) * float(row[FIELDS[field]]) for row in stints)
                  for field in ("minutes", "fieldGoalAttempts", "freeThrowAttempts", "assists", "turnovers")}
        assert math.isclose(totals["minutes"], observation["minutes"], abs_tol=1e-10)
        rates = {"shots": 36 * (totals["fieldGoalAttempts"] + 0.44 * totals["freeThrowAttempts"]) / totals["minutes"],
                 "assists": 36 * totals["assists"] / totals["minutes"], "turnovers": 36 * totals["turnovers"] / totals["minutes"]}
        baseline = baselines[observation["season"]]
        league = {"shots": baseline["shotEndsPer36"], "assists": baseline["assistsPer36"],
                  "turnovers": 36 * baseline["totals"]["turnovers"] / baseline["totals"]["minutes"]}
        assert rates["shots"] > 0 and all(math.isfinite(value) and value >= 0 for value in [*rates.values(), *league.values()])
        seasons[(observation["playerId"], observation["season"])] = {**observation, "rates": rates, "league": league}
    rows = []
    for pair in workload["consecutivePairs"]:
        before = seasons[(pair["playerId"], pair["beforeSeason"])]
        after = seasons[(pair["playerId"], pair["season"])]
        changes = {field: (after["rates"][field] - after["league"][field]) - (before["rates"][field] - before["league"][field])
                   for field in ("shots", "assists", "turnovers")}
        stable_exposure = all(20 <= row["age"] <= 34 for row in (before, after)) and 0.8 <= pair["minutesRatio"] <= 1.2
        changed_team = len(before["teams"]) == len(after["teams"]) == 1 and before["teams"] != after["teams"]
        league_change = after["league"]["turnovers"] - before["league"]["turnovers"]
        features = {"priorShots": before["rates"]["shots"] - before["league"]["shots"],
                    "priorAssists": before["rates"]["assists"] - before["league"]["assists"],
                    "priorTurnovers": before["rates"]["turnovers"] - before["league"]["turnovers"],
                    "age": before["age"], "minutesChange": after["minutesPerGame"] - before["minutesPerGame"],
                    "shotChange": changes["shots"], "assistChange": changes["assists"]}
        rows.append({"playerId": pair["playerId"], "beforeSeason": pair["beforeSeason"], "season": pair["season"],
                     "sameTeam": pair["sameTeam"], "stable": pair["stable"],
                     "changedSingleTeamStableExposure": changed_team and stable_exposure,
                     "before": {key: before[key] for key in ("rates", "league", "csvLines")},
                     "after": {key: after[key] for key in ("rates", "league", "csvLines")},
                     "features": features, "target": changes["turnovers"],
                     "fixedTurnovers": -league_change,
                     "shotLinkedTurnovers": before["rates"]["turnovers"] * (after["rates"]["shots"] / before["rates"]["shots"] - 1) - league_change})
    assert len(rows) == 11775
    return rows, hashes


def association(rows):
    design = np.asarray([[1, row["features"]["shotChange"], row["features"]["assistChange"]] for row in rows])
    values = np.asarray([row["target"] for row in rows])
    coefficients, _, rank, _ = np.linalg.lstsq(design, values, rcond=None)
    assert rank == 3 and len(rows) > 3
    residuals = values - design @ coefficients
    scores = defaultdict(lambda: np.zeros(3))
    for row, vector, residual in zip(rows, design, residuals, strict=True):
        scores[row["playerId"]] += vector * residual
    clusters = len(scores)
    assert clusters > 1
    bread = np.linalg.inv(design.T @ design)
    meat = sum((np.outer(score, score) for score in scores.values()), np.zeros((3, 3)))
    correction = clusters / (clusters - 1) * (len(rows) - 1) / (len(rows) - 3)
    covariance = correction * bread @ meat @ bread
    errors = np.sqrt(np.maximum(0, np.diag(covariance)))
    return {"pairs": len(rows), "players": clusters, "fields": ["intercept", "shotChange", "assistChange"],
            "coefficients": coefficients.tolist(), "clusterCovariance": covariance.tolist(),
            "interval95": [[float(value - 1.96 * error), float(value + 1.96 * error)] for value, error in zip(coefficients, errors, strict=True)],
            "rmse": float(np.sqrt(np.mean(residuals ** 2)))}


def evaluate(rows, name):
    train_indices, test_indices = split_indices(rows, name)
    training, testing = [rows[index] for index in train_indices], [rows[index] for index in test_indices]
    values = [row["target"] for row in training]
    actual = np.asarray([row["target"] for row in testing])
    models = {}
    for model in PROTOCOL["models"]:
        fields, fitted = MODEL_FIELDS.get(model, []), None
        if fields:
            fitted = fit_ridge([[row["features"][field] for field in fields] for row in training], values)
            predictions = predict([[row["features"][field] for field in fields] for row in testing], fitted)
        else:
            predictions = np.asarray([row[model] for row in testing])
        models[model] = {"fields": fields, "fit": fitted, "predictions": predictions.tolist(), "metrics": metrics(actual, predictions)}
    comparisons = {f"{candidate}Minus{reference}": paired_difference(testing, actual, models[candidate]["predictions"], models[reference]["predictions"])
                   for candidate, reference in (("shots", "context"), ("shotsAndAssists", "shots"))}
    return {"trainingIndices": train_indices, "testIndices": test_indices, "models": models, "comparisons": comparisons}


def self_test():
    rows = [{"playerId": f"player{index % 40}", "season": 2012 if index < 120 else 2013,
             "features": {**{field: float(index % 11) for field in CONTEXT},
                          "shotChange": float(index % 7), "assistChange": float(index % 5)},
             "target": 2 + 0.3 * (index % 7) + 0.7 * (index % 5),
             "fixedTurnovers": 0, "shotLinkedTurnovers": 0} for index in range(240)]
    result = association(rows)
    assert np.allclose(result["coefficients"], [2, 0.3, 0.7])
    assert np.max(np.abs(result["clusterCovariance"])) < 1e-20
    noisy = [{**row, "target": row["target"] + 0.1 * (index % 3)} for index, row in enumerate(rows)]
    assert np.all(np.diag(association(noisy)["clusterCovariance"]) > 0)
    for name in PROTOCOL["splits"]:
        first = evaluate(rows, name)
        indices = set(first["testIndices"])
        changed = [{**row, "target": 9999} if index in indices else row for index, row in enumerate(rows)]
        second = evaluate(changed, name)
        for model in PROTOCOL["models"]:
            assert first["models"][model]["predictions"] == second["models"][model]["predictions"]
            assert first["models"][model]["fit"] == second["models"][model]["fit"]
    assert [direction(value, 2) for value in (-2, 0, 2)] == ["decreased", "similar", "increased"]
    print("Role-change self-checks passed: multivariate slopes, clustered covariance, threshold boundaries and held-out target isolation.")


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
        parser.error("Refusing to overwrite an existing role-change study.")
    rows, hashes = load_rows()
    cohorts = {name: [row for row in rows if name == "all" or row[name]] for name in PROTOCOL["cohorts"]}
    groups = []
    for shot_direction in ("decreased", "similar", "increased"):
        for assist_direction in ("decreased", "similar", "increased"):
            selected = [row for row in cohorts["stable"] if direction(row["features"]["shotChange"], 2) == shot_direction
                        and direction(row["features"]["assistChange"], 1) == assist_direction]
            groups.append({"shots": shot_direction, "assists": assist_direction, "pairs": len(selected),
                           "players": len({row["playerId"] for row in selected}),
                           "meanTurnoverChange": float(np.mean([row["target"] for row in selected])) if selected else None})
    report = {"version": "mid-iq-role-change-study-1", "scope": "observed-role-change-associations", "protocol": PROTOCOL,
              "sourceSha256": hashes, "implementationSha256": fingerprint(Path(__file__)),
              "runtime": {"python": platform.python_version(), "numpy": np.__version__}, "observations": rows,
              "associations": {name: association(selected) for name, selected in cohorts.items()},
              "eraSensitivity": [{"years": [low, high], **association([row for row in cohorts["stable"] if low <= row["beforeSeason"] and row["season"] <= high])}
                                 for low, high in PROTOCOL["eras"]], "stableDirectionalGroups": groups,
              "evaluations": {name: evaluate(rows, name) for name in PROTOCOL["splits"]},
              "limitations": ["Observed after-season features are intentional conditioning, not future information available to a preseason forecast.",
                              "Repeatedly exposed source seasons and model partitions; this is diagnostic reuse, not new independent validation.",
                              "No causal turnover response, maximum capacity or five-player portability. Assists are incomplete proxies for handling and passing.",
                              "Shared per-minute denominators, measurement error, role selection, injury, aging and team/season shocks remain; cluster intervals are not multiplicity-adjusted.",
                              "Team changes are observational raw-label changes, not randomized teammate changes; no teammate treatment variable is constructed.",
                              "Both-season exposure filters select survivors. No pre-1978 imputation, win-band fitting or live/prototype policy changes."]}
    for source, expected in hashes.items():
        assert fingerprint(ROOT / source) == expected, f"Source changed during role study: {source}"
    with path.open("x", encoding="utf-8") as output:
        json.dump(report, output, indent=2, allow_nan=False)
        output.write("\n")
    print(json.dumps({"associations": report["associations"], "stableDirectionalGroups": groups,
                      "evaluations": {name: {"metrics": {model: result["metrics"] for model, result in data["models"].items()},
                                             "comparisons": data["comparisons"]} for name, data in report["evaluations"].items()}}, indent=2))


if __name__ == "__main__":
    main()