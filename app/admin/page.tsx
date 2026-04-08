"use client";
import { useState, useEffect } from "react";
import { Config, Golfer } from "@/lib/types";

export default function AdminPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Config form state
  const [competition, setCompetition] = useState("");
  const [pickOrderText, setPickOrderText] = useState("");
  const [picksPerPerson, setPicksPerPerson] = useState(4);
  const [espnEventId, setEspnEventId] = useState("");

  // Golfer edit state
  const [golferJson, setGolferJson] = useState("");
  const [golferJsonError, setGolferJsonError] = useState("");

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c: Config) => {
        setConfig(c);
        setCompetition(c.competition);
        setPickOrderText(c.pickOrder.join(", "));
        setPicksPerPerson(c.picksPerPerson);
        setEspnEventId(c.espnEventId || "");
      });

    fetch("/api/golfers")
      .then((r) => r.json())
      .then((g: Golfer[]) => {
        setGolfers(g);
        setGolferJson(JSON.stringify(g, null, 2));
      });
  }, []);

  async function saveConfig() {
    setSaving(true);
    const pickOrder = pickOrderText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const updated = {
      competition,
      pickOrder,
      picksPerPerson,
      espnEventId: espnEventId.trim() || null,
    };

    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });

    if (res.ok) {
      setSavedMsg("Config saved!");
    } else {
      setSavedMsg("Error saving config.");
    }
    setSaving(false);
    setTimeout(() => setSavedMsg(""), 3000);
  }

  async function saveGolfers() {
    setGolferJsonError("");
    let parsed: Golfer[];
    try {
      parsed = JSON.parse(golferJson);
    } catch {
      setGolferJsonError("Invalid JSON");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/golfers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    if (res.ok) {
      setSavedMsg("Golfer list saved!");
    } else {
      setSavedMsg("Error saving golfers.");
    }
    setSaving(false);
    setTimeout(() => setSavedMsg(""), 3000);
  }

  async function resetDraft() {
    setResetting(true);
    const res = await fetch("/api/draft?reset=true", { method: "DELETE" });
    if (res.ok) {
      setSavedMsg("Draft reset!");
    }
    setConfirmReset(false);
    setResetting(false);
    setTimeout(() => setSavedMsg(""), 3000);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-green-500">⛳</span> Admin Panel
          </h1>
          <a
            href="/"
            className="text-sm px-3 py-1.5 border border-gray-700 hover:border-gray-500 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Draft
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
        {savedMsg && (
          <div className="bg-green-900/50 border border-green-700 rounded-lg px-4 py-2 text-green-300 text-sm">
            {savedMsg}
          </div>
        )}

        {/* Competition Config */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">Competition Settings</h2>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Competition Name
              </label>
              <input
                type="text"
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="The Masters 2026"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Pick Order{" "}
                <span className="text-gray-600">(comma-separated, left to right for snake draft)</span>
              </label>
              <input
                type="text"
                value={pickOrderText}
                onChange={(e) => setPickOrderText(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Paul, Jack, Wilson, Henry, Chris, Vic, Shaun, Miky, Tony, Jason"
              />
              <p className="text-xs text-gray-600 mt-1">
                Snake draft: Round 1 picks left→right, Round 2 right→left, etc.
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Picks Per Person
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={picksPerPerson}
                onChange={(e) => setPicksPerPerson(Number(e.target.value))}
                className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                ESPN Event ID{" "}
                <span className="text-gray-600">(auto-detected if blank)</span>
              </label>
              <input
                type="text"
                value={espnEventId}
                onChange={(e) => setEspnEventId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Leave blank to auto-detect The Masters"
              />
              <p className="text-xs text-gray-600 mt-1">
                The app will search ESPN&apos;s golf feed for the current Masters event. Override here if needed.
              </p>
            </div>

            <button
              onClick={saveConfig}
              disabled={saving}
              className="self-start bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg transition-colors"
            >
              {saving ? "Saving..." : "Save Config"}
            </button>
          </div>
        </section>

        {/* Draft Reset */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-2">Reset Draft</h2>
          <p className="text-gray-400 text-sm mb-4">
            Clear all picks and start the draft over. This cannot be undone.
          </p>

          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="bg-red-900 hover:bg-red-800 text-white font-medium px-6 py-2 rounded-lg transition-colors"
            >
              Reset Draft
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-red-400 text-sm">Are you sure?</span>
              <button
                onClick={resetDraft}
                disabled={resetting}
                className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {resetting ? "Resetting..." : "Yes, Reset All Picks"}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="border border-gray-700 text-gray-400 hover:text-white px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </section>

        {/* Golfer List Editor */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-2">Golfer List & Odds</h2>
          <p className="text-gray-400 text-sm mb-4">
            Edit the golfer list for this competition. Each entry needs:{" "}
            <code className="text-green-400">id, name, odds, oddsValue</code>.
            Sort by <code className="text-green-400">oddsValue</code> ascending (lowest = best odds).
          </p>

          <textarea
            value={golferJson}
            onChange={(e) => setGolferJson(e.target.value)}
            className="w-full h-96 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
            spellCheck={false}
          />
          {golferJsonError && (
            <p className="text-red-400 text-sm mt-1">{golferJsonError}</p>
          )}

          <button
            onClick={saveGolfers}
            disabled={saving}
            className="mt-3 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-medium px-6 py-2 rounded-lg transition-colors"
          >
            {saving ? "Saving..." : "Save Golfer List"}
          </button>
        </section>

        {/* Scoring Rules */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-3">Scoring Rules</h2>
          <ul className="text-gray-400 text-sm flex flex-col gap-2">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Each competitor drafts <strong className="text-white">4 golfers</strong> in a snake draft format
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Winners scored by their <strong className="text-white">best 2 golfers&apos; combined score</strong> (lowest wins)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">✗</span>
              Golfers who <strong className="text-white">miss the cut</strong> are removed from scoring
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">✗</span>
              Teams with <strong className="text-white">fewer than 2 golfers making the cut</strong> are eliminated
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
