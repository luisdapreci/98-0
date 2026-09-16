"""
Processes raw player season and advanced stats into Project 98-0 static format.
Calculates peak 3-year weighted averages for each player per franchise per decade.
Outputs: data/processed/players.json
"""
import os
import csv
import json
from collections import defaultdict
from franchise_map import HISTORICAL_TEAM_MAP, ERA_PACE_FACTORS, get_decade, CANONICAL_FRANCHISES
from curated_defense import get_curated_defense

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw")
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed")

# Position compatibility / natural basketball adjacencies
POSITION_ADJACENCIES = {
    "PG": ["PG", "SG"],
    "SG": ["SG", "PG", "SF"],
    "SF": ["SF", "SG", "PF"],
    "PF": ["PF", "SF", "C"],
    "C":  ["C", "PF"],
}

def safe_float(val, default=0.0):
    try:
        if val is None or val == "" or val == "NA":
            return default
        return float(val)
    except (ValueError, TypeError):
        return default

def safe_int(val, default=0):
    try:
        if val is None or val == "" or val == "NA":
            return default
        return int(val)
    except (ValueError, TypeError):
        return default

def load_data():
    """Loads and merges Player Per Game and Advanced CSVs."""
    print("[LOAD] Loading Advanced.csv...")
    advanced_map = {}
    with open(os.path.join(RAW_DIR, "Advanced.csv"), "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r["lg"] != "NBA":
                continue
            key = (r["season"], r["player_id"], r["team"])
            advanced_map[key] = r

    print("[LOAD] Loading Player Per Game.csv and merging...")
    records = []
    with open(os.path.join(RAW_DIR, "Player Per Game.csv"), "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r["lg"] != "NBA":
                continue
            team_raw = r["team"]
            if team_raw.endswith("TM") or team_raw == "TOT":
                continue
            
            franchise = HISTORICAL_TEAM_MAP.get(team_raw)
            if not franchise:
                continue

            season = safe_int(r["season"])
            decade = get_decade(season)
            if not decade:
                continue

            games = safe_int(r["g"])
            mp_per_game = safe_float(r["mp_per_game"])
            
            # Minimum threshold for an individual season to be considered
            if games < 10 or mp_per_game < 8.0:
                continue

            key = (r["season"], r["player_id"], team_raw)
            adv = advanced_map.get(key, {})

            # Usage Rate calculation
            usg_raw = safe_float(adv.get("usg_percent"))
            fga = safe_float(r["fga_per_game"])
            fta = safe_float(r["fta_per_game"])
            if usg_raw > 0:
                usg = usg_raw
            else:
                # Historical calibrated proxy for pre-1978 seasons
                usg = 50.0 * (fga + 0.44 * fta) / max(mp_per_game, 1.0)
                usg = max(10.0, min(usg, 42.0))

            # Defensive Box Plus/Minus and Stocks (Steals/Blocks)
            dbpm_raw = adv.get("dbpm")
            stl_raw = r["stl_per_game"]
            blk_raw = r["blk_per_game"]

            is_curated_def = False
            pos = (r["pos"] or "SF").strip().upper()
            if pos not in ["PG", "SG", "SF", "PF", "C"]:
                pos = "SF"

            if season < 1974 or dbpm_raw is None or dbpm_raw == "NA":
                cur_dbpm, cur_blk, cur_stl = get_curated_defense(r["player_id"], pos)
                dbpm = cur_dbpm
                blk = cur_blk if (blk_raw == "NA" or blk_raw == "") else safe_float(blk_raw)
                stl = cur_stl if (stl_raw == "NA" or stl_raw == "") else safe_float(stl_raw)
                is_curated_def = True
            else:
                dbpm = safe_float(dbpm_raw)
                blk = safe_float(blk_raw)
                stl = safe_float(stl_raw)

            # 3PT metrics (introduced in 1979-80)
            if season < 1980:
                three_pt_pct = 0.0
                three_pt_att = 0.0
            else:
                three_pt_att = safe_float(r["x3pa_per_game"])
                three_pt_pct = safe_float(r["x3p_percent"]) if three_pt_att > 0 else 0.0

            # Win Shares and BPM for ranking peak seasons
            ws = safe_float(adv.get("ws"), 0.0)
            bpm = safe_float(adv.get("bpm"), 0.0)

            # Composite single-season performance rating for peak selection
            pts = safe_float(r["pts_per_game"])
            reb = safe_float(r["trb_per_game"])
            ast = safe_float(r["ast_per_game"])
            fg_pct = safe_float(r["fg_percent"])

            season_score = pts + (reb * 1.2) + (ast * 1.5) + (stl * 2.0) + (blk * 2.0) + (ws * 2.5) + (bpm * 1.5)

            records.append({
                "player_id": r["player_id"],
                "name": r["player"].strip(),
                "franchise": franchise,
                "decade": decade,
                "season": season,
                "pos": pos,
                "games": games,
                "mp_per_game": mp_per_game,
                "total_mp": games * mp_per_game,
                "pts": pts,
                "reb": reb,
                "ast": ast,
                "stl": stl,
                "blk": blk,
                "fg_pct": fg_pct,
                "three_pt_att": three_pt_att,
                "three_pt_pct": three_pt_pct,
                "usg": usg,
                "dbpm": dbpm,
                "is_curated_def": is_curated_def,
                "season_score": season_score,
            })

    print(f"[LOAD] Loaded {len(records):,} valid player-seasons.")
    return records

def process_peak_players(records):
    """
    Groups records by (player_id, franchise, decade) and finds peak 3-year average.
    """
    groups = defaultdict(list)
    for r in records:
        key = (r["player_id"], r["franchise"], r["decade"])
        groups[key].append(r)

    processed_players = []

    for (player_id, franchise, decade), seasons in groups.items():
        # Require at least 20 total games with the franchise in the decade
        total_games = sum(s["games"] for s in seasons)
        total_minutes = sum(s["total_mp"] for s in seasons)
        if total_games < 20 or total_minutes < 300:
            continue

        # Sort seasons by performance score descending
        seasons.sort(key=lambda s: s["season_score"], reverse=True)
        # Take peak up to 3 seasons
        peak_seasons = seasons[:3]

        # Calculate weighted averages (weighted by minutes played in the season)
        sum_mp = sum(s["total_mp"] for s in peak_seasons)
        if sum_mp <= 0:
            continue

        pts = sum(s["pts"] * s["total_mp"] for s in peak_seasons) / sum_mp
        reb = sum(s["reb"] * s["total_mp"] for s in peak_seasons) / sum_mp
        ast = sum(s["ast"] * s["total_mp"] for s in peak_seasons) / sum_mp
        stl = sum(s["stl"] * s["total_mp"] for s in peak_seasons) / sum_mp
        blk = sum(s["blk"] * s["total_mp"] for s in peak_seasons) / sum_mp
        fg_pct = sum(s["fg_pct"] * s["total_mp"] for s in peak_seasons) / sum_mp
        three_pt_att = sum(s["three_pt_att"] * s["total_mp"] for s in peak_seasons) / sum_mp
        three_pt_pct = sum(s["three_pt_pct"] * s["total_mp"] for s in peak_seasons) / sum_mp
        usg = sum(s["usg"] * s["total_mp"] for s in peak_seasons) / sum_mp
        dbpm = sum(s["dbpm"] * s["total_mp"] for s in peak_seasons) / sum_mp

        # Determine primary and eligible positions
        pos_counts = defaultdict(float)
        for s in peak_seasons:
            pos_counts[s["pos"]] += s["total_mp"]
        primary_pos = max(pos_counts.keys(), key=lambda p: pos_counts[p])

        eligible = set()
        eligible.add(primary_pos)
        # Add any position played in the peak window
        for s in peak_seasons:
            eligible.add(s["pos"])
        # Add natural basketball positional adjacencies
        for p in list(eligible):
            for adj in POSITION_ADJACENCIES.get(p, []):
                eligible.add(adj)

        # Era Pace Factor from lookup
        era_pace_factor = ERA_PACE_FACTORS.get(decade, 1.0)

        # Curated defense flag if any peak season used curated defense
        is_curated_def = any(s["is_curated_def"] for s in peak_seasons)

        # Overall composite rating for UI sorting
        # Balances scoring, playmaking, defense, and efficiency
        overall_rating = (
            (pts * 1.0)
            + (reb * 1.1)
            + (ast * 1.4)
            + (stl * 2.0)
            + (blk * 2.0)
            + (dbpm * 2.2)
            + (fg_pct * 12.0)
            + (min(three_pt_att * three_pt_pct, 4.0) * 1.5)
        )

        name = peak_seasons[0]["name"]
        player_entry = {
            "id": f"{player_id}_{franchise}_{decade}",
            "name": name,
            "franchise": franchise,
            "decade": decade,
            "primaryPosition": primary_pos,
            "eligiblePositions": sorted(list(eligible)),
            "overallRating": round(overall_rating, 1),
            "stats": {
                "pts": round(pts, 1),
                "reb": round(reb, 1),
                "ast": round(ast, 1),
                "stl": round(stl, 1),
                "blk": round(blk, 1),
                "fgPct": round(fg_pct, 3),
                "threePtPct": round(three_pt_pct, 3),
                "threePtAttempts": round(three_pt_att, 1),
                "usgPct": round(usg, 1),
                "dbpm": round(dbpm, 1),
                "eraPaceFactor": round(era_pace_factor, 3),
            },
            "isCuratedDefense": is_curated_def,
            "peakYears": [s["season"] for s in peak_seasons],
        }
        processed_players.append(player_entry)

    return processed_players

def filter_and_balance(players):
    """
    Groups players by (franchise, decade) and keeps top players per combo
    ensuring rich depth across every position while omitting deep-bench noise.
    """
    combos = defaultdict(list)
    for p in players:
        combos[(p["franchise"], p["decade"])].append(p)

    final_players = []
    print(f"[BALANCE] Processing {len(combos)} franchise-decade combinations...")

    for (fran, dec), p_list in combos.items():
        # Sort by overall rating descending
        p_list.sort(key=lambda p: p["overallRating"], reverse=True)

        # Always guarantee at least 2 players for each base position (PG, SG, SF, PF, C)
        selected_ids = set()
        by_pos = defaultdict(list)
        for p in p_list:
            by_pos[p["primaryPosition"]].append(p)

        # Pick top 2 for each position
        for pos in ["PG", "SG", "SF", "PF", "C"]:
            for p in by_pos[pos][:2]:
                if p["id"] not in selected_ids:
                    final_players.append(p)
                    selected_ids.add(p["id"])

        # Fill remaining slots up to top 25 overall players for this combo
        for p in p_list:
            if p["id"] not in selected_ids and len(selected_ids) < 25:
                final_players.append(p)
                selected_ids.add(p["id"])

    print(f"[BALANCE] Retained {len(final_players):,} top rotation players across all combos.")
    return final_players

def main():
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    records = load_data()
    all_players = process_peak_players(records)
    balanced_players = filter_and_balance(all_players)

    output_path = os.path.join(PROCESSED_DIR, "players.json")
    print(f"[SAVE] Writing to {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(balanced_players, f, indent=2)

    file_size_kb = os.path.getsize(output_path) / 1024

    # Build franchise metadata index with active decades
    franchise_decades = defaultdict(set)
    franchise_counts = defaultdict(int)
    for p in balanced_players:
        franchise_decades[p["franchise"]].add(p["decade"])
        franchise_counts[p["franchise"]] += 1

    franchises_meta = []
    for f_id in sorted(CANONICAL_FRANCHISES.keys()):
        franchises_meta.append({
            "id": f_id,
            "name": CANONICAL_FRANCHISES[f_id],
            "activeDecades": sorted(list(franchise_decades.get(f_id, set()))),
            "playerCount": franchise_counts.get(f_id, 0),
        })

    franchises_path = os.path.join(PROCESSED_DIR, "franchises.json")
    with open(franchises_path, "w", encoding="utf-8") as f:
        json.dump(franchises_meta, f, indent=2)

    print(f"[DONE] Generated franchises.json with metadata for {len(franchises_meta)} NBA franchises.")
    print(f"[DONE] Generated players.json successfully ({file_size_kb:.1f} KB, {len(balanced_players)} player records).")

if __name__ == "__main__":
    main()
