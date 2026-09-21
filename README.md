# GHASILAK / غسيلك

**دليل رفع المشروع على GitHub وتشغيله:** [GITHUB-SETUP-AR.md](GITHUB-SETUP-AR.md)

Production laundry pickup & delivery platform for Muscat, Oman.

Phases 1–8 on this branch: foundation through **go-live production connection** (real Supabase/Vercel — no fake keys in git).

## Go live in plain English (beginner)

You do these account steps yourself (we cannot log into your Supabase/Vercel):

1. **Create a free Supabase project** at [supabase.com](https://supabase.com) → New project.
2. **Copy 3 values** from Project Settings → API into `.env.local` (see `.env.example`):
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (Reveal) → `SUPABASE_SERVICE_ROLE_KEY` (**secret**)
3. **Apply database:** Supabase CLI `supabase link` + `supabase db push`, **or** run each file in `supabase/migrations/` in order in the SQL Editor, then paste `supabase/seed.sql`.
4. **Create first admin:** Dashboard → Authentication → Users → Add user → copy UUID → open `supabase/scripts/create-first-admin.sql`, paste UUID, run in SQL Editor.
5. **Deploy on Vercel:** Import this Git repo → paste the same env vars → Deploy. Then set Auth redirect URLs to your Vercel URL.
6. **Test:** open the site → customer order 10 pieces = **4.000 OMR** → admin assigns laundry + driver → finish delivery → finance shows 2.000 / 0.600 / 0.100 / 1.300.

Full beginner checklist: ask the team for `docs/go-live-checklist.md` (sections A–F).

**Never put real keys or passwords in Git.** Only `.env.example` placeholders belong in the repo.

## Architecture

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Customer PWA│   │  Driver PWA │   │Admin / Finance│
│  /ar /en    │   │  /driver    │   │   /admin      │
└──────┬──────┘   └──────┬──────┘   └──────┬───────┘
       │                 │                 │
       └────────────┬────┴────────────────┘
                    │ Next.js App Router (server actions + RLS)
                    ▼
              Supabase (Postgres + Auth + Storage)
```

- **Money:** OMR `NUMERIC(12,3)` + string/bigint helpers — no JS float persistence
- **Auth roles:** `customer` | `driver` | `admin` | `manager` | `finance` in `profiles.role` + JWT `app_metadata.role`
- **Place order:** server action recalculates prices from catalog; service role writes; financial columns frozen for non-staff
- **Locales:** `/ar` (RTL default) and `/en`

```
src/
  app/[locale]/          # Customer, driver, admin routes
  app/api/               # Health, pickup slots, finance CSV
  components/            # UI + brand + shells
  lib/auth|orders|finance|driver|admin|money|…
supabase/migrations/     # Schema, RLS, finance, production security
supabase/seed.sql        # Catalog + settings (no passwords)
public/icons/            # PWA 192/512 icons
```

## Environment variables

Copy `.env.example` → `.env.local`:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser + server (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (prod) | **Server only** — place-order + admin scripts. Never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_APP_URL` | Yes | e.g. `http://127.0.0.1:43123` or production domain |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | No | Default `ar` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | No | Public WhatsApp, e.g. `+9689xxxxxxx` (overrides seed default) |
| `DATABASE_URL` | Optional | Hosted `psql` seed / migrations |

## Supabase setup

### Hosted

1. Create a project at [supabase.com](https://supabase.com)
2. Copy URL, anon key, service_role key → `.env.local`
3. Apply migrations:

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref YOUR_PROJECT_REF
pnpm exec supabase db push
```

4. Seed catalog (partners, zones, services, settings):

```bash
# SQL editor: paste supabase/seed.sql
# or
psql "$DATABASE_URL" -f supabase/seed.sql
```

### Local

```bash
pnpm install
pnpm exec supabase start
pnpm db:reset          # migrations + seed.sql
# copy keys from `supabase start` into .env.local
pnpm db:types          # after schema changes
```

## Migration commands

```bash
pnpm exec supabase migration list
pnpm exec supabase db push          # hosted
pnpm db:reset                       # local: wipe + migrate + seed
```

Latest security migration: `20260920160000_production_security.sql` (financial freeze, staff-only order insert, driver contact view).

## Seed commands

`supabase/seed.sql` loads Ansab + Amerat partners, Muscat zones, services (0.400 / 0.200), business settings, sample slots.

**No auth users or passwords are seeded** (security). Create demo accounts via the steps below.

## Create first admin

Use the safe SQL helper (no passwords in the file):

1. Supabase → Authentication → Users → **Add user** (email + your own strong password).
2. Copy the user UUID.
3. Open `supabase/scripts/create-first-admin.sql`, replace `PASTE_USER_UUID_HERE`, run in **SQL Editor**.
4. Sign in at `/ar/admin/login`.

Driver helper: `supabase/scripts/create-driver.sql` (same pattern).

## Run locally (dev)

```bash
pnpm install
cp .env.example .env.local   # fill keys
pnpm dev                     # http://127.0.0.1:43123
```

Quality gates:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Production

- Set all env vars in the host (Vercel Project Settings)
- `NEXT_PUBLIC_APP_URL` = your public HTTPS domain
- Run migrations + seed against the production Supabase project **once**
- Create staff/driver accounts; rotate any bootstrap passwords
- Confirm RLS + service role key are set; anon key alone cannot place forged orders

## Deploy (Vercel)

1. Import the Git repo into Vercel
2. Framework: Next.js · Build: `pnpm build` · Install: `pnpm install`
3. Add env vars (including `SUPABASE_SERVICE_ROLE_KEY`)
4. Deploy production; map custom domain (DNS → Vercel)
5. In Supabase Auth → URL config: add production site URL + redirect allow list

## Domain

Point `ghasilak.om` (or chosen domain) A/CNAME to Vercel. Update `NEXT_PUBLIC_APP_URL`, Auth redirect URLs, and WhatsApp deep links.

## PWA

- Manifest: `/manifest.webmanifest` (standalone, theme `#144078`, icons 192/512)
- Service worker: `/sw.js` + offline page `/offline.html`
- Install from browser “Add to Home Screen” on Android / iOS Safari Share → Add
- Icons live under `/public/icons/`

## WhatsApp

Support number comes from `business_settings.support_whatsapp` (seeded). Deep links built in `src/lib/whatsapp/link.ts`. Update the number in Admin → Settings after go-live.

## Backup

- Enable Supabase daily backups (Pro) or schedule `pg_dump` of production
- Keep migration history in Git as source of truth
- Do not rely on Storage until bucket RLS is configured

## Security checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` never in `NEXT_PUBLIC_*` or client bundles
- [ ] Roles only in `app_metadata` / `profiles.role` (not `user_metadata`)
- [ ] Financial columns immutable for customers/drivers (DB trigger)
- [ ] Place-order only via server action + service role
- [ ] Customer UI selects exclude laundry cost / contribution / margin
- [ ] Drivers use `driver_order_cards` (no partner cost / margin)
- [ ] Admin/finance actions gated by role helpers
- [ ] Storage photo uploads disabled until path-scoped policies exist
- [ ] QR tokens opaque (no PII/finance in token)
- [ ] Strong unique passwords for all staff; MFA recommended for admin

## Production launch checklist

- [ ] Migrations applied on production Supabase
- [ ] Seed catalog + settings verified (0.400 / 0.200 / 15% / 0.100 packaging)
- [ ] First admin created; test login
- [ ] Demo walkthrough: customer 10 pcs → 4.000 OMR → assign Ansab + driver → pickup → qty confirm → deliver → cash → commission 0.600 / laundry 2.000 / contribution 1.300
- [ ] Arabic RTL spot-check on home, order, tracking, admin
- [ ] PWA install on one Android + one iPhone
- [ ] Finance CSV download works for staff
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green
- [ ] Monitoring / error alerts (Vercel + Supabase) enabled
- [ ] WhatsApp number live; privacy/terms pages linked

## Demo / testing procedure

1. Create customer (email signup), driver, admin as above — store passwords in a password manager, not Git.
2. Customer: add Muscat address → order 10 mixed pieces → confirm **4.000 OMR** → cash or bank transfer.
3. Admin: see order → assign Ansab partner + pickup/delivery driver.
4. Driver: on the way → arrived → pickup (QR) → at laundry.
5. Admin: confirm piece count if needed.
6. Driver: delivery → collect cash → record cash → customer confirmation code → delivered.
7. Finance: laundry payable **2.000**, commission **0.600**, packaging **0.100**, contribution **1.300**; generate weekly settlements; confirm owner withdrawal is capital not expense.

Without `.env.local`, UI shows “connect Supabase” empty states; unit tests still cover money math offline.

## Feature surfaces (MVP)

| Surface | Paths |
| --- | --- |
| Customer | `/order`, `/orders`, `/pricing`, `/profile`, PWA |
| Driver | `/driver/jobs`, `/cash`, `/commission`, `/routes` |
| Admin | `/admin` … orders, customers, drivers, partners, finance, settings, audit |
| Finance | `/admin/finance/*` + CSV API |

## Known limitations

See `docs/production-readiness.md` in the project agent store (or ask the team for the Phase 7 summary): photo Storage RLS not shipped; live E2E needs Supabase env; QR public resolve for anon scanners is intentional no-op without auth.
