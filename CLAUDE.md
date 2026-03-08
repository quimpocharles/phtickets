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
  generateTickets.js  Counter → format GH26-XXXXXX → QR buffer → Cloudinary → Ticket.insertMany
  orderNumber.js      ORD-YYYYMMDD-XXXXX
jobs/eodReport.js  node-cron scheduled EOD report email
middleware/adminAuth.js  JWT verification for /admin routes
```

### Payment flow (critical path)

1. **`POST /tickets/purchase`** — accepts `{ items: [{ ticketTypeId, quantity }], buyerEmail, buyerPhone, buyerName, country }`. Generates a `cartId` (UUID), runs a MongoDB transaction to check availability and create all `TicketReservation` docs (shared `cartId`, TTL=5min), calls PayMongo `createCheckout` with `cartId` as `reference_number`, extends TTL to 30min, returns `{ cartId, checkoutUrl }`.
2. **`POST /payments/webhook`** — `reference_number` = `cartId`. HMAC-SHA256 verify (`paymongo-signature` header) → cross-verify with PayMongo API → `TicketReservation.updateMany({ cartId })` to claim all → one `Order` per reservation → `TicketType.sold += qty` → `generateTickets` → one combined email + SMS (non-blocking).
3. **`POST /payments/process/:cartId`** — client-triggered fallback for local dev when webhooks can't reach localhost. Skips PayMongo API verification only when `NODE_ENV=development`. Returns same shape as `GET /tickets/order/cart/:cartId`.
4. **`GET /tickets/order/cart/:cartId`** — polled by the success page every 5s; returns `{ game, buyer, grandTotal, orders: [{ orderNumber, ticketTypeName, tickets }] }`. Triggers `/process` after 3 failed polls.

### Multi-cart purchase

A single checkout can contain multiple ticket types (e.g. 4× Single Day + 2× VIP). All reservations share one `cartId` stored on each `TicketReservation`. The PayMongo checkout total = sum of `(price + serviceFee) × quantity` across all items (in centavos = PHP × 100). On success, one `Order` is created per ticket type.

**Mongoose 8 note:** `Model.create([...], { session, ordered: true })` — `ordered: true` is required when using a session with multiple documents.

### Availability race-condition guard

`TicketReservation.countActiveReserved(ticketTypeId, session)` aggregates live reservations inside the same Mongoose transaction as the new reservation insert. `ticketType.sold` is only incremented on `PAYMENT_SUCCESS` — never on reservation.

### Ticket ID & QR codes

- Format: `GH26-000001` (sequential via `Counter` collection, update `YEAR` constant in `generateTickets.js` each season)
- QR content is the plain ticket ID string (not a URL) to prevent accidental redemption from camera apps
- `scope=day` tickets: marked `status=used` on first scan; `scope=all` (VIP): per-day `ScanLog` check, ticket never marked used

### Key env vars

| Var | Purpose |
|-----|---------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `ALLOWED_ORIGIN` | CORS origin (default `*`) |
| `PAYMONGO_SECRET_KEY` | PayMongo secret key (Basic auth, amounts in centavos) |
| `PAYMONGO_WEBHOOK_SECRET` | HMAC-SHA256 webhook secret (`paymongo-signature` header, optional in dev) |
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
| `payments/success/` | Polls `GET /tickets/order/cart/:cartId`; shows ticket cards + QR per ticket |
| `payments/failure/` `payments/cancel/` | PayMongo redirect pages |
| `scanner/` | Guard QR scanner — ZXing camera, calls `GET /tickets/verify/:ticketId`, full-screen PWA |
| `admin/` | Dashboard, orders, games CRUD, reports |

### Purchase panel (frontend)

`TicketPurchasePanel` uses a `Map<ticketTypeId, { type, quantity }>` cart. `TicketTypeCard` renders as a `<button>` (add to cart) when `cartQty === 0`, and as a `<div>` with a qty stepper when `cartQty > 0`. Grand total = tickets subtotal + web service fees. Buyer must select country (10 options: PH, US, AU, CA, NZ, IT, EU, GB, AE, JP) for team commission tracking. All dates formatted with `timeZone: 'Asia/Manila'` to prevent UTC/PHT off-by-one on Vercel.

### TicketType model

Key fields: `price`, `serviceFee` (web service fee per purchase unit, default 0, shouldered by buyer), `quantity`, `sold`, `scope` ('day'|'all'), `ticketsPerPurchase`, `active`. `available` and `urgencyBadge` are server-computed and injected by `GET /games`.

### Game model

`game.description` is a free-text string (e.g. `"Letran vs San Beda | EAC vs Mapua"`). There are no team references on the Game document — use `game.description` directly everywhere.
