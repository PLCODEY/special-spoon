"use client";
import { useState, useCallback } from "react";
import useSWR from "swr";
import DraftBoard from "@/components/DraftBoard";
import GolferList from "@/components/GolferList";
import Standings from "@/components/Standings";
import LiveLeaderboard from "@/components/LiveLeaderboard";
import { calculateStandings } from "@/lib/scoring";
import { Config, LeaderboardEntry, Pick } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Tab = "draft" | "standings" | "leaderboard";

export default function Home() {
  const [tab, setTab] = useState<Tab>("draft");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [undoing, setUndoing] = useState(false);

  const { data: draftData, mutate: mutateDraft } = useSWR(
    "/api/draft",
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: configData } = useSWR<Config>("/api/config", fetcher, {
    refreshInterval: 30000,
  });

  const { data: leaderboardData, mutate: mutateLeaderboard } = useSWR(
    "/api/leaderboard",
    fetcher,
    {
      refreshInterval: 30000,
      onSuccess: () => setLastUpdated(new Date()),
    }
  );

  const picks: Pick[] = draftData?.picks || [];
  const golfers = draftData?.golfers || [];
  const currentPicker: string | null = draftData?.currentPicker || null;
  const nextPicker: string | null = draftData?.nextPicker || null;
  const draftComplete: boolean = draftData?.draftComplete || false;
  const leaderboard: LeaderboardEntry[] = leaderboardData?.entries || [];
  const hasLiveData = leaderboard.length > 0;

  const standings = configData
    ? calculateStandings(picks, leaderboard, configData.pickOrder)
    : [];

  async function handlePick(golferId: string) {
    const res = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ golferId }),
    });
    if (res.ok) {
      mutateDraft();
    }
  }

  async function handleUndo() {
    setUndoing(true);
    await fetch("/api/draft", { method: "DELETE" });
    await mutateDraft();
    setUndoing(false);
  }

  const tabs: { id: Tab; label: string; badge?: string }[] = [
    { id: "draft", label: "Draft" },
    { id: "standings", label: "Standings" },
    {
      id: "leaderboard",
      label: "Live Board",
      badge: hasLiveData ? "LIVE" : undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-green-500">⛳</span>
                {configData?.competition || "Golf Snake Draft"}
              </h1>
              {!draftComplete && currentPicker && (
                <div className="text-sm text-yellow-400 mt-0.5">
                  On the clock:{" "}
                  <strong>{currentPicker}</strong>
                  {nextPicker && (
                    <span className="text-gray-500 ml-2">
                      Next: {nextPicker}
                    </span>
                  )}
                </div>
              )}
              {draftComplete && (
                <div className="text-sm text-green-400 mt-0.5">
                  Draft complete — {picks.length} picks made
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {picks.length > 0 && (
                <button
                  onClick={handleUndo}
                  disabled={undoing}
                  className="text-xs px-3 py-1.5 border border-gray-700 hover:border-gray-500 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  {undoing ? "..." : "Undo Last Pick"}
                </button>
              )}
              <a
                href="/admin"
                className="text-xs px-3 py-1.5 border border-gray-700 hover:border-gray-500 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                Admin
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  tab === t.id
                    ? "border-green-500 text-green-400"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                {t.label}
                {t.badge && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full animate-pulse">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {tab === "draft" && (
          <div className="flex flex-col gap-6">
            <section className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Draft Board
              </h2>
              {configData ? (
                <DraftBoard
                  config={configData}
                  picks={picks}
                  currentPicker={currentPicker}
                  draftComplete={draftComplete}
                />
              ) : (
                <div className="text-gray-500">Loading...</div>
              )}
            </section>

            <section className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Available Golfers{" "}
                <span className="text-gray-600 font-normal">
                  (ranked by Vegas odds)
                </span>
              </h2>
              <GolferList
                golfers={golfers}
                currentPicker={currentPicker}
                draftComplete={draftComplete}
                onPick={handlePick}
              />
            </section>
          </div>
        )}

        {tab === "standings" && (
          <section className="max-w-2xl mx-auto">
            <Standings standings={standings} hasLiveData={hasLiveData} />
          </section>
        )}

        {tab === "leaderboard" && (
          <section className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Tournament Leaderboard
              </h2>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <span>●</span> Drafted
                </span>
                <button
                  onClick={() => mutateLeaderboard()}
                  className="text-xs px-3 py-1 border border-gray-700 hover:border-gray-500 rounded text-gray-400 hover:text-white transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
            <LiveLeaderboard
              entries={leaderboard}
              draftedNames={picks.map((p) => p.golferName)}
              lastUpdated={lastUpdated}
            />
          </section>
        )}
      </main>
    </div>
  );
}
