"""Audit frozen peak records and emit offline possession inputs, never production data."""
import argparse
import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

from franchise_map import HISTORICAL_TEAM_MAP
from process_players import load_data, process_peak_players, filter_and_balance

ROOT = Path(__file__).resolve().parents[2]
FIELDS = {
    "minutes": "mp_per_game", "points": "pts_per_game", "assists": "ast_per_game",
    "fieldGoalAttempts": "fga_per_game", "freeThrowAttempts": "fta_per_game",
    "turnovers": "tov_per_game", "fieldGoals": "fg_per_game",
    "freeThrows": "ft_per_game", "threePointAttempts": "x3pa_per_game",
    "threePointers": "x3p_per_game", "offensiveRebounds": "orb_per_game",
}
REQUIRED = ("minutes", "points", "assists", "fieldGoalAttempts", "freeThrowAttempts", "turnovers")


def number(value):
    if value is None or value.strip() in ("", "NA"):
        return None
    result = float(value)
    if not math.isfinite(result) or result < 0:
        raise ValueError(f"Invalid nonnegative statistic: {value}")
    return result


def aggregate(rows):
    totals = {
        field: None if any(row["stats"][field] is None for row in rows)
        else sum(row["games"] * row["stats"][field] for row in rows)
        for field in FIELDS
    }
    minutes = totals["minutes"]
    if not minutes or not rows:
        raise ValueError("Positive observed minutes are required.")
    per36 = {field: None if value is None else 36 * value / minutes for field, value in totals.items() if field != "minutes"}
    ready = all(totals[field] is not None for field in REQUIRED)
    shot_ends = None if totals["fieldGoalAttempts"] is None or totals["freeThrowAttempts"] is None else totals["fieldGoalAttempts"] + 0.44 * totals["freeThrowAttempts"]
    used_ends = shot_ends + totals["turnovers"] if ready and shot_ends is not None else None
    return {
        "totals": totals, "per36": per36, "ready": ready,
        "shotPointsPerEnd": totals["points"] / shot_ends if shot_ends and totals["points"] is not None else None,
        "trueShootingProxy": totals["points"] / (2 * shot_ends) if shot_ends and totals["points"] is not None else None,
        "turnoverShare": totals["turnovers"] / used_ends if used_ends else None,
        "usedEndsPer36": 36 * used_ends / minutes if used_ends else None,
    }


def self_test():
    assert number("NA") is None and number("") is None and number("0") == 0
    for invalid in ("nan", "inf", "-1"):
        try:
            number(invalid)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid value accepted")
    first = {field: 1.0 for field in FIELDS}
    first.update(minutes=10, points=10, fieldGoalAttempts=5, freeThrowAttempts=0, turnovers=1)
    second = {**first, "minutes": 30, "points": 30, "fieldGoalAttempts": 10, "turnovers": 2}
    rows = [{"games": 10, "stats": first}, {"games": 20, "stats": second}]
    result = aggregate(rows)
    assert result["per36"]["points"] == 36
    assert result["shotPointsPerEnd"] == 700 / 250
    assert result["turnoverShare"] == 50 / 300
    assert result["ready"]
    missing = aggregate([rows[0], {"games": 20, "stats": {**second, "turnovers": None}}])
    assert not missing["ready"] and missing["turnoverShare"] is None
    zero = aggregate([{"games": 10, "stats": {**first, "turnovers": 0}}])
    assert zero["ready"] and zero["turnoverShare"] == 0
    print("Audit self-checks passed: pooled exposure, missing versus zero, finite inputs.")


def build_audit():
    source_paths = ["data/raw/Player Per Game.csv", "data/raw/Advanced.csv", "data/processed/players.json",
                    "data/reference/mid-iq-roster-benchmarks.json", "scripts/data_pipeline/process_players.py",
                    "scripts/data_pipeline/franchise_map.py", "scripts/data_pipeline/curated_defense.py"]
    hashes = {path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest() for path in source_paths}
    stored = json.loads((ROOT / "data/processed/players.json").read_text(encoding="utf-8"))
    reconstructed = filter_and_balance(process_peak_players(load_data()))
    assert reconstructed == stored, "Importer does not exactly reproduce stored player versions; stop before enrichment."
    raw = defaultdict(list)
    with (ROOT / "data/raw/Player Per Game.csv").open(encoding="utf-8", newline="") as source:
        for line, row in enumerate(csv.DictReader(source), 2):
            if row["lg"] != "NBA" or row["team"].endswith("TM") or row["team"] == "TOT":
                continue
            franchise = HISTORICAL_TEAM_MAP.get(row["team"])
            games, minutes = number(row["g"]), number(row["mp_per_game"])
            if not franchise or games is None or minutes is None or games < 10 or minutes < 8:
                continue
            raw[(row["player_id"], franchise, int(row["season"]))].append((line, row))
    advanced = defaultdict(list)
    with (ROOT / "data/raw/Advanced.csv").open(encoding="utf-8", newline="") as source:
        for line, row in enumerate(csv.DictReader(source), 2):
            if row["lg"] == "NBA":
                advanced[(row["player_id"], row["team"], int(row["season"]))].append((line, row))
    entries = []
    issues = []
    for player in stored:
        identity = player["id"].split("_")[0]
        selected = []
        for season in player["peakYears"]:
            candidates = raw[(identity, player["franchise"], season)]
            if len(candidates) != 1:
                issues.append({"id": player["id"], "season": season, "kind": "ambiguous-peak-row", "matches": len(candidates)})
                continue
            line, row = candidates[0]
            adv = advanced[(identity, row["team"], season)]
            if len(adv) != 1:
                issues.append({"id": player["id"], "season": season, "kind": "advanced-join", "matches": len(adv)})
            stats = {field: number(row[column]) for field, column in FIELDS.items()}
            if season < 1980:
                stats["threePointers"] = stats["threePointAttempts"] = 0.0
            selected.append({"season": season, "team": row["team"], "csvLine": line,
                             "games": number(row["g"]), "stats": stats,
                             "advancedCsvLines": [entry[0] for entry in adv],
                             "reportedTrueShooting": number(adv[0][1]["ts_percent"]) if len(adv) == 1 else None})
        unique_seasons = len(set(player["peakYears"])) == len(player["peakYears"])
        if not unique_seasons:
            issues.append({"id": player["id"], "kind": "repeated-peak-season"})
        complete_join = len(selected) == len(player["peakYears"]) and unique_seasons
        result = aggregate(selected) if complete_join else None
        entries.append({"id": player["id"], "decade": player["decade"], "peakYears": player["peakYears"],
                        "ready": bool(result and result["ready"]), "selected": selected, "aggregate": result})
    catalog = json.loads((ROOT / "data/reference/mid-iq-roster-benchmarks.json").read_text(encoding="utf-8"))
    by_id = {entry["id"]: entry for entry in entries}
    benchmarks = [{"id": roster["id"], "unsupportedIds": [identity for identity in roster["players"] if not by_id[identity]["ready"]]} for roster in catalog["rosters"]]
    missing_fields = Counter(field for entry in entries for row in entry["selected"] for field, value in row["stats"].items() if value is None)
    per_decade = {decade: {"total": sum(entry["decade"] == decade for entry in entries),
                           "ready": sum(entry["decade"] == decade and entry["ready"] for entry in entries)}
                  for decade in sorted({entry["decade"] for entry in entries})}
    assert hashes == {path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest() for path in source_paths}
    return {"version": "mid-iq-possession-input-audit-1", "scope": "offline-data-audit", "sourceSha256": hashes,
            "auditImplementationSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "reproducedPlayers": len(stored), "readyPlayers": sum(entry["ready"] for entry in entries),
            "perDecade": per_decade, "missingSelectedFieldOccurrences": dict(missing_fields),
            "joinIssues": issues, "benchmarks": benchmarks, "players": entries,
            "method": "Preserve importer-selected peak records exactly; pool games times per-game values, divide by total observed minutes for per36. Ratios use pooled counts, not averaged percentages.",
            "limitations": ["Rounded per-game source values approximate totals. The 0.44 free-throw factor is an explicit conventional proxy, not measured possessions.",
                            "Missing turnovers and offensive rebounds are null, never zero. Only pre-1980 three-point attempts/makes use rule-defined structural zero.",
                            "Ready denotes complete core offensive fields, not historical comparability or calibrated team strength. Advanced TS% is recorded, not averaged or used to fill missing data.",
                            "No processed players, peak years, live ratings or benchmark expectations changed. No win predictions or independent validation performed."]}


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
    destination = Path(args.output)
    if destination.exists():
        parser.error("Refusing to overwrite an existing audit.")
    report = build_audit()
    with destination.open("x", encoding="utf-8") as output:
        json.dump(report, output, indent=2, allow_nan=False)
        output.write("\n")
    print(json.dumps({key: value for key, value in report.items() if key not in ("players", "sourceSha256")}, indent=2))


if __name__ == "__main__":
    main()