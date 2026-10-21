import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Permission = "registrations" | "polls" | "announcements" | "forms";
type Role = "master" | "coordenacao" | "operador" | "user";

interface AuthState {
  user: User | null;
  loading: boolean;
  roles: Role[];
  permissions: Permission[];
  isMaster: boolean;
  isStaff: boolean;
  can: (p: Permission) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const loadAccess = useCallback(async (u: User | null) => {
    if (!u) {
      setRoles([]);
      setPermissions([]);
      return;
    }
    const [r, p] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", u.id),
      supabase.from("user_permissions").select("permission").eq("user_id", u.id),
    ]);
    setRoles((r.data ?? []).map((x) => x.role as Role));
    setPermissions((p.data ?? []).map((x) => x.permission as Permission));
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    setUser(data.user ?? null);
    await loadAccess(data.user ?? null);
  }, [loadAccess]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      const u = session?.user ?? null;
      setUser(u);
      setTimeout(() => {
        loadAccess(u).finally(() => setLoading(false));
      }, 0);
    });
    refresh().finally(() => setLoading(false));
    return () => sub.subscription.unsubscribe();
  }, [refresh, loadAccess]);

  const isMaster = roles.includes("master");
  const isStaff = isMaster || roles.includes("coordenacao") || roles.includes("operador");
  const can = (p: Permission) => isMaster || (isStaff && permissions.includes(p));

  return (
    <AuthContext.Provider value={{ user, loading, roles, permissions, isMaster, isStaff, can, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
