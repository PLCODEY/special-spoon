import { LeaderboardEntry } from "./types";

const ESPN_BASE =
  "https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard";

const ESPN_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
};

// Augusta National par by hole (18 holes, par 72)
const HOLE_PARS = [4, 5, 4, 3, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4];
const ROUND_PAR = 72;

// Cumulative par through hole N (1-indexed)
function parThruHole(hole: number): number {
  return HOLE_PARS.slice(0, Math.min(hole, 18)).reduce((a, b) => a + b, 0);
}

function parseScore(val: unknown): number | null {
  if (val === null || val === undefined) return null;
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

  if (typeId === "2" || typeName.includes("CUT") || displayValue.includes("cut") || displayValue === "mc") return "cut";
  if (typeId === "3" || typeId === "6" || typeName.includes("WITHDRAWN") || typeName.includes("_WD") || displayValue.includes("withdrew") || displayValue === "wd") return "wd";
  if (typeId === "7" || typeName.includes("DISQUALIF") || displayValue === "dq") return "dq";
  return "active";
}

function parseThruNumber(comp: Record<string, unknown>): number | null {
  const status = comp.status as Record<string, unknown> | undefined;
  if (!status) return null;

  if (status.thru !== undefined && status.thru !== null) {
    const n = Number(status.thru);
    if (!isNaN(n)) return n;
  }

  const typeObj = status.type as Record<string, unknown> | undefined;
  const shortDetail = (typeObj?.shortDetail as string) || "";
  if (shortDetail.toUpperCase() === "F") return 18;
  const m = shortDetail.match(/thru\s*(\d+)/i);
  if (m) return parseInt(m[1], 10);
  if (/^\d+/.test(shortDetail)) return parseInt(shortDetail, 10);

  const typeName = (typeObj?.name as string) || "";
  if (typeName.includes("PLAY_COMPLETE")) return 18;

  return null;
}

function parseThruDisplay(comp: Record<string, unknown>): string {
  const n = parseThruNumber(comp);
  if (n === 18) return "F";
  if (n !== null && n > 0) return String(n);

  const status = comp.status as Record<string, unknown> | undefined;
  const typeObj = (status?.type as Record<string, unknown> | undefined);
  const typeName = (typeObj?.name as string) || "";
  if (typeName.includes("PLAY_COMPLETE")) return "F";

  return "-";
}

function hasPlayerStarted(
  comp: Record<string, unknown>,
  linescores: Array<Record<string, unknown>>
): boolean {
  const n = parseThruNumber(comp);
  if (n !== null && n > 0) return true;

  const statusObj = comp.status as Record<string, unknown> | undefined;
  const typeObj = (statusObj?.type as Record<string, unknown> | undefined);
  const typeName = ((typeObj?.name as string) || "").toUpperCase();
  if (typeName.includes("SCHEDULED") || typeName.includes("PRE_PLAY")) return false;
  if (typeName.includes("IN_PROGRESS") || typeName.includes("PLAY_COMPLETE")) return true;

  // Check for any non-zero linescore
  return linescores.some((ls) => {
    const v = parseScore(ls.value ?? ls.displayValue);
    return v !== null && v !== 0;
  });
}

/**
 * Compute tournament score relative to par.
 *
 * ESPN's comp.score contains total strokes played (not relative to par).
 * linescores[n] represents each round:
 *   - Completed rounds: total strokes for 18 holes (e.g. 68)
 *   - In-progress round: total strokes for holes played so far (e.g. 25 thru 7 holes)
 *
 * We convert to relative using Augusta par (72 per round, or cumulative par thru N holes).
 */
function computeRelativeScore(
  comp: Record<string, unknown>,
  linescores: Array<Record<string, unknown>>
): number | null {
  // 1. Try explicit relative-to-par fields first
  for (const field of ["toPar", "overallToPar", "scoreRelativeToPar"]) {
    const v = comp[field];
    if (v !== null && v !== undefined) {
      const s = parseScore(v);
      if (s !== null) return s;
    }
  }

  // 2. If comp.score (as object or string) looks like a relative-to-par string
  const scoreObj = comp.score as Record<string, unknown> | undefined;
  if (typeof scoreObj === "object" && scoreObj !== null) {
    const dv = scoreObj.displayValue as string | undefined;
    if (dv && (dv === "E" || /^[+-]\d+$/.test(dv))) {
      return parseScore(dv);
    }
  }
  if (typeof comp.score === "string") {
    const s = comp.score.trim();
    if (s === "E" || /^[+-]\d+$/.test(s)) {
      return parseScore(s);
    }
  }

  // 3. Compute from linescores using Augusta par table
  if (linescores.length > 0) {
    const thruHoles = parseThruNumber(comp); // holes played in current round
    let total = 0;
    let valid = true;

    for (let i = 0; i < linescores.length; i++) {
      const ls = linescores[i];
      const dv = String(ls.displayValue ?? ls.value ?? "").trim();

      // If displayValue looks like relative (E, -4, +2), use directly
      if (dv === "E" || /^[+-]\d+$/.test(dv)) {
        total += parseScore(dv) ?? 0;
        continue;
      }

      const v = parseScore(ls.value ?? ls.displayValue);
      if (v === null) { valid = false; break; }

      // Small values (< 20) — relative to par
      if (v < 20 && v > -20) {
        total += v;
        continue;
      }

      // Large values — total strokes for the round
      const isLastRound = i === linescores.length - 1;
      const isInProgress = isLastRound && thruHoles !== null && thruHoles < 18;

      if (isInProgress && thruHoles !== null && thruHoles > 0) {
        // Use Augusta par for the holes played
        total += v - parThruHole(thruHoles);
      } else {
        // Complete 18-hole round
        total += v - ROUND_PAR;
      }
    }

    if (valid) return total;
  }

  // 4. Raw comp.score fallback — only use if it looks like relative to par
  const raw = parseScore(comp.score);
  if (raw !== null && raw < 0) return raw; // negative = definitely under par
  // Don't return positive values — could be total strokes

  return null;
}

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
            e.name?.toLowerCase().includes("masters") ||
            e.shortName?.toLowerCase().includes("masters")
        );
        if (mastersEvent) {
          eventId = mastersEvent.id;
          console.log(`ESPN: discovered Masters event ID: ${eventId}`);
        } else {
          const msg = `Masters not found. Events: ${events.slice(0, 5).map((e) => e.name).join(", ")}`;
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

    // Log first competitor's score fields for debugging
    if (competitors[0]) {
      const c0 = competitors[0] as Record<string, unknown>;
      const athlete = c0.athlete as Record<string, unknown> | undefined;
      console.log(`ESPN sample [${athlete?.displayName}]: score=${JSON.stringify(c0.score)}, toPar=${c0.toPar}, linescores=${JSON.stringify(c0.linescores)}, sortOrder=${c0.sortOrder}, status.thru=${(c0.status as Record<string, unknown>)?.thru}`);
    }

    const rawEntries: Array<LeaderboardEntry & { _sortOrder: number }> = [];

    for (const comp of competitors) {
      const athlete = (comp.athlete || {}) as Record<string, unknown>;
      const linescores: Array<Record<string, unknown>> =
        (comp.linescores as Array<Record<string, unknown>>) || [];

      const status = parseStatus(comp);
      const started = status !== "active" || hasPlayerStarted(comp, linescores);
      const sortOrder = Number(comp.sortOrder ?? comp.order ?? 9999);
      const thru = parseThruDisplay(comp);
      const overallScore = started ? computeRelativeScore(comp, linescores) : null;

      const rounds = linescores.map((ls) => {
        const v = ls.displayValue ?? ls.value;
        return v !== undefined ? String(v) : undefined;
      });

      const name = String(
        athlete.displayName || athlete.fullName || athlete.shortName || ""
      );
      if (!name) continue;

      rawEntries.push({
        id: String(athlete.id || comp.id || ""),
        name,
        position: String(sortOrder),
        _sortOrder: sortOrder,
        score: overallScore,
        scoreDisplay: formatScore(overallScore),
        thru,
        status,
        round1: rounds[0] as string | undefined,
        round2: rounds[1] as string | undefined,
        round3: rounds[2] as string | undefined,
        round4: rounds[3] as string | undefined,
      });
    }

    // Detect ties from ESPN's sortOrder
    const sortOrderCounts = new Map<number, number>();
    for (const e of rawEntries) {
      if (e.status === "active") {
        sortOrderCounts.set(e._sortOrder, (sortOrderCounts.get(e._sortOrder) || 0) + 1);
      }
    }

    for (const e of rawEntries) {
      if (e.status === "cut") { e.position = "CUT"; continue; }
      if (e.status === "wd") { e.position = "WD"; continue; }
      if (e.status === "dq") { e.position = "DQ"; continue; }
      const count = sortOrderCounts.get(e._sortOrder) || 1;
      e.position = count > 1 ? `T${e._sortOrder}` : String(e._sortOrder);
    }

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
