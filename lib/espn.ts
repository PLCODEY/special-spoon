import { LeaderboardEntry } from "./types";

const ESPN_BASE =
  "https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard";

const ESPN_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
};

function parseScore(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  // ESPN sometimes returns score as {displayValue: "-5", value: -5}
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj.value === "number") return obj.value;
    if (obj.displayValue !== undefined) return parseScore(obj.displayValue);
  }
  const s = String(val).trim();
  if (s === "" || s === "-" || s === "--" || s === "N/A") return null;
  if (s === "E") return 0;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function formatScore(score: number | null): string {
  if (score === null) return "-";
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `${score}`;
}

type ESPNStatus = "active" | "cut" | "wd" | "dq" | "unknown";

function parseStatus(comp: Record<string, unknown>): ESPNStatus {
  const statusObj = comp.status as Record<string, unknown> | undefined;
  const typeObj = statusObj?.type as Record<string, unknown> | undefined;
  const typeId = typeObj?.id as string | undefined;
  const typeName = ((typeObj?.name as string) || "").toUpperCase();
  const displayValue = ((statusObj?.displayValue as string) || "").toLowerCase();

  if (
    typeId === "2" ||
    typeName.includes("CUT") ||
    displayValue.includes("cut") ||
    displayValue === "mc"
  )
    return "cut";
  if (
    typeId === "3" ||
    typeId === "6" ||
    typeName.includes("WITHDRAWN") ||
    typeName.includes("_WD") ||
    displayValue.includes("withdrew") ||
    displayValue === "wd"
  )
    return "wd";
  if (
    typeId === "7" ||
    typeName.includes("DISQUALIF") ||
    displayValue.includes("disqualif") ||
    displayValue === "dq"
  )
    return "dq";

  return "active";
}

function parseThru(comp: Record<string, unknown>): string {
  const status = comp.status as Record<string, unknown> | undefined;
  if (!status) return "-";

  // Try direct thru field
  if (status.thru !== undefined && status.thru !== null) {
    const t = String(status.thru).trim();
    if (t !== "" && t !== "0") return t;
  }

  const typeObj = status.type as Record<string, unknown> | undefined;

  // Try shortDetail: "F", "Thru 9", "1*", etc.
  const shortDetail = (typeObj?.shortDetail as string) || "";
  if (shortDetail) {
    if (shortDetail.toUpperCase() === "F") return "F";
    const m = shortDetail.match(/thru\s*(\d+)/i);
    if (m) return m[1];
    // Some formats like "14*" meaning in-progress hole 14
    if (/^\d+/.test(shortDetail)) return shortDetail.replace(/\*/g, "");
  }

  // If play is complete for the round/tournament
  const typeName = (typeObj?.name as string) || "";
  if (typeName.includes("PLAY_COMPLETE") || typeName.includes("COMPLETE")) return "F";

  // Fall back to period (round number)
  const period = status.period;
  if (period !== undefined && period !== null) return `R${period}`;

  return "-";
}

interface RawEntry extends LeaderboardEntry {
  _sortOrder: number;
}

export async function fetchMastersLeaderboard(
  eventId?: string | null
): Promise<{ entries: LeaderboardEntry[]; eventId: string | null; error?: string }> {
  try {
    // Auto-discover The Masters event if no ID given
    if (!eventId) {
      const listResp = await fetch(`${ESPN_BASE}?league=pga`, {
        cache: "no-store",
        headers: ESPN_HEADERS,
      });
      if (listResp.ok) {
        const listData = await listResp.json();
        const events: Array<{ id: string; name?: string; shortName?: string }> =
          listData?.events || [];
        const mastersEvent = events.find(
          (e) =>
            e.name?.toLowerCase().includes("masters") ||
            e.shortName?.toLowerCase().includes("masters")
        );
        if (mastersEvent) {
          eventId = mastersEvent.id;
          console.log(`ESPN: discovered Masters event ID: ${eventId}`);
        } else {
          console.error(
            `ESPN: could not find Masters in events list. Found: ${events.map((e) => e.name).join(", ")}`
          );
          return {
            entries: [],
            eventId: null,
            error: `Masters not found in ESPN events. Available: ${events
              .slice(0, 5)
              .map((e) => e.name)
              .join(", ")}`,
          };
        }
      } else {
        const errText = await listResp.text().catch(() => "");
        const msg = `ESPN events list HTTP ${listResp.status}: ${errText.slice(0, 200)}`;
        console.error(msg);
        return { entries: [], eventId: null, error: msg };
      }
    }

    const resp = await fetch(`${ESPN_BASE}?league=pga&event=${eventId}`, {
      cache: "no-store",
      headers: ESPN_HEADERS,
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      const msg = `ESPN leaderboard HTTP ${resp.status}: ${errText.slice(0, 200)}`;
      console.error(msg);
      return { entries: [], eventId, error: msg };
    }

    const data = await resp.json();

    // ESPN structure: data.events[0].competitions[0].competitors[]
    const competitors: Record<string, unknown>[] =
      data?.events?.[0]?.competitions?.[0]?.competitors || [];

    if (competitors.length === 0) {
      const msg = `ESPN returned 0 competitors for event ${eventId}`;
      console.error(msg);
      return { entries: [], eventId, error: msg };
    }

    console.log(`ESPN: parsed ${competitors.length} competitors for event ${eventId}`);

    const rawEntries: RawEntry[] = competitors
      .map((comp) => {
        const athlete = (comp.athlete || {}) as Record<string, unknown>;
        const linescores: Array<Record<string, unknown>> =
          (comp.linescores as Array<Record<string, unknown>>) || [];

        const status = parseStatus(comp);
        const overallScore = parseScore(comp.score ?? comp.totalScore);
        const thru = parseThru(comp);
        const sortOrder = Number(comp.sortOrder ?? comp.order ?? 9999);

        const rounds = linescores.map((ls) => {
          const v = ls.displayValue ?? ls.value;
          return v !== undefined ? String(v) : undefined;
        });

        return {
          id: String(athlete.id || comp.id || ""),
          name: String(
            athlete.displayName ||
              athlete.fullName ||
              athlete.shortName ||
              ""
          ),
          position: String(sortOrder), // preliminary; will be recomputed below
          _sortOrder: sortOrder,
          score: overallScore,
          scoreDisplay: formatScore(overallScore),
          thru,
          status,
          round1: rounds[0] as string | undefined,
          round2: rounds[1] as string | undefined,
          round3: rounds[2] as string | undefined,
          round4: rounds[3] as string | undefined,
        } as RawEntry;
      })
      .filter((e) => e.name);

    // Compute positions with tie detection for active players
    const active = rawEntries
      .filter((e) => e.status === "active" && e.score !== null)
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

    const scoreToCount = new Map<number, number>();
    for (const e of active) {
      scoreToCount.set(e.score!, (scoreToCount.get(e.score!) || 0) + 1);
    }

    let rank = 1;
    for (let i = 0; i < active.length; i++) {
      const entry = active[i];
      const tied = (scoreToCount.get(entry.score!) || 1) > 1;
      entry.position = tied ? `T${rank}` : String(rank);
      // Advance rank past all players with this score
      if (i + 1 < active.length && active[i + 1].score !== entry.score) {
        rank = i + 2;
      }
    }

    // Return sorted by original ESPN sort order, stripping internal field
    const entries: LeaderboardEntry[] = rawEntries
      .sort((a, b) => a._sortOrder - b._sortOrder)
      .map(({ _sortOrder: _, ...rest }) => rest as LeaderboardEntry);

    return { entries, eventId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ESPN fetch error:", msg);
    return { entries: [], eventId: eventId || null, error: msg };
  }
}
