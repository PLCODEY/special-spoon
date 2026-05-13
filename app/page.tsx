"use client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import DraftBoard from "@/components/DraftBoard";
import GolferList from "@/components/GolferList";
import Standings from "@/components/Standings";
import LiveLeaderboard from "@/components/LiveLeaderboard";
import PickCelebration from "@/components/PickCelebration";
import { calculateStandings } from "@/lib/scoring";
import { Config, LeaderboardEntry, Pick } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Tab = "draft" | "standings" | "leaderboard";

interface DraftPayload {
  picks: Pick[];
  golfers: Array<{ id: string; name: string; odds: string; oddsValue: number; drafted: boolean }>;
  currentPicker: string | null;
  nextPicker: string | null;
  draftComplete: boolean;
  snakeOrder: string[];
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("draft");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [celebration, setCelebration] = useState<{ golferName: string; drafter: string } | null>(null);

  // Draft state — initially fetched, then kept live via SSE
  const [draftData, setDraftData] = useState<DraftPayload | null>(null);

  // Config — polled every 60s (changes rarely)
  const { data: configData } = useSWR<Config>("/api/config", fetcher, {
    refreshInterval: 60000,
  });

  // Leaderboard — polled every 30s (external API)
  const { data: leaderboardData, mutate: mutateLeaderboard } = useSWR(
    "/api/leaderboard",
    fetcher,
    {
      refreshInterval: 30000,
      onSuccess: () => setLastUpdated(new Date()),
    }
  );

  // Initial draft fetch
  useEffect(() => {
    fetch("/api/draft")
      .then((r) => r.json())
      .then(setDraftData);
  }, []);

  // SSE connection for real-time draft updates
  useEffect(() => {
    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource("/api/events");

      es.onopen = () => setSseConnected(true);

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "draft_update") {
            setDraftData(msg.payload);
          }
        } catch {}
      };

      es.onerror = () => {
        setSseConnected(false);
        es.close();
        // Reconnect after 3 seconds
        retryTimeout = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      es?.close();
      clearTimeout(retryTimeout);
    };
  }, []);

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
    const drafter = currentPicker || "";
    const golfer = golfers.find((g) => g.id === golferId);
    const res = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ golferId }),
    });
    if (res.ok && golfer && drafter) {
      setCelebration({ golferName: golfer.name, drafter });
    } else if (!res.ok) {
      fetch("/api/draft").then((r) => r.json()).then(setDraftData);
    }
  }

  async function handleUndo() {
    setUndoing(true);
    await fetch("/api/draft", { method: "DELETE" });
    setUndoing(false);
    // SSE will push the update — fallback below
    if (!sseConnected) {
      fetch("/api/draft").then((r) => r.json()).then(setDraftData);
    }
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
                <span
                  title={sseConnected ? "Live updates active" : "Reconnecting..."}
                  className={`w-2 h-2 rounded-full ${
                    sseConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"
                  }`}
                />
              </h1>
              {!draftComplete && currentPicker && (
                <div className="text-sm text-yellow-400 mt-0.5">
                  On the clock: <strong>{currentPicker}</strong>
                  {nextPicker && (
                    <span className="text-gray-500 ml-2">Next: {nextPicker}</span>
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
              error={leaderboardData?.error}
            />
          </section>
        )}
      </main>

      <PickCelebration
        pick={celebration}
        onDone={() => setCelebration(null)}
      />
    </div>
  );
}
