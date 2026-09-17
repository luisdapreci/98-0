"""Outcome-conditioned error attribution for the frozen possession prototype."""
import argparse
import csv
import itertools
import json
from research_files import parse_research_json
import math
from collections import defaultdict
from pathlib import Path

from audit_era_baselines import fingerprint
from audit_possessions import ROOT, FIELDS, number
from audit_team_offense import paired
from audit_team_roles import metrics

FIELDS_USED = ("points", "fieldGoalAttempts", "freeThrowAttempts", "turnovers", "offensiveRebounds")
COMPONENTS = ("shooting", "turnovers", "rebounds")
PERIODS = {"earlier": (1981, 2012), "later": (2013, 2026),
           "laterEarly": (2013, 2019), "laterRecent": (2020, 2026)}
PROTOCOL = {
    "version": "possession-error-diagnostic-1",
    "scope": "One bounded offline diagnostic; no fitting, benchmark scoring, coefficient changes or release decision.",
    "equation": "100 * shooting / (1 + turnovers - rebounds), where shooting=PTS/S, turnovers=TOV/S, rebounds=ORB/S, S=FGA+0.44FTA.",
    "inputs": "Frozen historical lagged player rates and target minutes; reproduce both topFive and wholeRoster projections before diagnostics.",
    "outcomes": "Pool target-season NBA team stints by games times per-game counts. Match frozen player identities, minutes and CSV lineage exactly; exclude TOT/nTM and zero-minute zero-count stints.",
    "attribution": "Six-order Shapley decomposition of predicted proxy minus observed whole-team proxy across three components. Center each attribution within the full season before cohort selection.",
    "residual": "Observed whole-team box proxy minus official ORTG, both equal-team season centered. Retain separately; never label it a player component error.",
    "mseAttribution": "Mean(component error * total official-rating error); sums to MSE with the residual. Signed covariance allocation, not independent component MSE or causal importance.",
    "oracle": "Replace one projected ratio at a time with its observed whole-team ratio; recenter each hybrid across full season. Outcome-conditioned diagnostics, NOT deployable predictions or matched causal interventions.",
    "workload": "Primary: frozen 75 possessions per36 divided by projected per36 net possessions. Sensitivity: observed target per36 net possessions divided by projected net possessions; uses outcomes, diagnostic only.",
    "bins": "Fixed workload bins <=1, (1,1.25], >1.25. No ceiling selected or penalty fitted.",
    "association": "Pearson correlation with absolute official-rating error and absolute centered component errors; also correlate season-demeaned values. Associations are descriptive, not causal load-efficiency estimates.",
    "cohorts": "Earlier1981-2012; later2013-2026; laterEarly2013-2019; laterRecent2020-2026. All teams and >=90% prior-minute coverage. No new holdout claim.",
    "uncertainty": "Normal 95% season-cluster intervals for mean covariance contributions and paired oracle MSE differences; no multiplicity correction. Small-cluster estimates are approximate.",
    "stop": "Diagnose only. No automatic component model, imputation, workload penalty or parameter search after viewing results.",
}


def components(totals):
    shots = totals["fieldGoalAttempts"] + 0.44 * totals["freeThrowAttempts"]
    assert shots > 0
    result = {"shooting": totals["points"] / shots, "turnovers": totals["turnovers"] / shots,
              "rebounds": totals["offensiveRebounds"] / shots}
    assert all(math.isfinite(value) and value >= 0 for value in result.values())
    assert result["rebounds"] < 1
    return result


def score(ratios):
    denominator = 1 + ratios["turnovers"] - ratios["rebounds"]
    assert denominator > 0
    result = 100 * ratios["shooting"] / denominator
    assert math.isfinite(result)
    return result


def decompose(predicted, observed):
    contribution = dict.fromkeys(COMPONENTS, 0.0)
    for order in itertools.permutations(COMPONENTS):
        current = dict(observed)
        for name in order:
            before = score(current)
            current[name] = predicted[name]
            contribution[name] += (score(current) - before) / 6
    assert math.isclose(math.fsum(contribution.values()), score(predicted) - score(observed), abs_tol=1e-9)
    return contribution


def project(players, model):
    selected = sorted(players, key=lambda player: (-player["minutes"], player["id"]))[:5] if model == "topFive" else players
    weights = [1 if model == "topFive" else player["minutes"] for player in selected]
    total_weight = math.fsum(weights)
    totals = {field: 180 * math.fsum(player["rates"][field] * weight for player, weight in zip(selected, weights, strict=True)) / total_weight
              for field in FIELDS_USED}
    net = totals["fieldGoalAttempts"] + 0.44 * totals["freeThrowAttempts"] + totals["turnovers"] - totals["offensiveRebounds"]
    return components(totals), net


def load_outcomes():
    teams = defaultdict(list)
    seen = set()
    with (ROOT / "data/raw/Player Per Game.csv").open(encoding="utf-8", newline="") as handle:
        for line, raw in enumerate(csv.DictReader(handle), 2):
            season = int(raw["season"])
            if raw["lg"] != "NBA" or not 1981 <= season <= 2026 or raw["team"] == "TOT" or raw["team"].endswith("TM"):
                continue
            games = number(raw["g"])
            assert games is not None
            if games == 0:
                continue
            key = (season, raw["team"], raw["player_id"])
            assert key not in seen
            seen.add(key)
            values = {field: number(raw[FIELDS[field]]) for field in ("minutes",) + FIELDS_USED}
            assert all(value is not None for value in values.values()), f"Missing field: {line}"
            totals = {field: value * games for field, value in values.items()}
            if totals["minutes"] == 0:
                assert all(totals[field] == 0 for field in FIELDS_USED)
                continue
            teams[(season, raw["team"])].append({"id": raw["player_id"], "line": line, **totals})
    return teams


def clustered_mean(rows, values):
    mean = math.fsum(values) / len(values)
    groups = defaultdict(float)
    for row, value in zip(rows, values, strict=True):
        groups[row["season"]] += value - mean
    count = len(groups)
    interval = None
    if count > 1:
        error = math.sqrt(count / (count - 1) * math.fsum(value ** 2 for value in groups.values()) / len(values) ** 2)
        interval = [mean - 1.96 * error, mean + 1.96 * error]
    return {"mean": mean, "interval95": interval, "seasonClusters": count}


def correlation(first, second):
    if len(first) < 3:
        return None
    mean_first, mean_second = math.fsum(first) / len(first), math.fsum(second) / len(second)
    centered_first = [value - mean_first for value in first]
    centered_second = [value - mean_second for value in second]
    denominator = math.sqrt(math.fsum(value ** 2 for value in centered_first) * math.fsum(value ** 2 for value in centered_second))
    return math.fsum(first * second for first, second in zip(centered_first, centered_second, strict=True)) / denominator if denominator > 0 else None


def demean(rows, values):
    groups = defaultdict(list)
    for row, value in zip(rows, values, strict=True):
        groups[row["season"]].append(value)
    means = {season: math.fsum(group) / len(group) for season, group in groups.items()}
    return [value - means[row["season"]] for row, value in zip(rows, values, strict=True)]


def summarize(rows):
    actual, predicted = [row["target"] for row in rows], [row["prediction"] for row in rows]
    errors = [prediction - target for prediction, target in zip(predicted, actual, strict=True)]
    attribution = {name: clustered_mean(rows, [row["attribution"][name] * error for row, error in zip(rows, errors, strict=True)])
                   for name in COMPONENTS + ("proxyResidual",)}
    assert math.isclose(math.fsum(value["mean"] for value in attribution.values()), math.fsum(error ** 2 for error in errors) / len(rows), abs_tol=1e-8)
    associations = {}
    for workload in ("fixedWorkload", "observedWorkload"):
        values = [row[workload] for row in rows]
        outcomes = {"absoluteError": [abs(error) for error in errors],
                    **{name: [abs(row["attribution"][name]) for row in rows] for name in COMPONENTS}}
        bins = {}
        for label, lower, upper in (("atMost1", 0, 1), ("1to1.25", 1, 1.25), ("above1.25", 1.25, math.inf)):
            selected = [row for row in rows if lower < row[workload] <= upper]
            bins[label] = {"teams": len(selected), "metrics": metrics([row["target"] for row in selected], [row["prediction"] for row in selected]) if selected else None}
        associations[workload] = {"bins": bins, "correlations": {name: {
            "pooled": correlation(values, outcome), "withinSeason": correlation(demean(rows, values), demean(rows, outcome))}
            for name, outcome in outcomes.items()}}
    return {"teams": len(rows), "metrics": metrics(actual, predicted), "mseAttribution": attribution,
            "componentRatioErrors": {name: metrics([row["observed"][name] for row in rows], [row["projected"][name] for row in rows]) for name in COMPONENTS},
            "observedProxyMetrics": metrics(actual, [row["observedProxyCentered"] for row in rows]),
            "oracles": {name: {"metrics": metrics(actual, [row["oracles"][name] for row in rows]),
                               "pairedAgainstFrozen": paired(rows, [row["oracles"][name] for row in rows], predicted)} for name in COMPONENTS},
            "workload": associations}


def self_test():
    observed = {"shooting": 1.1, "turnovers": 0.15, "rebounds": 0.1}
    predicted = {"shooting": 1.2, "turnovers": 0.2, "rebounds": 0.08}
    assert decompose(observed, observed) == dict.fromkeys(COMPONENTS, 0.0)
    forward, reverse = decompose(predicted, observed), decompose(observed, predicted)
    for name in COMPONENTS:
        assert math.isclose(forward[name], -reverse[name], abs_tol=1e-10)
        changed = {**observed, name: predicted[name]}
        single = decompose(changed, observed)
        assert all(math.isclose(value, 0, abs_tol=1e-10) for key, value in single.items() if key != name)
    assert forward["shooting"] > 0 and forward["turnovers"] < 0 and forward["rebounds"] < 0
    rates = dict(points=0.5, fieldGoalAttempts=0.4, freeThrowAttempts=0.1, turnovers=0.05, offensiveRebounds=0.04)
    players = [{"id": str(index), "minutes": 100 + index, "rates": rates} for index in range(6)]
    for model in ("topFive", "wholeRoster"):
        assert project(players, model) == project(list(reversed(players)), model)
        assert project(players, model) == project([{**player, "targetPoints": 9999} for player in players], model)
    assert math.isclose(correlation([1, 2, 3], [2, 4, 6]), 1)
    assert correlation([1, 1, 1], [2, 4, 6]) is None
    print("Passed exact attribution, symmetry, single-component isolation, projection isolation, ordering and association checks.")


def build_report():
    history_path = "docs/research/mid-iq/MID_IQ_HISTORICAL_TEAM_OFFENSE_1.json"
    prototype_path = "docs/research/mid-iq/MID_IQ_POSSESSION_OFFENSE_2.json"
    history = parse_research_json((ROOT / history_path).read_text(encoding="utf-8"))
    prototype = parse_research_json((ROOT / prototype_path).read_text(encoding="utf-8"))
    assert history["version"] == "mid-iq-historical-team-offense-1"
    assert prototype["version"] == "mid-iq-possession-offense-2"
    hashes = {**prototype["sourceSha256"], history_path: fingerprint(ROOT / history_path), prototype_path: fingerprint(ROOT / prototype_path)}
    for path, expected in hashes.items():
        assert fingerprint(ROOT / path) == expected, f"Stale source: {path}"
    outcomes = load_outcomes()
    assert set(outcomes) == {(row["season"], row["team"]) for row in history["rows"]}
    frozen = {(row["season"], row["team"]): row for row in prototype["historicalRows"]}
    rows = []
    for source in history["rows"]:
        key = (source["season"], source["team"])
        target_players = outcomes[key]
        assert {(player["id"], player["line"], player["minutes"]) for player in target_players} == {
            (player["id"], player["targetCsvLine"], player["minutes"]) for player in source["players"]}
        totals = {field: math.fsum(player[field] for player in target_players) for field in ("minutes",) + FIELDS_USED}
        observed = components(totals)
        observed_net = 180 * (totals["fieldGoalAttempts"] + 0.44 * totals["freeThrowAttempts"] + totals["turnovers"] - totals["offensiveRebounds"]) / totals["minutes"]
        for model in ("topFive", "wholeRoster"):
            projected, net = project(source["players"], model)
            assert math.isclose(score(projected), frozen[key]["raw"][model], abs_tol=1e-9)
            assert math.isclose(75 / net, frozen[key]["workload"][model], abs_tol=1e-9)
            rows.append({"season": key[0], "team": key[1], "model": model, "target": source["target"],
                         "coverage": source["priorMinuteCoverage"], "prediction": frozen[key]["predictions"][model],
                         "projected": projected, "observed": observed, "observedProxy": score(observed),
                         "fixedWorkload": 75 / net, "observedWorkload": observed_net / net,
                         "attribution": decompose(projected, observed),
                         "oracles": {name: score({**projected, name: observed[name]}) for name in COMPONENTS},
                         "outcomeCsvLines": [player["line"] for player in target_players]})
    groups = defaultdict(list)
    for row in rows:
        groups[(row["season"], row["model"])].append(row)
    for group in groups.values():
        mean_observed = math.fsum(row["observedProxy"] for row in group) / len(group)
        means = {name: math.fsum(row["attribution"][name] for row in group) / len(group) for name in COMPONENTS}
        oracle_means = {name: math.fsum(row["oracles"][name] for row in group) / len(group) for name in COMPONENTS}
        for row in group:
            row["observedProxyCentered"] = row["observedProxy"] - mean_observed
            row["attribution"] = {name: row["attribution"][name] - means[name] for name in COMPONENTS}
            row["attribution"]["proxyResidual"] = row["observedProxyCentered"] - row["target"]
            row["oracles"] = {name: row["oracles"][name] - oracle_means[name] for name in COMPONENTS}
            assert math.isclose(math.fsum(row["attribution"].values()), row["prediction"] - row["target"], abs_tol=1e-8)
    evaluations = {}
    for period, (first, last) in PERIODS.items():
        for model in ("topFive", "wholeRoster"):
            for cohort in ("all", "coverage90"):
                selected = [row for row in rows if first <= row["season"] <= last and row["model"] == model
                            and (cohort == "all" or row["coverage"] >= 0.9)]
                evaluations[f"{period}:{model}:{cohort}"] = summarize(selected)
    for path, expected in hashes.items():
        assert fingerprint(ROOT / path) == expected, f"Changed source: {path}"
    return {"version": "mid-iq-possession-error-diagnostic-1", "protocol": PROTOCOL,
            "sourceSha256": hashes, "implementationSha256": fingerprint(Path(__file__)),
            "teamSeasons": len(history["rows"]), "evaluations": evaluations, "rows": rows,
            "limitations": ["Oracle results contain target outcomes and cannot be treated as prediction accuracy or gameplay improvements.",
                            "Component ratios share shot denominators; Shapley allocation is exact accounting, not causal identification.",
                            "Whole-team outcomes are the target for both representations; top-five errors include omitted reserves and equal-time assumptions.",
                            "Player-count rounding, team-only events and the box possession proxy differ from official team offense.",
                            "Workload uses projected net possession volume, not measured shot-creation capacity. The outcome-volume sensitivity is explicitly outcome-conditioned.",
                            "Source data and later seasons were previously exposed. 2026 data are used as stored. No benchmark targets are read for tuning."]}


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
    print(json.dumps({model: report["evaluations"][f"later:{model}:all"] for model in ("topFive", "wholeRoster")}, indent=2))


if __name__ == "__main__":
    main()