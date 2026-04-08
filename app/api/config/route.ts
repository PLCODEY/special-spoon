import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
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
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Failed to read config" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const current = readConfig();
    const updated: Config = { ...current, ...body };
    writeConfig(updated);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
