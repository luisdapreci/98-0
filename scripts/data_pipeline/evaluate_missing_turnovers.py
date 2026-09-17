"""Bounded integration1: validate a single masked historical-input policy."""
import argparse
import copy
import hashlib
import json
from research_files import parse_research_json
import math
import platform
from pathlib import Path

from audit_era_baselines import fingerprint
from audit_possessions import ROOT
from evaluate_turnover_shrinkage import verify_hashes

PROTOCOL_PATH = "docs/research/mid-iq/MID_IQ_INTEGRATION_1_PROTOCOL.json"
PROTOCOL_SHA256 = "a9a933d9b923dc21e44346aa805a8daa80af68566e1f4d8fe221af08d9432232"
COHORTS = {"donors": (1978, 2002, range(6)), "calibration": (2003, 2012, range(6, 8)),
           "evaluation": (2013, 2026, range(8, 10))}


def load_inputs():
    assert fingerprint(ROOT / PROTOCOL_PATH) == PROTOCOL_SHA256, "Integration registration changed."
    protocol = parse_research_json((ROOT / PROTOCOL_PATH).read_text(encoding="utf-8"))
    previous_path = "docs/research/mid-iq/MID_IQ_CANDIDATE_2_RESULT.json"
    previous = parse_research_json((ROOT / previous_path).read_text(encoding="utf-8"))
    assert previous["version"] == "mid-iq-candidate-2-result-1"
    assert previous["decision"]["verdict"] == "advance-to-integration-assessment"
    assert previous["selectedPassingWeight"] == protocol["candidate2PassingWeight"] == 0.25
    hashes = {**previous["sourceSha256"], previous_path: fingerprint(ROOT / previous_path),
              "scripts/data_pipeline/evaluate_role_costs.py": previous["implementationSha256"], PROTOCOL_PATH: PROTOCOL_SHA256}
    verify_hashes(hashes)
    audit = parse_research_json((ROOT / protocol["missingDataPolicy"]["source"]).read_text(encoding="utf-8"))
    assert audit["version"] == "mid-iq-possession-input-audit-1"
    return protocol, audit["players"], hashes


def partition(identity):
    return int.from_bytes(hashlib.sha256(identity.encode("utf-8")).digest(), "big") % 10


def cohort(players, name):
    first, last, buckets = COHORTS[name]
    selected = {}
    for player in players:
        identity = player["id"].split("_")[0]
        if not player["ready"] or partition(identity) not in buckets or not all(first <= year <= last for year in player["peakYears"]):
            continue
        aggregate = player["aggregate"]
        rates = aggregate["per36"]
        entry = {"id": player["id"], "identity": identity, "peakYears": player["peakYears"],
                 "minutes": aggregate["totals"]["minutes"],
                 "features": [rates["fieldGoalAttempts"] + 0.44 * rates["freeThrowAttempts"], rates["assists"]],
                 "observedTurnoversPer36": rates["turnovers"]}
        assert all(math.isfinite(value) and value >= 0 for value in entry["features"] + [entry["observedTurnoversPer36"]])
        assert entry["minutes"] > 0
        previous = selected.get(identity)
        if previous is None or (-entry["minutes"], entry["id"]) < (-previous["minutes"], previous["id"]):
            selected[identity] = entry
    return sorted(selected.values(), key=lambda entry: entry["id"])


def standardization(donors):
    means = [math.fsum(entry["features"][feature] for entry in donors) / len(donors) for feature in range(2)]
    deviations = [math.sqrt(math.fsum((entry["features"][feature] - means[feature]) ** 2 for entry in donors) / len(donors)) for feature in range(2)]
    if not all(math.isfinite(value) and value > 0 for value in deviations):
        raise ValueError("Donor feature deviations must be finite and positive.")
    return {"means": means, "populationStandardDeviations": deviations}


def predict(features, donors, scale):
    if len(features) != 2 or any(not math.isfinite(value) or value < 0 for value in features):
        raise ValueError("Two finite nonnegative observed role features required.")
    if len(donors) < 50:
        raise ValueError("Exactly50 neighbors require at least50 donors.")
    ordered = sorted((
        {"id": donor["id"], "squaredDistance": math.fsum(((features[index] - donor["features"][index]) / scale["populationStandardDeviations"][index]) ** 2 for index in range(2)),
         "turnoversPer36": donor["observedTurnoversPer36"]} for donor in donors),
        key=lambda entry: (entry["squaredDistance"], entry["id"]))[:50]
    value = math.fsum(entry["turnoversPer36"] for entry in ordered) / 50
    assert math.isfinite(value) and value >= 0
    return {"prediction": value, "neighbors": ordered}


def radius_for(residuals):
    rank = math.ceil((len(residuals) + 1) * 0.9)
    if rank < 1 or rank > len(residuals):
        raise ValueError("Insufficient residuals for the registered conformal rank.")
    return {"rank": rank, "radius": sorted(residuals)[rank - 1]}


def fit(players, protocol):
    donors, calibration = cohort(players, "donors"), cohort(players, "calibration")
    minimums = protocol["missingDataPolicy"]["minimumCohorts"]
    support = len(donors) >= minimums["donors"] and len(calibration) >= minimums["calibration"]
    report = {"donors": donors, "calibration": [], "calibrationIds": [entry["id"] for entry in calibration],
              "cohortCounts": {"donors": len(donors), "calibration": len(calibration)},
              "status": "fitted" if support else "stop-insufficient-support"}
    if not support:
        return report
    scale = standardization(donors)
    results = [{**entry, **predict(entry["features"], donors, scale)} for entry in calibration]
    residuals = [abs(entry["prediction"] - entry["observedTurnoversPer36"]) for entry in results]
    return {**report, "standardization": scale, "baseline": math.fsum(entry["observedTurnoversPer36"] for entry in donors) / len(donors),
            "calibration": results, "uncertainty": radius_for(residuals)}


def summarize(results, baseline):
    if not results:
        return None
    errors = [entry["prediction"] - entry["observedTurnoversPer36"] for entry in results]
    baseline_errors = [baseline - entry["observedTurnoversPer36"] for entry in results]
    count = len(results)
    return {"players": count, "bias": math.fsum(errors) / count,
            "mae": math.fsum(abs(value) for value in errors) / count,
            "rmse": math.sqrt(math.fsum(value ** 2 for value in errors) / count),
            "baselineRmse": math.sqrt(math.fsum(value ** 2 for value in baseline_errors) / count),
            "intervalCoverage": sum(entry["lower"] <= entry["observedTurnoversPer36"] <= entry["upper"] for entry in results) / count,
            "meanIntervalWidth": math.fsum(entry["upper"] - entry["lower"] for entry in results) / count}


def decide(results, metrics, policy):
    limits = policy["maskingGate"]
    rules = {
        "evaluationSupport": len(results) >= policy["minimumCohorts"]["evaluation"],
        "allPredictionsFiniteNonnegative": bool(results) and all(math.isfinite(entry[field]) and entry[field] >= 0 for entry in results for field in ("prediction", "lower", "upper")),
        "rmseNoWorseThanDonorMean": metrics is not None and metrics["rmse"] <= metrics["baselineRmse"],
        "absoluteBiasWithinLimit": metrics is not None and abs(metrics["bias"]) <= limits["maximumAbsoluteBiasPer36"],
        "intervalCoverageWithinLimit": metrics is not None and metrics["intervalCoverage"] >= limits["minimumEmpiricalIntervalCoverage"],
        "intervalWidthWithinLimit": metrics is not None and metrics["meanIntervalWidth"] <= limits["maximumMeanIntervalWidthPer36"],
    }
    return {"rules": rules, "failedRules": [name for name, passed in rules.items() if not passed],
            "verdict": "advance-to-modeled-input-layer" if all(rules.values()) else "stop-integration-cycle"}


def evaluate(players, trained, protocol):
    assert trained["status"] == "fitted", "Training gate must pass before evaluation."
    entries = cohort(players, "evaluation")
    radius = trained["uncertainty"]["radius"]
    results = []
    for entry in entries:
        prediction = predict(entry["features"], trained["donors"], trained["standardization"])
        results.append({**entry, **prediction, "lower": max(0, prediction["prediction"] - radius), "upper": prediction["prediction"] + radius})
    metrics = summarize(results, trained["baseline"])
    return {"rows": results, "metrics": metrics, "decision": decide(results, metrics, protocol["missingDataPolicy"]),
            "integrationStatus": "Modern masked-label screen only; no historical values filled, complete-strength mapping, live changes or fresh release evidence."}


def self_test():
    donors = [{"id": f"donor{index:03}", "features": [float(index), float(index % 7)], "observedTurnoversPer36": index / 25} for index in range(60)]
    snapshot = copy.deepcopy(donors)
    scale = standardization(donors)
    result = predict([20, 2], donors, scale)
    assert len(result["neighbors"]) == 50
    assert result == predict([20, 2], list(reversed(donors)), scale)
    assert donors == snapshot
    tied = [{**entry, "features": [1, 1]} for entry in reversed(donors)]
    assert [entry["id"] for entry in predict([1, 1], tied, scale)["neighbors"]] == [entry["id"] for entry in donors[:50]]
    assert radius_for(list(range(9))) == {"rank": 9, "radius": 8}
    assert radius_for(list(range(19))) == {"rank": 18, "radius": 17}
    for features in ([math.nan, 0], [1, -1], [1]):
        try:
            predict(features, donors, scale)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid features accepted")
    protocol = parse_research_json((ROOT / PROTOCOL_PATH).read_text(encoding="utf-8"))
    policy = protocol["missingDataPolicy"]
    rows = [{"prediction": 2, "lower": 1, "upper": 3, "observedTurnoversPer36": 2} for _ in range(40)]
    metrics = summarize(rows, 3)
    assert decide(rows, metrics, policy)["verdict"] == "advance-to-modeled-input-layer"
    for key, value, rule in (("bias", 0.250001, "absoluteBiasWithinLimit"), ("intervalCoverage", 0.84999, "intervalCoverageWithinLimit"),
                             ("meanIntervalWidth", 3.00001, "intervalWidthWithinLimit"), ("rmse", 2, "rmseNoWorseThanDonorMean")):
        decision = decide(rows, {**metrics, key: value}, policy)
        assert decision["verdict"] == "stop-integration-cycle" and rule in decision["failedRules"]
    assert decide([], None, policy)["verdict"] == "stop-integration-cycle"
    assert fit([], protocol)["status"] == "stop-insufficient-support"
    print("PASS: deterministic50-neighbor estimator, exact tie ordering, input validation, conformal rank and gate boundaries.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("stage", nargs="?", choices=("fit", "evaluate"))
    parser.add_argument("output", nargs="?")
    parser.add_argument("--fit")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.stage or not args.output or (args.stage == "evaluate" and not args.fit):
        parser.error("Use fit NEW_OUTPUT or evaluate NEW_OUTPUT --fit FROZEN_FIT.")
    path = Path(args.output)
    if path.exists():
        parser.error("Refusing to overwrite an existing integration artifact.")
    protocol, players, hashes = load_inputs()
    metadata = {"protocolVersion": protocol["version"], "sourceSha256": hashes,
                "implementationSha256": fingerprint(Path(__file__)), "runtime": {"python": platform.python_version()}}
    if args.stage == "fit":
        report = {"version": "mid-iq-missing-turnovers-fit-1", **metadata, **fit(players, protocol)}
    else:
        fit_path = Path(args.fit)
        fit_hash = fingerprint(fit_path)
        trained = parse_research_json(fit_path.read_text(encoding="utf-8"))
        assert trained["version"] == "mid-iq-missing-turnovers-fit-1"
        for key, value in metadata.items():
            assert trained[key] == value, f"Training metadata mismatch: {key}"
        expected = fit(players, protocol)
        assert all(trained[key] == value for key, value in expected.items()), "Frozen training/calibration mismatch."
        report = {"version": "mid-iq-missing-turnovers-result-1", **metadata, "fitSha256": fit_hash, **evaluate(players, trained, protocol)}
        assert fingerprint(fit_path) == fit_hash
    verify_hashes(hashes)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(report, handle, indent=2, allow_nan=False)
        handle.write("\n")
    print(json.dumps({key: report[key] for key in ("status", "cohortCounts", "metrics", "decision") if key in report}, indent=2))


if __name__ == "__main__":
    main()