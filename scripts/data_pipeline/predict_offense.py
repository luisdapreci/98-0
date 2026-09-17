"""Fixed-protocol next-season prediction; not a causal capacity model."""
import argparse
import csv
import hashlib
import json
from research_files import parse_research_json
import math
import platform
from collections import defaultdict
from pathlib import Path

import numpy as np

from audit_possessions import ROOT, FIELDS
from audit_era_baselines import fingerprint

CONTEXT = ["age", "ageSquared", "minutesPerGame", "games"]
PROFILE = ["workload", "shooting", "turnovers"]
OUTCOMES = ["shooting", "turnovers"]
PROTOCOL = {
    "version": "offense-prediction-protocol-1",
    "trainingLastTargetSeason": 2012,
    "heldOutPlayerRule": "int(SHA256(UTF8(playerId)), 16) % 5 == 0",
    "splits": ["unseenPlayers", "futureSeasons", "unseenFuturePlayers"],
    "features": "Only the immediately prior season; no target-season role, minutes, team or player ID as predictors.",
    "targets": {"shooting": "Next-season TS proxy minus next-season league TS proxy",
                "turnovers": "Next-season turnovers per 36 minus next-season league turnovers per 36"},
    "normalization": "Future league rates define evaluation labels only, never features or preprocessing; not a raw-stat forecast.",
    "cohort": "All consecutive pairs in workload study 1; both seasons >=20 games and >=500 minutes. No stable-team filtering.",
    "ridgeAlpha": 1.0,
    "fit": "Training-only population standardization; unpenalized intercept; numpy.linalg.lstsq augmented ridge system.",
    "models": ["mean", "context", "persistence", "laggedOutcome", "profile", "profileAndAssists"],
    "evaluation": "Equal pair weight RMSE/MAE; paired MSE differences with player-cluster normal intervals. No tuning or model selection.",
    "eraSensitivity": [[2013, 2019], [2020, 2026]],
    "comparison": "profile vs laggedOutcome; profileAndAssists vs profile; negative MSE difference favors added inputs.",
}


def held_out(identity):
    return int(hashlib.sha256(identity.encode("utf-8")).hexdigest(), 16) % 5 == 0


def split_indices(rows, name):
    cutoff = PROTOCOL["trainingLastTargetSeason"]
    train = [index for index, row in enumerate(rows) if row["season"] <= cutoff
             and (name == "futureSeasons" or not held_out(row["playerId"]))]
    test = [index for index, row in enumerate(rows) if
            (row["season"] <= cutoff and held_out(row["playerId"]) if name == "unseenPlayers" else
             row["season"] > cutoff and (name == "futureSeasons" or held_out(row["playerId"])))]
    assert name in PROTOCOL["splits"] and train and test and not set(train).intersection(test)
    return train, test


def fit_ridge(matrix, values, alpha=1.0):
    matrix, values = np.asarray(matrix, dtype=float), np.asarray(values, dtype=float)
    mean, scale = matrix.mean(axis=0), matrix.std(axis=0)
    scale = np.where(scale > 1e-12, scale, 1.0)
    design = np.column_stack((np.ones(len(matrix)), (matrix - mean) / scale))
    penalty = np.diag([0.0] + [math.sqrt(alpha)] * matrix.shape[1])
    coefficients = np.linalg.lstsq(np.vstack((design, penalty)),
                                 np.concatenate((values, np.zeros(len(penalty)))), rcond=None)[0]
    return {"mean": mean.tolist(), "scale": scale.tolist(), "coefficients": coefficients.tolist()}


def predict(matrix, fitted):
    normalized = (np.asarray(matrix, dtype=float) - fitted["mean"]) / fitted["scale"]
    return np.column_stack((np.ones(len(normalized)), normalized)) @ fitted["coefficients"]


def metrics(actual, predicted):
    residual = np.asarray(predicted) - np.asarray(actual)
    return {"rmse": float(np.sqrt(np.mean(residual ** 2))), "mae": float(np.mean(np.abs(residual)))}


def paired_difference(rows, actual, candidate, reference):
    differences = (np.asarray(candidate) - actual) ** 2 - (np.asarray(reference) - actual) ** 2
    mean = float(np.mean(differences))
    clusters = defaultdict(float)
    for row, difference in zip(rows, differences, strict=True):
        clusters[row["playerId"]] += float(difference) - mean
    count = len(clusters)
    assert count > 1
    standard_error = math.sqrt(count / (count - 1) * sum(score ** 2 for score in clusters.values()) / len(rows) ** 2)
    return {"meanSquaredErrorDifference": mean, "playerClusterStandardError": standard_error,
            "interval95": [mean - 1.96 * standard_error, mean + 1.96 * standard_error]}


def load_rows():
    workload_path = ROOT / "docs/research/mid-iq/MID_IQ_WORKLOAD_STUDY_1.json"
    workload = parse_research_json(workload_path.read_text(encoding="utf-8"))
    assert workload["version"] == "mid-iq-workload-study-1"
    hashes = {**workload["sourceSha256"], "docs/research/mid-iq/MID_IQ_WORKLOAD_STUDY_1.json": fingerprint(workload_path),
              "scripts/data_pipeline/audit_workload.py": workload["implementationSha256"],
              "scripts/data_pipeline/requirements-analysis.txt": fingerprint(Path(__file__).with_name("requirements-analysis.txt"))}
    for path, expected in hashes.items():
        assert fingerprint(ROOT / path) == expected, f"Stale prediction source: {path}"
    era = parse_research_json((ROOT / "docs/research/mid-iq/MID_IQ_ERA_BASELINE_AUDIT_1.json").read_text(encoding="utf-8"))
    baselines = {row["season"]: row for row in era["seasons"]}
    with (ROOT / "data/raw/Player Per Game.csv").open(encoding="utf-8", newline="") as source:
        raw_rows = dict(enumerate(csv.DictReader(source), 2))
    seasons = {}
    for row in workload["seasonObservations"]:
        raw = [raw_rows[line] for line in row["csvLines"]]
        assert all(stint["player_id"] == row["playerId"] and int(stint["season"]) == row["season"] for stint in raw)
        assert sorted(stint["team"] for stint in raw) == row["teams"]
        minutes = sum(float(stint["g"]) * float(stint[FIELDS["minutes"]]) for stint in raw)
        assert math.isclose(minutes, row["minutes"], abs_tol=1e-10)
        assists = 36 * sum(float(stint["g"]) * float(stint[FIELDS["assists"]]) for stint in raw) / minutes
        turnovers = 36 * sum(float(stint["g"]) * float(stint[FIELDS["turnovers"]]) for stint in raw) / minutes
        base = baselines[row["season"]]
        league_turnovers = 36 * base["totals"]["turnovers"] / base["totals"]["minutes"]
        seasons[(row["playerId"], row["season"])] = {**row, "ageSquared": row["age"] ** 2,
            "assists": assists / base["assistsPer36"], "turnovers": turnovers - league_turnovers}
    rows = []
    for pair in workload["consecutivePairs"]:
        before = seasons[(pair["playerId"], pair["beforeSeason"])]
        after = seasons[(pair["playerId"], pair["season"])]
        assert after["season"] == before["season"] + 1
        rows.append({"playerId": pair["playerId"], "beforeSeason": before["season"], "season": after["season"],
                     "features": {field: before[field] for field in CONTEXT + PROFILE + ["assists"]},
                     "targets": {field: after[field] for field in OUTCOMES}})
    return rows, hashes


def evaluate(rows, name):
    training_indices, test_indices = split_indices(rows, name)
    training, test = [rows[index] for index in training_indices], [rows[index] for index in test_indices]
    outcomes = {}
    for outcome in OUTCOMES:
        values = np.asarray([row["targets"][outcome] for row in training])
        actual = np.asarray([row["targets"][outcome] for row in test])
        models = {}
        for model in PROTOCOL["models"]:
            fields, fitted = [], None
            if model == "mean":
                fitted = {"constant": float(np.mean(values))}
                predictions = np.full(len(test), fitted["constant"])
            elif model == "persistence":
                predictions = np.asarray([row["features"][outcome] for row in test])
            else:
                fields = CONTEXT + ([] if model == "context" else [outcome] if model == "laggedOutcome" else
                                    PROFILE + (["assists"] if model == "profileAndAssists" else []))
                fitted = fit_ridge([[row["features"][field] for field in fields] for row in training], values,
                                   PROTOCOL["ridgeAlpha"])
                predictions = predict([[row["features"][field] for field in fields] for row in test], fitted)
            models[model] = {"fields": fields, "fit": fitted, "metrics": metrics(actual, predictions),
                             "predictions": predictions.tolist()}
        comparisons = {}
        for candidate, reference in (("profile", "laggedOutcome"), ("profileAndAssists", "profile")):
            comparisons[f"{candidate}Minus{reference}"] = paired_difference(
                test, actual, models[candidate]["predictions"], models[reference]["predictions"])
        sensitivity = []
        for low, high in PROTOCOL["eraSensitivity"]:
            indices = [index for index, row in enumerate(test) if low <= row["season"] <= high]
            if indices:
                sensitivity.append({"years": [low, high], "pairs": len(indices), "metrics": {
                    model: metrics(actual[indices], np.asarray(saved["predictions"])[indices]) for model, saved in models.items()}})
        outcomes[outcome] = {"models": models, "comparisons": comparisons, "eraSensitivity": sensitivity}
    return {"trainingIndices": training_indices, "testIndices": test_indices,
            "trainingPlayers": len({row["playerId"] for row in training}),
            "testPlayers": len({row["playerId"] for row in test}), "outcomes": outcomes}


def self_test():
    matrix = [[float(index), 5.0] for index in range(6)]
    fitted = fit_ridge(matrix, [2 + 3 * index for index in range(6)], alpha=0)
    assert np.allclose(predict([[6, 5], [7, 5]], fitted), [20, 23])
    assert fitted["mean"] == [2.5, 5.0] and fitted["scale"][1] == 1
    regularized = fit_ridge(matrix, [2 + 3 * index for index in range(6)])
    assert abs(regularized["coefficients"][1]) < abs(fitted["coefficients"][1])
    identities = [f"player{index}" for index in range(50)]
    rows = [{"playerId": identity, "season": season, "beforeSeason": season - 1,
             "features": {field: float(index + 1) for field in CONTEXT + PROFILE + ["assists"]},
             "targets": {field: float(index + 2) for field in OUTCOMES}}
            for index, identity in enumerate(identities) for season in (2012, 2013)]
    for name in PROTOCOL["splits"]:
        train, test = split_indices(rows, name)
        assert all(rows[index]["season"] <= 2012 for index in train)
        if name != "futureSeasons":
            assert not {rows[index]["playerId"] for index in train} & {rows[index]["playerId"] for index in test}
        first = evaluate(rows, name)
        changed = [{**row, "targets": {field: 9999.0 for field in OUTCOMES}} if index in test else row
                   for index, row in enumerate(rows)]
        second = evaluate(changed, name)
        for outcome in OUTCOMES:
            for model in PROTOCOL["models"]:
                assert first["outcomes"][outcome]["models"][model]["fit"] == second["outcomes"][outcome]["models"][model]["fit"]
                assert first["outcomes"][outcome]["models"][model]["predictions"] == second["outcomes"][outcome]["models"][model]["predictions"]
    assert metrics([1, 3], [2, 2]) == {"rmse": 1.0, "mae": 1.0}
    print("Prediction self-checks passed: solver, ridge, scaling, disjoint splits, target leakage and metrics.")


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
        parser.error("Refusing to overwrite an existing prediction study.")
    rows, hashes = load_rows()
    report = {"version": "mid-iq-offense-prediction-1", "scope": "offline-next-season-prediction",
              "protocol": PROTOCOL, "sourceSha256": hashes, "implementationSha256": fingerprint(Path(__file__)),
              "runtime": {"python": platform.python_version(), "numpy": np.__version__},
              "observations": rows, "evaluations": {name: evaluate(rows, name) for name in PROTOCOL["splits"]},
              "limitations": ["Existing seasons were already inspected descriptively; fixed evaluation splits are new, data are not wholly untouched.",
                              "Unseen players means absent from model training, not rookies: prior-season observations are required.",
                              "Future relative labels use future league context for scoring only; this is not forecasting that context.",
                              "Both-season exposure requirements select survivors; no prediction of dropout or minutes availability.",
                              "Assists are a box-score passing proxy, not identified shot creation or causal teammate benefit.",
                              "Player-cluster intervals do not handle every team/season shock or multiple comparisons; splits overlap.",
                              "No causal load response, maximum capacity, lineup portability, pre-1978 imputation, win-band fitting or live changes."]}
    for source, expected in hashes.items():
        assert fingerprint(ROOT / source) == expected, f"Source changed during prediction study: {source}"
    with path.open("x", encoding="utf-8") as output:
        json.dump(report, output, indent=2, allow_nan=False)
        output.write("\n")
    print(json.dumps({name: {"trainingPairs": len(result["trainingIndices"]), "testPairs": len(result["testIndices"]),
                            "outcomes": {outcome: {"metrics": {model: saved["metrics"] for model, saved in data["models"].items()},
                                                    "comparisons": data["comparisons"]} for outcome, data in result["outcomes"].items()}}
                      for name, result in report["evaluations"].items()}, indent=2))


if __name__ == "__main__":
    main()