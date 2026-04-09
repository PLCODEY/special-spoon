import { Pick, LeaderboardEntry, TeamResult, TeamGolfer } from "./types";
import { getTeamPicks } from "./draft";

const LEADER_BONUS = -10;

// Extract numeric rank from position string ("T8" → 8, "1" → 1, "T1" → 1)
function positionToNumber(position: string | undefined): number {
  if (!position || position === "-" || position === "CUT" || position === "WD" || position === "DQ") {
    return Infinity;
  }
  const n = parseInt(position.replace(/^T/, ""), 10);
  return isNaN(n) ? Infinity : n;
}

function isLeader(position: string): boolean {
  return position === "1" || position === "T1";
}

export function calculateStandings(
  picks: Pick[],
  leaderboard: LeaderboardEntry[],
  pickOrder: string[]
): TeamResult[] {
  const teams = getTeamPicks(picks);
  const lbMap = new Map<string, LeaderboardEntry>();
  for (const entry of leaderboard) {
    lbMap.set(normalizeGolferName(entry.name), entry);
  }

  const results: TeamResult[] = pickOrder.map((drafter) => {
    const teamPicks = teams[drafter] || [];
    const teamGolfers: TeamGolfer[] = teamPicks.map((pick) => ({
      golferId: pick.golferId,
      golferName: pick.golferName,
      pickNumber: pick.pickNumber,
      liveData: lbMap.get(normalizeGolferName(pick.golferName)),
    }));

    // If no leaderboard data yet, show draft-only view
    if (leaderboard.length === 0) {
      return {
        drafter,
        golfers: teamGolfers,
        eliminated: false,
        combinedScore: null,
        best2: [],
        leaderBonus: false,
      };
    }

    const madecut = teamGolfers.filter(
      (g) =>
        g.liveData &&
        g.liveData.status !== "cut" &&
        g.liveData.status !== "wd" &&
        g.liveData.status !== "dq"
    );

    if (madecut.length < 2 && leaderboard.some((e) => e.status === "cut")) {
      return {
        drafter,
        golfers: teamGolfers,
        eliminated: true,
        eliminationReason: `Only ${madecut.length} golfer(s) made the cut`,
        combinedScore: null,
        best2: [],
        leaderBonus: false,
      };
    }

    // Best 2 = golfers with the lowest position number (best rank) who have started
    const withPositions = madecut.filter(
      (g) => g.liveData && positionToNumber(g.liveData.position) !== Infinity
    );
    const sorted = [...withPositions].sort(
      (a, b) => positionToNumber(a.liveData!.position) - positionToNumber(b.liveData!.position)
    );
    const best2 = sorted.slice(0, 2);

    // Check if any golfer on this team is currently leading
    const hasLeader = teamGolfers.some(
      (g) => g.liveData && isLeader(g.liveData.position)
    );

    // Combined score = sum of best 2 position numbers (lower is better)
    let combinedScore =
      best2.length === 2
        ? best2.reduce((sum, g) => sum + positionToNumber(g.liveData!.position), 0)
        : null;

    // Apply -10 leader bonus
    if (combinedScore !== null && hasLeader) {
      combinedScore += LEADER_BONUS;
    }

    return {
      drafter,
      golfers: teamGolfers,
      eliminated: false,
      combinedScore,
      best2,
      leaderBonus: hasLeader,
    };
  });

  // Rank: non-eliminated first sorted by combinedScore ascending (lower = better)
  const active = results
    .filter((r) => !r.eliminated && r.combinedScore !== null)
    .sort((a, b) => (a.combinedScore ?? 0) - (b.combinedScore ?? 0));

  const nodataActive = results.filter(
    (r) => !r.eliminated && r.combinedScore === null
  );
  const eliminated = results.filter((r) => r.eliminated);

  let rank = 1;
  for (const r of active) {
    r.rank = rank++;
  }
  for (const r of nodataActive) {
    r.rank = rank++;
  }
  for (const r of eliminated) {
    r.rank = undefined;
  }

  return [...active, ...nodataActive, ...eliminated];
}

export function formatScore(score: number | null): string {
  if (score === null) return "-";
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `${score}`;
}

// Format a position-based combined score (no "E" or "+" — just the number)
export function formatCombinedScore(score: number | null): string {
  if (score === null) return "-";
  return String(score);
}

function normalizeGolferName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}
