/**
 * Final poll ranking. Order: most votes first. Tie rule (documented):
 * candidates with the same number of votes share the same position
 * ("1, 1, 3" competition ranking) and are flagged as tied — no winner is invented.
 * Display order inside a tie follows the candidate order set in the admin panel.
 */
export type RankInput = { id: string; position: number; votes: number };
export type Ranked<T> = T & { rank: number; tied: boolean; pct: number };

export function rankPct(votes: number, total: number) {
  if (!total) return 0;
  return Math.round((votes / total) * 10000) / 100;
}

export function buildRanking<T extends RankInput>(items: T[]): { rows: Ranked<T>[]; total: number } {
  const total = items.reduce((a, b) => a + b.votes, 0);
  const sorted = [...items].sort((a, b) => b.votes - a.votes || a.position - b.position);
  const rows = sorted.map((it) => {
    const rank = 1 + sorted.filter((o) => o.votes > it.votes).length;
    const tied = sorted.filter((o) => o.votes === it.votes).length > 1;
    return { ...it, rank, tied, pct: rankPct(it.votes, total) };
  });
  return { rows, total };
}

export function fmtPct(n: number) {
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
