"""Registered candidate1: earlier-only shrinkage selection, then fixed evaluation."""
import argparse
import copy
import json
import math
import platform
from pathlib import Path

from audit_era_baselines import fingerprint
from audit_possessions import ROOT
from audit_team_roles import estimate, metrics, paired

PROTOCOL_PATH = "docs/MID_IQ_CANDIDATE_1_PROTOCOL.json"
PROTOCOL_SHA256 = "f660073f9a4ef7519eab939676a822cb0e098d84d18b58fd70ea2132bcbe2e01"


def load_inputs():
    assert fingerprint(ROOT / PROTOCOL_PATH) == PROTOCOL_SHA256, "Registration changed after freeze."
    protocol = json.loads((ROOT / PROTOCOL_PATH).read_text(encoding="utf-8"))
    source_path = ROOT / protocol["source"]
    source = json.loads(source_path.read_text(encoding="utf-8"))
    assert source["version"] == protocol["sourceVersion"]
    hashes = {**source["sourceSha256"], protocol["source"]: fingerprint(source_path),
              PROTOCOL_PATH: PROTOCOL_SHA256, "scripts/data_pipeline/audit_team_roles.py": source["implementationSha256"]}
    verify_hashes(hashes)
    return protocol, source["rows"], hashes


def verify_hashes(hashes):
    for path, expected in hashes.items():
        assert fingerprint(ROOT / path) == expected, f"Changed candidate source: {path}"


def shrink(players, reference, k_minutes):
    if not math.isfinite(k_minutes) or k_minutes < 0:
        raise ValueError("Finite nonnegative shrinkage minutes required.")
    if k_minutes == 0:
        return players
    result = []
    for player in players:
        if player["fallback"] is not None:
            result.append(player)
            continue
        minutes = player["priorMinutes"]
        assert math.isfinite(minutes) and minutes > 0
        weight = minutes / (minutes + k_minutes)
        turnover_rate = weight * player["priorRates"]["turnovers"] + (1 - weight) * reference["turnovers"]
        result.append({**player, "priorRates": {**player["priorRates"], "turnovers": turnover_rate}})
    return result


def predict_row(row, k_minutes):
    return estimate(shrink(row["players"], row["reference"], k_minutes), row["reference"], (0.5, 0.5), "prior-roles")


def common_indices(rows):
    return [index for index, row in enumerate(rows) if all(case["status"] == "evaluated" for case in row["scenarios"].values())]


def select_earlier(rows, protocol):
    first, last = protocol["trainingYears"]
    indices = [index for index in common_indices(rows) if first <= rows[index]["season"] <= last]
    assert indices
    actual = [rows[index]["targetTurnoverEnds"] for index in indices]
    grid = []
    for k_minutes in protocol["kMinutes"]:
        predictions = [predict_row(rows[index], k_minutes) for index in indices]
        unsupported = [index for index, prediction in zip(indices, predictions, strict=True) if prediction["status"] != "evaluated"]
        values = [prediction["turnoverEnds"] if prediction["status"] == "evaluated" else None for prediction in predictions]
        grid.append({"kMinutes": k_minutes, "unsupportedIndices": unsupported, "predictions": values,
                     "metrics": metrics(actual, values) if not unsupported else None})
    eligible = [entry for entry in grid if entry["metrics"] is not None]
    assert eligible, "No configuration supports the fixed training cohort."
    selected = min(eligible, key=lambda entry: (entry["metrics"]["rmse"], entry["kMinutes"]))
    return {"trainingIndices": indices, "grid": grid, "selectedKMinutes": selected["kMinutes"]}


def evaluate_cohort(rows, predictions, indices, protocol):
    selected = [rows[index] for index in indices]
    assert selected
    actual = [row["targetTurnoverEnds"] for row in selected]
    baselines = {"shotOnly": [row["scenarios"][protocol["baselines"]["shotOnly"]]["turnoverEnds"] for row in selected],
                 "unshrunk": [row["scenarios"][protocol["baselines"]["unshrunk"]]["turnoverEnds"] for row in selected],
                 "league": [row["leaguePrediction"] for row in selected]}
    unsupported = [index for index in indices if predictions[index]["status"] != "evaluated"]
    models = {name: metrics(actual, values) for name, values in baselines.items()}
    comparisons = {}
    if not unsupported:
        values = [predictions[index]["turnoverEnds"] for index in indices]
        models["candidate"] = metrics(actual, values)
        comparisons = {name: paired(selected, values, baseline) for name, baseline in baselines.items()}
    else:
        models["candidate"] = None
    return {"indices": indices, "unsupportedIndices": unsupported, "models": models, "comparisons": comparisons}


def decide(selected_k, all_supported, evaluations, protocol):
    earlier = evaluations["earlier:all"]
    later = evaluations["later:all"]
    high = evaluations["later:at-least-90-percent"]
    earlier_model, later_model, high_model = [entry["models"]["candidate"] for entry in (earlier, later, high)]
    rules = {
        "positiveShrinkageAndFullSupport": selected_k > 0 and all_supported,
        "earlierNoWorseThanShotOnly": earlier_model is not None and earlier_model["rmse"] <= earlier["models"]["shotOnly"]["rmse"],
        "laterMaterialAndPairedImprovement": later_model is not None and all(
            later_model["rmse"] <= (1 - protocol["minimumLaterRmseReduction"]) * later["models"][name]["rmse"]
            and later["comparisons"][name]["interval95"][1] < 0 for name in ("shotOnly", "unshrunk")),
        "laterHighCoverageNoRegression": high_model is not None and all(
            high_model["rmse"] <= high["models"][name]["rmse"] for name in ("shotOnly", "unshrunk")),
    }
    return {"rules": rules, "verdict": "advance-to-integration-assessment" if all(rules.values()) else "reject-component",
            "failedRules": [name for name, passed in rules.items() if not passed]}


def evaluate_selected(rows, protocol, selection):
    indices = common_indices(rows)
    predictions = {index: predict_row(rows[index], selection["selectedKMinutes"]) for index in indices}
    evaluations = {}
    for period, years in (("earlier", protocol["trainingYears"]), ("later", protocol["evaluationYears"])):
        for coverage in ("all", "at-least-90-percent"):
            subset = [index for index in indices if years[0] <= rows[index]["season"] <= years[1]
                      and (coverage == "all" or rows[index]["priorMinuteCoverage"] >= protocol["highCoverageMinimum"])]
            evaluations[f"{period}:{coverage}"] = evaluate_cohort(rows, predictions, subset, protocol)
    supported = all(result["status"] == "evaluated" for result in predictions.values())
    return {"selectedKMinutes": selection["selectedKMinutes"],
            "rows": [{"sourceIndex": index, "season": rows[index]["season"], "team": rows[index]["team"], "result": predictions[index]} for index in indices],
            "evaluations": evaluations, "decision": decide(selection["selectedKMinutes"], supported, evaluations, protocol),
            "integrationStatus": "Not a complete game candidate. Historical missingness, team-only events and integration with offense/defense/coaching remain unresolved. No fresh-family, difficulty or human gates evaluated."}


def self_test():
    protocol = json.loads((ROOT / PROTOCOL_PATH).read_text(encoding="utf-8"))
    reference = {"shots": 0.44, "assists": 0.1, "turnovers": 0.06}
    players = [{"priorRates": {**reference, "turnovers": 0.12}, "priorMinutes": 500, "fallback": None,
                "after": {"minutes": 20, "shots": 8.8, "assists": 2, "turnovers": 1.2}} for _ in range(5)]
    snapshot = copy.deepcopy(players)
    assert shrink(players, reference, 0) is players
    for player in shrink(players, reference, 500):
        assert math.isclose(player["priorRates"]["turnovers"], 0.09)
        assert player["priorRates"]["shots"] == 0.44 and player["priorRates"]["assists"] == 0.1
    fallback = [{**player, "fallback": "no-prior-season", "priorRates": dict(reference)} for player in players]
    assert shrink(fallback, reference, 500) == fallback
    assert shrink([{**players[0], "priorMinutes": 2000}], reference, 500)[0]["priorRates"]["turnovers"] > 0.09
    for invalid in (-1, math.nan, math.inf):
        try:
            shrink(players, reference, invalid)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid shrinkage accepted")
    rows = [{"season": season, "team": "TEST", "players": copy.deepcopy(players), "reference": reference,
             "priorMinuteCoverage": 1, "targetTurnoverEnds": 12,
             "scenarios": {"case": {"status": "evaluated"}}} for season in (2000, 2001, 2013, 2014)]
    selection = select_earlier(rows, protocol)
    assert selection["trainingIndices"] == [0, 1]
    assert selection["selectedKMinutes"] > 0
    changed = copy.deepcopy(rows)
    for row in changed[2:]:
        row["targetTurnoverEnds"] = 99999
        row["players"][0]["priorRates"]["turnovers"] = 999
    assert selection == select_earlier(changed, protocol)
    for k_minutes in protocol["kMinutes"]:
        first = predict_row(rows[0], k_minutes)
        altered = copy.deepcopy(rows[0])
        for player in altered["players"]:
            player["after"]["turnovers"] = 999
        assert first == predict_row(altered, k_minutes)
        assert math.isclose(first["shotEnds"] + first["turnoverEnds"], 100, abs_tol=1e-10)
    assert predict_row(rows[0], 0) == estimate(players, reference, (0.5, 0.5), "prior-roles")
    assert players == snapshot
    neutral = [{**row, "players": fallback} for row in rows]
    assert select_earlier(neutral, protocol)["selectedKMinutes"] == 0
    good = {"models": {"candidate": {"rmse": 0.8}, "shotOnly": {"rmse": 1}, "unshrunk": {"rmse": 1}},
            "comparisons": {name: {"interval95": [-0.4, -0.1]} for name in ("shotOnly", "unshrunk")}}
    evaluations = {name: copy.deepcopy(good) for name in ("earlier:all", "later:all", "later:at-least-90-percent")}
    assert decide(500, True, evaluations, protocol)["verdict"] == "advance-to-integration-assessment"
    assert decide(0, True, evaluations, protocol)["verdict"] == "reject-component"
    assert decide(500, False, evaluations, protocol)["verdict"] == "reject-component"
    evaluations["later:all"]["comparisons"]["shotOnly"]["interval95"][1] = 0
    assert decide(500, True, evaluations, protocol)["verdict"] == "reject-component"
    print("Candidate1 self-checks passed: shrinkage, fallback, immutability, earlier-only selection, ties, target isolation and decision boundaries.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("stage", nargs="?", choices=("select", "evaluate"))
    parser.add_argument("output", nargs="?")
    parser.add_argument("--selection")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.stage or not args.output or (args.stage == "evaluate" and not args.selection):
        parser.error("Use select NEW_OUTPUT or evaluate NEW_OUTPUT --selection FROZEN_SELECTION.")
    path = Path(args.output)
    if path.exists():
        parser.error("Refusing to overwrite an existing candidate1 artifact.")
    protocol, rows, hashes = load_inputs()
    metadata = {"sourceSha256": hashes, "implementationSha256": fingerprint(Path(__file__)),
                "protocolVersion": protocol["version"], "runtime": {"python": platform.python_version()}}
    if args.stage == "select":
        report = {"version": "mid-iq-candidate-1-selection-1", "scope": "earlier-only-candidate-selection", **metadata,
                  **select_earlier(rows, protocol)}
    else:
        selection_path = Path(args.selection)
        selection_hash = fingerprint(selection_path)
        selection = json.loads(selection_path.read_text(encoding="utf-8"))
        assert selection["version"] == "mid-iq-candidate-1-selection-1"
        for key, value in metadata.items():
            assert selection[key] == value, f"Selection metadata mismatch: {key}"
        expected = select_earlier(rows, protocol)
        assert all(selection[key] == value for key, value in expected.items()), "Selection differs from registered earlier-only minimum."
        report = {"version": "mid-iq-candidate-1-result-1", "scope": "selected-turnover-shrinkage-evaluation", **metadata,
                  "selectionSha256": selection_hash, **evaluate_selected(rows, protocol, selection)}
        assert fingerprint(selection_path) == selection_hash, "Selection changed during evaluation."
    verify_hashes(hashes)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(report, handle, indent=2, allow_nan=False)
        handle.write("\n")
    print(json.dumps({"stage": args.stage, "selectedKMinutes": report["selectedKMinutes"],
                      "decision": report.get("decision"), "trainingRows": len(report.get("trainingIndices", []))}, indent=2))


if __name__ == "__main__":
    main()