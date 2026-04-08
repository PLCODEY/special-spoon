import { Pick, LeaderboardEntry, TeamResult, TeamGolfer } from "./types";
import { getTeamPicks } from "./draft";

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
      };
    }

    const active = madecut.filter((g) => g.liveData?.score !== null);
    const sorted = [...active].sort(
      (a, b) => (a.liveData!.score ?? 0) - (b.liveData!.score ?? 0)
    );
    const best2 = sorted.slice(0, 2);
    const combinedScore =
      best2.length === 2
        ? best2.reduce((sum, g) => sum + (g.liveData?.score ?? 0), 0)
        : null;

    return {
      drafter,
      golfers: teamGolfers,
      eliminated: false,
      combinedScore,
      best2,
    };
  });

  // Rank: non-eliminated first sorted by combinedScore, then eliminated
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

function normalizeGolferName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}
