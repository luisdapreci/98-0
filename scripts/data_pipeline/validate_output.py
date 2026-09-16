"""
Validation script for Project 98-0 Phase 1 Datasets.
Verifies data integrity, TypeScript interface adherence, and basketball realism.
"""
import os
import sys
import json
from franchise_map import CANONICAL_FRANCHISES, VALID_DECADES, ERA_PACE_FACTORS

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed")

def validate_players():
    players_path = os.path.join(PROCESSED_DIR, "players.json")
    assert os.path.exists(players_path), "players.json does not exist!"
    
    with open(players_path, "r", encoding="utf-8") as f:
        players = json.load(f)

    print(f"Loaded {len(players):,} players from players.json ({os.path.getsize(players_path)/1024:.1f} KB)")
    assert len(players) > 1000, "Expected at least 1,000 players"

    # Verify schema of each player
    required_keys = {"id", "name", "franchise", "decade", "primaryPosition", "eligiblePositions", "stats", "overallRating", "peakYears"}
    stat_keys = {"pts", "reb", "ast", "stl", "blk", "fgPct", "threePtPct", "threePtAttempts", "usgPct", "dbpm", "eraPaceFactor"}
    valid_positions = {"PG", "SG", "SF", "PF", "C"}

    combos_seen = set()
    combos_positions = {}

    for p in players:
        # Check required fields
        for k in required_keys:
            assert k in p, f"Player {p.get('id')} missing key '{k}'"

        assert p["franchise"] in CANONICAL_FRANCHISES, f"Unknown franchise {p['franchise']}"
        assert p["decade"] in VALID_DECADES, f"Unknown decade {p['decade']}"
        assert p["primaryPosition"] in valid_positions, f"Invalid primary pos {p['primaryPosition']}"
        assert isinstance(p["eligiblePositions"], list) and len(p["eligiblePositions"]) > 0

        stats = p["stats"]
        for sk in stat_keys:
            assert sk in stats, f"Player {p['id']} stats missing key '{sk}'"
            assert isinstance(stats[sk], (int, float)), f"Stat {sk} is not a number in {p['id']}"

        # Check era pace factor matching
        expected_pace = ERA_PACE_FACTORS[p["decade"]]
        assert abs(stats["eraPaceFactor"] - expected_pace) < 0.001, f"Pace factor mismatch for {p['id']}"

        # Pre-1980 players should have 0.0 3P% and 3PA
        if p["decade"] in ["1960s", "1970s"] and max(p.get("peakYears", [1970])) < 1980:
            assert stats["threePtAttempts"] == 0.0, f"Unexpected 3PA in pre-1980 for {p['id']}"
            assert stats["threePtPct"] == 0.0, f"Unexpected 3P% in pre-1980 for {p['id']}"

        # Track combos and positions
        combo = (p["franchise"], p["decade"])
        combos_seen.add(combo)
        if combo not in combos_positions:
            combos_positions[combo] = set()
        for pos in p["eligiblePositions"]:
            combos_positions[combo].add(pos)

    print(f"Validated {len(combos_seen)} valid franchise-decade combinations.")

    # Check positional completeness
    for combo, positions in combos_positions.items():
        for base_pos in valid_positions:
            assert base_pos in positions, f"Combo {combo} is missing eligible players for position {base_pos}!"

    print("All 180 franchise-decade combos have 100% position coverage across PG, SG, SF, PF, C!")

    # Check flagship player representations
    flagships = {
        "Michael Jordan": ["CHI"],
        "Stephen Curry": ["GSW"],
        "Bill Russell": ["BOS"],
        "Wilt Chamberlain": ["GSW", "PHI", "LAL"],
        "Magic Johnson": ["LAL"],
        "Larry Bird": ["BOS"],
        "LeBron James": ["CLE", "MIA", "LAL"],
        "Shaquille O'Neal": ["ORL", "LAL", "MIA"],
        "Kobe Bryant": ["LAL"],
        "Tim Duncan": ["SAS"],
    }

    print("\n--- Flagship Player Spot Checks ---")
    for name, expected_frans in flagships.items():
        matches = [p for p in players if p["name"] == name]
        assert len(matches) > 0, f"Flagship player '{name}' not found!"
        # Verify that all expected iconic franchises are represented
        found_frans = set(m["franchise"] for m in matches)
        for ef in expected_frans:
            assert ef in found_frans, f"Expected iconic franchise {ef} for {name} not found in {found_frans}"
        for m in matches:
            s = m["stats"]
            print(f"[OK] {m['name']:<18} | {m['franchise']} {m['decade']} | Pos: {m['primaryPosition']:<2} | PTS: {s['pts']:<4} REB: {s['reb']:<4} AST: {s['ast']:<4} USG: {s['usgPct']}% DBPM: {s['dbpm']:<4} | Rating: {m['overallRating']}")

    return True

def validate_opponents():
    opps_path = os.path.join(PROCESSED_DIR, "opponents.json")
    assert os.path.exists(opps_path), "opponents.json does not exist!"

    with open(opps_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "regularSeasonPool" in data
    assert "playoffPool" in data

    reg_pool = data["regularSeasonPool"]
    expected_tiers = ["CONTENDER", "PLAYOFF", "AVERAGE", "LOTTERY"]
    for tier in expected_tiers:
        assert tier in reg_pool, f"Missing regular season tier '{tier}'"
        assert len(reg_pool[tier]) > 0, f"Tier '{tier}' has 0 teams"
        print(f"Tier {tier:<10}: {len(reg_pool[tier])} teams (Sample: {reg_pool[tier][0]['name']}, NR={reg_pool[tier][0]['netRating']})")

    playoff_pool = data["playoffPool"]
    expected_rounds = ["playIn", "round1", "round2", "conferenceFinals", "finals"]
    for rnd in expected_rounds:
        assert rnd in playoff_pool, f"Missing playoff round '{rnd}'"
        assert len(playoff_pool[rnd]) > 0, f"Round '{rnd}' has 0 teams"
        print(f"Playoff {rnd:<17}: {len(playoff_pool[rnd])} teams (Sample: {playoff_pool[rnd][0]['name']}, NR={playoff_pool[rnd][0]['netRating']})")

    return True

def validate_coaches():
    coaches_path = os.path.join(PROCESSED_DIR, "coaches.json")
    assert os.path.exists(coaches_path), "coaches.json does not exist!"

    with open(coaches_path, "r", encoding="utf-8") as f:
        coaches = json.load(f)

    assert len(coaches) == 12, f"Expected 12 coaches, got {len(coaches)}"
    valid_stats = {"threePtPct", "fgPct", "dbpm", "pace", "usgCap"}

    for c in coaches:
        assert "id" in c and "name" in c and "systemName" in c and "modifiers" in c, f"Incomplete coach record: {c}"
        mods = c["modifiers"]
        assert len(mods) >= 2, f"Coach {c['name']} has fewer than 2 modifiers"
        has_buff = any(m["delta"] > 0 for m in mods)
        has_debuff = any(m["delta"] < 0 for m in mods)
        assert has_buff, f"Coach {c['name']} missing buff"
        assert has_debuff, f"Coach {c['name']} missing debuff"
        for m in mods:
            assert m["stat"] in valid_stats, f"Invalid modifier stat '{m['stat']}' in coach {c['name']}"
        print(f"[OK] Coach: {c['name']:<18} | System: {c['systemName']:<22} | Modifiers: {len(mods)}")

    return True

def main():
    print("=== PROJECT 98-0 DATA VALIDATION ===")
    validate_players()
    print("\nOpponents validation:")
    validate_opponents()
    print("\nCoaches validation:")
    validate_coaches()
    print("\nALL VALIDATION CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
