export default function LocaleLoading() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-40 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
        <div className="h-32 w-full rounded-2xl bg-muted" />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Loading… / جاري التحميل…
      </p>
    </main>
  );
}
