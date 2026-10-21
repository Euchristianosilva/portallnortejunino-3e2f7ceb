import { Crown, Lock, Medal, Trophy, UserRound, ThumbsUp } from "lucide-react";
import { StoredImage } from "@/components/site/StoredImage";
import { buildRanking, fmtPct, type Ranked } from "@/lib/ranking";

type Opt = { id: string; name: string; image_url: string | null; group_name: string; artistic_name: string; position: number; votes: number };

const TONE = {
  1: { ring: "border-gold", text: "text-gold", bg: "bg-gold", label: "Campeão" },
  2: { ring: "border-silver", text: "text-silver", bg: "bg-silver", label: "Vice-campeão" },
  3: { ring: "border-bronze", text: "text-bronze", bg: "bg-bronze", label: "Terceiro lugar" },
} as const;

function tone(rank: number) {
  return TONE[(rank <= 3 ? rank : 3) as 1 | 2 | 3];
}
function label(r: Ranked<Opt>) {
  return r.tied ? `Empate no ${r.rank}º lugar` : tone(r.rank).label;
}

export function PollRanking({ options }: { options: Opt[] }) {
  const { rows, total } = buildRanking(options);
  const podium = total > 0 ? rows.filter((r) => r.rank <= 3).slice(0, 3) : [];
  const order = ["md:order-2", "md:order-1", "md:order-3"];

  return (
    <section className="bg-hero border-b border-border" aria-labelledby="ranking-title">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-gold">
            <Lock className="size-3.5" /> Votação encerrada
          </span>
          <h2 id="ranking-title" className="mt-4 flex items-center justify-center gap-3 text-3xl font-extrabold md:text-5xl">
            <Trophy className="size-9 text-gold md:size-11" /> Resultado oficial
          </h2>
          <p className="mt-2 text-lg text-foreground/90">Classificação final da votação</p>
          {rows.some((r) => r.tied && r.rank <= 3) && (
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">Há empate entre participantes com a mesma quantidade de votos. Eles dividem a mesma posição.</p>
          )}
        </div>

        {total === 0 ? (
          <p className="mt-10 text-center text-muted-foreground">Nenhum voto foi registrado nesta votação.</p>
        ) : (
          <div className="mt-12 grid items-end gap-6 md:grid-cols-3">
            {podium.map((r, i) => {
              const t = tone(r.rank);
              const first = r.rank === 1;
              return (
                <article key={r.id} className={`relative rounded-2xl border-2 ${t.ring} bg-card p-4 shadow-card ${order[i]} ${first ? "md:-translate-y-6" : ""}`}>
                  {first && <Crown className="absolute -top-5 left-1/2 size-9 -translate-x-1/2 text-gold" aria-hidden />}
                  <div className="relative overflow-hidden rounded-xl">
                    {r.image_url ? (
                      <StoredImage src={r.image_url} alt={r.name} className={`w-full object-cover ${first ? "aspect-[4/3.4]" : "aspect-[4/3]"}`} />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center bg-muted"><UserRound className="size-16 text-muted-foreground/50" /></div>
                    )}
                    <span className={`absolute left-3 top-3 flex size-11 items-center justify-center rounded-full ${t.bg} text-lg font-extrabold text-navy-deep shadow`}>{r.rank}º</span>
                  </div>
                  <div className="mt-4 text-center">
                    <h3 className="text-lg font-extrabold uppercase leading-tight">{r.name}</h3>
                    {(r.group_name || r.artistic_name) && <p className="mt-1 text-sm text-foreground/80">Representa: {r.group_name || r.artistic_name}</p>}
                    <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full ${t.bg} px-4 py-1 text-xs font-extrabold uppercase text-navy-deep`}>
                      {first ? <Trophy className="size-3.5" /> : <Medal className="size-3.5" />} {label(r)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm font-semibold">
                    <span className="flex items-center gap-1.5"><ThumbsUp className="size-4" /> {r.votes} voto(s)</span>
                    <span>{fmtPct(r.pct)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`portal-result-bar h-full rounded-full ${t.bg}`} style={{ width: `${r.pct}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {total > 0 && (
          <div className="theme-light mt-12 rounded-2xl p-4 shadow-card sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-xl font-extrabold"><Trophy className="size-6 text-primary" /> Classificação completa</h3>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">Total de votos: {total}</span>
            </div>
            <ol className="mt-4 divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="grid grid-cols-[2.5rem_3rem_1fr] items-center gap-3 py-3 sm:grid-cols-[2.5rem_3rem_1fr_14rem]">
                  <span className={`flex size-9 items-center justify-center rounded-full text-sm font-extrabold ${r.rank <= 3 ? `${tone(r.rank).bg} text-navy-deep` : "bg-muted"}`} aria-label={`${r.rank}º lugar${r.tied ? " (empate)" : ""}`}>{r.rank}</span>
                  {r.image_url ? <StoredImage src={r.image_url} alt="" className="size-12 rounded-lg object-cover" /> : <span className="flex size-12 items-center justify-center rounded-lg bg-muted"><UserRound className="size-6 text-muted-foreground/50" /></span>}
                  <div className="min-w-0">
                    <div className="truncate font-bold uppercase">{r.name}{r.tied && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold normal-case text-muted-foreground">Empate</span>}</div>
                    {(r.group_name || r.artistic_name) && <div className="truncate text-xs text-muted-foreground">Representa: {r.group_name || r.artistic_name}</div>}
                    <div className="mt-1 flex justify-between text-xs font-semibold sm:hidden"><span>{r.votes} voto(s)</span><span>{fmtPct(r.pct)}</span></div>
                  </div>
                  <div className="col-span-3 sm:col-span-1">
                    <div className="hidden justify-between text-sm font-semibold sm:flex"><span>{r.votes}</span><span>{fmtPct(r.pct)}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${r.pct}%` }} /></div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-muted-foreground">Critério: maior número de votos válidos. Participantes com a mesma quantidade de votos dividem a posição.</p>
          </div>
        )}
      </div>
    </section>
  );
}
