import { useRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";

export function PasswordInput(props: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return <div className="relative">
    <Input {...props} ref={ref} type={visible ? "text" : "password"} className={`pr-12 ${props.className ?? ""}`} />
    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-10" aria-label={visible ? "Ocultar senha" : "Mostrar senha"} title={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible} onMouseDown={(e) => e.preventDefault()} onClick={() => { setVisible((v) => !v); ref.current?.focus(); }}>
      {visible ? <EyeOff /> : <Eye />}
    </Button>
  </div>;
}