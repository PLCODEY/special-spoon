"use client";
import { LeaderboardEntry } from "@/lib/types";
import { formatScore } from "@/lib/scoring";

interface Props {
  entries: LeaderboardEntry[];
  draftedNames: string[];
  lastUpdated: Date | null;
  error?: string | null;
}

export default function LiveLeaderboard({
  entries,
  draftedNames,
  lastUpdated,
  error,
}: Props) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-3">⛳</div>
        <div className="text-lg font-medium text-gray-400">
          Leaderboard not yet available
        </div>
        {error ? (
          <div className="text-xs mt-2 text-red-400 max-w-md mx-auto break-all">
            ESPN error: {error}
          </div>
        ) : (
          <div className="text-sm mt-1">
            Scores will appear here once the tournament begins
          </div>
        )}
      </div>
    );
  }

  const normalizedDrafted = new Set(
    draftedNames.map((n) => n.toLowerCase().trim())
  );

  const sorted = [...entries].sort((a, b) => {
    // cut/wd/dq go to bottom
    const aOut = a.status === "cut" || a.status === "wd" || a.status === "dq";
    const bOut = b.status === "cut" || b.status === "wd" || b.status === "dq";
    if (aOut !== bOut) return aOut ? 1 : -1;
    // not-yet-started (score null) below active players
    if (a.score === null && b.score !== null) return 1;
    if (a.score !== null && b.score === null) return -1;
    if (a.score === null && b.score === null) return 0;
    return (a.score as number) - (b.score as number);
  });

  return (
    <div>
      {lastUpdated && (
        <div className="text-xs text-gray-600 text-right mb-2">
          Updated {lastUpdated.toLocaleTimeString()}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-left py-2 px-2 w-12">Pos</th>
              <th className="text-left py-2 px-2">Player</th>
              <th className="text-center py-2 px-2">Score</th>
              <th className="text-center py-2 px-2">Thru</th>
              <th className="text-center py-2 px-2 hidden sm:table-cell">R1</th>
              <th className="text-center py-2 px-2 hidden sm:table-cell">R2</th>
              <th className="text-center py-2 px-2 hidden sm:table-cell">R3</th>
              <th className="text-center py-2 px-2 hidden sm:table-cell">R4</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, i) => {
              const isDrafted = normalizedDrafted.has(
                entry.name.toLowerCase().trim()
              );
              const isCut =
                entry.status === "cut" ||
                entry.status === "wd" ||
                entry.status === "dq";

              return (
                <tr
                  key={entry.id || i}
                  className={`border-b border-gray-800/50 ${
                    isCut
                      ? "opacity-40"
                      : isDrafted
                      ? "bg-green-900/20"
                      : ""
                  }`}
                >
                  <td className="py-2 px-2 text-gray-400">
                    {isCut ? (
                      <span className="text-red-500 font-semibold text-xs">
                        {entry.status.toUpperCase()}
                      </span>
                    ) : (
                      entry.position
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <span
                      className={`font-medium ${
                        isDrafted ? "text-green-300" : "text-white"
                      } ${isCut ? "line-through" : ""}`}
                    >
                      {entry.name}
                    </span>
                    {isDrafted && !isCut && (
                      <span className="ml-2 text-green-600 text-xs">●</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center font-mono font-semibold">
                    <span
                      className={
                        entry.score === null
                          ? "text-gray-500"
                          : entry.score < 0
                          ? "text-red-400"
                          : entry.score > 0
                          ? "text-blue-400"
                          : "text-gray-200"
                      }
                    >
                      {entry.scoreDisplay || "-"}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center text-gray-400">
                    {entry.thru || "-"}
                  </td>
                  <td className="py-2 px-2 text-center text-gray-400 hidden sm:table-cell">
                    {entry.round1 || "-"}
                  </td>
                  <td className="py-2 px-2 text-center text-gray-400 hidden sm:table-cell">
                    {entry.round2 || "-"}
                  </td>
                  <td className="py-2 px-2 text-center text-gray-400 hidden sm:table-cell">
                    {entry.round3 || "-"}
                  </td>
                  <td className="py-2 px-2 text-center text-gray-400 hidden sm:table-cell">
                    {entry.round4 || "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
