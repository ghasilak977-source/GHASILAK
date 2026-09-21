/**
 * Laundry partner auto-suggestion by area code.
 * Admin may override; store final partner_id on the order.
 */

export const ANSAB_AREA_CODES = [
  "al_ansab",
  "ghala",
  "bausher",
  "al_khuwair",
  "al_ghubrah",
  "azaiba",
] as const;

export const AMERAT_AREA_CODES = ["al_amerat"] as const;

export type PartnerCode = "ANSAB" | "AMERAT";

export function suggestPartnerCodeForArea(
  areaCode: string | null | undefined,
): PartnerCode | null {
  if (!areaCode) return null;
  const code = areaCode.toLowerCase();
  if ((ANSAB_AREA_CODES as readonly string[]).includes(code)) return "ANSAB";
  if ((AMERAT_AREA_CODES as readonly string[]).includes(code)) return "AMERAT";
  return null;
}

export function resolvePartnerAssignment(params: {
  areaCode: string | null | undefined;
  /** Admin override partner code */
  overridePartnerCode?: PartnerCode | null;
}): {
  partnerCode: PartnerCode | null;
  wasOverride: boolean;
  suggestedCode: PartnerCode | null;
} {
  const suggestedCode = suggestPartnerCodeForArea(params.areaCode);
  if (params.overridePartnerCode) {
    return {
      partnerCode: params.overridePartnerCode,
      wasOverride: params.overridePartnerCode !== suggestedCode,
      suggestedCode,
    };
  }
  return {
    partnerCode: suggestedCode,
    wasOverride: false,
    suggestedCode,
  };
}
