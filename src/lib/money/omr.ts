import { z } from "zod";

/** OMR always uses exactly 3 decimal places. Persist as strings / NUMERIC — never JS floats. */
export const OMR_DECIMALS = 3;
export const OMR_CURRENCY_CODE = "OMR" as const;
export const OMR_ARABIC_SYMBOL = "ر.ع";

const ZERO = BigInt(0);
const THOUSAND = BigInt(1000);
const HUNDRED_THOUSAND = BigInt(100000);

const omrStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,3})?$/, "Invalid OMR amount");

function toScaledBigInt(value: string): bigint {
  const parsed = omrStringSchema.parse(value.trim());
  const negative = parsed.startsWith("-");
  const raw = negative ? parsed.slice(1) : parsed;
  const [whole, frac = ""] = raw.split(".");
  const padded = (frac + "000").slice(0, OMR_DECIMALS);
  const scaled = BigInt(whole) * THOUSAND + BigInt(padded);
  return negative ? -scaled : scaled;
}

function fromScaledBigInt(scaled: bigint): string {
  const negative = scaled < ZERO;
  const abs = negative ? -scaled : scaled;
  const whole = abs / THOUSAND;
  const frac = (abs % THOUSAND).toString().padStart(OMR_DECIMALS, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${frac}`;
}

export function normalizeOmr(value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Invalid OMR number");
    }
    return normalizeOmr(value.toFixed(OMR_DECIMALS));
  }
  return fromScaledBigInt(toScaledBigInt(value));
}

export function addOmr(a: string, b: string): string {
  return fromScaledBigInt(toScaledBigInt(a) + toScaledBigInt(b));
}

export function subOmr(a: string, b: string): string {
  return fromScaledBigInt(toScaledBigInt(a) - toScaledBigInt(b));
}

export function mulOmrByInt(amount: string, qty: number): string {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error("Quantity must be a non-negative integer");
  }
  return fromScaledBigInt(toScaledBigInt(amount) * BigInt(qty));
}

/** percent e.g. "15" or "15.000" → portion of base */
export function percentOfOmr(base: string, percent: string): string {
  const baseScaled = toScaledBigInt(base);
  const percentScaled = toScaledBigInt(percent);
  const result = (baseScaled * percentScaled) / HUNDRED_THOUSAND;
  return fromScaledBigInt(result);
}

/**
 * (numerator / denominator) * 100 with 3 decimal places.
 * Used for margin_percentage. Returns "0.000" if denominator is 0.
 */
export function percentRatio(numerator: string, denominator: string): string {
  const den = toScaledBigInt(denominator);
  if (den === ZERO) return "0.000";
  const num = toScaledBigInt(numerator);
  // (num/den)*100 with 3dp → (num * 100 * 1000) / den in scaled form
  const result = (num * HUNDRED_THOUSAND) / den;
  return fromScaledBigInt(result);
}

export function compareOmr(a: string, b: string): number {
  const left = toScaledBigInt(normalizeOmr(a));
  const right = toScaledBigInt(normalizeOmr(b));
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

export function minOmr(a: string, b: string): string {
  return compareOmr(a, b) <= 0 ? normalizeOmr(a) : normalizeOmr(b);
}

export function maxOmr(a: string, b: string): string {
  return compareOmr(a, b) >= 0 ? normalizeOmr(a) : normalizeOmr(b);
}

export function formatOmr(
  amount: string,
  locale: "ar" | "en" = "en",
): string {
  const normalized = normalizeOmr(amount);
  if (locale === "ar") {
    return `${normalized} ${OMR_ARABIC_SYMBOL}`;
  }
  return `${normalized} ${OMR_CURRENCY_CODE}`;
}

export const moneySchema = z.string().transform((v) => normalizeOmr(v));
