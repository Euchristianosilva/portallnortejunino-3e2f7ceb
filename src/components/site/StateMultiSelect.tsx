import { useState } from "react";
import { MapPin, ChevronDown, X, Search, CheckCheck, Eraser } from "lucide-react";
import { BRAZIL_STATES, searchStates } from "@/lib/brazil-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function StateMultiSelect({ value, onChange, disabled = false }: { value: string[]; onChange: (value: string[]) => void; disabled?: boolean }) {
  const [search, setSearch] = useState("");
  function toggle(code: string) {
    onChange(value.includes(code) ? value.filter(c => c !== code) : BRAZIL_STATES.filter(s => s.code === code || value.includes(s.code)).map(s => s.code));
  }
  return <div className="space-y-3">
    <Popover>
      <PopoverTrigger asChild><Button id="opportunity-states" type="button" variant="outline" disabled={disabled} className="h-auto min-h-11 w-full justify-between gap-2 text-left">
        <span className="flex min-w-0 items-center gap-2"><MapPin className="size-4 shrink-0" /><span className="whitespace-normal">{value.length ? `${value.length} de 27 estados selecionados` : "Selecionar estados de atuação"}</span></span><ChevronDown className="size-4 shrink-0" />
      </Button></PopoverTrigger>
      <PopoverContent align="start" className="theme-light flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 p-3" onOpenAutoFocus={e => e.preventDefault()}>
        <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Pesquisar estado por nome ou sigla" placeholder="Pesquisar nome ou sigla" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <div className="flex flex-wrap justify-between gap-1 border-b border-border pb-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(BRAZIL_STATES.map(s => s.code))}><CheckCheck />Selecionar todos</Button>
          <Button type="button" size="sm" variant="ghost" disabled={!value.length} onClick={() => onChange([])}><Eraser />Limpar seleção</Button>
        </div>
        <div className="max-h-[min(18rem,40dvh)] overflow-y-auto overscroll-contain">
          {searchStates(search).map(s => <label key={s.code} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent">
            <Checkbox aria-label={`${s.name} (${s.code})`} checked={value.includes(s.code)} onCheckedChange={() => toggle(s.code)} /><span className="w-7 font-bold text-primary">{s.code}</span>{s.name}
          </label>)}
          {!searchStates(search).length && <p className="p-3 text-sm text-muted-foreground">Nenhum estado encontrado.</p>}
        </div>
        <p aria-live="polite" className="border-t border-border pt-2 text-xs text-muted-foreground">{value.length} de 27 unidades federativas</p>
      </PopoverContent>
    </Popover>
    {!!value.length && <div className="flex flex-wrap gap-2">{BRAZIL_STATES.filter(s => value.includes(s.code)).map(s => <span key={s.code} className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary pl-2 text-xs font-semibold text-secondary-foreground">
      {s.code}<Button type="button" size="icon" variant="ghost" disabled={disabled} className="size-7" aria-label={`Remover ${s.name}`} title={`Remover ${s.name}`} onClick={() => toggle(s.code)}><X className="size-3" /></Button>
    </span>)}<Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([])}><Eraser />Limpar</Button></div>}
  </div>;
}