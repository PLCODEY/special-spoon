import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Golfer } from "@/lib/types";

const golfersPath = path.join(process.cwd(), "data", "golfers.json");

export async function GET() {
  try {
    const golfers = JSON.parse(fs.readFileSync(golfersPath, "utf-8"));
    return NextResponse.json(golfers);
  } catch {
    return NextResponse.json(
      { error: "Failed to read golfers" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const golfers: Golfer[] = await request.json();
    fs.writeFileSync(golfersPath, JSON.stringify(golfers, null, 2));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update golfers" },
      { status: 500 }
    );
  }
}
