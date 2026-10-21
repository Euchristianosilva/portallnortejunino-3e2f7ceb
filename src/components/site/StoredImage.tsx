import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { supabase } from "@/integrations/supabase/client";

export function StoredImage({ src, ...props }: ComponentProps<"img">) {
  const path = typeof src === "string" && src.startsWith("storage:") ? src.slice(8) : null;
  const image = useQuery({ queryKey: ["stored-image", path], enabled: Boolean(path), staleTime: 40 * 60 * 1000, refetchInterval: 40 * 60 * 1000, queryFn: async () => {
    if (!path) return null;
    const { data, error } = await supabase.storage.from("portal-images").createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }});
  if (path && !image.data) return <div role="img" aria-label={image.error ? "Imagem indisponível" : "Carregando imagem"} className={`${props.className ?? ""} bg-muted`} />;
  return <img {...props} src={path ? image.data ?? undefined : src} />;
}