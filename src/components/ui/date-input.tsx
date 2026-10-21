import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Calendar } from "./calendar";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
export function DateInput({ value, onChange, label }: { value:string; onChange:(value:string)=>void; label:string }) {
 const date=value?parseISO(value):undefined;
 return <Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-start" aria-label={label}><CalendarDays/>{date?format(date,"dd/MM/yyyy"):"Selecionar data"}</Button></PopoverTrigger><PopoverContent className="theme-light w-auto p-0"><Calendar mode="single" {...(date?{selected:date}:{})} onSelect={date=>onChange(date?format(date,"yyyy-MM-dd"):"")} /><Button type="button" variant="ghost" className="w-full" onClick={()=>onChange("")}>Limpar data</Button></PopoverContent></Popover>;
}