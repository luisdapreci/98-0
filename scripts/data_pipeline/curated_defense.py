"""
Curated defense ratings for pre-1974 NBA players.
Implements the 5-Tier system and historical block/steal estimates specified in GAME_DESIGN.md §3.2.
"""

# Specific curated values for renowned pre-1974 players (dbpm, blk, stl)
CURATED_PLAYERS = {
    # Tier 5 — Elite (+5.0 DBPM)
    "russebi01": {"dbpm": 5.0, "blk": 8.0, "stl": 1.0},  # Bill Russell
    "chambwi01": {"dbpm": 5.0, "blk": 6.0, "stl": 0.7},  # Wilt Chamberlain

    # Tier 4 — Excellent (+3.0 DBPM)
    "havlijo01": {"dbpm": 3.0, "blk": 0.4, "stl": 1.8},  # John Havlicek
    "fraziwa01": {"dbpm": 3.0, "blk": 0.2, "stl": 2.2},  # Walt Frazier
    "thurmna01": {"dbpm": 3.0, "blk": 3.5, "stl": 0.7},  # Nate Thurmond
    "reedwi01":  {"dbpm": 2.5, "blk": 2.2, "stl": 0.6},  # Willis Reed
    "sloanje01": {"dbpm": 2.5, "blk": 0.2, "stl": 2.2},  # Jerry Sloan
    "unselwe01": {"dbpm": 2.5, "blk": 1.5, "stl": 1.0},  # Wes Unseld
    "cowenda01": {"dbpm": 2.5, "blk": 1.3, "stl": 1.1},  # Dave Cowens

    # Tier 3 — Good (+1.5 DBPM)
    "westje01":  {"dbpm": 1.5, "blk": 0.7, "stl": 2.0},  # Jerry West
    "roberos01": {"dbpm": 1.2, "blk": 0.1, "stl": 1.4},  # Oscar Robertson
    "debusda01": {"dbpm": 1.8, "blk": 0.8, "stl": 1.1},  # Dave DeBusschere
    "bayloel01": {"dbpm": 1.0, "blk": 0.5, "stl": 1.1},  # Elgin Baylor
    "greerha01": {"dbpm": 1.0, "blk": 0.2, "stl": 1.2},  # Hal Greer
    "walkech01": {"dbpm": 1.0, "blk": 0.3, "stl": 0.9},  # Chet Walker
    "howelba01": {"dbpm": 1.0, "blk": 0.4, "stl": 0.8},  # Bailey Howell
    "cunningham01": {"dbpm": 1.2, "blk": 0.5, "stl": 1.3}, # Billy Cunningham
    "wilkile01": {"dbpm": 1.0, "blk": 0.2, "stl": 1.2},  # Lenny Wilkens

    # Tier 1 — Poor (-1.5 DBPM, pure scorers / poor defenders)
    "marinja01": {"dbpm": -1.5, "blk": 0.1, "stl": 0.5}, # Jack Marin
    "vanarlu01": {"dbpm": -1.2, "blk": 0.1, "stl": 0.6}, # Lucius Allen
}

def get_curated_defense(player_id: str, primary_pos: str) -> tuple[float, float, float]:
    """
    Returns (dbpm, blk, stl) for pre-1974 players.
    If explicitly curated, returns curated value.
    Otherwise returns Tier 2 (Average, 0.0 DBPM) with positional baselines.
    """
    if player_id in CURATED_PLAYERS:
        d = CURATED_PLAYERS[player_id]
        return d["dbpm"], d["blk"], d["stl"]

    # Positional baseline for Tier 2 (Average, 0.0 DBPM)
    pos = (primary_pos or "SF").upper()
    if "C" in pos:
        return 0.0, 1.2, 0.4
    elif "PF" in pos:
        return 0.0, 0.8, 0.6
    elif "SF" in pos:
        return 0.0, 0.4, 0.8
    elif "SG" in pos:
        return 0.0, 0.2, 1.0
    else:  # PG
        return 0.0, 0.1, 1.1
