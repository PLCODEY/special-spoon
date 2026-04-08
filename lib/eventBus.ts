import { EventEmitter } from "events";

// Singleton EventEmitter that persists across Next.js hot reloads in dev
const g = global as unknown as { _golfEventBus?: EventEmitter };
if (!g._golfEventBus) {
  g._golfEventBus = new EventEmitter();
  g._golfEventBus.setMaxListeners(200);
}

export const eventBus = g._golfEventBus;
