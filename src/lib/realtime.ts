import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RtStatus = "connecting" | "live" | "offline";

interface Sub {
  table: string;
  filter?: string;
  /** query keys to invalidate when this table changes */
  keys: unknown[][];
}

/**
 * Subscribes to Postgres changes and invalidates the given queries.
 * On (re)connection it also re-syncs, so events missed while offline are recovered.
 */
export function useLiveQueries(name: string, subs: Sub[], enabled = true): RtStatus {
  const qc = useQueryClient();
  const [status, setStatus] = useState<RtStatus>("connecting");
  const subsRef = useRef(subs);
  subsRef.current = subs;
  const sig = JSON.stringify(subs.map((s) => [s.table, s.filter]));

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pending = new Set<string>();
    const flush = () => {
      timer = null;
      pending.forEach((k) => qc.invalidateQueries({ queryKey: JSON.parse(k) }));
      pending.clear();
    };
    const queue = (keys: unknown[][]) => {
      keys.forEach((k) => pending.add(JSON.stringify(k)));
      if (!timer) timer = setTimeout(flush, 150);
    };

    const channel = supabase.channel(`${name}-${Math.random().toString(36).slice(2, 8)}`);
    subsRef.current.forEach((s) => {
      channel.on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: s.table, ...(s.filter ? { filter: s.filter } : {}) },
        () => queue(s.keys),
      );
    });
    let wasOffline = false;
    channel.subscribe((st) => {
      if (st === "SUBSCRIBED") {
        setStatus("live");
        queue(subsRef.current.flatMap((s) => s.keys));
        wasOffline = false;
      } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") {
        setStatus("offline");
        wasOffline = true;
      }
    });
    const onOnline = () => queue(subsRef.current.flatMap((s) => s.keys));
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [name, sig, enabled, qc]);

  return status;
}
