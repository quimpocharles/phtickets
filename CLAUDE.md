# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (root)
```bash
npm run dev       # nodemon src/server.js (port 3000)
npm start         # node src/server.js
```

### Frontend (web/)
```bash
cd web
npm run dev       # next dev (port 3001)
npm run build     # next build
npm start         # next start
```

Both packages require `--legacy-peer-deps` when installing dependencies.

There is no test suite configured.

## Architecture

This is a two-package monorepo:
- **Root** — Node.js/Express backend API
- **`web/`** — Next.js 14 frontend (App Router, TypeScript, Tailwind, PWA)

They are independent npm packages sharing no code — the frontend calls the backend over HTTP.

### Backend structure (`src/`)

```
server.js          entry: dotenv → mongoose → scheduleEodReport → listen
app.js             Express app: CORS, rate limits, route mounting
routes/
  games.js         GET /games (public)
  tickets.js       POST /reserve, POST /purchase, GET /order/:id, GET /find, GET /verify/:id
  payments.js      POST /payments/webhook (Maya), POST /payments/process/:id (dev fallback)
  admin.js         /admin/** — JWT-protected CRUD for games, ticket types, orders, reports, teams
models/            Mongoose schemas: Game, TicketType, Order, Ticket, Counter, ScanLog,
                   TicketReservation, Admin, ReportRecipient, Team
services/
  maya.js          createCheckout (MAYA_PUBLIC_KEY), getPaymentStatus (MAYA_SECRET_KEY)
  mailer.js        sendTicketEmail — base64-inline QR codes via Nodemailer/MXrouting
  sms.js           sendTicketSMS — Semaphore API
  cloudinary.js    uploadQRCode helper
  reportService.js EOD sales report generation
utils/
  generateTickets.js  Counter → format NBTC26-XXXXXX → QR buffer → Cloudinary → Ticket.insertMany
  orderNumber.js      ORD-YYYYMMDD-XXXXX
jobs/eodReport.js  node-cron scheduled EOD report email
middleware/adminAuth.js  JWT verification for /admin routes
```

### Payment flow (critical path)

1. **`POST /tickets/purchase`** — MongoDB transaction: availability check (quantity − sold − activeReservations) → create `TicketReservation` (status=reserved, TTL=5min) → call Maya `createCheckout` → extend TTL to 30min → return `checkoutUrl`.
2. **`POST /payments/webhook`** — HMAC-SHA512 verify (`x-signature` header, skipped if `MAYA_WEBHOOK_SECRET` not set) → cross-verify with Maya API → atomic `findOneAndUpdate` to claim reservation → `Order.create` → `TicketType.sold += qty` → `generateTickets` → fire email + SMS (non-blocking).
3. **`POST /payments/process/:reservationId`** — client-triggered fallback for local dev when webhooks can't reach localhost. Skips Maya API verification only when `NODE_ENV=development`. The success page polls `GET /tickets/order/:reservationId` every 5s; triggers `/process` after 3 failures.

### Availability race-condition guard

`TicketReservation.countActiveReserved(ticketTypeId, session)` aggregates live reservations inside the same Mongoose transaction as the new reservation insert. `ticketType.sold` is only incremented on `PAYMENT_SUCCESS` — never on reservation.

### Ticket ID & QR codes

- Format: `NBTC26-000001` (sequential via `Counter` collection, update `YEAR` constant in `generateTickets.js` each season)
- QR content is the plain ticket ID string (not a URL) to prevent accidental redemption from camera apps
- `scope=day` tickets: marked `status=used` on first scan; `scope=all` (VIP): per-day `ScanLog` check, ticket never marked used

### Key env vars

| Var | Purpose |
|-----|---------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `ALLOWED_ORIGIN` | CORS origin (default `*`) |
| `MAYA_BASE_URL` | `https://pg-sandbox.paymaya.com` or `https://pg.maya.ph` |
| `MAYA_PUBLIC_KEY` | Maya checkout key |
| `MAYA_SECRET_KEY` | Maya payment status key |
| `MAYA_WEBHOOK_SECRET` | HMAC-SHA512 secret (optional in dev) |
| `CLOUDINARY_*` | Cloud name, API key, API secret |
| `SMTP_HOST/PORT/USER/PASS` | MXrouting SMTP (fusion.mxrouting.net:587) |
| `EMAIL_FROM` | Must match `SMTP_USER` |
| `SEMAPHORE_API_KEY` | Semaphore SMS |
| `JWT_SECRET` | Admin auth |
| `NODE_ENV` | Set to `development` to enable process endpoint bypass |

### Frontend structure (`web/src/app/`)

| Route | Purpose |
|-------|---------|
| `tickets/` | Public game listing + game detail + purchase panel |
| `tickets/find/` | "Find My Tickets" — email + phone lookup |
| `payments/success/` | Polls `GET /tickets/order/:reservationId`; shows ticket cards + QR |
| `payments/failure/` `payments/cancel/` | Maya redirect pages |
| `scanner/` | Guard QR scanner — ZXing camera, calls `GET /tickets/verify/:ticketId`, full-screen PWA |
| `admin/` | Dashboard, orders, games CRUD, reports |

### Game model

`game.description` is a free-text string (e.g. `"Letran vs San Beda | EAC vs Mapua"`). There are no team references on the Game document — use `game.description` directly everywhere.
