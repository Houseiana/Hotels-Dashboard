# Houseiana Hotels — Owner / Admin Dashboard

The dashboard where hotel owners create and manage hotels for the Houseiana
platform. Its output is **schema-identical** to what the guest-facing app
consumes: both sides share the Zod schemas in [`src/lib/schemas/hotel.ts`](src/lib/schemas/hotel.ts),
and the TypeScript types are inferred from them with `z.infer` — never
hand-written.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript (strict) |
| Styling | Tailwind CSS v4 (CSS-first `@theme`), light/dark aware |
| Data | TanStack Query — typed hook layer, `USE_MOCK` flag |
| Auth | Clerk — the whole dashboard is gated |
| Validation | Zod — single source of truth, every step + form validated |
| i18n | next-intl — full English + Arabic, `dir="rtl"` |

## Getting started

```bash
npm install
cp .env.local.example .env.local     # optional — see below
npm run dev                          # http://localhost:3000/en
```

Both languages are always available: `/en/...` and `/ar/...`, plus a language
switcher in the top bar.

### Environment

Everything runs with **zero configuration**. `.env.local` only unlocks the real
integrations:

| Variable | Default | Effect |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | _empty_ | Empty → **dev-bypass mode**: the dashboard renders with a clearly-labelled mock owner session and no sign-in wall. Set it (with `CLERK_SECRET_KEY`) to gate every route behind real owner/admin sign-in. |
| `CLERK_SECRET_KEY` | _empty_ | Server half of the above. |
| `NEXT_PUBLIC_USE_MOCK` | `true` | `true` → in-memory mock backend. `false` → REST calls to `NEXT_PUBLIC_API_BASE_URL`. |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000/api` | Real backend base URL. |

Dev-bypass exists so the project is reviewable without a Clerk tenant. It is a
build-time decision (`src/lib/auth.ts`): with keys present, `src/proxy.ts` runs
`auth.protect()` on every non-auth route.

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (includes the React Compiler purity/effect rules)
```

## Design references

The wizard and the availability calendar are ports of two approved artifacts —
palette, radii, shadows, stepper, cards, chips, room-type accordion, rate-plan
table, review layout, sticky footer and calendar cell states are taken from them
verbatim:

- Wizard — <https://claude.ai/code/artifact/7f7eb6c8-5807-4940-ba52-3884d19e162c>
- Availability calendar — <https://claude.ai/code/artifact/26ed3244-352f-4024-8d6e-37d00797f3ac>

## The shared data model

`src/lib/schemas/hotel.ts` is the contract. Nothing else in the app defines the
hotel shape:

```
Hotel
├── status: 'draft' | 'active'
├── name / nameAr, description / descriptionAr
├── city, country, address, latitude, longitude
├── starRating, currency, coverPhoto, photos[]
├── amenities[]                        ← catalogue IDs, labels live in i18n
├── roomTypes[]  → HotelRoomType
│                  ├── capacity, beds, bedConfig, bathrooms, sizeM2, inventory
│                  ├── amenities[], photos[]
│                  └── ratePlans[] → HotelRatePlan (boardBasis, pricePerNight,
│                                    priceWithoutDiscount, discountPercent,
│                                    refundable, breakfastIncluded)
├── policies?    → HotelPolicies
├── nearby?      → HotelNearbyPlace[]  ← AUTO-DERIVED from the map pin
└── read-only guest data: rating, reviewCount, ratingBreakdown, reviews[]
```

Three rules the code enforces rather than documents:

1. **Guest-authored fields are never writable.** `rating`, `reviewCount`,
   `ratingBreakdown` and `reviews` are displayed on the Reviews screen and
   preserved on save (`saveHotel` in `src/lib/mock/db.ts` restores them from the
   stored record, ignoring whatever the payload claims). The single exception is
   `ownerReply`.
2. **`nearby[]` is derived, not entered.** The Location step runs a places
   lookup around the pin and writes the result; there is no input for it. Swap
   `hotelsApi.nearby` for a real Places provider and nothing else changes.
3. **Seasonal pricing lives in one place.** `priceWithoutDiscount` and
   `discountPercent` are edited on *Pricing & availability*, never in the
   wizard — the wizard sets base rates only, and says so in the rate-plan
   footer.

### Draft vs. publishable

A half-filled hotel must be storable; a published one must satisfy the guest
app. Two schemas, one shape:

- `hotelDraftSchema` (`src/lib/schemas/draft.ts`) — lenient mirror. Numbers may
  be `undefined` while the owner is typing. Field names match the model
  **exactly**, so publishing is a projection, not a mapping.
- `hotelSchema` — the real contract. Step 6 and the Hotels-list *Publish*
  action both run it, so a hotel can only go `active` if the guest app would
  accept it.

`draftToHotel()` also derives what must never be typed twice:

- `roomType.pricePerNight` ← the cheapest rate plan
- `roomType.refundable` / `breakfastIncluded` ← mirrored from the rate plans
- `ratePlan.breakfastIncluded` ← implied by `boardBasis`
- `ratePlan.refundable` ← implied by the cancellation preset
- `roomType.beds` ← total of the bed-configuration rows
- `coverPhoto` ← `photos[0]`

### Validation messages are i18n keys

Zod messages are keys, not prose:

```ts
name: z.string().min(1, 'hotelNameRequired')
```

`useCatalogLabels().validation(key)` resolves them against the `validation`
namespace, so every error is bilingual by construction and an unknown key
degrades to a generic message instead of crashing.

## Screens

| Route | What it does |
| --- | --- |
| `/[locale]` | Overview — KPI tiles (active hotels, upcoming check-ins, occupancy, revenue with period deltas), recent bookings, "needs attention" alerts |
| `/[locale]/hotels` | Hotels list — grid **and** table view, status chip, stars, city, room-type count, quick actions (edit, publish, view as guest, pricing, delete) |
| `/[locale]/hotels/new` | 6-step wizard (own full-screen layout, like the reference) |
| `/[locale]/hotels/[id]/edit` | Same wizard, hydrated. `?step=rooms` deep-links a step |
| `/[locale]/pricing` | Per-room-type calendar: nightly price, availability, seasonal discounts, manual blocks, stop-sell, bulk range editor |
| `/[locale]/bookings` | Reservations table, filters (search / status / hotel / date range), detail drawer, confirm & cancel |
| `/[locale]/reviews` | Read-only guest reviews + category `ratingBreakdown`, owner reply |
| `/[locale]/settings` | Account, currency, payout, default policies |

### The wizard

1. **Basics** — name + nameAr, description + descriptionAr, star rating,
   **currency**, check-in/out, and a **Policies** card (cancellation, children
   policy, payment note, pets, smoking).
2. **Location** — address fields, country → city → area, clickable map pin
   (writes `latitude`/`longitude`), and auto-derived `nearby[]` grouped by
   attraction / restaurant / transit.
3. **Amenities** — multi-select chips, grouped, with select-all per group.
4. **Photos** — gallery, first photo is the cover, real file upload,
   drag-to-reorder plus keyboard-accessible move buttons, make-cover, remove.
5. **Rooms** — accordion per room type: name + nameAr, category, view, size,
   capacity, **bathrooms**, inventory, descriptions, bed-config rows (type +
   qty, add/remove), in-room amenities, and the rate-plan table
   (board basis + cancellation + base price).
6. **Review & publish** — per-step summary with live Zod issue counts, guest
   preview card, publish (blocked, with reasons, until the shared schema passes).

Changing country resets city, pin, `nearby[]` and the currency default together,
so an Egyptian address can never keep a Doha pin.

**Currency** starts at `DEFAULT_CURRENCY` (`EGP`, in `src/lib/catalogs.ts`) —
one constant that seeds new hotels and backs every display fallback, so the
wizard, the guest preview and the overview KPIs cannot disagree. It is only a
starting value: picking a country in step 2 switches to that country's currency
(`COUNTRY_DEFAULT_CURRENCY`), and Basics lets the owner override it outright.
Owners can change the account-wide starting currency in Settings → Account.

**Draft autosave** debounces 1.2s and writes through the same
`useSaveHotel()` mutation as an explicit save. Nothing is written until the
hotel has a name, so an abandoned `/hotels/new` visit leaves no junk record; the
generated draft id is kept in `sessionStorage` so a reload resumes the same
draft instead of orphaning it. The top bar shows *Unsaved changes → Saving… →
Draft saved N minutes ago*.

## Architecture

```
src/
├── app/[locale]/
│   ├── layout.tsx              root layout: Clerk (conditional) + providers + dir/lang
│   ├── (dashboard)/            sidebar + top bar shell
│   └── (wizard)/               full-screen wizard shell (no sidebar), per the reference
├── components/
│   ├── providers/              Query, Theme, Toast, HotelScope, AppProviders
│   ├── ui/                     primitives, form controls, Menu, overlays
│   ├── shell/                  Sidebar, TopBar, HotelSwitcher, Locale/Theme switchers
│   ├── wizard/                 WizardProvider + stepper + 6 steps
│   └── hotels|overview|pricing|bookings|reviews|settings/
├── lib/
│   ├── schemas/                hotel.ts (contract), draft.ts, booking.ts, errors.ts
│   ├── api/                    config.ts (USE_MOCK), hotels/bookings/pricing/settings
│   ├── mock/                   seed data, in-memory store, places lookup
│   ├── query/                  keys.ts + hooks.ts — the app's entire data surface
│   ├── catalogs.ts             amenity/category/view/bed/board/currency/city IDs
│   └── useLabels.ts            catalogue ID → localised label
├── i18n/                       routing, request, navigation
├── messages/                   en.json, ar.json (mirrored key-for-key)
└── proxy.ts                    Clerk + next-intl (Next 16's `middleware` rename)
```

Components never call `fetch`, the mock store, or the API modules. They call
hooks from `src/lib/query/hooks.ts`. That is the seam the `USE_MOCK` flag lives
behind.

Responses from a real backend are parsed with the *same* Zod schemas the
dashboard writes with (`request()` in `src/lib/api/config.ts`), so a backend
that drifts from the shared model fails loudly at the boundary instead of
halfway down a render tree.

### Mock backend

`src/lib/mock/db.ts` is a browser-only in-memory store that persists to
`localStorage`, with simulated latency so the loading skeletons are genuinely
exercised. Availability months are materialised lazily from a seed derived from
the room-type id and the month, so the same month always looks the same while
owner edits layer on top. All data fetching happens client-side, which is why
nothing can hydrate-mismatch.

Clear `localStorage` (or call `resetMockStore()`) to return to the seed data:
two published hotels and one draft. The draft deliberately contains a room type
with **no rate plans** — that is what drives the "needs attention" alert and the
wizard's review-step warning.

## RTL & theming

- Every spacing/alignment utility is logical: `ms/me`, `ps/pe`, `start/end`,
  `text-start/text-end`. No `ml`, `mr`, `left`, or `right` in layout code.
- Direction-encoding icons (chevrons, arrows) carry `.flip-rtl`, which mirrors
  them under `dir="rtl"`.
- **Readex Pro** (via `next/font/google`) is the brand face for both locales —
  it ships Latin and Arabic in one family, so the Arabic side never falls back
  to a system font. Prices, codes, coordinates and IBANs carry `.latn` so Latin
  digits stay readable and copyable inside RTL text.
- Plurals use full ICU categories in Arabic (`zero`/`one`/`two`/`few`/`many`),
  not an English two-form approximation.
- The brand yellow `#fcc519` is a **fill only** — it scores ~1.7:1 against white,
  so it can never carry text. The accent is therefore three tokens, and which
  one to reach for is not a judgement call:
  - `accent` — fills, borders, graphic marks (`bg-accent`)
  - `accent-ink` — text and icons *on* a surface, plus focus rings and the
    input focus border (`text-accent-ink`). Dark amber in light mode, and the
    brand yellow itself in dark mode, where it already clears 10:1.
  - `on-accent` — near-black text *on* an accent fill (`text-on-accent`)
- Brand assets live in `public/`: `logo.png` (monogram) is the favicon and the
  wizard's compact mark; `full_logo.png` (wordmark) is the sidebar and auth
  screens. The favicon is wired through Metadata `icons`, so there is no second
  copy of the mark to keep in sync.
- The rest of the design tokens are the reference artifact's palette. `data-theme` is
  resolved to a concrete `light`/`dark` by an inline script before first paint,
  so there is one authoritative value per token and no flash. Light / dark /
  system are switchable from the top bar.

## Wiring a real backend

1. Set `NEXT_PUBLIC_USE_MOCK=false` and `NEXT_PUBLIC_API_BASE_URL`.
2. Implement the endpoints the service modules already call:

```
GET    /hotels                                    → Hotel[]
GET    /hotels/:id                                → Hotel
PUT    /hotels/:id                                → Hotel      (drafts included)
PATCH  /hotels/:id/status                         → Hotel
DELETE /hotels/:id
PUT    /hotels/:id/reviews/:reviewId/reply        → HotelReview
GET    /places/nearby?lat&lng&locale              → HotelNearbyPlace[]
GET    /bookings                                  → Booking[]
PATCH  /bookings/:id/status                       → Booking
GET    /room-types/:id/availability?hotelId&year&month  → AvailabilityCalendar
PUT    /room-types/:id/availability/:date         → DayInventory
POST   /room-types/:id/availability/bulk          → { updated: number }
GET    /settings                                  → Settings
PUT    /settings                                  → Settings
```

3. Nothing else changes. The response schemas are already the shared ones.

## Known limitations

- Uploaded photos are stored as data URLs in the mock store (capped at 1.5 MB
  each). A real backend would return an object-storage URL — `photos: string[]`
  already accepts either.
- The map is a self-contained grid-and-pin picker, not a tile provider. It
  writes the same `latitude`/`longitude` a real map would; drop in Mapbox or
  Google Maps behind `LocationStep`'s `dropPin` handler.
- Clerk's own UI (sign-in form, account menu) renders in English. Add
  `@clerk/localizations` and pass `localization={arSA}` to `ClerkProvider` for a
  fully Arabic auth flow.
