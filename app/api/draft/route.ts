import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { DraftState, Pick, Config } from "@/lib/types";
import { getSnakeOrder, getDraftedGolferIds } from "@/lib/draft";
import { eventBus } from "@/lib/eventBus";

const draftPath = path.join(process.cwd(), "data", "draft.json");
const configPath = path.join(process.cwd(), "data", "config.json");
const golfersPath = path.join(process.cwd(), "data", "golfers.json");

function readDraft(): DraftState {
  return JSON.parse(fs.readFileSync(draftPath, "utf-8"));
}

function readConfig(): Config {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function readGolfers() {
  return JSON.parse(fs.readFileSync(golfersPath, "utf-8"));
}

function writeDraft(draft: DraftState) {
  fs.writeFileSync(draftPath, JSON.stringify(draft, null, 2));
}

function buildDraftPayload(draft: DraftState, config: Config, golfers: unknown[]) {
  const snakeOrder = getSnakeOrder(config);
  const draftedIds = getDraftedGolferIds(draft.picks);
  const currentPickerIdx = draft.picks.length;
  const currentPicker =
    currentPickerIdx < snakeOrder.length ? snakeOrder[currentPickerIdx] : null;
  const nextPicker =
    currentPickerIdx + 1 < snakeOrder.length
      ? snakeOrder[currentPickerIdx + 1]
      : null;

  return {
    picks: draft.picks,
    snakeOrder,
    currentPicker,
    nextPicker,
    draftComplete: draft.picks.length >= snakeOrder.length,
    draftedIds: Array.from(draftedIds),
    golfers: (golfers as Array<{ id: string }>).map((g) => ({
      ...g,
      drafted: draftedIds.has(g.id),
    })),
  };
}

export async function GET() {
  try {
    const draft = readDraft();
    const config = readConfig();
    const golfers = readGolfers();
    return NextResponse.json(buildDraftPayload(draft, config, golfers));
  } catch {
    return NextResponse.json({ error: "Failed to read draft" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { golferId } = body;

    const draft = readDraft();
    const config = readConfig();
    const golfers = readGolfers();
    const snakeOrder = getSnakeOrder(config);

    if (draft.picks.length >= snakeOrder.length) {
      return NextResponse.json({ error: "Draft is complete" }, { status: 400 });
    }

    const draftedIds = getDraftedGolferIds(draft.picks);
    if (draftedIds.has(golferId)) {
      return NextResponse.json(
        { error: "Golfer already drafted" },
        { status: 400 }
      );
    }

    const golfer = (golfers as Array<{ id: string; name: string }>).find(
      (g) => g.id === golferId
    );
    if (!golfer) {
      return NextResponse.json({ error: "Golfer not found" }, { status: 404 });
    }

    const pickNumber = draft.picks.length + 1;
    const drafter = snakeOrder[draft.picks.length];

    const newPick: Pick = {
      pickNumber,
      drafter,
      golferId,
      golferName: golfer.name,
      timestamp: new Date().toISOString(),
    };

    draft.picks.push(newPick);
    writeDraft(draft);

    // Push update to all connected SSE clients
    const payload = buildDraftPayload(draft, config, golfers);
    eventBus.emit("draft_update", payload);

    return NextResponse.json({ success: true, pick: newPick });
  } catch {
    return NextResponse.json({ error: "Failed to make pick" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reset = searchParams.get("reset") === "true";

    const config = readConfig();
    const golfers = readGolfers();

    if (reset) {
      const emptyDraft: DraftState = { picks: [] };
      writeDraft(emptyDraft);
      const payload = buildDraftPayload(emptyDraft, config, golfers);
      eventBus.emit("draft_update", payload);
      return NextResponse.json({ success: true, reset: true });
    }

    const draft = readDraft();
    if (draft.picks.length === 0) {
      return NextResponse.json({ error: "No picks to undo" }, { status: 400 });
    }
    draft.picks.pop();
    writeDraft(draft);

    const payload = buildDraftPayload(draft, config, golfers);
    eventBus.emit("draft_update", payload);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to undo pick" }, { status: 500 });
  }
}
