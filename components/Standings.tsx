"use client";
import { TeamResult } from "@/lib/types";
import { formatScore } from "@/lib/scoring";

interface Props {
  standings: TeamResult[];
  hasLiveData: boolean;
}

const RANK_COLORS = [
  "text-yellow-400",
  "text-gray-300",
  "text-amber-600",
];

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-400",
  cut: "text-red-400",
  wd: "text-orange-400",
  dq: "text-red-600",
  unknown: "text-gray-400",
};

export default function Standings({ standings, hasLiveData }: Props) {
  if (standings.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        No picks made yet. Start the draft to see standings.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!hasLiveData && (
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg px-4 py-2 text-blue-300 text-sm">
          Tournament hasn&apos;t started yet — standings will update in real time once play begins.
        </div>
      )}

      {standings.map((team, idx) => (
        <div
          key={team.drafter}
          className={`rounded-xl border p-4 ${
            team.eliminated
              ? "bg-gray-900 border-red-900/50 opacity-70"
              : idx === 0 && hasLiveData && team.combinedScore !== null
              ? "bg-gray-800 border-green-500/50 ring-1 ring-green-500/30"
              : "bg-gray-800 border-gray-700"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {team.eliminated ? (
                <span className="text-red-500 font-bold text-lg">X</span>
              ) : team.rank ? (
                <span
                  className={`font-bold text-xl ${
                    RANK_COLORS[team.rank - 1] || "text-gray-400"
                  }`}
                >
                  #{team.rank}
                </span>
              ) : (
                <span className="text-gray-500 text-lg">-</span>
              )}
              <span className="text-white font-bold text-lg">
                {team.drafter}
              </span>
              {team.eliminated && (
                <span className="bg-red-900/50 text-red-400 text-xs px-2 py-0.5 rounded-full">
                  ELIMINATED
                </span>
              )}
            </div>
            <div className="text-right">
              {team.eliminated ? (
                <div className="text-red-400 text-sm">{team.eliminationReason}</div>
              ) : team.combinedScore !== null ? (
                <div>
                  <div className="text-white font-bold text-xl">
                    {formatScore(team.combinedScore)}
                  </div>
                  <div className="text-gray-400 text-xs">combined (best 2)</div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">Awaiting scores</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {team.golfers.map((g) => {
              const isBest2 = team.best2.some(
                (b) => b.golferId === g.golferId
              );
              const status = g.liveData?.status || "unknown";
              return (
                <div
                  key={g.golferId}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    status === "cut" || status === "wd" || status === "dq"
                      ? "bg-gray-900 border border-gray-800 opacity-60"
                      : isBest2 && hasLiveData
                      ? "bg-green-900/30 border border-green-700/50"
                      : "bg-gray-900/50 border border-gray-700/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-medium ${
                        status === "cut" || status === "wd" || status === "dq"
                          ? "text-gray-500 line-through"
                          : "text-white"
                      }`}
                    >
                      {g.golferName}
                    </span>
                    {g.liveData && (
                      <span
                        className={`font-mono font-semibold ${
                          status === "cut" || status === "wd"
                            ? "text-red-400"
                            : isBest2
                            ? "text-green-400"
                            : "text-gray-300"
                        }`}
                      >
                        {status === "cut"
                          ? "CUT"
                          : status === "wd"
                          ? "WD"
                          : g.liveData.scoreDisplay}
                      </span>
                    )}
                  </div>
                  {g.liveData && status !== "cut" && status !== "wd" && (
                    <div className="flex gap-2 mt-0.5 text-xs text-gray-500">
                      <span>{g.liveData.position}</span>
                      <span>Thru {g.liveData.thru}</span>
                      {isBest2 && hasLiveData && (
                        <span className="text-green-600 ml-auto">★ scoring</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
