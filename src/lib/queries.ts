import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const pollsQuery = () =>
  queryOptions({
    queryKey: ["polls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("polls")
        .select("*")
        .not("status", "in", "(rascunho)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

export const pollQuery = (id: string) =>
  queryOptions({
    queryKey: ["poll", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("polls").select("*, poll_options(*)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const tallyQuery = (pollId: string) =>
  queryOptions({
    queryKey: ["tally", pollId],
    queryFn: async () => {
      const [t, p] = await Promise.all([
        supabase.from("poll_tallies").select("option_id, votes").eq("poll_id", pollId),
        supabase.from("poll_participation").select("voters").eq("poll_id", pollId).maybeSingle(),
      ]);
      return { tallies: t.data ?? [], voters: p.data?.voters ?? null };
    },
  });

export const myVotesQuery = (pollId: string, userId: string | undefined) =>
  queryOptions({
    queryKey: ["myvotes", pollId, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("votes").select("option_id").eq("poll_id", pollId);
      return data ?? [];
    },
  });

export const formsQuery = () =>
  queryOptions({
    queryKey: ["forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registration_forms")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

export const formQuery = (id: string) =>
  queryOptions({
    queryKey: ["form", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("registration_forms").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const announcementsQuery = (limit = 20) =>
  queryOptions({
    queryKey: ["announcements", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });

export const eventsQuery = () =>
  queryOptions({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("published", true)
        .order("starts_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
