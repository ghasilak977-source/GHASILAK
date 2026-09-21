import Link from "next/link";

export default function LocaleNotFound() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="font-display text-2xl font-bold text-primary">غسيلك</p>
      <h1 className="font-display text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground" dir="rtl">
        الصفحة غير موجودة
      </p>
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        <Link className="text-primary underline" href="/ar">
          الرئيسية
        </Link>
        <Link className="text-primary underline" href="/en">
          Home
        </Link>
        <Link className="text-primary underline" href="/ar/order">
          اطلب الآن
        </Link>
      </div>
    </main>
  );
}
