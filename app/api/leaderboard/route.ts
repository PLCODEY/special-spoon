import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { fetchMastersLeaderboard } from "@/lib/espn";
import { Config } from "@/lib/types";

const configPath = path.join(process.cwd(), "data", "config.json");

function readConfig(): Config {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function writeConfig(config: Config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export async function GET() {
  try {
    const config = readConfig();
    const { entries, eventId, error } = await fetchMastersLeaderboard(
      config.espnEventId
    );

    // Persist discovered eventId
    if (eventId && !config.espnEventId) {
      config.espnEventId = eventId;
      writeConfig(config);
    }

    return NextResponse.json({ entries, eventId, error: error || null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg, entries: [], eventId: null },
      { status: 500 }
    );
  }
}
