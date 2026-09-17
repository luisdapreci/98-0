"""Registered candidate2: turnover costs per combined prior role exposure."""
import argparse
import copy
import json
from research_files import parse_research_json
import math
import platform
from pathlib import Path

from audit_era_baselines import fingerprint
from audit_possessions import ROOT
from audit_team_roles import estimate, metrics
from evaluate_turnover_shrinkage import common_indices, evaluate_cohort, verify_hashes

PROTOCOL_PATH = "docs/research/mid-iq/MID_IQ_CANDIDATE_2_PROTOCOL.json"
PROTOCOL_SHA256 = "78f403ecea458a8f98a75d1667e77c970380f06a32cc2d0d2f125afaefad0f12"


def load_inputs():
    assert fingerprint(ROOT / PROTOCOL_PATH) == PROTOCOL_SHA256, "Candidate2 registration changed."
    protocol = parse_research_json((ROOT / PROTOCOL_PATH).read_text(encoding="utf-8"))
    prior_path = ROOT / "docs/research/mid-iq/MID_IQ_CANDIDATE_1_RESULT.json"
    prior = parse_research_json(prior_path.read_text(encoding="utf-8"))
    assert prior["version"] == "mid-iq-candidate-1-result-1"
    hashes = {**prior["sourceSha256"], "docs/research/mid-iq/MID_IQ_CANDIDATE_1_RESULT.json": fingerprint(prior_path),
              "scripts/data_pipeline/evaluate_turnover_shrinkage.py": prior["implementationSha256"], PROTOCOL_PATH: PROTOCOL_SHA256}
    verify_hashes(hashes)
    source = parse_research_json((ROOT / protocol["source"]).read_text(encoding="utf-8"))
    assert source["version"] == protocol["sourceVersion"]
    return protocol, source["rows"], hashes


def role_costs(rates, reference, passing_weight):
    demand = (1 - passing_weight) * rates["shots"] / reference["shots"] + passing_weight * rates["assists"] / reference["assists"]
    if not math.isfinite(demand) or demand <= 0:
        return None
    ratio = rates["turnovers"] / reference["turnovers"] / demand
    share = reference["turnovers"] / (reference["shots"] + reference["turnovers"])
    costs = {"shot": share / (1 - share) * (1 - passing_weight) * ratio,
             "passing": share * passing_weight * ratio}
    return costs if all(math.isfinite(value) and value >= 0 for value in costs.values()) else None


def predict_row(row, passing_weight):
    if not math.isfinite(passing_weight) or not 0 <= passing_weight <= 1:
        raise ValueError("Passing weight must be finite and between zero and one.")
    players, reference = row["players"], row["reference"]
    if passing_weight == 0:
        return estimate(players, reference, (1, 0), "prior-roles")
    assert all(math.isfinite(value) and value > 0 for value in reference.values())
    assert all(math.isfinite(player["after"]["minutes"]) and player["after"]["minutes"] > 0 for player in players)
    assert all(math.isfinite(value) and value >= 0 for player in players for value in player["priorRates"].values())
    costs = [role_costs(player["priorRates"], reference, passing_weight) for player in players]
    if any(cost is None for cost in costs):
        return {"status": "unsupported", "reason": "nonpositive-role-demand-or-nonfinite-cost"}
    shot_weights = [player["after"]["minutes"] * player["priorRates"]["shots"] for player in players]
    passing_weights = [player["after"]["minutes"] * player["priorRates"]["assists"] for player in players]
    shot_sum, passing_sum = math.fsum(shot_weights), math.fsum(passing_weights)
    if shot_sum <= 0 or passing_sum <= 0:
        return {"status": "unsupported", "reason": "empty-role-demand"}
    passing = 100 * math.fsum(cost["passing"] * weight / passing_sum for cost, weight in zip(costs, passing_weights, strict=True))
    marginal = math.fsum(cost["shot"] * weight / shot_sum for cost, weight in zip(costs, shot_weights, strict=True))
    if not math.isfinite(passing) or not math.isfinite(marginal) or passing > 100:
        return {"status": "unsupported", "reason": "passing-cost-exceeds-event-budget-or-nonfinite"}
    shots = (100 - passing) / (1 + marginal)
    shot_turnovers = shots * marginal
    assert math.isclose(shots + shot_turnovers + passing, 100, abs_tol=1e-10)
    return {"status": "evaluated", "turnoverEnds": passing + shot_turnovers, "shotEnds": shots,
            "passingBudget": 100.0, "fixedTurnovers": 0.0,
            "shotLinkedTurnovers": shot_turnovers, "passingLinkedTurnovers": passing}


def select_earlier(rows, protocol):
    first, last = protocol["trainingYears"]
    indices = [index for index in common_indices(rows) if first <= rows[index]["season"] <= last]
    assert indices
    actual = [rows[index]["targetTurnoverEnds"] for index in indices]
    grid = []
    for weight in protocol["passingWeights"]:
        results = [predict_row(rows[index], weight) for index in indices]
        unsupported = [index for index, result in zip(indices, results, strict=True) if result["status"] != "evaluated"]
        values = [result["turnoverEnds"] if result["status"] == "evaluated" else None for result in results]
        grid.append({"passingWeight": weight, "results": results, "unsupportedIndices": unsupported,
                     "metrics": None if unsupported else metrics(actual, values)})
    eligible = [entry for entry in grid if entry["metrics"] is not None]
    assert eligible, "No supported configuration on the frozen training cohort."
    selected = min(eligible, key=lambda entry: (entry["metrics"]["rmse"], entry["passingWeight"]))
    return {"trainingIndices": indices, "grid": grid, "selectedPassingWeight": selected["passingWeight"]}


def decide(weight, supported, evaluations, protocol):
    earlier, later, high = [evaluations[name] for name in ("earlier:all", "later:all", "later:at-least-90-percent")]
    earlier_model, later_model, high_model = [entry["models"]["candidate"] for entry in (earlier, later, high)]
    rules = {
        "positivePassingWeightAndFullSupport": weight > 0 and supported,
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
    predictions = {index: predict_row(rows[index], selection["selectedPassingWeight"]) for index in indices}
    evaluations = {}
    for period, years in (("earlier", protocol["trainingYears"]), ("later", protocol["evaluationYears"])):
        for coverage in ("all", "at-least-90-percent"):
            subset = [index for index in indices if years[0] <= rows[index]["season"] <= years[1]
                      and (coverage == "all" or rows[index]["priorMinuteCoverage"] >= protocol["highCoverageMinimum"])]
            evaluations[f"{period}:{coverage}"] = evaluate_cohort(rows, predictions, subset, protocol)
    return {"selectedPassingWeight": selection["selectedPassingWeight"],
            "rows": [{"sourceIndex": index, "season": rows[index]["season"], "team": rows[index]["team"], "result": predictions[index]} for index in indices],
            "evaluations": evaluations,
            "decision": decide(selection["selectedPassingWeight"], all(result["status"] == "evaluated" for result in predictions.values()), evaluations, protocol),
            "integrationStatus": "Not a complete-game finalist; no old-era imputation, live changes, fresh-family measurement, legal-draft acceptance or playtesting."}


def self_test():
    protocol = parse_research_json((ROOT / PROTOCOL_PATH).read_text(encoding="utf-8"))
    reference = {"shots": 0.44, "assists": 0.1, "turnovers": 0.06}
    players = [{"priorRates": dict(reference), "after": {"minutes": 20, "shots": 8.8, "assists": 2, "turnovers": 1.2}} for _ in range(5)]
    neutral = {"players": players, "reference": reference}
    snapshot = copy.deepcopy(neutral)
    for weight in protocol["passingWeights"]:
        result = predict_row(neutral, weight)
        assert math.isclose(result["turnoverEnds"], 12, abs_tol=1e-10)
        assert math.isclose(result["shotLinkedTurnovers"], 12 * (1 - weight), abs_tol=1e-10)
        for rates in (reference, {"shots": 0.88, "assists": 0.05, "turnovers": 0.09}):
            cost = role_costs(rates, reference, weight)
            reconstructed = cost["shot"] * 17.6 * rates["shots"] / 0.44 + cost["passing"] * 20 * rates["assists"] / 0.1
            assert math.isclose(reconstructed, 2.4 * rates["turnovers"] / 0.06, abs_tol=1e-10)
        changed = copy.deepcopy(neutral)
        for player in changed["players"]:
            player["after"].update(shots=999, assists=999, turnovers=999)
        assert result == predict_row(changed, weight)
    assert neutral == snapshot
    assert predict_row(neutral, 0) == estimate(players, reference, (1, 0), "prior-roles")
    no_assists = copy.deepcopy(neutral)
    for player in no_assists["players"]:
        player["priorRates"]["assists"] = 0
    assert predict_row(no_assists, 1)["status"] == "unsupported"
    expensive = copy.deepcopy(neutral)
    for player in expensive["players"]:
        player["priorRates"]["turnovers"] = 10
    assert predict_row(expensive, 1)["status"] == "unsupported"
    for invalid in (-1, 2, math.nan, math.inf):
        try:
            predict_row(neutral, invalid)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid weight accepted")
    rows = [{**copy.deepcopy(neutral), "season": season, "targetTurnoverEnds": 12, "scenarios": {"case": {"status": "evaluated"}}}
            for season in (2000, 2001, 2013, 2014)]
    selection = select_earlier(rows, protocol)
    assert selection["trainingIndices"] == [0, 1]
    changed = copy.deepcopy(rows)
    for row in changed[2:]:
        row["targetTurnoverEnds"] = 99999
        row["players"][0]["priorRates"]["turnovers"] = 999
    assert select_earlier(changed, protocol) == selection
    zero_rows = copy.deepcopy(rows)
    for row in zero_rows:
        row["targetTurnoverEnds"] = 0
        for player in row["players"]:
            player["priorRates"]["turnovers"] = 0
    assert select_earlier(zero_rows, {**protocol, "passingWeights": list(reversed(protocol["passingWeights"]))})["selectedPassingWeight"] == 0
    diverse = copy.deepcopy(neutral)
    for index, player in enumerate(diverse["players"]):
        player["priorRates"] = {"shots": 0.1 * (index + 1), "assists": 0.03 * (5 - index), "turnovers": 0.02 * (index + 1)}
    before = copy.deepcopy(diverse)
    for weight in protocol["passingWeights"]:
        result = predict_row(diverse, weight)
        reverse = predict_row({**diverse, "players": list(reversed(diverse["players"]))}, weight)
        for field in ("shotEnds", "turnoverEnds", "passingLinkedTurnovers", "shotLinkedTurnovers"):
            assert math.isclose(result[field], reverse[field], abs_tol=1e-10)
        assert math.isclose(result["shotEnds"] + result["turnoverEnds"], 100, abs_tol=1e-10)
    assert diverse == before
    assert predict_row(diverse, 0.25)["turnoverEnds"] != predict_row(diverse, 0.75)["turnoverEnds"]
    good = {"models": {"candidate": {"rmse": 0.8}, "shotOnly": {"rmse": 1}, "unshrunk": {"rmse": 1}},
            "comparisons": {name: {"interval95": [-0.4, -0.1]} for name in ("shotOnly", "unshrunk")}}
    evaluations = {name: copy.deepcopy(good) for name in ("earlier:all", "later:all", "later:at-least-90-percent")}
    assert decide(0.5, True, evaluations, protocol)["verdict"] == "advance-to-integration-assessment"
    assert decide(0, True, evaluations, protocol)["verdict"] == "reject-component"
    assert decide(0.5, False, evaluations, protocol)["verdict"] == "reject-component"
    evaluations["later:all"]["comparisons"]["shotOnly"]["interval95"][1] = 0
    assert decide(0.5, True, evaluations, protocol)["verdict"] == "reject-component"
    print("Candidate2 self-checks passed: neutral budgets, observed-exposure reconstruction, exact control, target isolation, selection isolation and rejection boundaries.")


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
        parser.error("Refusing to overwrite an existing candidate2 artifact.")
    protocol, rows, hashes = load_inputs()
    metadata = {"sourceSha256": hashes, "implementationSha256": fingerprint(Path(__file__)),
                "protocolVersion": protocol["version"], "runtime": {"python": platform.python_version()}}
    if args.stage == "select":
        report = {"version": "mid-iq-candidate-2-selection-1", "scope": "earlier-only-role-cost-selection", **metadata, **select_earlier(rows, protocol)}
    else:
        selection_path = Path(args.selection)
        selection_hash = fingerprint(selection_path)
        selection = parse_research_json(selection_path.read_text(encoding="utf-8"))
        assert selection["version"] == "mid-iq-candidate-2-selection-1"
        for key, value in metadata.items():
            assert selection[key] == value, f"Selection metadata mismatch: {key}"
        expected = select_earlier(rows, protocol)
        assert all(selection[key] == value for key, value in expected.items()), "Selection differs from earlier-only minimum."
        report = {"version": "mid-iq-candidate-2-result-1", "scope": "selected-role-cost-evaluation", **metadata,
                  "selectionSha256": selection_hash, **evaluate_selected(rows, protocol, selection)}
        assert fingerprint(selection_path) == selection_hash
    verify_hashes(hashes)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(report, handle, indent=2, allow_nan=False)
        handle.write("\n")
    print(json.dumps({"stage": args.stage, "selectedPassingWeight": report["selectedPassingWeight"], "decision": report.get("decision")}, indent=2))


if __name__ == "__main__":
    main()