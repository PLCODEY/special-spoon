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

function parseThru(comp: Record<string, unknown>): string {
  const status = comp.status as Record<string, unknown> | undefined;
  if (!status) return "-";

  if (status.thru !== undefined && status.thru !== null) {
    const t = String(status.thru).trim();
    if (t !== "" && t !== "0") return t;
  }

  const typeObj = status.type as Record<string, unknown> | undefined;
  const shortDetail = (typeObj?.shortDetail as string) || "";
  if (shortDetail) {
    if (shortDetail.toUpperCase() === "F") return "F";
    const m = shortDetail.match(/thru\s*(\d+)/i);
    if (m) return m[1];
    if (/^\d+/.test(shortDetail)) return shortDetail.replace(/\*/g, "");
  }

  const typeName = (typeObj?.name as string) || "";
  if (typeName.includes("PLAY_COMPLETE") || typeName.includes("COMPLETE")) return "F";

  // Don't fall back to "R1" etc — use "-" if unknown
  return "-";
}

function hasPlayerStarted(
  comp: Record<string, unknown>,
  linescores: Array<Record<string, unknown>>
): boolean {
  const thru = parseThru(comp);
  if (thru !== "-" && thru !== "F") return true; // has a hole count
  if (thru === "F") return true; // finished a round

  // Check status type name
  const statusObj = comp.status as Record<string, unknown> | undefined;
  const typeObj = statusObj?.type as Record<string, unknown> | undefined;
  const typeName = ((typeObj?.name as string) || "").toUpperCase();
  if (typeName.includes("SCHEDULED") || typeName.includes("PRE_PLAY")) return false;
  if (typeName.includes("IN_PROGRESS") || typeName.includes("PLAY_COMPLETE")) return true;

  // If linescores has any non-zero value, player has started
  if (linescores.length > 0) {
    const anyNonZero = linescores.some((ls) => {
      const v = parseScore(ls.value ?? ls.displayValue);
      return v !== null && v !== 0;
    });
    if (anyNonZero) return true;
  }

  return false;
}

/**
 * Attempt to get tournament score relative to par.
 * ESPN sometimes returns total strokes in comp.score — try to find the
 * relative-to-par value from other fields first.
 */
function getRelativeScore(
  comp: Record<string, unknown>,
  linescores: Array<Record<string, unknown>>
): number | null {
  // 1. Try explicit relative-to-par fields (some ESPN endpoints provide these)
  for (const field of ["toPar", "overallToPar", "displayScore", "scoreRelativeToPar"]) {
    const v = comp[field];
    if (v !== null && v !== undefined) {
      const s = parseScore(v);
      if (s !== null) return s;
    }
  }

  // 2. If comp.score is an object, check its displayValue for a relative-looking string
  const scoreObj = comp.score as Record<string, unknown> | undefined;
  if (typeof scoreObj === "object" && scoreObj !== null) {
    const dv = scoreObj.displayValue as string | undefined;
    // Relative-to-par strings: "E", "-7", "+3" (never look like "17" or "68")
    if (dv && (dv === "E" || /^[+-]\d+$/.test(dv))) {
      return parseScore(dv);
    }
  }

  // 3. If comp.score is a string that looks like relative-to-par, use it
  if (typeof comp.score === "string") {
    const s = comp.score.trim();
    if (s === "E" || /^[+-]\d+$/.test(s)) {
      return parseScore(s);
    }
  }

  // 4. Sum linescores IF they all look like relative-to-par (small, or "E"/"+"/"-")
  if (linescores.length > 0) {
    let sum = 0;
    let valid = true;
    let anyRelative = false;
    for (const ls of linescores) {
      const dv = String(ls.displayValue ?? ls.value ?? "").trim();
      // Total-strokes values for 18 holes are 60-90; relative are -15 to +20
      const v = parseScore(dv === "E" ? 0 : dv);
      if (v === null) { valid = false; break; }
      if (v < 0 || dv === "E") anyRelative = true; // negative = definitely relative
      if (v > 50) { valid = false; break; } // definitely total strokes for a round
      sum += v;
    }
    if (valid && anyRelative) return sum;
    // If all linescores are small non-negative, could be relative (+3, +2) — use if sum <= 20
    if (valid && Math.abs(sum) <= 20) return sum;
  }

  // 5. comp.score as a number: if it's in a plausible relative-score range use it
  const raw = parseScore(comp.score);
  if (raw !== null && raw < 0) return raw; // negative = definitely under par, use it
  // Positive values are ambiguous (could be total strokes or over par)
  // For values > 20, assume total strokes and return null
  if (raw !== null && raw <= 20) return raw;

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

    console.log(`ESPN: ${competitors.length} competitors for event ${eventId}`);

    // First pass: collect raw data with ESPN's sortOrder
    const rawEntries: Array<LeaderboardEntry & { _sortOrder: number }> = [];

    for (const comp of competitors) {
      const athlete = (comp.athlete || {}) as Record<string, unknown>;
      const linescores: Array<Record<string, unknown>> =
        (comp.linescores as Array<Record<string, unknown>>) || [];

      const status = parseStatus(comp);
      const started = status !== "active" || hasPlayerStarted(comp, linescores);
      const sortOrder = Number(comp.sortOrder ?? comp.order ?? 9999);
      const thru = parseThru(comp);

      // Score: only meaningful if player has started
      const overallScore = started ? getRelativeScore(comp, linescores) : null;

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
        position: String(sortOrder), // will be updated below
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

    // Compute positions using ESPN's sortOrder with tie detection
    // Group by sortOrder to detect ties
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
