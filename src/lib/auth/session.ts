import { createClient } from "@/lib/supabase/server";
import {
  resolveRoleFromClaims,
  type AppRole,
} from "@/lib/auth/roles";
import type { Profile } from "@/types/database";

export type SessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  role: AppRole;
  profile: Profile | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const profile = (data ?? null) as Profile | null;

  const role =
    profile?.role ??
    resolveRoleFromClaims(user.app_metadata) ??
    "customer";

  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    role,
    profile,
  };
}

export async function requireRole(allowed: AppRole[]): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session || !allowed.includes(session.role)) {
    throw new Error("Unauthorized");
  }
  return session;
}
