export interface Golfer {
  id: string;
  name: string;
  odds: string;
  oddsValue: number;
}

export interface Pick {
  pickNumber: number;
  drafter: string;
  golferId: string;
  golferName: string;
  timestamp: string;
}

export interface DraftState {
  picks: Pick[];
}

export interface Config {
  competition: string;
  pickOrder: string[];
  picksPerPerson: number;
  espnEventId: string | null;
  active: boolean;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  position: string;
  score: number | null;
  scoreDisplay: string;
  thru: string;
  status: "active" | "cut" | "wd" | "dq" | "unknown";
  teeTime?: string;
  round1?: string;
  round2?: string;
  round3?: string;
  round4?: string;
}

export interface TeamResult {
  drafter: string;
  golfers: TeamGolfer[];
  eliminated: boolean;
  eliminationReason?: string;
  combinedScore: number | null;
  best2: TeamGolfer[];
  rank?: number;
  leaderBonus: boolean;
}

export interface TeamGolfer {
  golferId: string;
  golferName: string;
  pickNumber: number;
  liveData?: LeaderboardEntry;
}
