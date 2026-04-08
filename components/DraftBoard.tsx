"use client";
import { Config, Pick } from "@/lib/types";
import { getSnakeOrder } from "@/lib/draft";

interface Props {
  config: Config;
  picks: Pick[];
  currentPicker: string | null;
  draftComplete: boolean;
}

const COLORS = [
  "bg-emerald-700",
  "bg-blue-700",
  "bg-purple-700",
  "bg-orange-700",
  "bg-red-700",
  "bg-yellow-700",
  "bg-pink-700",
  "bg-teal-700",
  "bg-indigo-700",
  "bg-rose-700",
];

export default function DraftBoard({
  config,
  picks,
  currentPicker,
  draftComplete,
}: Props) {
  const snakeOrder = getSnakeOrder(config);
  const colorMap = Object.fromEntries(
    config.pickOrder.map((name, i) => [name, COLORS[i % COLORS.length]])
  );

  // Build grid: rows = rounds, cols = drafters
  const rounds = config.picksPerPerson;
  const people = config.pickOrder;

  // picks indexed by pickNumber
  const pickMap = new Map(picks.map((p) => [p.pickNumber, p]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-800">
            <th className="px-3 py-2 text-left text-gray-400 font-medium w-16">
              Round
            </th>
            {people.map((name) => (
              <th
                key={name}
                className={`px-3 py-2 text-center font-semibold text-white ${
                  currentPicker === name && !draftComplete
                    ? "ring-2 ring-yellow-400"
                    : ""
                }`}
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rounds }, (_, roundIdx) => {
            const isEvenRound = roundIdx % 2 === 0;
            const roundPeople = isEvenRound
              ? people
              : [...people].reverse();

            return (
              <tr
                key={roundIdx}
                className={roundIdx % 2 === 0 ? "bg-gray-900" : "bg-gray-850"}
              >
                <td className="px-3 py-2 text-gray-400 font-medium border-r border-gray-700">
                  {roundIdx + 1}
                </td>
                {people.map((name) => {
                  // Find which pick slot this person has in this round
                  const posInRound = roundPeople.indexOf(name);
                  const pickNum = roundIdx * people.length + posInRound + 1;
                  const pick = pickMap.get(pickNum);
                  const isNext =
                    !pick &&
                    snakeOrder[picks.length] === name &&
                    Math.floor(picks.length / people.length) === roundIdx;

                  return (
                    <td
                      key={name}
                      className={`px-3 py-2 border border-gray-700 text-center min-w-[120px]`}
                    >
                      {pick ? (
                        <div
                          className={`${colorMap[name]} rounded px-2 py-1 text-white text-xs`}
                        >
                          <div className="font-semibold">{pick.golferName}</div>
                          <div className="opacity-70">#{pick.pickNumber}</div>
                        </div>
                      ) : isNext ? (
                        <div className="border-2 border-yellow-400 border-dashed rounded px-2 py-1 text-yellow-400 text-xs animate-pulse">
                          On the clock
                        </div>
                      ) : (
                        <div className="text-gray-700">—</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
