"""
Compiles historical coach cards for Project 98-0 according to GAME_DESIGN.md §6.
Outputs: data/processed/coaches.json
"""
import os
import sys
import json

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed")

COACHES_DATA = [
    {
        "id": "phil_jackson",
        "name": "Phil Jackson",
        "systemName": "Triangle Offense",
        "description": "Half-court execution; punishes run-and-gun",
        "modifiers": [
            {"stat": "fgPct", "delta": 0.03},
            {"stat": "usgCap", "delta": 3.0},
            {"stat": "pace", "delta": -1.0},
        ],
    },
    {
        "id": "mike_dantoni",
        "name": "Mike D'Antoni",
        "systemName": "Seven Seconds or Less",
        "description": "Pace-and-space specialist; defense suffers",
        "modifiers": [
            {"stat": "threePtPct", "delta": 0.04},
            {"stat": "pace", "delta": 2.0},
            {"stat": "dbpm", "delta": -0.5},
        ],
    },
    {
        "id": "gregg_popovich",
        "name": "Gregg Popovich",
        "systemName": "Spurs System",
        "description": "Ball movement master; slow, methodical",
        "modifiers": [
            {"stat": "usgCap", "delta": 5.0},
            {"stat": "dbpm", "delta": 0.3},
            {"stat": "pace", "delta": -1.5},
        ],
    },
    {
        "id": "pat_riley",
        "name": "Pat Riley",
        "systemName": "Showtime → Grind",
        "description": "Elite defense; spacing slightly worse",
        "modifiers": [
            {"stat": "dbpm", "delta": 0.5},
            {"stat": "threePtPct", "delta": -0.02},
        ],
    },
    {
        "id": "steve_kerr",
        "name": "Steve Kerr",
        "systemName": "Motion Offense",
        "description": "Best 3PT coach; mild defensive cost",
        "modifiers": [
            {"stat": "threePtPct", "delta": 0.05},
            {"stat": "usgCap", "delta": 3.0},
            {"stat": "dbpm", "delta": -0.3},
        ],
    },
    {
        "id": "chuck_daly",
        "name": "Chuck Daly",
        "systemName": "Bad Boys Defense",
        "description": "Defensive identity; offense grinds",
        "modifiers": [
            {"stat": "dbpm", "delta": 0.8},
            {"stat": "threePtPct", "delta": -0.03},
        ],
    },
    {
        "id": "red_auerbach",
        "name": "Red Auerbach",
        "systemName": "Fast Break Celtics",
        "description": "Tempo pusher; transition over halfcourt D",
        "modifiers": [
            {"stat": "pace", "delta": 2.5},
            {"stat": "threePtPct", "delta": 0.02},
            {"stat": "dbpm", "delta": -0.3},
        ],
    },
    {
        "id": "don_nelson",
        "name": "Don Nelson",
        "systemName": "Nellie Ball",
        "description": "Most extreme pace; defense is optional",
        "modifiers": [
            {"stat": "pace", "delta": 3.0},
            {"stat": "threePtPct", "delta": 0.03},
            {"stat": "dbpm", "delta": -0.6},
        ],
    },
    {
        "id": "larry_brown",
        "name": "Larry Brown",
        "systemName": "Grit Defense",
        "description": "Slowest coach; best pure defensive buff",
        "modifiers": [
            {"stat": "dbpm", "delta": 0.6},
            {"stat": "pace", "delta": -2.0},
        ],
    },
    {
        "id": "erik_spoelstra",
        "name": "Erik Spoelstra",
        "systemName": "Modern Versatility",
        "description": "Balanced; slight tempo cost",
        "modifiers": [
            {"stat": "dbpm", "delta": 0.3},
            {"stat": "threePtPct", "delta": 0.02},
            {"stat": "pace", "delta": -0.5},
        ],
    },
    {
        "id": "jerry_sloan",
        "name": "Jerry Sloan",
        "systemName": "Jazz System (PnR)",
        "description": "Accommodates ball-dominant PG; slight D cost",
        "modifiers": [
            {"stat": "usgCap", "delta": 4.0},
            {"stat": "threePtPct", "delta": 0.02},
            {"stat": "dbpm", "delta": -0.2},
        ],
    },
    {
        "id": "rick_adelman",
        "name": "Rick Adelman",
        "systemName": "Princeton / Corner 3",
        "description": "Motion-heavy; slow but efficient",
        "modifiers": [
            {"stat": "threePtPct", "delta": 0.03},
            {"stat": "usgCap", "delta": 3.0},
            {"stat": "pace", "delta": -1.0},
        ],
    },
]

def main():
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    out_file = os.path.join(PROCESSED_DIR, "coaches.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(COACHES_DATA, f, indent=2)
    print(f"[DONE] Saved {len(COACHES_DATA)} coaches to coaches.json")

if __name__ == "__main__":
    main()
