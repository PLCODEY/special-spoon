"use client";
import { useState, useEffect } from "react";
import { Config, Golfer, Pick } from "@/lib/types";

export default function AdminPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
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

  // Pick edit state
  const [editingPick, setEditingPick] = useState<number | null>(null);
  const [editGolferId, setEditGolferId] = useState("");
  const [editSearch, setEditSearch] = useState("");
  const [editError, setEditError] = useState("");

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

    fetch("/api/draft")
      .then((r) => r.json())
      .then((d) => setPicks(d.picks || []));
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

    if (res.ok) setSavedMsg("Config saved!");
    else setSavedMsg("Error saving config.");
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
      setGolfers(parsed);
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
      setPicks([]);
    }
    setConfirmReset(false);
    setResetting(false);
    setTimeout(() => setSavedMsg(""), 3000);
  }

  async function savePick(pickNumber: number) {
    setEditError("");
    if (!editGolferId) {
      setEditError("Select a golfer");
      return;
    }
    const res = await fetch("/api/draft", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickNumber, golferId: editGolferId }),
    });
    if (res.ok) {
      const data = await res.json();
      setPicks((prev) =>
        prev.map((p) => (p.pickNumber === pickNumber ? data.pick : p))
      );
      setEditingPick(null);
      setEditGolferId("");
      setEditSearch("");
      setSavedMsg(`Pick #${pickNumber} updated!`);
      setTimeout(() => setSavedMsg(""), 3000);
    } else {
      const err = await res.json();
      setEditError(err.error || "Failed to update pick");
    }
  }

  const takenIds = new Set(picks.map((p) => p.golferId));
  const filteredGolfers = golfers.filter(
    (g) =>
      g.name.toLowerCase().includes(editSearch.toLowerCase()) &&
      (!takenIds.has(g.id) || g.id === editGolferId)
  );

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

        {/* Edit Individual Picks */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-1">Edit Picks</h2>
          <p className="text-gray-400 text-sm mb-4">
            Click any pick to change the golfer. Use this to fix incorrect entries.
          </p>

          {picks.length === 0 ? (
            <div className="text-gray-500 text-sm">No picks made yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {picks.map((pick) => (
                <div key={pick.pickNumber} className="border border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs w-6">#{pick.pickNumber}</span>
                      <span className="text-gray-400 text-sm w-16">{pick.drafter}</span>
                      <span className="text-white font-medium">{pick.golferName}</span>
                    </div>
                    <button
                      onClick={() => {
                        setEditingPick(
                          editingPick === pick.pickNumber ? null : pick.pickNumber
                        );
                        setEditGolferId(pick.golferId);
                        setEditSearch("");
                        setEditError("");
                      }}
                      className="text-xs px-3 py-1 border border-gray-600 hover:border-yellow-500 hover:text-yellow-400 text-gray-400 rounded transition-colors"
                    >
                      {editingPick === pick.pickNumber ? "Cancel" : "Edit"}
                    </button>
                  </div>

                  {editingPick === pick.pickNumber && (
                    <div className="px-4 py-3 bg-gray-850 border-t border-gray-700">
                      <input
                        type="text"
                        placeholder="Search golfer..."
                        value={editSearch}
                        onChange={(e) => setEditSearch(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white mb-2 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        autoFocus
                      />
                      <div className="max-h-48 overflow-y-auto flex flex-col gap-1 mb-2">
                        {filteredGolfers.slice(0, 20).map((g) => (
                          <button
                            key={g.id}
                            onClick={() => setEditGolferId(g.id)}
                            className={`flex items-center justify-between px-3 py-2 rounded text-sm text-left transition-colors ${
                              editGolferId === g.id
                                ? "bg-yellow-600 text-white"
                                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                            }`}
                          >
                            <span>{g.name}</span>
                            <span className="text-xs opacity-70">{g.odds}</span>
                          </button>
                        ))}
                      </div>
                      {editError && (
                        <p className="text-red-400 text-xs mb-2">{editError}</p>
                      )}
                      <button
                        onClick={() => savePick(pick.pickNumber)}
                        disabled={!editGolferId}
                        className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors"
                      >
                        Save Change
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Competition Config */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">Competition Settings</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Competition Name</label>
              <input
                type="text"
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Pick Order <span className="text-gray-600">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={pickOrderText}
                onChange={(e) => setPickOrderText(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-600 mt-1">
                Snake draft: Round 1 left→right, Round 2 right→left, etc.
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Picks Per Person</label>
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
                ESPN Event ID <span className="text-gray-600">(auto-detected if blank)</span>
              </label>
              <input
                type="text"
                value={espnEventId}
                onChange={(e) => setEspnEventId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Leave blank to auto-detect The Masters"
              />
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
          <p className="text-gray-400 text-sm mb-4">Clear all picks and start over. Cannot be undone.</p>
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
            Each entry needs: <code className="text-green-400">id, name, odds, oddsValue</code>.
            Sort by <code className="text-green-400">oddsValue</code> ascending.
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
              Each competitor drafts <strong className="text-white">4 golfers</strong> in a snake draft
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <strong className="text-white">Best 2 golfers&apos; combined score</strong> wins (lowest)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <strong className="text-white">Tournament leader gets -10 bonus</strong> to owning team
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">✗</span>
              Golfers who <strong className="text-white">miss the cut</strong> are removed
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">✗</span>
              Teams with <strong className="text-white">fewer than 2 making cut</strong> are eliminated
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
