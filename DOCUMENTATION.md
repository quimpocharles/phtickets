# Global Hoops Ticketing System — Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Tech Stack](#tech-stack)
5. [Environment Variables](#environment-variables)
6. [Getting Started](#getting-started)
7. [Data Models](#data-models)
8. [API Reference](#api-reference)
9. [Purchase Flow](#purchase-flow)
10. [Availability Calculation](#availability-calculation)
11. [Urgency & Scarcity Indicators](#urgency--scarcity-indicators)
12. [Payment Webhook](#payment-webhook)
13. [Ticket Generation](#ticket-generation)
14. [Notifications](#notifications)
15. [QR Scanner](#qr-scanner)
16. [Gate Reconciliation](#gate-reconciliation)
17. [End-of-Day Report](#end-of-day-report)
18. [Admin Dashboard](#admin-dashboard)
19. [Frontend Pages & Components](#frontend-pages--components)
20. [Security](#security)
21. [Database Indexes](#database-indexes)
22. [Seeding Mock Orders](#seeding-mock-orders)
23. [Deployment](#deployment)

---

## Overview

A full-stack basketball pass platform built for Global Hoops International. Fans browse upcoming games, select pass types, and pay via PayMongo. Upon successful payment, individual QR-coded passes are generated, uploaded to Cloudinary, and delivered by email and SMS.

Admin staff manage games, teams, and pass types through a protected dashboard. Gate staff scan QR codes at the venue using a real-time camera scanner. Administrators receive automated End-of-Day transaction reports by email with a CSV attachment, plus an immediate notification email on every confirmed purchase.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / Mobile                         │
│              Next.js 14 (App Router)  ·  port 3001              │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST (JSON)
┌────────────────────────────▼────────────────────────────────────┐
│              Express API  ·  port 3000                           │
│   /games   /admin   /tickets   /payments/webhook                 │
└───┬────────────────┬────────────────────┬────────────────────────┘
    │                │                    │
    ▼                ▼                    ▼
MongoDB Atlas    Cloudinary           PayMongo PH
(Mongoose)    (banners, logos,      (payment gateway)
               QR codes)                 │ webhook
                                  Resend + Semaphore
                               (email + SMS on payment success)
```

---

## Project Structure

```
ticket-sys/
├── src/                        # Express API
│   ├── server.js               # Entry point: DB connect, server start, cron schedule
│   ├── app.js                  # Express app: routes, CORS, middleware
│   ├── models/
│   │   ├── Team.js             # Team (name, monicker, logo)
│   │   ├── Game.js             # Game (description, venue, gameDate, banner)
│   │   ├── TicketType.js       # Pass tier (name, price, quantity, sold)
│   │   ├── Order.js            # Purchase record (buyer info, amount, payment status)
│   │   ├── Ticket.js           # Individual pass (ticketId, QR URL, status)
│   │   ├── TicketReservation.js# Seat hold (TTL-based, 5 min → 30 min)
│   │   ├── Counter.js          # Sequential pass ID generator
│   │   ├── Admin.js            # Admin user (email, bcrypt password, role)
│   │   ├── ScanLog.js          # Gate scan audit (result per scan attempt)
│   │   ├── ReportRecipient.js  # EOD report mailing list
│   │   └── ReportLog.js        # Tracks successful EOD sends by date (rescue cron)
│   ├── routes/
│   │   ├── games.js            # GET /games (public)
│   │   ├── tickets.js          # POST /tickets/purchase; GET /verify/:id, /find
│   │   ├── payments.js         # POST /payments/webhook (PayMongo)
│   │   └── admin.js            # All /admin/* endpoints (JWT-protected)
│   ├── middleware/
│   │   └── adminAuth.js        # JWT verification + role middleware
│   ├── services/
│   │   ├── cloudinary.js       # uploadBanner, uploadTeamLogo, uploadQRCode
│   │   ├── paymongo.js         # createCheckout, getPaymentStatus (PayMongo)
│   │   ├── mailer.js           # sendTicketEmail, sendTransactionNotification (Resend)
│   │   ├── sms.js              # sendTicketSMS (Semaphore)
│   │   ├── reportService.js    # generateDailyTransactionReport(dateStr?)
│   │   └── gateReconciliationService.js  # generateGateReconciliationReport
│   ├── jobs/
│   │   └── eodReport.js        # Crons: 23:59 PHT (primary) + 05:00 PHT (rescue)
│   ├── templates/
│   │   └── eodReportTemplate.js# HTML + plain-text EOD email renderer
│   └── utils/
│       ├── generateTickets.js  # Parallel QR generation + Cloudinary upload
│       └── orderNumber.js      # ORD-YYYYMMDD-XXXXX format generator
│
├── web/                        # Next.js 14 frontend
│   └── src/
│       ├── app/
│       │   ├── layout.tsx              # Root layout (Navbar + Footer + JSON-LD Organization)
│       │   ├── not-found.tsx           # Branded 404 page
│       │   ├── robots.ts               # robots.txt generation
│       │   ├── sitemap.ts              # sitemap.xml generation
│       │   ├── page.tsx                # Home: upcoming games list
│       │   ├── legal/
│       │   │   └── page.tsx            # Combined Terms & Conditions + Privacy Policy
│       │   ├── passes/
│       │   │   ├── page.tsx            # Passes index
│       │   │   └── [gameId]/page.tsx   # Game detail + JSON-LD SportsEvent + purchase panel
│       │   ├── scanner/
│       │   │   └── page.tsx            # QR camera scanner (ZXing)
│       │   └── admin/
│       │       ├── layout.tsx          # Admin shell: sidebar nav + auth guard
│       │       ├── page.tsx            # Dashboard: games list + stats
│       │       ├── login/              # Admin login
│       │       ├── setup/              # First-time admin registration
│       │       ├── games/
│       │       │   ├── new/            # Create game form
│       │       │   └── [gameId]/tickets/ # Manage ticket types
│       │       └── reports/
│       │           ├── page.tsx        # Reports hub
│       │           └── gate/
│       │               ├── page.tsx         # Gate report game picker
│       │               └── [gameId]/page.tsx # Gate reconciliation detail
│       ├── components/
│       │   ├── Navbar.tsx
│       │   ├── Footer.tsx
│       │   ├── GameCard.tsx
│       │   ├── TicketTypeCard.tsx
│       │   ├── TicketPurchasePanel.tsx
│       │   ├── Badge.tsx
│       │   └── TeamSearchDropdown.tsx
│       ├── lib/
│       │   ├── api.ts          # fetch wrappers (getGames, purchaseTickets)
│       │   └── badges.ts       # Badge style config
│       └── types/
│           └── index.ts        # Shared TypeScript interfaces
│
└── DOCUMENTATION.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| API server | Node.js + Express 4 |
| Database | MongoDB Atlas (Mongoose 8) |
| Authentication | JWT (`jsonwebtoken`) + bcrypt |
| File uploads | Multer + multer-storage-cloudinary |
| Image storage | Cloudinary |
| Payment | PayMongo (hosted checkout) |
| Email | Resend API |
| SMS | Semaphore PH |
| QR code generation | `qrcode` (Node) |
| QR code scanning | `@zxing/browser` (browser) |
| Scheduling | `node-cron` |
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS 3 |

---

## Environment Variables

### Backend (`.env`)

```env
PORT=3000
NODE_ENV=production            # REQUIRED — controls PayMongo bypass and error verbosity
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/ticket-sys
ALLOWED_ORIGIN=https://your-frontend-domain.com   # REQUIRED in production

JWT_SECRET=<long-random-string-32-bytes-minimum>
JWT_EXPIRES_IN=8h

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

RESEND_API_KEY=re_...          # Resend API key — used for EOD reports + transaction notifications
EMAIL_FROM=noreply@yourdomain.com   # must be from a Resend-verified domain

SEMAPHORE_API_KEY=
SEMAPHORE_SENDER_NAME=GlobalHoops

PAYMONGO_SECRET_KEY=sk_...     # PayMongo secret key (Basic auth, amounts in centavos)
PAYMONGO_WEBHOOK_SECRET=       # REQUIRED in production — HMAC-SHA256 webhook signature key
                               # Must match the mode (test/live) of the registered webhook

RENDER_EXTERNAL_URL=           # Auto-set by Render — enables keep-alive self-ping every 10 min
```

> **Note:** `PAYMONGO_WEBHOOK_SECRET` must be set in production. If left empty, webhook signature verification is skipped. The key must match the test/live mode of the registered webhook — mismatches cause signature failures and PayMongo will disable the webhook endpoint.

### Frontend (`web/.env.local`)

```env
NEXT_PUBLIC_API_URL=https://api.your-production-domain.com
NEXT_PUBLIC_APP_URL=https://your-frontend-domain.com   # used for SEO metadataBase and sitemap
```

---

## Getting Started

### Backend

```bash
cd ticket-sys
npm install --legacy-peer-deps   # required: multer-storage-cloudinary peer dep
cp .env.example .env             # fill in values
node src/server.js
```

### Frontend

```bash
cd web
npm install
cp .env.local.example .env.local  # set NEXT_PUBLIC_API_URL
npm run dev
```

---

## Data Models

### Team

```js
{
  name:      String (required, unique),
  monicker:  String,          // nickname, e.g. "Hotshots"
  logo:      String,          // Cloudinary URL
  createdAt: Date,
}
```

### Game

```js
{
  description:  String,       // free-text e.g. "Letran vs San Beda | EAC vs Mapua"
  venue:        String,
  gameDate:     Date,
  eventEndDate: Date,
  bannerImage:  String,       // Cloudinary URL (optional; falls back to /landing.png)
  createdAt:    Date,
}
// Index: gameDate
```

### TicketType

```js
{
  gameId:             ObjectId → Game,
  name:               String,     // e.g. "VIP All Events Pass"
  price:              Number,     // PHP
  quantity:           Number,     // total capacity
  sold:               Number,     // incremented atomically on PAYMENT_SUCCESS
  scope:              'day'|'all',// day = single event, all = valid every event day
  ticketsPerPurchase: Number,     // QR codes generated per unit (5 for family passes)
  __v:                Number,     // Mongoose version key — used for OCC on admin edits
}
// Index: gameId
```

### Order

```js
{
  orderNumber:      String,   // ORD-YYYYMMDD-XXXXX
  gameId:           ObjectId → Game,
  ticketTypeId:     ObjectId → TicketType,
  buyerEmail:       String,
  buyerPhone:       String,
  buyerName:        String,
  quantity:         Number,
  totalAmount:      Number,   // PHP
  paymentStatus:    'pending' | 'paid' | 'failed' | 'refunded',
  paymentReference: String,   // Maya reference
  reservationId:    ObjectId → TicketReservation,
  createdAt:        Date,
}
// Indexes: reservationId, gameId, (buyerEmail + buyerPhone) compound
```

### Ticket

```js
{
  ticketId:     String,       // GH26-000001
  orderId:      ObjectId → Order,
  gameId:       ObjectId → Game,
  ticketTypeId: ObjectId → TicketType,
  qrCodeUrl:    String,       // Cloudinary URL
  status:       'unused' | 'used',
  createdAt:    Date,
}
// Indexes: orderId, gameId
```

### TicketReservation

```js
{
  gameId:       ObjectId → Game,
  ticketTypeId: ObjectId → TicketType,
  quantity:     Number,
  buyerEmail:   String,
  buyerPhone:   String,
  buyerName:    String,
  status:       'reserved' | 'completed' | 'expired',
  expiresAt:    Date,         // TTL index — MongoDB auto-deletes expired docs
  checkoutId:   String,       // populated after Maya checkout creation
}
```

TTL constants:
- `RESERVATION_TTL_SECONDS` = 300 (5 minutes — initial hold)
- `CHECKOUT_WINDOW_SECONDS` = 1800 (30 minutes — extended after Maya checkout created)

### ScanLog

```js
{
  ticketId:        ObjectId → Ticket,
  gameId:          ObjectId → Game,
  ticketTypeId:    ObjectId → TicketType,
  scanTime:        Date,
  scanResult:      'VALID' | 'ALREADY_USED' | 'INVALID',
  gateName:        String,    // optional
  scannerDeviceId: String,    // optional
}
```

### ScanLog (indexes)

```
// Indexes: ticketId, gameId
```

### Admin

```js
{
  email:     String (unique),
  password:  String (bcrypt hash),
  name:      String,
  role:      'super_admin' | 'admin' | 'scanner',
  deletedAt: Date,            // soft-delete; null = active
  createdAt: Date,
}
```

### ReportRecipient

```js
{
  email:     String (unique),
  name:      String,
  active:    Boolean,
  createdAt: Date,
}
```

### ReportLog

```js
{
  reportDate:     String (unique),  // 'YYYY-MM-DD' PHT — one doc per calendar day
  sentAt:         Date,
  recipientCount: Number,
  orderCount:     Number,
  revenue:        Number,
}
```

Used by the 05:00 PHT rescue cron to detect whether the 23:59 primary cron fired successfully. If no entry exists for yesterday, the rescue cron sends the missed report.

---

## API Reference

### Public

| Method | Endpoint | Description |
|---|---|---|
| GET | `/games` | Upcoming games with ticket types, availability, urgency badges |
| POST | `/tickets/purchase` | Reserve seats + create Maya checkout |
| GET | `/tickets/order/:reservationId` | Poll order status (success page polling) |
| GET | `/tickets/find` | Find tickets by email + phone |
| GET | `/tickets/verify/:ticketId` | Validate and mark ticket used (gate scanner, JWT required) |
| POST | `/payments/webhook` | Maya payment webhook (HMAC-SHA512 verified) |
| POST | `/payments/process/:reservationId` | Dev-only bypass — skips Maya, processes payment directly |

### Admin (all require `Authorization: Bearer <token>`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/setup-status` | Is first-time setup needed? |
| POST | `/admin/register` | Create first super_admin (disabled after first use) |
| POST | `/admin/login` | Authenticate, returns JWT |
| GET | `/admin/profile` | Current admin info |
| GET | `/admin/admins` | List all admins (super_admin only) |
| POST | `/admin/admins` | Create admin/scanner account |
| DELETE | `/admin/admins/:id` | Soft-delete admin |
| GET | `/admin/teams` | List all teams |
| POST | `/admin/teams` | Create team (multipart: name, monicker, logo) |
| PATCH | `/admin/teams/:id` | Update team |
| DELETE | `/admin/teams/:id` | Delete team |
| GET | `/admin/games` | All games with sales summary |
| POST | `/admin/games` | Create game (multipart: description, venue, gameDate, eventEndDate, bannerImage) |
| PATCH | `/admin/games/:gameId` | Edit game |
| DELETE | `/admin/games/:gameId` | Delete game + ticket types + open reservations |
| POST | `/admin/games/:gameId/tickets` | Add ticket type |
| PATCH | `/admin/games/:gameId/tickets/:ticketTypeId` | Edit ticket type (requires `__v` for OCC) |
| DELETE | `/admin/games/:gameId/tickets/:ticketTypeId` | Delete ticket type |
| GET | `/admin/orders` | List all paid orders |
| GET | `/admin/reports/gate/:gameId` | Gate reconciliation report |
| GET | `/admin/reports/gate/:gameId/export` | Gate scan log CSV download |
| GET | `/admin/report-recipients` | List EOD email recipients |
| POST | `/admin/report-recipients` | Add recipient |
| DELETE | `/admin/report-recipients/:id` | Remove recipient |

---

## Purchase Flow

```
1. Buyer selects ticket type and quantity
         ↓
2. POST /tickets/purchase
   - Availability check (quantity - sold - activeReservations)
   - Creates TicketReservation (status=reserved, expiresAt=+5 min)
   - Calls Maya createCheckout (totalAmount in centavos)
   - Extends reservation expiresAt to +30 min, stores checkoutId
   - Returns { reservationId, expiresAt, checkoutId, checkoutUrl }
         ↓
3. Frontend redirects buyer to checkoutUrl (Maya-hosted payment page)
         ↓
4. Buyer completes payment on Maya
         ↓
5. Maya POSTs to POST /payments/webhook
   - Verifies signature
   - Finds reservation by requestReferenceNumber
   - Cross-verifies with getPaymentStatus(checkoutId)
   - On PAYMENT_SUCCESS:
       • Marks reservation status=completed
       • Creates Order (paymentStatus=paid)
       • Increments TicketType.sold
       • Generates tickets + QR codes (parallel)
       • Sends confirmation email + SMS
   - On PAYMENT_FAILED:
       • Marks reservation status=expired (seats released)
         ↓
6. Buyer receives email with QR codes + SMS notification
```

---

## Availability Calculation

```
available = ticketType.quantity - ticketType.sold - activeReservations
```

- `ticketType.sold` — incremented atomically in the payment webhook
- `activeReservations` — sum of quantities from reservations where `status = 'reserved'` AND `expiresAt > now`

The reservation count is computed in a single MongoDB aggregate across all ticket types per request (not N+1). The availability check in `/tickets/purchase` runs inside a MongoDB transaction with a session to prevent overselling under concurrent load.

---

## Urgency & Scarcity Indicators

Computed server-side in `GET /games` for each ticket type:

| Remaining % | urgencyBadge |
|---|---|
| ≤ 25% | Last Chance to Buy |
| ≤ 50% | Almost Sold-Out |
| ≤ 75% | Fast-Selling |
| sold ≥ 10 | Trending |
| otherwise | null |

`scarcityMessage` — `"Only N tickets left"` when `quantity - sold < 100`.

---

## Payment Webhook

`POST /payments/webhook` (PayMongo → server)

The webhook is the single authoritative state machine for payment outcomes.

**Idempotency**: If a reservation is already `completed` and an Order exists, the webhook returns 200 immediately without re-processing.

**Atomic claim**: The reservation is updated with `findOneAndUpdate` matching `{ cartId }` and `status: 'reserved'`. If that returns null (already processed or expired), the webhook aborts.

**Signature verification**: PayMongo sends a `paymongo-signature` header in the format `t=<timestamp>,te=<test_hash>,li=<live_hash>`. The webhook computes `HMAC-SHA256(timestamp + "." + rawBody, PAYMONGO_WEBHOOK_SECRET)` and uses `crypto.timingSafeEqual()`. Verification is skipped only when `PAYMONGO_WEBHOOK_SECRET` is not set (local dev only).

**Always return 200**: The webhook handler must always return HTTP 200, even on signature failure or internal errors. Returning 4xx/5xx causes PayMongo to retry and eventually disable the webhook endpoint. Errors are logged server-side instead.

**Dev bypass**: `POST /payments/process/:cartId` is available only when `NODE_ENV=development`. It skips PayMongo verification and processes the cart directly — used for seeding test orders and local end-to-end testing.

---

## Ticket Generation

Triggered on `PAYMENT_SUCCESS` inside the webhook handler.

`generateTickets(orderId, gameId, ticketTypeId, quantity)`:

1. **Sequential IDs** — calls `Counter.nextSeq()` N times to get unique ticket IDs in `NBTC26-000001` format
2. **Parallel generation** — for each ticket, simultaneously:
   - Generates a QR code PNG buffer (`qrcode` library)
   - Uploads PNG to Cloudinary (`ticket-sys/qrcodes/` folder)
3. **Bulk insert** — `Ticket.insertMany()` with all generated docs

---

## Notifications

All notifications are sent asynchronously (fire-and-forget with `.catch()` logging) after ticket generation on payment success.

### Buyer confirmation email (`src/services/mailer.js` — `sendTicketEmail`)
- Sent via Resend API
- Subject: `Your Global Hoops Passes – Order ORD-YYYYMMDD-XXXXX`
- Contains all purchased passes in a single email — one horizontal card per pass (banner image left, QR + details right)
- QR codes are hosted Cloudinary URLs (not base64 inline — Gmail blocks `data:` URI images)
- Sender name: `Global Hoops Passes`; from address: `EMAIL_FROM` env var

### Transaction notification email (`src/services/mailer.js` — `sendTransactionNotification`)
- Sent via Resend API on every confirmed purchase
- Addressed to all active `ReportRecipient` entries
- Contains: game name + date, buyer name + email, passes breakdown (type × qty), total paid, timestamp (Asia/Manila)
- Allows recipients to monitor sales in real time without waiting for the EOD report

### SMS (`src/services/sms.js`)
- Sent via Semaphore PH API
- Short message: order number, game, quantity
- Configured sender name: `SEMAPHORE_SENDER_NAME`

---

## QR Scanner

Route: `/scanner`

Uses `@zxing/browser` (`BrowserQRCodeReader`) to access the device's rear camera and continuously decode QR codes.

**Scan flow:**
1. Camera starts on page mount (requests `facingMode: environment`)
2. ZXing decodes frames in real-time; on first result, calls `verifyTicket(ticketId)`
3. `isProcessingRef` prevents duplicate verify calls while a request is in flight
4. `GET /tickets/verify/:ticketId` marks the ticket as `used` and logs a `ScanLog` entry
5. Result panel slides up from the bottom:
   - **VALID** — blue, entry granted
   - **ALREADY USED** — amber, duplicate scan warning
   - **INVALID** — red, unknown ticket
6. "Scan Next Ticket" button resets state and resumes scanning

---

## Gate Reconciliation

`generateGateReconciliationReport(gameId)` in `src/services/gateReconciliationService.js`

Runs three parallel queries:
- `TicketType.find` — names for breakdown labels
- `Ticket.aggregate` — groups by `ticketTypeId`, counts `sold` and `scanned` (status=used) in one pass
- `ScanLog.aggregate` — groups by `scanResult`, returns INVALID and ALREADY_USED counts

Returns:

```js
{
  game, venue, gameDate,
  totalSold, totalScanned, noShows,
  invalidScans, duplicateScans,
  byTicketType: [{ ticketType, sold, scanned, noShows }]
}
```

Admin endpoint: `GET /admin/reports/gate/:gameId`
CSV export: `GET /admin/reports/gate/:gameId/export`

---

## End-of-Day Report

Two crons run in `src/jobs/eodReport.js`, both scoped to `Asia/Manila`:

| Cron | Time | Behaviour |
|---|---|---|
| Primary | **23:59 PHT** | Generates and sends today's report; saves a `ReportLog` entry on success |
| Rescue | **05:00 PHT** | Checks if yesterday has a `ReportLog` entry; sends the missed report if not |

The rescue cron exists because the backend is hosted on Render's free tier, which spins down after 15 minutes of inactivity. If the server was asleep at 23:59, the primary cron never fires — the rescue catches it in the morning.

A keep-alive self-ping (`setInterval`, every 10 minutes) in `src/server.js` hits `GET /health` to prevent spin-down. It only activates when `RENDER_EXTERNAL_URL` is set (injected automatically by Render).

### `generateDailyTransactionReport(dateStr?)`
- Accepts an optional `'YYYY-MM-DD'` string (PHT). Defaults to today PHT.
- Queries all `paid` Orders where `createdAt` falls within that day's UTC window
- Builds `byGame` and `byTicketType` breakdowns
- Aggregates `ScanLog` for the same window: `VALID`, `ALREADY_USED`, `INVALID` counts
- Returns totals: revenue, passes sold, transaction count, scan stats, `dateStr`

### EOD email contents
- HTML template: summary cards, Sales by Game table, Sales by Pass Type table, Scans Today table (Valid / Already Used / Invalid / Total)
- Plain-text fallback
- CSV attachment `transactions-YYYY-MM-DD.csv`: one row per order (Order ID, Game, Pass Type, Quantity, Total Amount, Buyer Email, Buyer Phone, Country, Payment Reference, Transaction Date)
- Sent to all `ReportRecipient` documents where `active: true`

### Manual send
```bash
node scripts/send-report-manual.js 2026-03-11
```
Sends the report for a specific date (useful for backfilling or testing).

### Recipients managed via
- `POST /admin/report-recipients` — add recipient
- `GET /admin/report-recipients` — list recipients
- `DELETE /admin/report-recipients/:id` — remove recipient

---

## Admin Dashboard

Protected by JWT stored in `localStorage`. All requests include `Authorization: Bearer <token>`.

### Sidebar Navigation

| Section | Link | Route |
|---|---|---|
| Overview | Dashboard | `/admin` |
| Games | All Games | `/admin` |
| Games | Add Game | `/admin/games/new` |
| Reports | Reports | `/admin/reports` |
| Reports | Gate Reconciliation | `/admin/reports/gate` |

### Pages

| Route | Description |
|---|---|
| `/admin/setup` | First-time admin registration (disappears after first admin is created) |
| `/admin/login` | Admin login form |
| `/admin` | Dashboard: stat cards + games table with inline delete |
| `/admin/games/new` | Create game: team search dropdowns, venue, date, banner upload |
| `/admin/games/:gameId/tickets` | Add ticket types (name, price, quantity) for a game |
| `/admin/reports` | Reports hub |
| `/admin/reports/gate` | Game picker for gate reconciliation |
| `/admin/reports/gate/:gameId` | Gate reconciliation detail: stat cards + ticket type table + CSV export |

---

## Frontend Pages & Components

### Public Pages

| Route | Description |
|---|---|
| `/` | Redirects directly to the active game's pass page |
| `/passes/:gameId` | Game detail: ticket-style banner, purchase panel, reservation countdown |
| `/passes/find` | Find My Passes — lookup by email + phone |
| `/payments/success` | Post-payment success: polls order status, displays QR tickets |
| `/payments/failure` | Payment failure page |
| `/payments/cancel` | Payment cancelled page |
| `/scanner` | QR camera scanner for gate staff (JWT required) |
| `/legal` | Combined Terms & Conditions and Privacy Policy page |

### Components

| Component | Description |
|---|---|
| `Navbar` | Dark pill navbar; Smart logo + "GLOBAL HOOPS INTL/INTERNATIONAL" in Anton font; mobile burger menu reveals Find My Passes; shrinks on scroll |
| `Footer` | Single-row footer: copyright + Terms & Privacy on left; "Let's get Social!" + Facebook + Instagram links on right |
| `TicketTypeCard` | Ticket tier card with stacked design, urgency starburst badge, three states (default / selected / sold-out); selected state uses offblack |
| `TicketPurchasePanel` | Includes game details card (full-width on desktop, compact with portrait image on mobile). Desktop/tablet: two-column layout. Mobile: full-width ticket list + floating blue cart button opens side drawer. Required Terms & Privacy checkbox blocks "Proceed to Payment" until ticked |
| `GameCard` | Game tile with banner, description, venue, date |
| `Badge` | Urgency badge renderer |
| `TeamSearchDropdown` | Searchable team selector used in game creation form |

### Banner Design

The game detail page banner (`/passes/:gameId`) uses a ticket-stub layout:
- **Left**: off-black background, yellow "Global Hoops International Tickets" label, large white game title, tagline (visible on all screen sizes)
- **Bottom strip**: scrolling marquee (CSS animation, Anton font) — date chip (yellow) → venue (blue) → "Global Hoops International Showcase" (black); loops infinitely
- **Right panel**: `smart-gh.jpg` full-cover image, black background; hidden on mobile

### Game Details Card

Displayed above the ticket type list inside `TicketPurchasePanel`:
- **Desktop**: full-width off-black card showing game title, date, and venue; no image
- **Mobile**: compact `inline-flex` card with text on left and `smart-gh.jpg` portrait image on right

### Ticket ID Format

`GH26-000001` — prefix `GH` + 2-digit year + 6-digit zero-padded sequential counter

Stored in the `counters` MongoDB collection, incremented atomically via `Counter.nextSeq()`.

To reset ticket data and counter (e.g. on rebrand): `node scripts/reset-tickets.js`

---

## Security

| Measure | Implementation |
|---|---|
| Security headers | `helmet` middleware (first middleware in `src/app.js`) |
| CORS | `ALLOWED_ORIGIN` env var; defaults to `*` in dev only |
| Rate limiting | 20 req/15min on `/tickets/purchase`; 10 req/5min on `/tickets/find` |
| JWT auth | All `/admin` routes; `adminAuth` middleware verifies token + checks soft-delete |
| Role-based access | `requireAdmin` / `requireScanner` / `requireSuperAdmin` middleware |
| Webhook verification | HMAC-SHA512, `crypto.timingSafeEqual()`, `x-signature` header |
| Error messages | 500 responses return `"An unexpected error occurred."` — full errors logged server-side only |
| Global error handlers | `unhandledRejection` + `uncaughtException` in `src/server.js` |
| Dev bypass guard | `POST /payments/process` blocked unless `NODE_ENV=development` |
| NoSQL injection | Mongoose parameterisation; regex queries anchored with `^...$` |

---

## Database Indexes

Indexes are defined at the bottom of each model file and created automatically by Mongoose on startup.

| Model | Indexes |
|---|---|
| `Game` | `gameDate` |
| `TicketType` | `gameId` |
| `TicketReservation` | `expiresAt` (TTL), `(ticketTypeId, status, expiresAt)` compound |
| `Order` | `reservationId`, `gameId`, `(buyerEmail, buyerPhone)` compound |
| `Ticket` | `ticketId` (unique), `orderId`, `gameId` |
| `ScanLog` | `ticketId`, `gameId` |

---

## Seeding Mock Orders

`scripts/seed-orders.js` creates mock paid orders for development testing. It connects directly to MongoDB, creates `TicketReservation` documents with a fake `checkoutId`, then calls `POST /payments/process/:reservationId` for each — triggering the full pipeline (sold count, QR generation, email, SMS).

**Requirements:**
- Backend server must be running on `API_URL` (default `http://localhost:3000`)
- `NODE_ENV=development` must be set in `.env`

```bash
node scripts/seed-orders.js
node scripts/seed-orders.js --game <gameId>   # target a specific game
```

The `ORDERS` array in the script is pre-configured with buyer names, emails, phone numbers, quantities, and ticket type name fragments that are matched case-insensitively against the game's ticket types.

---

## Deployment

### Backend

Recommended: any Node.js host (Railway, Render, Fly.io, VPS with PM2). Currently deployed on **Render** free tier.

Required env vars for production:
- `NODE_ENV=production`
- `MONGODB_URI`
- `ALLOWED_ORIGIN` (frontend domain)
- `JWT_SECRET` (32+ random bytes)
- `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `EMAIL_FROM` (must be a Resend-verified domain)
- All Cloudinary and Semaphore vars

**Render-specific:** `RENDER_EXTERNAL_URL` is injected automatically by Render. When present, the server pings its own `/health` endpoint every 10 minutes to prevent the free-tier spin-down from interrupting the 23:59 PHT EOD cron. Even if a spin-down occurs, the 05:00 PHT rescue cron will catch and send any missed report.

### Frontend

Deployed on **Vercel** (Next.js App Router). Set these in the Vercel project environment variables:
- `NEXT_PUBLIC_API_URL` — backend API URL
- `NEXT_PUBLIC_APP_URL` — frontend canonical URL (used for SEO `metadataBase` and sitemap)

### SEO

Auto-generated at runtime:
- `/robots.txt` — blocks `/admin/` and `/scanner/`; links to sitemap
- `/sitemap.xml` — game pages: priority `1.0`, `hourly`; home: `0.9`, `daily`; `/passes/find`: `0.4`; `/legal`: `0.2`, `monthly`

Favicon: `/favico.png` (served from `web/src/app/icon.png` via Next.js App Router convention).

Open Graph and Twitter card metadata are set globally in `layout.tsx` and overridden per game page via `generateMetadata()`.

**OG Image:** `gh-marquee.png` (1200×630) — used as the global and per-game social share image.

**Canonical URLs:** Set via `alternates.canonical` in `generateMetadata()` for each game page (`/passes/:gameId`).

**Route redirects:** Permanent 301 redirects are configured in `next.config.mjs` for the old `/tickets` URLs:
- `/tickets` → `/passes`
- `/tickets/find` → `/passes/find`
- `/tickets/:gameId` → `/passes/:gameId`

**Custom 404:** `web/src/app/not-found.tsx` — branded page with Smart logo, "Page not found" message, and "Get Passes →" CTA linking to `/`. Search engines excluded via `robots: { index: false, follow: false }`.

### Structured Data (JSON-LD)

Two schemas are injected server-side via `<script type="application/ld+json">`:

**Organization** (global, in `layout.tsx`):
```json
{
  "@type": "Organization",
  "name": "Global Hoops International",
  "url": "https://tickets.globalhoops.com",
  "logo": "https://tickets.globalhoops.com/favico.png",
  "sameAs": ["facebook.com/...", "instagram.com/globalhoopsint"]
}
```

**SportsEvent** (per game, in `passes/[gameId]/page.tsx`):
```json
{
  "@type": "SportsEvent",
  "name": "<game.description>",
  "startDate": "<game.gameDate>",
  "endDate": "<game.eventEndDate>",
  "eventStatus": "schema.org/EventScheduled",
  "eventAttendanceMode": "schema.org/OfflineEventAttendanceMode",
  "location": { "@type": "Place", "name": "<game.venue>" },
  "organizer": { "@type": "Organization", "name": "Global Hoops International" },
  "sponsor": { "@type": "Organization", "name": "Smart Communications" },
  "sport": "Basketball",
  "offers": [{ "@type": "Offer", "price": "<price>", "priceCurrency": "PHP", "availability": "InStock|SoldOut" }]
}
```
