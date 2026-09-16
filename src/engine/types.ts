export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | '6TH';
export type EraDecade = '1960s' | '1970s' | '1980s' | '1990s' | '2000s' | '2010s' | '2020s';

export interface PlayerStats {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgPct: number;
  threePtPct: number;
  threePtAttempts: number;
  usgPct: number;
  dbpm: number;
  eraPaceFactor: number;
}

export interface Player {
  id: string;
  name: string;
  franchise: string;
  decade: EraDecade;
  primaryPosition: Position;
  eligiblePositions: Position[];
  stats: PlayerStats;
  overallRating: number;
  peakYears: number[];
  isCuratedDefense?: boolean;
}

export interface Coach {
  id: string;
  name: string;
  systemName: string;
  description?: string;
  modifiers: {
    stat: 'threePtPct' | 'fgPct' | 'dbpm' | 'pace' | 'usgCap';
    delta: number;
  }[];
}

export interface TeamLineup {
  PG: Player | null;
  SG: Player | null;
  SF: Player | null;
  PF: Player | null;
  C: Player | null;
  SIXTH: Player | null;
  coach: Coach | null;
}

export interface SynergySnapshot {
  usgTeam: number;
  phiUsg: number;
  spacingRating: number;
  spacingTier: 'ELITE' | 'GOOD' | 'AVERAGE' | 'POOR';
  spacingModifier: number;
  drtgTeam: number;
  ortgTeam: number;
  effectiveOrtg: number;
  netRating: number;
  sixthManFRF: number;
  depthBonus: number;
}

export interface GameContext {
  opponentNetRating: number;
  isHome: boolean;
  isBackToBack: boolean;
}

export interface GameEvaluation {
  synergy: SynergySnapshot;
  fatigueModifier: number;
  homeCourtBonus: number;
  coachPaceModifier: number;
  deltaRating: number;
  winProbability: number;
}

export type OpponentTier = 'CONTENDER' | 'PLAYOFF' | 'AVERAGE' | 'LOTTERY';

export interface Opponent {
  id: string;
  name: string;
  franchise: string;
  season: number;
  netRating: number;
  tier: OpponentTier;
}

export type OpponentPool = Record<OpponentTier, readonly Opponent[]>;

export interface ScheduleEntry {
  gameNumber: number;
  opponent: Opponent;
  isHome: boolean;
  isBackToBack: boolean;
  day: number;
  pairId: number | null;
  leg: 1 | 2 | null;
}

export interface GameScore {
  userScore: number;
  oppScore: number;
}

export interface GameOutcome extends GameScore {
  won: boolean;
  margin: number;
  regulation: GameScore;
  overtime: GameScore[];
  events: ('OVERTIME' | 'ONE_POINT_FINISH')[];
}

export interface SeasonGame extends ScheduleEntry, GameOutcome {
  context: GameContext;
  evaluation: GameEvaluation;
}

export type PostseasonEntry = 'MISSED' | 'PLAY_IN' | 'FOURTH_SEED' | 'SECOND_SEED' | 'FIRST_SEED';

export interface SeasonResult {
  wins: number;
  losses: number;
  pointDifferential: number;
  currentStreak: number;
  longestStreak: number;
  firstLoss: number | null;
  isUndefeated: boolean;
  qualified: boolean;
  postseasonEntry: PostseasonEntry;
  gameLog: SeasonGame[];
}