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
    const { entries, eventId } = await fetchMastersLeaderboard(
      config.espnEventId
    );

    // Persist discovered eventId
    if (eventId && !config.espnEventId) {
      config.espnEventId = eventId;
      writeConfig(config);
    }

    return NextResponse.json({ entries, eventId });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch leaderboard", entries: [], eventId: null },
      { status: 500 }
    );
  }
}
