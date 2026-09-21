"use client";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-border px-3 py-1.5 text-sm print:hidden"
    >
      {label}
    </button>
  );
}
