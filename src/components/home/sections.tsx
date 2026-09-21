import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { AnchorButton, LinkButton } from "@/components/ui/link-button";
import type { Dictionary } from "@/messages/en";
import type { Locale } from "@/lib/i18n/config";
import { formatOmr } from "@/lib/money/omr";
import type { BusinessSettings } from "@/lib/settings/business-settings";
import type { CatalogZone } from "@/lib/catalog/queries";
import { buildWhatsAppUrl } from "@/lib/whatsapp/link";

export function HomeHero({
  locale,
  dict,
  settings,
}: {
  locale: Locale;
  dict: Dictionary;
  settings: BusinessSettings;
}) {
  const wa = buildWhatsAppUrl(
    settings.support_whatsapp,
    dict.whatsapp.supportGeneric,
  );

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(37,99,168,0.14),_transparent_55%),linear-gradient(180deg,#f7fbff_0%,#eef5fb_50%,#ffffff_100%)]" />
      <div className="pointer-events-none absolute -start-20 top-16 h-64 w-64 rounded-full bg-[rgba(91,168,220,0.2)] blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-12 pt-8 md:grid-cols-[1.15fr_0.85fr] md:gap-12 md:pb-16 md:pt-12">
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <p className="inline-flex rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-primary">
            {dict.common.muscat} · عمان
          </p>
          <h1 className="font-display max-w-xl text-4xl font-bold tracking-tight text-primary sm:text-5xl">
            {dict.home.heroTitle}
          </h1>
          <p className="max-w-lg text-base text-foreground/80 sm:text-lg">
            {dict.home.heroSub}
          </p>
          <p className="rounded-lg border border-[rgba(37,99,168,0.15)] bg-white/80 px-3 py-2 text-sm font-medium text-primary shadow-sm">
            {dict.home.heroHighlight}
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href={`/${locale}/order`} size="lg">
              {dict.home.ctaOrder}
            </LinkButton>
            <AnchorButton
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
              variant="outline"
            >
              {dict.home.ctaWhatsapp}
            </AnchorButton>
          </div>
        </div>
        <div className="relative animate-in fade-in zoom-in-95 duration-700 delay-100">
          <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/75 p-6 shadow-[0_24px_60px_rgba(20,64,120,0.12)] backdrop-blur">
            <BrandMark className="mx-auto h-36 w-auto sm:h-44" />
            <dl className="mt-5 space-y-2 border-t border-border/70 pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{dict.pricingPage.perPiece}</dt>
                <dd className="font-semibold tabular-nums text-primary">
                  {formatOmr(settings.default_customer_price_omr, locale)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{dict.pricingPage.minOrder}</dt>
                <dd className="font-semibold tabular-nums">
                  {formatOmr(settings.min_order_omr, locale)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection({ dict }: { dict: Dictionary }) {
  const steps = [
    { title: dict.home.how1, body: dict.home.how1Desc },
    { title: dict.home.how2, body: dict.home.how2Desc },
    { title: dict.home.how3, body: dict.home.how3Desc },
    { title: dict.home.how4, body: dict.home.how4Desc },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="font-display mb-6 text-2xl font-semibold text-primary">
        {dict.home.howTitle}
      </h2>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm"
          >
            <span className="mb-3 inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <h3 className="font-display text-base font-semibold">{step.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function PricingHighlight({
  locale,
  dict,
  settings,
}: {
  locale: Locale;
  dict: Dictionary;
  settings: BusinessSettings;
}) {
  return (
    <section className="border-y border-border/60 bg-[linear-gradient(135deg,#144078_0%,#2563a8_55%,#5ba8dc_100%)] text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">
            {dict.home.pricingTitle}
          </h2>
          <p className="mt-1 text-white/90">
            {dict.home.pricingBody}{" "}
            <span className="font-semibold tabular-nums">
              {formatOmr(settings.default_customer_price_omr, locale)}
            </span>
          </p>
        </div>
        <LinkButton
          href={`/${locale}/pricing`}
          variant="secondary"
          className="bg-white text-primary hover:bg-white/90"
        >
          {dict.home.pricingCta}
        </LinkButton>
      </div>
    </section>
  );
}

export function AreasSection({
  locale,
  dict,
  zones,
}: {
  locale: Locale;
  dict: Dictionary;
  zones: CatalogZone[];
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold text-primary">
          {dict.home.areasTitle}
        </h2>
        <Link
          href={`/${locale}/areas`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {dict.common.viewAll}
        </Link>
      </div>
      <ul className="flex flex-wrap gap-2">
        {zones.map((zone) => (
          <li
            key={zone.id}
            className="rounded-md border border-border/70 bg-white px-3 py-1.5 text-sm"
          >
            {locale === "ar" ? zone.name_ar : zone.name_en}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WhySection({ dict }: { dict: Dictionary }) {
  const items = [
    { t: dict.home.why1, d: dict.home.why1Desc },
    { t: dict.home.why2, d: dict.home.why2Desc },
    { t: dict.home.why3, d: dict.home.why3Desc },
    { t: dict.home.why4, d: dict.home.why4Desc },
  ];
  return (
    <section className="bg-white/70 py-12">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="font-display mb-6 text-2xl font-semibold text-primary">
          {dict.home.whyTitle}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.t}
              className="rounded-2xl border border-border/60 bg-[linear-gradient(180deg,#ffffff,#f7fbff)] p-5"
            >
              <h3 className="font-display font-semibold text-primary">{item.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PromoSection({ dict }: { dict: Dictionary }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="rounded-2xl border border-[rgba(37,99,168,0.2)] bg-secondary/60 p-6">
        <h2 className="font-display text-xl font-semibold text-primary">
          {dict.home.promoTitle}
        </h2>
        <p className="mt-2 text-sm text-foreground/80">{dict.home.promoBody}</p>
      </div>
    </section>
  );
}

export function FaqTeaser({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-2xl font-semibold text-primary">
          {dict.home.faqTitle}
        </h2>
        <Link
          href={`/${locale}/faq`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {dict.common.viewAll}
        </Link>
      </div>
      <ul className="space-y-3">
        {dict.faqPage.items.slice(0, 3).map((item) => (
          <li
            key={item.q}
            className="rounded-xl border border-border/70 bg-white p-4"
          >
            <p className="font-medium">{item.q}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ContactTeaser({
  locale,
  dict,
  settings,
}: {
  locale: Locale;
  dict: Dictionary;
  settings: BusinessSettings;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="font-display mb-3 text-2xl font-semibold text-primary">
        {dict.home.contactTitle}
      </h2>
      <p className="text-sm text-muted-foreground">{dict.contactPage.body}</p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <a
          className="rounded-md border border-border bg-white px-3 py-2 hover:border-primary"
          href={`tel:${settings.support_phone}`}
        >
          {settings.support_phone}
        </a>
        <a
          className="rounded-md border border-border bg-white px-3 py-2 hover:border-primary"
          href={`mailto:${settings.support_email}`}
        >
          {settings.support_email}
        </a>
        <Link
          href={`/${locale}/contact`}
          className="rounded-md bg-primary px-3 py-2 text-primary-foreground"
        >
          {dict.footer.contact}
        </Link>
      </div>
    </section>
  );
}
