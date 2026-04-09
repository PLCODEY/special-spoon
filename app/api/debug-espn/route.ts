import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Config } from "@/lib/types";

const configPath = path.join(process.cwd(), "data", "config.json");
const ESPN_BASE =
  "https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard";
const ESPN_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
};

export async function GET() {
  const config: Config = JSON.parse(
    fs.readFileSync(configPath, "utf-8")
  );

  // Step 1: list events
  let eventId = config.espnEventId;
  let listStatus: number | null = null;
  let listError: string | null = null;
  let eventNames: string[] = [];

  if (!eventId) {
    try {
      const r = await fetch(`${ESPN_BASE}?league=pga`, {
        cache: "no-store",
        headers: ESPN_HEADERS,
      });
      listStatus = r.status;
      if (r.ok) {
        const d = await r.json();
        eventNames = (d?.events || []).map(
          (e: { name?: string; id: string }) => `${e.name} (${e.id})`
        );
        const m = (d?.events || []).find(
          (e: { name?: string; shortName?: string }) =>
            e.name?.toLowerCase().includes("masters") ||
            e.shortName?.toLowerCase().includes("masters")
        );
        if (m) eventId = m.id;
      } else {
        listError = await r.text().catch(() => "");
      }
    } catch (e) {
      listError = String(e);
    }
  }

  // Step 2: fetch leaderboard sample
  let lbStatus: number | null = null;
  let lbError: string | null = null;
  let sampleCompetitor: unknown = null;
  let totalCompetitors = 0;

  if (eventId) {
    try {
      const r = await fetch(`${ESPN_BASE}?league=pga&event=${eventId}`, {
        cache: "no-store",
        headers: ESPN_HEADERS,
      });
      lbStatus = r.status;
      if (r.ok) {
        const d = await r.json();
        const comps = d?.events?.[0]?.competitions?.[0]?.competitors || [];
        totalCompetitors = comps.length;
        // Return first 3 competitors' raw data for inspection
        sampleCompetitor = comps.slice(0, 3);
      } else {
        lbError = await r.text().catch(() => "").then((t) => t.slice(0, 500));
      }
    } catch (e) {
      lbError = String(e);
    }
  }

  return NextResponse.json({
    configEventId: config.espnEventId,
    discoveredEventId: eventId,
    listEventsStatus: listStatus,
    listEventsError: listError,
    availableEvents: eventNames,
    leaderboardStatus: lbStatus,
    leaderboardError: lbError,
    totalCompetitors,
    sampleCompetitor,
  });
}
