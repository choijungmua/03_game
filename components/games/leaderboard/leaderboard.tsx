import { useId } from "react";

import { cn } from "@/lib";

import type { LeaderboardProps, TierLabelProps } from "./type";

const RANK_BADGE_CLASSES = [
  "bg-amber-400 text-neutral-950",
  "bg-zinc-300 text-neutral-950",
  "bg-orange-400 text-neutral-950",
];

export function TierLabel({ label, dotClass }: TierLabelProps) {
  return (
    <span className="inline-flex items-center justify-end gap-1.5 text-text-normal">
      <span aria-hidden="true" className={cn("size-2 rounded-full", dotClass)} />
      {label}
    </span>
  );
}

export function Leaderboard({
  columns,
  rows,
  size,
  highlightId,
  legendTitle = "등급 기준",
  legend,
}: LeaderboardProps) {
  const titleId = useId();
  const slots = Array.from({ length: size }, (_, index) => rows[index]);

  return (
    <section
      aria-labelledby={titleId}
      className="w-full overflow-hidden rounded-2xl bg-card text-left text-foreground shadow-xl"
    >
      <h2
        id={titleId}
        className="px-4 pt-4 pb-1 text-caption-1 font-semibold text-text-strong"
      >
        최고 기록
      </h2>

      <table className="w-full text-caption-1 tabular-nums">
        <thead>
          <tr className="text-caption-3 text-text-caption">
            <th scope="col" className="w-16 px-4 py-2 text-left font-medium">
              순위
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn("px-4 py-2 font-medium", column.align === "right" ? "text-right" : "text-left")}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((row, index) => (
            <tr
              key={row?.id ?? `empty-${index}`}
              className={cn(row !== undefined && row.id === highlightId && "bg-primary/15")}
            >
              <td className="px-4 py-2.5">
                <span
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-full text-caption-2 font-bold",
                    RANK_BADGE_CLASSES[index] ?? "bg-bg-alternative text-text-caption",
                  )}
                >
                  {index + 1}
                </span>
              </td>
              {columns.map((column, columnIndex) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-4 py-2.5",
                    column.align === "right" ? "text-right" : "text-left",
                    columnIndex === 0 && "font-semibold text-text-strong",
                  )}
                >
                  {row ? row.cells[column.key] : <span className="text-text-caption">-</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {legend && legend.length > 0 && (
        <footer className="px-4 pt-2 pb-4">
          <h3 className="mb-2 text-caption-3 font-medium text-text-caption">{legendTitle}</h3>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {legend.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5 text-caption-3">
                <span aria-hidden="true" className={cn("size-2 rounded-full", item.dotClass)} />
                <span className="font-semibold text-text-normal">{item.label}</span>
                <span className="text-text-caption">{item.range}</span>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </section>
  );
}
