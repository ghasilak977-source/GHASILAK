import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { isStaffRole, type AppRole } from "@/lib/auth/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export type AdminContext = {
  profileId: string;
  role: AppRole;
  fullName: string;
  email: string | null;
  session: SessionUser;
};

export async function gateAdmin(
  locale: Locale,
  opts?: { financeOnly?: boolean },
): Promise<{ admin: AdminContext | null; configured: boolean }> {
  if (!hasSupabaseEnv()) {
    return { admin: null, configured: false };
  }

  const session = await getSessionUser();
  if (!session) {
    redirect(`/${locale}/admin/login`);
  }
  if (!isStaffRole(session.role)) {
    redirect(`/${locale}/admin/login?error=unauthorized`);
  }
  if (opts?.financeOnly && !["admin", "manager", "finance"].includes(session.role)) {
    redirect(`/${locale}/admin/login?error=unauthorized`);
  }

  return {
    configured: true,
    admin: {
      profileId: session.id,
      role: session.role,
      fullName: session.profile?.full_name || "",
      email: session.email,
      session,
    },
  };
}

export function canWriteSettings(role: AppRole): boolean {
  return role === "admin" || role === "manager";
}

export function canManageUsers(role: AppRole): boolean {
  return role === "admin";
}

export function canWriteFinance(role: AppRole): boolean {
  return role === "admin" || role === "manager" || role === "finance";
}
