"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="font-display text-2xl font-bold text-primary">غسيلك</p>
      <h1 className="font-display text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground" dir="rtl">
        حدث خطأ. حاول مرة أخرى أو تواصل عبر واتساب.
      </p>
      <Button type="button" onClick={reset}>
        Try again / إعادة المحاولة
      </Button>
    </main>
  );
}
