# NBTC Ticketing System — Documentation

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

---

## Overview

A full-stack basketball ticketing platform built for NBTC. Fans browse upcoming games, select ticket types, and pay via Maya. Upon successful payment, individual QR-coded tickets are generated, uploaded to Cloudinary, and delivered by email and SMS.

Admin staff manage games, teams, and ticket types through a protected dashboard. Gate staff scan QR codes at the venue using a real-time camera scanner. Administrators receive automated End-of-Day transaction reports by email with a CSV attachment.

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
MongoDB Atlas    Cloudinary           Maya PH
(Mongoose)    (banners, logos,      (payment gateway)
               QR codes)                 │ webhook
                                  Nodemailer + Semaphore
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
│   │   ├── Game.js             # Game (teamA/teamB refs, venue, gameDate, banner)
│   │   ├── TicketType.js       # Ticket tier (name, price, quantity, sold)
│   │   ├── Order.js            # Purchase record (buyer info, amount, payment status)
│   │   ├── Ticket.js           # Individual ticket (ticketId, QR URL, status)
│   │   ├── TicketReservation.js# Seat hold (TTL-based, 5 min → 30 min)
│   │   ├── Counter.js          # Sequential ticket ID generator
│   │   ├── Admin.js            # Admin user (email, bcrypt password)
│   │   ├── ScanLog.js          # Gate scan audit (result per scan attempt)
│   │   └── ReportRecipient.js  # EOD report mailing list
│   ├── routes/
│   │   ├── games.js            # GET /games (public)
│   │   ├── tickets.js          # POST /tickets/reserve, /purchase; GET /verify/:id
│   │   ├── payments.js         # POST /payments/webhook (Maya)
│   │   └── admin.js            # All /admin/* endpoints (JWT-protected)
│   ├── middleware/
│   │   └── adminAuth.js        # JWT verification middleware
│   ├── services/
│   │   ├── cloudinary.js       # uploadBanner, uploadTeamLogo, uploadQRCode
│   │   ├── maya.js             # createCheckout, getPaymentStatus
│   │   ├── mailer.js           # sendTicketEmail
│   │   ├── sms.js              # sendTicketSMS (Semaphore)
│   │   ├── reportService.js    # generateDailyTransactionReport
│   │   └── gateReconciliationService.js  # generateGateReconciliationReport
│   ├── jobs/
│   │   └── eodReport.js        # Cron job: 23:59 PHT — email report + CSV
│   ├── templates/
│   │   └── eodReportTemplate.js# HTML + plain-text EOD email renderer
│   └── utils/
│       ├── generateTickets.js  # Parallel QR generation + Cloudinary upload
│       └── orderNumber.js      # ORD-YYYYMMDD-XXXXX format generator
│
├── web/                        # Next.js 14 frontend
│   └── src/
│       ├── app/
│       │   ├── layout.tsx              # Root layout (Navbar)
│       │   ├── page.tsx                # Home: upcoming games list
│       │   ├── tickets/
│       │   │   ├── page.tsx            # Tickets index
│       │   │   └── [gameId]/page.tsx   # Game detail + purchase panel
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
| Payment | Maya PH (paymaya checkout v2) |
| Email | Nodemailer (SMTP) |
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
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/ticket-sys

JWT_SECRET=<long-random-string>
JWT_EXPIRES_IN=8h

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

SEMAPHORE_API_KEY=
SEMAPHORE_SENDER_NAME=NBTC

MAYA_PUBLIC_KEY=
MAYA_SECRET_KEY=
MAYA_BASE_URL=https://pg.maya.ph
MAYA_WEBHOOK_SECRET=

APP_BASE_URL=https://your-production-domain.com
EOD_REPORT_RECIPIENTS=admin@example.com,ops@example.com
```

### Frontend (`web/.env.local`)

```env
NEXT_PUBLIC_API_URL=https://api.your-production-domain.com
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
  teamA:       ObjectId → Team,
  teamB:       ObjectId → Team,
  venue:       String,
  gameDate:    Date,
  bannerImage: String,        // Cloudinary URL
  createdAt:   Date,
}
```

### TicketType

```js
{
  gameId:   ObjectId → Game,
  name:     String,           // e.g. "VIP", "Lowerbox"
  price:    Number,           // PHP
  quantity: Number,           // total capacity
  sold:     Number,           // incremented on PAYMENT_SUCCESS
}
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
```

### Ticket

```js
{
  ticketId:     String,       // NBTC26-000001
  orderId:      ObjectId → Order,
  gameId:       ObjectId → Game,
  ticketTypeId: ObjectId → TicketType,
  qrCodeUrl:    String,       // Cloudinary URL
  status:       'unused' | 'used',
  createdAt:    Date,
}
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

### Admin

```js
{
  email:     String (unique),
  password:  String (bcrypt hash),
  name:      String,
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

---

## API Reference

### Public

| Method | Endpoint | Description |
|---|---|---|
| GET | `/games` | Upcoming games with ticket types, availability, urgency badges |
| POST | `/tickets/reserve` | Reserve seats (5-min hold) |
| POST | `/tickets/purchase` | Reserve seats + create Maya checkout |
| GET | `/tickets/verify/:ticketId` | Validate and mark ticket as used (gate scanner) |
| POST | `/payments/webhook` | Maya payment webhook |

### Admin (all require `Authorization: Bearer <token>`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/setup-status` | Is first-time setup needed? |
| POST | `/admin/register` | Create first admin (disabled after first use) |
| POST | `/admin/login` | Authenticate, returns JWT |
| GET | `/admin/profile` | Current admin info |
| GET | `/admin/teams` | List all teams |
| POST | `/admin/teams` | Create team (multipart: name, monicker, logo) |
| PATCH | `/admin/teams/:id` | Update team |
| DELETE | `/admin/teams/:id` | Delete team |
| GET | `/admin/games` | All games with sales summary |
| POST | `/admin/games` | Create game (multipart: teamA, teamB, venue, gameDate, bannerImage) |
| POST | `/admin/games/:gameId/tickets` | Add ticket types to a game |
| DELETE | `/admin/games/:gameId` | Delete game + ticket types + open reservations |
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

`POST /payments/webhook` (Maya → server)

The webhook is the single authoritative state machine for payment outcomes.

**Idempotency**: If a reservation is already `completed` and an Order exists, the webhook returns 200 immediately without re-processing.

**Atomic claim**: The reservation is updated with `findOneAndUpdate` matching `{ status: 'reserved', expiresAt: { $gt: now } }`. If that returns null (already processed or expired), the webhook aborts.

**Signature verification**: Maya sends an `Authorization` header; the webhook verifies it against `MAYA_WEBHOOK_SECRET`.

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

Both are sent asynchronously after ticket generation on payment success.

### Email (`src/services/mailer.js`)
- Sent via Nodemailer (SMTP)
- Contains order number, game details, ticket table with QR code images
- Sender: `puso-support@codeatcoffee.com`

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

Scheduled via `node-cron` at **23:59 Asia/Manila** every day.

`generateDailyTransactionReport()`:
- Queries all `paid` Orders where `createdAt` falls within today (Asia/Manila timezone)
- Builds `byGame` and `byTicketType` breakdowns
- Returns totals: revenue, tickets sold, transaction count

The EOD email:
- HTML template with summary cards, Sales by Game table, Sales by Ticket Type table
- Plain-text fallback
- CSV attachment: one row per order (Order ID, Game, Ticket Type, Quantity, Total Amount, Buyer Email, Buyer Phone, Payment Reference, Transaction Date)
- Sent to all `ReportRecipient` documents where `active: true`

Recipients are managed via:
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
| `/` | Home: upcoming games list |
| `/tickets` | Ticket browsing |
| `/tickets/:gameId` | Game detail: ticket types, purchase panel, reservation countdown |
| `/scanner` | QR camera scanner for gate staff |

### Components

| Component | Description |
|---|---|
| `Navbar` | Site navigation |
| `GameCard` | Game tile with banner, teams, venue, date |
| `TicketTypeCard` | Ticket tier with price, urgency badge, scarcity message |
| `TicketPurchasePanel` | Quantity selector + buyer form + checkout + reservation countdown |
| `Badge` | Urgency badge renderer |
| `TeamSearchDropdown` | Searchable team selector with logo, name, monicker; used in game creation form |

### Ticket ID Format

`NBTC26-000001` — prefix `NBTC` + 2-digit year + 6-digit zero-padded sequential counter

Stored in the `counters` MongoDB collection, incremented atomically via `Counter.nextSeq()`.
