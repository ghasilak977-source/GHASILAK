import { z } from "zod";

export const APP_ROLES = [
  "customer",
  "driver",
  "admin",
  "manager",
  "finance",
] as const;

export const appRoleSchema = z.enum(APP_ROLES);
export type AppRole = z.infer<typeof appRoleSchema>;

export const STAFF_ROLES: AppRole[] = ["admin", "manager", "finance"];

export function isStaffRole(role: AppRole | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

export function isAdminRole(role: AppRole | null | undefined): boolean {
  return role === "admin";
}

export function isFinanceRole(role: AppRole | null | undefined): boolean {
  return role === "finance" || role === "admin" || role === "manager";
}

/**
 * Role resolution order:
 * 1) profiles.role (source of truth in DB)
 * 2) JWT app_metadata.role (safe claim; never user_metadata)
 */
export function resolveRoleFromClaims(appMetadata: unknown): AppRole | null {
  if (!appMetadata || typeof appMetadata !== "object") return null;
  const role = (appMetadata as { role?: unknown }).role;
  const parsed = appRoleSchema.safeParse(role);
  return parsed.success ? parsed.data : null;
}

export const signInEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const signUpCustomerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  phone: z.string().min(8).optional(),
  preferred_language: z.enum(["ar", "en"]).default("ar"),
});

export const phoneOtpSchema = z.object({
  phone: z.string().min(8),
});
