import { Config, Pick } from "./types";

export function getSnakeOrder(config: Config): string[] {
  const { pickOrder, picksPerPerson } = config;
  const totalPicks = pickOrder.length * picksPerPerson;
  const order: string[] = [];

  for (let round = 0; round < picksPerPerson; round++) {
    if (round % 2 === 0) {
      order.push(...pickOrder);
    } else {
      order.push(...[...pickOrder].reverse());
    }
  }

  return order.slice(0, totalPicks);
}

export function getCurrentPicker(
  snakeOrder: string[],
  picks: Pick[]
): string | null {
  if (picks.length >= snakeOrder.length) return null;
  return snakeOrder[picks.length];
}

export function getNextPicker(
  snakeOrder: string[],
  picks: Pick[]
): string | null {
  if (picks.length + 1 >= snakeOrder.length) return null;
  return snakeOrder[picks.length + 1];
}

export function getDraftedGolferIds(picks: Pick[]): Set<string> {
  return new Set(picks.map((p) => p.golferId));
}

export function getTeamPicks(picks: Pick[]): Record<string, Pick[]> {
  const teams: Record<string, Pick[]> = {};
  for (const pick of picks) {
    if (!teams[pick.drafter]) teams[pick.drafter] = [];
    teams[pick.drafter].push(pick);
  }
  return teams;
}

export function isDraftComplete(config: Config, picks: Pick[]): boolean {
  return picks.length >= config.pickOrder.length * config.picksPerPerson;
}
