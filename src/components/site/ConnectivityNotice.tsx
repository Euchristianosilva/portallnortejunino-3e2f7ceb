import { useCallback, useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Aviso de conexão: informa quando o dispositivo fica sem internet e quando
 * a conexão é recuperada. Nenhuma operação é simulada enquanto offline.
 *
 * `navigator.onLine` sozinho gera falsos "sem conexão" em alguns navegadores,
 * pré-visualizações embutidas e redes corporativas. Por isso o aviso só aparece
 * depois que uma requisição real ao próprio site falha; enquanto o site responde,
 * nenhum aviso é exibido.
 */
async function reachable(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`/manifest.webmanifest?ping=${Date.now()}`, { method: "HEAD", cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    return r.ok || r.status < 500;
  } catch {
    return false;
  }
}

export function ConnectivityNotice() {
  const [online, setOnline] = useState(true);
  const [recovered, setRecovered] = useState(false);
  const wasOffline = useRef(false);

  const check = useCallback(async () => {
    const ok = await reachable();
    if (ok) {
      setOnline(true);
      if (wasOffline.current) setRecovered(true);
      wasOffline.current = false;
    } else {
      wasOffline.current = true;
      setOnline(false);
      setRecovered(false);
    }
  }, []);

  useEffect(() => {
    if (!navigator.onLine) void check();
    const off = () => void check();
    const on = () => void check();
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, [check]);

  // Enquanto offline confirmado, testa novamente a cada 10 s.
  useEffect(() => {
    if (online) return;
    const i = setInterval(() => void check(), 10000);
    return () => clearInterval(i);
  }, [online, check]);

  useEffect(() => {
    if (!recovered) return;
    const t = setTimeout(() => setRecovered(false), 4000);
    return () => clearTimeout(t);
  }, [recovered]);

  if (online && !recovered) return null;
  return (
    <div
      role="status"
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-semibold ${
        online ? "bg-success text-background" : "bg-destructive text-destructive-foreground"
      }`}
      style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
    >
      <WifiOff className="size-4 shrink-0" />
      {online ? "Conexão restabelecida." : "Sem conexão com a internet. As ações serão retomadas quando a conexão voltar."}
    </div>
  );
}
