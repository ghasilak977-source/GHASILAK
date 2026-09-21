import { normalizeOmr, sumOmr } from "@/lib/finance/types";

export type SalesReportRow = {
  date: string;
  orders: number;
  pieces: number;
  revenueOmr: string;
  contributionOmr: string;
};

export type AreaPerfRow = {
  areaCode: string;
  areaName: string;
  orders: number;
  pieces: number;
  revenueOmr: string;
  contributionOmr: string;
  aovOmr: string;
  repeatCustomers: number;
};

export type LaundryPerfRow = {
  partnerId: string;
  partnerName: string;
  orders: number;
  pieces: number;
  costOmr: string;
  late: number;
  complaints: number;
  rewashes: number;
  avgTurnaroundHours: number | null;
};

export type DriverPerfRow = {
  driverId: string;
  driverName: string;
  assigned: number;
  completed: number;
  failedPickups: number;
  commissionOmr: string;
  cashHeldOmr: string;
  avgCompletionHours: number | null;
};

/** UTF-8 CSV with BOM for Arabic Excel compatibility. */
export function toCsvUtf8(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ];
  return `\uFEFF${lines.join("\n")}`;
}

export function buildAreaPerformance(
  orders: Array<{
    areaCode: string;
    areaName: string;
    customerId: string;
    pieces: number;
    revenueOmr: string;
    contributionOmr: string;
  }>,
): AreaPerfRow[] {
  const map = new Map<
    string,
    {
      areaName: string;
      orders: number;
      pieces: number;
      revenueOmr: string;
      contributionOmr: string;
      customers: Set<string>;
      customerOrderCounts: Map<string, number>;
    }
  >();

  for (const o of orders) {
    const key = o.areaCode || "unknown";
    if (!map.has(key)) {
      map.set(key, {
        areaName: o.areaName || key,
        orders: 0,
        pieces: 0,
        revenueOmr: "0.000",
        contributionOmr: "0.000",
        customers: new Set(),
        customerOrderCounts: new Map(),
      });
    }
    const g = map.get(key)!;
    g.orders += 1;
    g.pieces += o.pieces;
    g.revenueOmr = sumOmr([g.revenueOmr, o.revenueOmr]);
    g.contributionOmr = sumOmr([g.contributionOmr, o.contributionOmr]);
    g.customers.add(o.customerId);
    g.customerOrderCounts.set(
      o.customerId,
      (g.customerOrderCounts.get(o.customerId) || 0) + 1,
    );
  }

  return [...map.entries()].map(([areaCode, g]) => {
    const repeatCustomers = [...g.customerOrderCounts.values()].filter(
      (n) => n > 1,
    ).length;
    const aov =
      g.orders === 0
        ? "0.000"
        : normalizeOmr(
            // use sum/count via string path
            averageFromSum(g.revenueOmr, g.orders),
          );
    return {
      areaCode,
      areaName: g.areaName,
      orders: g.orders,
      pieces: g.pieces,
      revenueOmr: g.revenueOmr,
      contributionOmr: g.contributionOmr,
      aovOmr: aov,
      repeatCustomers,
    };
  });
}

function averageFromSum(totalOmr: string, count: number): string {
  if (count <= 0) return "0.000";
  const THOUSAND = BigInt(1000);
  const n = normalizeOmr(totalOmr);
  const [w, f = ""] = n.split(".");
  const scaled = BigInt(w) * THOUSAND + BigInt((f + "000").slice(0, 3));
  const avg = scaled / BigInt(count);
  return `${avg / THOUSAND}.${(avg % THOUSAND).toString().padStart(3, "0")}`;
}

export function buildLaundryPerformance(
  rows: Array<{
    partnerId: string;
    partnerName: string;
    pieces: number;
    costOmr: string;
    late: boolean;
    turnaroundHours: number | null;
  }>,
  complaintsByPartner: Record<string, number>,
  rewashByPartner: Record<string, number>,
): LaundryPerfRow[] {
  const map = new Map<
    string,
    {
      partnerName: string;
      orders: number;
      pieces: number;
      costOmr: string;
      late: number;
      turns: number[];
    }
  >();

  for (const r of rows) {
    if (!map.has(r.partnerId)) {
      map.set(r.partnerId, {
        partnerName: r.partnerName,
        orders: 0,
        pieces: 0,
        costOmr: "0.000",
        late: 0,
        turns: [],
      });
    }
    const g = map.get(r.partnerId)!;
    g.orders += 1;
    g.pieces += r.pieces;
    g.costOmr = sumOmr([g.costOmr, r.costOmr]);
    if (r.late) g.late += 1;
    if (r.turnaroundHours != null) g.turns.push(r.turnaroundHours);
  }

  return [...map.entries()].map(([partnerId, g]) => ({
    partnerId,
    partnerName: g.partnerName,
    orders: g.orders,
    pieces: g.pieces,
    costOmr: g.costOmr,
    late: g.late,
    complaints: complaintsByPartner[partnerId] || 0,
    rewashes: rewashByPartner[partnerId] || 0,
    avgTurnaroundHours:
      g.turns.length === 0
        ? null
        : Math.round(
            (g.turns.reduce((s, n) => s + n, 0) / g.turns.length) * 10,
          ) / 10,
  }));
}

export function buildDriverPerformance(
  rows: Array<{
    driverId: string;
    driverName: string;
    assigned: boolean;
    completed: boolean;
    failedPickup: boolean;
    commissionOmr: string;
    cashHeldOmr: string;
    completionHours: number | null;
  }>,
): DriverPerfRow[] {
  const map = new Map<
    string,
    {
      driverName: string;
      assigned: number;
      completed: number;
      failedPickups: number;
      commissionOmr: string;
      cashHeldOmr: string;
      times: number[];
    }
  >();

  for (const r of rows) {
    if (!map.has(r.driverId)) {
      map.set(r.driverId, {
        driverName: r.driverName,
        assigned: 0,
        completed: 0,
        failedPickups: 0,
        commissionOmr: "0.000",
        cashHeldOmr: normalizeOmr(r.cashHeldOmr),
        times: [],
      });
    }
    const g = map.get(r.driverId)!;
    if (r.assigned) g.assigned += 1;
    if (r.completed) g.completed += 1;
    if (r.failedPickup) g.failedPickups += 1;
    g.commissionOmr = sumOmr([g.commissionOmr, r.commissionOmr]);
    g.cashHeldOmr = normalizeOmr(r.cashHeldOmr);
    if (r.completionHours != null) g.times.push(r.completionHours);
  }

  return [...map.entries()].map(([driverId, g]) => ({
    driverId,
    driverName: g.driverName,
    assigned: g.assigned,
    completed: g.completed,
    failedPickups: g.failedPickups,
    commissionOmr: g.commissionOmr,
    cashHeldOmr: g.cashHeldOmr,
    avgCompletionHours:
      g.times.length === 0
        ? null
        : Math.round(
            (g.times.reduce((s, n) => s + n, 0) / g.times.length) * 10,
          ) / 10,
  }));
}
