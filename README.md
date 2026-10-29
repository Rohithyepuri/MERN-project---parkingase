# ParkEase

**Find your space. Book with confidence. Park with ease.**

A complete MERN smart-parking platform: live facility discovery on a map, exact-bay reservations, demo/Razorpay-test payments, signed QR entry passes, a staff gate console with exit billing, and a full admin workspace with reports and audit logs.

The UI is built to be reviewed: emerald/amber/charcoal design system, Outfit + Inter + JetBrains Mono, light and dark themes, responsive layouts, loading/empty/error states, keyboard-accessible dialogs and slot pickers.

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS 3, React Router 6, Leaflet + OpenStreetMap, Recharts, Lucide, qrcode.react, react-hot-toast |
| Backend | Node.js 20+, Express 4, Mongoose 8 |
| Database | MongoDB (local or Atlas) |
| Auth | JWT bearer tokens, bcrypt password hashing, server-side role checks |
| Payments | Razorpay test mode when keys are set, otherwise a labelled DEMO flow |
| Maps | Leaflet + OpenStreetMap tiles and Nominatim geocoding — no API key required |

---

## Quick start

Prerequisites: **Node.js 20+** and a running **MongoDB** (default `mongodb://127.0.0.1:27017/parkease`).

```bash
# 1. Install dependencies
npm run install:all

# 2. Configure the API
cd server
cp .env.example .env
# Edit .env: set JWT_SECRET and TICKET_HMAC_KEY (openssl rand -hex 32)

# 3. Seed realistic demo data (wipes existing ParkEase data)
npm run seed

# 4. Run the API (port 5000)
npm run dev
```

In a second terminal:

```bash
cd client
npm run dev      # http://localhost:5173 (proxies /api to :5000)
```

Production-style single-server run:

```bash
npm run build            # builds client/dist
cd server && npm start   # serves the built SPA and the API on :5000
```

---

## Demo accounts

Created by `npm run seed`:

| Role | Email | Password | Lands on |
| --- | --- | --- | --- |
| Admin | `admin@parkease.dev` | `Admin@123` | `/admin` |
| Staff (gate) | `staff@parkease.dev` | `Staff@123` | `/staff` |
| Staff (second gate) | `staff2@parkease.dev` | `Staff@123` | `/staff` |
| Customer | `user@parkease.dev` | `User@123` | `/dashboard` |
| Customer | `kabir@example.com` | `Demo@123` | `/dashboard` |
| Customer | `meera@example.com` | `Demo@123` | `/dashboard` |

`staff@parkease.dev` operates Indiranagar and Koramangala. `staff2@parkease.dev` operates MG Road and Whitefield — the API enforces this facility scope.

**Change the seeded passwords in `server/src/seed.js` before sharing or deploying.** Registration on the public site always creates a `user`; only an admin can create staff/admin accounts.

Demo seed includes 4 Bengaluru facilities, 270 bays across 8 floors and 15 zones, completed stays and reviews, an active session, an upcoming booking, a pending checkout, refunds, incidents and audit entries.

---

## What is implemented

### Public / customer

- Landing page with live availability, map preview, features, how-it-works and operator panel
- Registration, login, logout, password change, forgot/reset password (see limitations)
- Facility discovery: debounced search, vehicle/amenity/price filters, sorting, distance via “Near me”, map with price pins, compare up to three facilities
- Facility detail: floor/zone bay plan with live busy/maintenance states, start/end pickers, duration presets, itemised quote, saved or ad-hoc vehicle, cancellation policy
- Reservation flow: slot hold → checkout (DEMO or Razorpay test) → signed QR pass
- Dashboard, booking history with filters, booking timeline, cancellation with tiered refunds, review for completed stays
- Vehicles (CRUD, default vehicle), favourites, in-app notifications, payments/receipts, profile and theme preferences

### Staff

- Facility-scoped overview with expected arrivals, vehicles inside, overdue sessions, failed scans and recent audit events
- Ticket desk: paste a signed token, manual booking reference, or scan a QR via the browser `BarcodeDetector` (Chromium/Android) — signature, state, facility and entry-window checks
- Entry records a session once; duplicate scans are rejected
- Active sessions with live overstay flags; exit calculates overstay beyond the facility grace period and produces the final bill
- Session history, incident reporting

### Admin

- Overview with database-backed metrics, revenue/bookings charts, top facilities, latest bookings and audit feed
- Facility CRUD (deactivate instead of destructive delete), map picker + Nominatim search + manual coordinates
- Floors, zones and bulk slot generation; slot maintenance with active-booking guards
- Pricing rules per facility (peak/weekend multipliers, minimum, daily max, overstay grace)
- Bookings table with filters, cancellation, pagination
- Users & staff: create accounts, role/status changes, staff facility assignment, last-admin and self-lockout guards
- Payments ledger with manual refunds (partial or full) and refund history
- Reports: KPIs, revenue/booking charts, status mix, top facilities, CSV exports (revenue, bookings, occupancy) with formula-injection protection
- Audit logs with action/role/date/search filters
- Review moderation and incident resolution (status + notes)
- Settings: support details, policy copy, payment-mode indicator, maintenance mode (blocks new bookings)

---

## How the important pieces work

### No double bookings

Each reservation writes occupancy documents into `slotlocks`, one per 30-minute bucket, with a **unique compound index on `(slot, bucket)`**. Two concurrent requests for overlapping windows race on the database index; exactly one wins and the other receives `409 slot_conflict`. Slots are never allocated by flipping a boolean.

- Unpaid checkouts hold their buckets for `BOOKING_HOLD_MINUTES` (default 10). A sweeper expires abandoned holds and releases inventory.
- The confirmed price is snapshotted onto the booking (`quote.snapshot`), so later pricing edits never change an agreed amount.
- Bookings move through explicit states: `pending → confirmed → checked_in → completed`, with `cancelled`, `expired`, `payment_failed`, `no_show` handled server-side.

### Tickets

The QR contains `bookingRef.HMAC(ref)` signed with `TICKET_HMAC_KEY` — no personal data, no guessable payload. The server verifies the signature with a timing-safe compare, then checks booking state, facility assignment, entry window (opens one hour before start) and duplicate entry. The same pass cannot be scanned twice.

### Money

- All amounts are calculated on the server (`services/pricing.js`), including peak/weekend multipliers, minimum charge, daily maximum and overstay.
- Razorpay: orders are created by the backend, signatures are verified before confirmation, the webhook verifies its own signature and is idempotent per event. Secrets never reach the browser.
- Without Razorpay keys the app runs in **DEMO** mode, clearly labelled in checkout, receipts and admin settings. No real money moves.
- Cancellations refund 100% (≥2 h before start), 75% (1–2 h), 50% (under 1 h); nothing after check-in.

### Security

- bcrypt hashing, JWT session expiry, in-memory auth rate limiting, restricted CORS in production
- Role checks on every staff/admin route; staff actions are additionally limited to assigned facilities
- Explicit request validation at API boundaries; consistent `{ error: { message, code } }` responses
- Audit log records actor, role, action, entity, summary, IP, timestamp — never secrets
- Route-level protections: cannot demote the last admin, cannot suspend yourself, cannot remove a slot with upcoming bookings

---

## Configuration

`server/.env` (see `server/.env.example`):

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `5000` | API port |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/parkease` | Local or Atlas URI |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins |
| `JWT_SECRET` | dev fallback | **Set in production** |
| `JWT_EXPIRES_IN` | `7d` | Session length |
| `TICKET_HMAC_KEY` | dev fallback | **Set in production**; rotating it invalidates old passes |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | empty | Enables Razorpay test orders |
| `RAZORPAY_WEBHOOK_SECRET` | empty | Required to accept webhooks |
| `BOOKING_HOLD_MINUTES` | `10` | Checkout hold window |

Times are displayed in **Asia/Kolkata (IST)**. The server evaluates opening hours and peak pricing in IST.

---

## API overview

Public

- `GET /api/health` · `GET /api/facilities` · `GET /api/facilities/:id` · `GET /api/facilities/:id/availability` · `GET /api/payments/config` · `GET /api/reviews/facility/:id`
- `POST /api/auth/register` · `/login` · `/forgot-password` · `/reset-password` · `POST /api/bookings/quote`

Customer (JWT)

- `GET/PATCH /api/auth/me`, `POST /api/auth/change-password`
- `GET /api/facilities/:id` + `POST /api/facilities/:id/favorite`
- `POST /api/bookings`, `GET /api/bookings/mine`, `GET /api/bookings/:id`, `GET /api/bookings/:id/ticket`, `POST /api/bookings/:id/cancel`
- `POST /api/payments/:bookingId/confirm`, `POST /api/payments/webhook`, `GET /api/payments/mine`
- Vehicles, notifications and reviews CRUD

Staff (JWT, facility-scoped)

- `GET /api/staff/facilities` · `/overview` · `/sessions` · `/history` · `/incidents`
- `POST /api/staff/validate` · `/entry` · `/exit` · `/incidents`

Admin (JWT, `admin`)

- `GET /api/admin/overview`, `/users`, `/bookings`, `/payments`, `/refunds`, `/reviews`, `/incidents`, `/audit-logs`, `/settings`, `/reports/summary`
- Facility/floor/zone/slot management under `/api/admin/...`
- CSV: `/api/admin/reports/revenue.csv`, `/bookings.csv`, `/occupancy.csv` (`from`, `to`)
- `POST /api/admin/payments/:id/refund` (manual partial or full refund)

Full request/response shapes are in `server/src/routes/*.js`; the client in `client/src/api/client.js` is the reference consumer.

---

## Testing

With the API running and the database seeded:

```bash
cd server && npm run test:api
```

The suite (`server/src/tests/e2e.js`) performs 50+ checks against the live API:

- auth/role enforcement (customer blocked from staff/admin, facility scope)
- discovery, facility detail, public quote
- concurrent double-booking race → one 201, one 409
- booking → demo payment → signed ticket → forged ticket rejected → gate validation → entry → duplicate entry blocked → exit billing
- completed booking cannot be cancelled; 100% refund path; failed payment releases the slot
- vehicles, notifications, staff metrics, admin overview/bookings/users/payments/refunds/CSV/audit/settings
- validation errors and the slot-with-upcoming-bookings guard

It creates a few bookings in the demo database; re-run `npm run seed` to reset to clean demo data.

---

## Project structure

```
parkease/
├── server/
│   ├── src/
│   │   ├── app.js, index.js, config.js, db.js, seed.js
│   │   ├── models/          User, Vehicle, Facility, Floor, Zone, Slot, SlotLock,
│   │   │                    Booking, Session, Payment, Refund, Notification,
│   │   │                    AuditLog, Review, Incident, Settings
│   │   ├── routes/          auth, facilities, bookings, payments, vehicles,
│   │   │                    notifications, reviews, staff, admin, adminInventory
│   │   ├── services/        pricing, locks, bookings, payments, ticket, sweeper,
│   │   │                    csv, activity
│   │   ├── middleware/      auth, rateLimit
│   │   ├── utils/           errors, helpers, validate, serialize
│   │   └── tests/e2e.js
│   └── .env.example
└── client/
    ├── src/
    │   ├── admin/           Overview, Facilities, FacilityEditor, Bookings, Users,
    │   │                    Payments, Reports, AuditLogs, Moderation, Settings
    │   ├── pages/           Landing, auth, discovery, facility, dashboard, bookings,
    │   │                    vehicles, payments, favourites, profile, staff console
    │   ├── components/      layout, console shell, map, slot grid, ticket, checkout,
    │   │                    cards, UI kit
    │   ├── context/         Auth, Theme
    │   ├── api/, lib/
    │   └── index.css, App.jsx, main.jsx
    └── index.html, vite.config.js, tailwind.config.js
```

---

## Known limitations

These are deliberate scope choices, not silently broken features:

- **Email delivery is not configured.** Forgot-password prints the reset link to the API console in development; add an email provider for production.
- **Razorpay keys are not included.** The app runs in labelled DEMO mode until you add test keys and the webhook secret. Live-mode configuration is out of scope.
- **Camera QR scanning** uses the browser `BarcodeDetector` API (Chromium/Android). Where unavailable, the token or booking reference can be pasted.
- **Admin 2FA / TOTP** is not implemented.
- **No floor-plan drawing** — bays are grouped by floor and zone, not positioned graphically.
- **Notifications are in-app only.** No SMS/WhatsApp integration.
- **No monthly passes / waitlists / dynamic demand pricing.**
- The audit log is append-only through the API, but the database user still has direct write access; production deployments should restrict that.

---

## Production checklist

1. Generate strong `JWT_SECRET` and `TICKET_HMAC_KEY`; keep `.env` out of version control.
2. Use MongoDB Atlas (or a secured instance) and restrict network access.
3. Set `CLIENT_ORIGIN` to your real domain, serve over HTTPS, and put the app behind a reverse proxy.
4. Add a shared store (Redis) for rate limiting if you run multiple API instances.
5. Configure Razorpay test keys and `RAZORPAY_WEBHOOK_SECRET`; point the webhook at `https://your-domain/api/payments/webhook`.
6. Change demo passwords and remove the demo accounts before exposing the site.
7. Replace the in-memory sweeper with a durable job runner if you scale horizontally.
