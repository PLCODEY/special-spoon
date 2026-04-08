"use client";
import { useState } from "react";
import { Golfer } from "@/lib/types";

interface Props {
  golfers: (Golfer & { drafted: boolean })[];
  currentPicker: string | null;
  draftComplete: boolean;
  onPick: (golferId: string) => void;
}

export default function GolferList({
  golfers,
  currentPicker,
  draftComplete,
  onPick,
}: Props) {
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState<string | null>(null);

  const filtered = golfers.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const available = filtered.filter((g) => !g.drafted);
  const drafted = filtered.filter((g) => g.drafted);

  async function handlePick(golferId: string) {
    if (!currentPicker || draftComplete) return;
    setPicking(golferId);
    await onPick(golferId);
    setPicking(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Search golfers..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      {!draftComplete && currentPicker && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg px-4 py-2 text-yellow-300 text-sm font-medium">
          On the clock: <span className="text-yellow-200 font-bold">{currentPicker}</span>
        </div>
      )}

      {draftComplete && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg px-4 py-2 text-green-300 text-sm font-medium">
          Draft complete!
        </div>
      )}

      <div className="flex flex-col gap-1 max-h-[600px] overflow-y-auto pr-1">
        {available.map((golfer, idx) => (
          <button
            key={golfer.id}
            onClick={() => handlePick(golfer.id)}
            disabled={!!picking || draftComplete || !currentPicker}
            className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all text-left
              ${
                picking === golfer.id
                  ? "bg-green-700 border-green-500"
                  : draftComplete || !currentPicker
                  ? "bg-gray-800 border-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-gray-800 border-gray-700 hover:border-green-500 hover:bg-gray-750 cursor-pointer"
              }
            `}
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-xs w-6 text-right">
                {idx + 1}
              </span>
              <span className="text-white font-medium">{golfer.name}</span>
            </div>
            <span className="text-green-400 font-mono text-sm font-semibold">
              {golfer.odds}
            </span>
          </button>
        ))}

        {drafted.length > 0 && (
          <>
            <div className="text-gray-500 text-xs uppercase tracking-wider mt-3 mb-1 px-1">
              Drafted
            </div>
            {drafted.map((golfer) => (
              <div
                key={golfer.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg border bg-gray-900 border-gray-800 opacity-50"
              >
                <span className="text-gray-500 line-through">{golfer.name}</span>
                <span className="text-gray-600 font-mono text-sm">
                  {golfer.odds}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
