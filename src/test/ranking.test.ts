import { buildRanking } from "@/lib/ranking";

const o = (id: string, votes: number, position = 0) => ({ id, votes, position });

describe("ranking final", () => {
  it("ordena do maior para o menor e calcula porcentagens sobre o total", () => {
    const { rows, total } = buildRanking([o("c", 50, 0), o("a", 150, 1), o("b", 100, 2), o("d", 30, 3)]);
    expect(total).toBe(330);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
    expect(rows[0]?.pct).toBe(45.45);
    expect(rows[1]?.pct).toBe(30.3);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });
  it("empate divide a posição e não inventa vencedor", () => {
    const { rows } = buildRanking([o("a", 10), o("b", 10), o("c", 5)]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
    expect(rows[0]?.tied).toBe(true);
    expect(rows[2]?.tied).toBe(false);
  });
});
