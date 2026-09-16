"""
Franchise and Era mappings for Project 98-0.
Normalizes all historical NBA team codes to the 30 canonical NBA franchises.
Provides decade classification and pace factors.
"""

# The 30 modern NBA franchises
CANONICAL_FRANCHISES = {
    "ATL": "Atlanta Hawks",
    "BOS": "Boston Celtics",
    "BKN": "Brooklyn Nets",
    "CHA": "Charlotte Hornets",
    "CHI": "Chicago Bulls",
    "CLE": "Cleveland Cavaliers",
    "DAL": "Dallas Mavericks",
    "DEN": "Denver Nuggets",
    "DET": "Detroit Pistons",
    "GSW": "Golden State Warriors",
    "HOU": "Houston Rockets",
    "IND": "Indiana Pacers",
    "LAC": "Los Angeles Clippers",
    "LAL": "Los Angeles Lakers",
    "MEM": "Memphis Grizzlies",
    "MIA": "Miami Heat",
    "MIL": "Milwaukee Bucks",
    "MIN": "Minnesota Timberwolves",
    "NOP": "New Orleans Pelicans",
    "NYK": "New York Knicks",
    "OKC": "Oklahoma City Thunder",
    "ORL": "Orlando Magic",
    "PHI": "Philadelphia 76ers",
    "PHX": "Phoenix Suns",
    "POR": "Portland Trail Blazers",
    "SAC": "Sacramento Kings",
    "SAS": "San Antonio Spurs",
    "TOR": "Toronto Raptors",
    "UTA": "Utah Jazz",
    "WAS": "Washington Wizards",
}

# Historical abbreviation -> Canonical Franchise ID
HISTORICAL_TEAM_MAP = {
    # Atlanta Hawks
    "ATL": "ATL",
    "STL": "ATL",  # St. Louis Hawks (1956-1968)
    "MLH": "ATL",  # Milwaukee Hawks (1952-1955)
    "TRI": "ATL",  # Tri-Cities Blackhawks (1950-1951)

    # Boston Celtics
    "BOS": "BOS",

    # Brooklyn Nets
    "BKN": "BKN",
    "BRK": "BKN",
    "NJN": "BKN",  # New Jersey Nets (1978-2012)
    "NYN": "BKN",  # New York Nets (1977)

    # Charlotte Hornets
    "CHA": "CHA",
    "CHH": "CHA",  # Charlotte Hornets (original 1989-2002)
    "CHO": "CHA",  # Charlotte Hornets (2015-present)

    # Chicago Bulls
    "CHI": "CHI",

    # Cleveland Cavaliers
    "CLE": "CLE",

    # Dallas Mavericks
    "DAL": "DAL",

    # Denver Nuggets
    "DEN": "DEN",

    # Detroit Pistons
    "DET": "DET",
    "FTW": "DET",  # Fort Wayne Pistons (pre-1958)

    # Golden State Warriors
    "GSW": "GSW",
    "SFW": "GSW",  # San Francisco Warriors (1963-1971)
    "PHW": "GSW",  # Philadelphia Warriors (1947-1962)

    # Houston Rockets
    "HOU": "HOU",
    "SDR": "HOU",  # San Diego Rockets (1968-1971)

    # Indiana Pacers
    "IND": "IND",

    # Los Angeles Clippers
    "LAC": "LAC",
    "SDC": "LAC",  # San Diego Clippers (1979-1984)
    "BUF": "LAC",  # Buffalo Braves (1971-1978)

    # Los Angeles Lakers
    "LAL": "LAL",
    "MNL": "LAL",  # Minneapolis Lakers (1949-1960)

    # Memphis Grizzlies
    "MEM": "MEM",
    "VAN": "MEM",  # Vancouver Grizzlies (1996-2001)

    # Miami Heat
    "MIA": "MIA",

    # Milwaukee Bucks
    "MIL": "MIL",

    # Minnesota Timberwolves
    "MIN": "MIN",

    # New Orleans Pelicans
    "NOP": "NOP",
    "NOH": "NOP",  # New Orleans Hornets (2003-2013)
    "NOK": "NOP",  # New Orleans/OKC Hornets (2006-2007)

    # New York Knicks
    "NYK": "NYK",

    # Oklahoma City Thunder
    "OKC": "OKC",
    "SEA": "OKC",  # Seattle SuperSonics (1968-2008)

    # Orlando Magic
    "ORL": "ORL",

    # Philadelphia 76ers
    "PHI": "PHI",
    "SYR": "PHI",  # Syracuse Nationals (1950-1963)

    # Phoenix Suns
    "PHX": "PHX",
    "PHO": "PHX",

    # Portland Trail Blazers
    "POR": "POR",

    # Sacramento Kings
    "SAC": "SAC",
    "KCK": "SAC",  # Kansas City Kings (1976-1985)
    "KCO": "SAC",  # Kansas City-Omaha Kings (1973-1975)
    "CIN": "SAC",  # Cincinnati Royals (1958-1972)
    "ROC": "SAC",  # Rochester Royals (1949-1957)

    # San Antonio Spurs
    "SAS": "SAS",

    # Toronto Raptors
    "TOR": "TOR",

    # Utah Jazz
    "UTA": "UTA",
    "NOJ": "UTA",  # New Orleans Jazz (1975-1979)

    # Washington Wizards
    "WAS": "WAS",
    "WSB": "WAS",  # Washington Bullets (1975-1997)
    "CAP": "WAS",  # Capital Bullets (1974)
    "BAL": "WAS",  # Baltimore Bullets (1964-1973)
    "CHZ": "WAS",  # Chicago Zephyrs (1963)
    "CHP": "WAS",  # Chicago Packers (1962)
}

# Era pace factor lookup table as defined in Section 7 of GAME_DESIGN.md
ERA_PACE_FACTORS = {
    "1960s": 0.794,
    "1970s": 0.943,
    "1980s": 0.990,
    "1990s": 1.075,
    "2000s": 1.099,
    "2010s": 1.053,
    "2020s": 1.000,
}

VALID_DECADES = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"]

def get_decade(season_year: int) -> str | None:
    """Classifies a season year into an EraDecade."""
    if 1960 <= season_year <= 1969:
        return "1960s"
    elif 1970 <= season_year <= 1979:
        return "1970s"
    elif 1980 <= season_year <= 1989:
        return "1980s"
    elif 1990 <= season_year <= 1999:
        return "1990s"
    elif 2000 <= season_year <= 2009:
        return "2000s"
    elif 2010 <= season_year <= 2019:
        return "2010s"
    elif 2020 <= season_year <= 2029:
        return "2020s"
    return None
