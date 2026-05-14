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
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (s === "" || s === "-" || s === "--") return null;
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

export async function fetchMastersLeaderboard(
  eventId?: string | null
): Promise<{ entries: LeaderboardEntry[]; eventId: string | null; error?: string }> {
  try {
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
            e.name?.toLowerCase().includes("pga championship") ||
            e.shortName?.toLowerCase().includes("pga championship") ||
            e.name?.toLowerCase().includes("masters") ||
            e.shortName?.toLowerCase().includes("masters")
        ) || events[0];
        if (mastersEvent) {
          eventId = mastersEvent.id;
          console.log(`ESPN: discovered event ID: ${eventId} (${mastersEvent.name})`);
        } else {
          const msg = `No active event found. Events: ${events.slice(0, 5).map((e) => e.name).join(", ")}`;
          console.error(msg);
          return { entries: [], eventId: null, error: msg };
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
    const competitors: Record<string, unknown>[] =
      data?.events?.[0]?.competitions?.[0]?.competitors || [];

    if (competitors.length === 0) {
      return { entries: [], eventId, error: `ESPN returned 0 competitors for event ${eventId}` };
    }

    const entries: LeaderboardEntry[] = competitors
      .map((comp) => {
        const athlete = (comp.athlete || {}) as Record<string, unknown>;
        const status = comp.status as Record<string, unknown> | undefined;
        const typeObj = (status?.type as Record<string, unknown> | undefined);
        const positionObj = (status?.position as Record<string, unknown> | undefined);
        const linescores = (comp.linescores as Array<Record<string, unknown>>) || [];
        const statistics = (comp.statistics as Array<Record<string, unknown>>) || [];

        const name = String(
          athlete.displayName || athlete.fullName || athlete.shortName || ""
        );
        if (!name) return null;

        // Status: check type name/id
        const typeName = ((typeObj?.name as string) || "").toUpperCase();
        const typeId = typeObj?.id as string | undefined;
        const statusVal = (status?.displayValue as string || "").toLowerCase();
        let espnStatus: ESPNStatus = "active";
        if (typeName === "MISSED_CUT" || statusVal === "cut" || statusVal === "missed cut") espnStatus = "cut";
        else if (typeId === "3" || typeId === "6" || typeName.includes("WITHDRAWN") || statusVal.includes("wd")) espnStatus = "wd";
        else if (typeId === "7" || typeName.includes("DISQUALIF") || statusVal === "dq") espnStatus = "dq";

        // Thru holes — directly from status.thru
        const thruNum = status?.thru as number | undefined;
        const isFinishedRound = typeName.includes("PLAY_COMPLETE") || typeName.includes("FINAL")
          || typeName === "MADE_CUT" || typeName === "ROUND_COMPLETE";
        let thru = "-";
        if (isFinishedRound) thru = "F";
        else if (thruNum !== undefined && thruNum > 0) thru = String(thruNum);

        // Score relative to par: read from statistics.scoreToPar
        // If ESPN has populated this stat, the player has started — trust the value directly.
        const scoreToParStat = statistics.find((s) => s.name === "scoreToPar");
        const rawScoreVal = scoreToParStat?.value ?? scoreToParStat?.displayValue;
        const hasKnownScore = rawScoreVal !== undefined && rawScoreVal !== null && rawScoreVal !== "";
        const hasStarted = hasKnownScore
          || espnStatus !== "active"
          || (thruNum !== undefined && thruNum > 0)
          || isFinishedRound;
        const score: number | null = hasStarted
          ? parseScore(rawScoreVal)
          : null;

        // Position: read directly from status.position.displayName ("T9", "1", "CUT", etc.)
        const position = positionObj?.displayName as string | undefined
          || String(comp.sortOrder ?? 9999);

        // Round scores from linescores displayValue ("-1", "E", "+3")
        // Only include rounds that have a real displayValue (not just tee time placeholders)
        const rounds = linescores
          .filter((ls) => ls.displayValue !== undefined && ls.displayValue !== null)
          .map((ls) => ls.displayValue as string);

        return {
          id: String(athlete.id || comp.id || ""),
          name,
          position: espnStatus === "cut" ? "CUT"
            : espnStatus === "wd" ? "WD"
            : espnStatus === "dq" ? "DQ"
            : (position || String(comp.sortOrder ?? "-")),
          score,
          scoreDisplay: formatScore(score),
          thru,
          status: espnStatus,
          round1: rounds[0],
          round2: rounds[1],
          round3: rounds[2],
          round4: rounds[3],
        } as LeaderboardEntry;
      })
      .filter((e): e is LeaderboardEntry => e !== null)
      .sort((a, b) => {
        // Sort by sortOrder from original array (preserved via closure below)
        return 0; // ESPN already returns in order
      });

    return { entries, eventId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ESPN fetch error:", msg);
    return { entries: [], eventId: eventId || null, error: msg };
  }
}
