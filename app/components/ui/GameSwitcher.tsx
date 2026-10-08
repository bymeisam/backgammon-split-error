import Link from "next/link";
import { style } from "./GameSwitcher.styles";

// A segmented row of a match's games, each linking to its replay; the
// current one raised (the replay header), or none (the match page, with a
// "Replay" label). One item per real game.
export default function GameSwitcher({
  matchId,
  games,
  current,
  label,
}: {
  matchId: string;
  games: number[];
  current?: number;
  label?: string;
}) {
  if (games.length === 0) return null;
  return (
    <div className={style.wrapper}>
      {label && <span className={style.label}>{label}</span>}
      <nav className={style.track} aria-label={label ? `${label}: game` : "Game"}>
        {games.map((g) => (
          <Link
            key={g}
            href={`/matches/${encodeURIComponent(matchId)}/replay/${g}`}
            aria-current={g === current ? "page" : undefined}
            aria-label={`Game ${g}`}
            className={style.item(g === current)}
          >
            {g}
          </Link>
        ))}
      </nav>
    </div>
  );
}
