"""
Extracts historical benchmark teams from Team Summaries.csv for both
Regular Season Gauntlet and Playoff Bracket according to GAME_DESIGN.md §4 & §5.
Outputs: data/processed/opponents.json
"""
import os
import csv
import json

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw")
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed")

# Target team selections matching GAME_DESIGN.md specifications
CONTENDER_TARGETS = [
    ("1996", "CHI", "1995-96 Chicago Bulls"),
    ("2017", "GSW", "2016-17 Golden State Warriors"),
    ("1986", "BOS", "1985-86 Boston Celtics"),
    ("1971", "MIL", "1970-71 Milwaukee Bucks"),
    ("1987", "LAL", "1986-87 Los Angeles Lakers"),
    ("2014", "SAS", "2013-14 San Antonio Spurs"),
]

PLAYOFF_TARGETS = [
    ("2003", "SAS", "2002-03 San Antonio Spurs"),
    ("2011", "DAL", "2010-11 Dallas Mavericks"),
    ("2014", "IND", "2013-14 Indiana Pacers"),
    ("2004", "DET", "2003-04 Detroit Pistons"),
    ("1995", "HOU", "1994-95 Houston Rockets"),
    ("1993", "PHO", "1992-93 Phoenix Suns"),
    ("1998", "UTA", "1997-98 Utah Jazz"),
    ("2001", "LAL", "2000-01 Los Angeles Lakers"),
    ("2012", "MIA", "2011-12 Miami Heat"),
    ("1994", "NYK", "1993-94 New York Knicks"),
]

AVERAGE_TARGETS = [
    ("1995", "DEN", "1994-95 Denver Nuggets"),
    ("2006", "SAC", "2005-06 Sacramento Kings"),
    ("2008", "PHI", "2007-08 Philadelphia 76ers"),
    ("1987", "IND", "1986-87 Indiana Pacers"),
    ("2004", "MEM", "2003-04 Memphis Grizzlies"),
    ("1999", "NYK", "1998-99 New York Knicks"),
    ("2016", "DET", "2015-16 Detroit Pistons"),
    ("2002", "ORL", "2001-02 Orlando Magic"),
    ("1991", "ATL", "1990-91 Atlanta Hawks"),
    ("2018", "WAS", "2017-18 Washington Wizards"),
]

LOTTERY_TARGETS = [
    ("2012", "CHA", "2011-12 Charlotte Bobcats"),
    ("2016", "PHI", "2015-16 Philadelphia 76ers"),
    ("1997", "BOS", "1996-97 Boston Celtics"),
    ("2017", "NYK", "2016-17 New York Knicks"),
    ("2018", "BRK", "2017-18 Brooklyn Nets"),
    ("2005", "LAL", "2004-05 Los Angeles Lakers"),
]

# Playoff squads categorized by potential rounds as defined in GAME_DESIGN.md §4
PLAYOFF_ROUNDS_POOL = {
    "playIn": [
        ("1994", "NYK", "1994 New York Knicks"),
        ("2004", "DET", "2004 Detroit Pistons"),
        ("2021", "GSW", "2021 Golden State Warriors"),
        ("1999", "NYK", "1999 New York Knicks"),
    ],
    "round1": [
        ("2011", "DAL", "2011 Dallas Mavericks"),
        ("1995", "HOU", "1995 Houston Rockets"),
        ("2003", "SAS", "2003 San Antonio Spurs"),
        ("1977", "POR", "1977 Portland Trail Blazers"),
    ],
    "round2": [
        ("1986", "BOS", "1986 Boston Celtics"),
        ("2001", "LAL", "2001 Los Angeles Lakers"),
        ("2014", "SAS", "2014 San Antonio Spurs"),
        ("2012", "MIA", "2012 Miami Heat"),
    ],
    "conferenceFinals": [
        ("2017", "GSW", "2017 Golden State Warriors"),
        ("1996", "CHI", "1996 Chicago Bulls"),
        ("1987", "LAL", "1987 Los Angeles Lakers"),
        ("1983", "PHI", "1983 Philadelphia 76ers"),
    ],
    "finals": [
        ("1996", "CHI", "1996 Chicago Bulls"),
        ("2017", "GSW", "2017 Golden State Warriors"),
        ("1971", "MIL", "1971 Milwaukee Bucks"),
        ("1986", "BOS", "1986 Boston Celtics"),
    ],
}

def safe_float(val, default=0.0):
    try:
        if val is None or val == "" or val == "NA":
            return default
        return float(val)
    except (ValueError, TypeError):
        return default

def load_team_summaries():
    teams = {}
    with open(os.path.join(RAW_DIR, "Team Summaries.csv"), "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r["lg"] != "NBA":
                continue
            key = (r["season"], r["abbreviation"])
            teams[key] = r
    return teams

def build_team_entry(summary, display_name, tier=None):
    season = summary["season"]
    w = int(summary["w"])
    l = int(summary["l"])
    n_rtg = safe_float(summary.get("n_rtg"), safe_float(summary.get("mov")))
    o_rtg = safe_float(summary.get("o_rtg"), 105.0)
    d_rtg = safe_float(summary.get("d_rtg"), 105.0)
    pace = safe_float(summary.get("pace"), 100.0)

    entry = {
        "id": f"{summary['abbreviation']}_{season}",
        "name": display_name,
        "franchise": summary["abbreviation"],
        "season": int(season),
        "wins": w,
        "losses": l,
        "netRating": round(n_rtg, 1),
        "ortg": round(o_rtg, 1),
        "drtg": round(d_rtg, 1),
        "pace": round(pace, 1),
    }
    if tier:
        entry["tier"] = tier
    return entry

def main():
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    summaries = load_team_summaries()

    regular_season_pool = {
        "CONTENDER": [],
        "PLAYOFF": [],
        "AVERAGE": [],
        "LOTTERY": [],
    }

    # Populate regular season tiers
    for s, tm, name in CONTENDER_TARGETS:
        sum_row = summaries.get((s, tm))
        if sum_row:
            regular_season_pool["CONTENDER"].append(build_team_entry(sum_row, name, "CONTENDER"))

    for s, tm, name in PLAYOFF_TARGETS:
        sum_row = summaries.get((s, tm))
        if sum_row:
            regular_season_pool["PLAYOFF"].append(build_team_entry(sum_row, name, "PLAYOFF"))

    for s, tm, name in AVERAGE_TARGETS:
        sum_row = summaries.get((s, tm))
        if sum_row:
            regular_season_pool["AVERAGE"].append(build_team_entry(sum_row, name, "AVERAGE"))

    for s, tm, name in LOTTERY_TARGETS:
        sum_row = summaries.get((s, tm))
        if sum_row:
            regular_season_pool["LOTTERY"].append(build_team_entry(sum_row, name, "LOTTERY"))

    # Populate playoff rounds pool
    playoff_pool = {}
    for round_name, teams in PLAYOFF_ROUNDS_POOL.items():
        playoff_pool[round_name] = []
        for s, tm, name in teams:
            sum_row = summaries.get((s, tm))
            if sum_row:
                playoff_pool[round_name].append(build_team_entry(sum_row, name))

    data = {
        "regularSeasonPool": regular_season_pool,
        "playoffPool": playoff_pool,
    }

    out_file = os.path.join(PROCESSED_DIR, "opponents.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    total_reg = sum(len(v) for v in regular_season_pool.values())
    print(f"[DONE] Saved opponents.json ({total_reg} regular season benchmark teams, {len(playoff_pool)} playoff tiers).")

if __name__ == "__main__":
    main()
