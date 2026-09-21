/**
 * Role-based visibility for order finance fields (go-live contract).
 * Customers see price only; drivers never see laundry/profit; admin sees all.
 */
export type FinanceVisibilityRole = "customer" | "driver" | "staff";

export type OrderFinanceSnapshot = {
  totalOmr: string;
  laundryCostOmr: string;
  driverCommissionOmr: string;
  packagingOmr: string;
  contributionOmr: string;
  marginPercentage?: string;
};

export function projectFinanceForRole(
  role: FinanceVisibilityRole,
  snap: OrderFinanceSnapshot,
): Partial<OrderFinanceSnapshot> {
  if (role === "customer") {
    return { totalOmr: snap.totalOmr };
  }
  if (role === "driver") {
    return {
      totalOmr: snap.totalOmr,
      driverCommissionOmr: snap.driverCommissionOmr,
    };
  }
  return { ...snap };
}

/** Canonical 10-piece Muscat example used across QA. */
export const TEN_PIECE_EXAMPLE: OrderFinanceSnapshot = {
  totalOmr: "4.000",
  laundryCostOmr: "2.000",
  driverCommissionOmr: "0.600",
  packagingOmr: "0.100",
  contributionOmr: "1.300",
  marginPercentage: "32.500",
};
