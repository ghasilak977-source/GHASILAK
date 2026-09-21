import { createHash, randomBytes } from "crypto";

/**
 * Opaque QR token — encodes no phone, address, or financial data.
 * Prefer DB `generate_order_qr_token()` when inserting; this is for app-side use.
 */
export function generateQrToken(): string {
  return randomBytes(24).toString("hex");
}

/** Public path that only exposes the opaque token. */
export function buildOrderQrPayload(token: string): string {
  return `ghasilak:order:${token}`;
}

export function buildOrderQrPath(locale: string, token: string): string {
  return `/${locale}/qr/${token}`;
}

export function hashQrToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidQrTokenFormat(token: string): boolean {
  return /^[a-f0-9]{48}$/i.test(token);
}
