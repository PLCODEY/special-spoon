import { LeaderboardEntry } from "./types";

const ESPN_BASE =
  "https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard";

function parseScore(val: unknown): number | null {
  if (val === null || val === undefined) return null;
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

function parseStatusFromCompetitor(comp: Record<string, unknown>): ESPNStatus {
  // ESPN uses status object with type.name
  const statusObj = comp.status as Record<string, unknown> | undefined;
  const typeName = (
    statusObj?.type as Record<string, unknown>
  )?.name as string | undefined;
  const typeId = (statusObj?.type as Record<string, unknown>)?.id as
    | string
    | undefined;
  const displayValue = (statusObj?.displayValue as string | undefined)?.toLowerCase() || "";

  if (
    typeId === "2" ||
    displayValue.includes("cut") ||
    displayValue === "mc"
  )
    return "cut";
  if (
    typeId === "6" ||
    displayValue.includes("withdrew") ||
    displayValue.includes("wd")
  )
    return "wd";
  if (typeId === "7" || displayValue.includes("disqualif") || displayValue === "dq")
    return "dq";

  // Fallback: check linescoreDisplay
  const ld = (comp.linescoreDisplay as string | undefined)?.toLowerCase() || "";
  if (ld === "cut" || ld === "mc") return "cut";
  if (ld === "wd") return "wd";

  return "active";
}

export async function fetchMastersLeaderboard(
  eventId?: string | null
): Promise<{ entries: LeaderboardEntry[]; eventId: string | null }> {
  try {
    // Auto-discover The Masters event if no ID given
    if (!eventId) {
      const listResp = await fetch(`${ESPN_BASE}?league=pga`, {
        cache: "no-store",
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
        if (mastersEvent) eventId = mastersEvent.id;
      }
    }

    if (!eventId) {
      return { entries: [], eventId: null };
    }

    const resp = await fetch(`${ESPN_BASE}?league=pga&event=${eventId}`, {
      cache: "no-store",
    });
    if (!resp.ok) throw new Error(`ESPN API error: ${resp.status}`);
    const data = await resp.json();

    // ESPN structure: data.events[0].competitions[0].competitors[]
    const competitors: Record<string, unknown>[] =
      data?.events?.[0]?.competitions?.[0]?.competitors || [];

    const entries: LeaderboardEntry[] = competitors
      .map((comp) => {
        const athlete = (comp.athlete || {}) as Record<string, unknown>;
        const linescores: Array<Record<string, unknown>> =
          (comp.linescores as Array<Record<string, unknown>>) || [];

        const status = parseStatusFromCompetitor(comp);
        const overallScore = parseScore(comp.score ?? comp.totalScore);

        // Position from status display or sortOrder
        let position = "-";
        const statusObj = comp.status as Record<string, unknown> | undefined;
        const posDisplay = statusObj?.displayValue as string | undefined;
        if (status === "cut") {
          position = "CUT";
        } else if (status === "wd") {
          position = "WD";
        } else if (posDisplay && posDisplay.toLowerCase() !== "active") {
          position = posDisplay;
        } else {
          position = String(comp.sortOrder || "-");
        }

        const rounds = linescores.map((ls) => ls.displayValue as string);

        return {
          id: String(athlete.id || comp.id || ""),
          name: String(
            athlete.displayName || athlete.fullName || athlete.shortName || ""
          ),
          position,
          score: overallScore,
          scoreDisplay: formatScore(overallScore),
          thru: String(
            (comp.status as Record<string, unknown>)?.period || "-"
          ),
          status,
          round1: rounds[0],
          round2: rounds[1],
          round3: rounds[2],
          round4: rounds[3],
        } as LeaderboardEntry;
      })
      .filter((e) => e.name); // remove empty entries

    return { entries, eventId };
  } catch (err) {
    console.error("ESPN fetch error:", err);
    return { entries: [], eventId: eventId || null };
  }
}
