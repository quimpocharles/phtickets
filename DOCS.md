# Global Hoops Tickets — System Documentation

> Visual guide for customers and admins. Add screenshots at each `[SCREENSHOT]` marker.

---

## Table of Contents

1. [Customer Flow — How to Buy Tickets](#1-customer-flow--how-to-buy-tickets)
2. [What Customers Receive](#2-what-customers-receive)
3. [Find My Tickets](#3-find-my-tickets)
4. [At the Venue — Gate Entry](#4-at-the-venue--gate-entry)
5. [Admin — Dashboard](#5-admin--dashboard)
6. [Admin — Managing Games](#6-admin--managing-games)
7. [Admin — Managing Ticket Types](#7-admin--managing-ticket-types)
8. [Admin — Orders](#8-admin--orders)
9. [Admin — Reports](#9-admin--reports)

---

## 1. Customer Flow — How to Buy Tickets

### Step 1 — Browse Upcoming Games

The homepage lists all available games. Each game card shows the event name, venue, date, and a link to buy tickets.

`[SCREENSHOT: Games listing page — /tickets]`

---

### Step 2 — Select a Game

Clicking a game opens the game detail page. The banner shows the event name, venue, and date in a scrolling marquee. Below it is the ticket purchase panel.

`[SCREENSHOT: Game detail page with banner and ticket panel — /tickets/[gameId]]`

---

### Step 3 — Choose Ticket Types and Quantities

Each available ticket type is shown as a card with its name, price, service fee, and remaining availability. Urgency badges (e.g. "Almost Sold Out") appear automatically based on stock levels.

- Tap a ticket type card to add it to the cart.
- Once added, a quantity stepper appears — use **+** and **−** to adjust.
- Multiple ticket types can be added in one checkout (e.g. 2× Single Day + 1× VIP).
- The grand total (tickets + web service fees) updates live at the bottom.

`[SCREENSHOT: Ticket type cards — one unselected (button style), one selected (stepper style)]`

`[SCREENSHOT: Cart summary showing multiple ticket types and grand total]`

---

### Step 4 — Enter Buyer Details

Fill in:
- **Full Name**
- **Email Address** — tickets and QR codes will be sent here
- **Mobile Number** — an SMS confirmation is sent here
- **Country** — used for team commission tracking (10 options: PH, US, AU, CA, NZ, IT, EU, GB, AE, MT)

`[SCREENSHOT: Buyer details form]`

---

### Step 5 — Checkout via PayMongo

Tapping **Proceed to Checkout** redirects to the PayMongo hosted checkout page. Accepted payment methods:

- Visa / Mastercard / JCB / Amex (credit & debit cards)
- GCash
- Maya
- GrabPay
- QR Ph

No account or login is required.

`[SCREENSHOT: PayMongo checkout page]`

---

### After Payment — Confirmation Loading Screen

After completing payment, the customer is redirected back to the site. A loading screen appears while the system confirms the payment and generates the QR codes. This typically takes a few seconds.

> "Confirming your payment… This usually takes a few seconds. Please don't close this page."

`[SCREENSHOT: Payment confirmation loading spinner]`

---

## 2. What Customers Receive

### On-Screen — Ticket Cards

Once confirmed, each ticket appears as a digital card showing:

| Field | Example |
|-------|---------|
| Ticket Type | Single Day Pass |
| Validity | Single Day Pass / All Events Pass |
| Ticket # | 1 / 3 |
| Date & Time | March 15, 2026, 10:00 AM |
| Total Paid | ₱1,500 |
| Ticket No. | GH26-000042 |
| Venue | Ynares Center Antipolo |
| Ticket Holder | Juan dela Cruz |
| QR Code | Unique per ticket |

`[SCREENSHOT: Full ticket card on success page]`

Customers can:
- **Download Ticket** — saves the card as a PNG image (yellow button below each ticket)
- **Save / Print** — exports all tickets to print or save as PDF

`[SCREENSHOT: Download and Save/Print buttons]`

---

### By Email — Ticket Confirmation

A confirmation email is sent to the buyer's email address containing all purchased tickets in a single email. Each ticket includes the event banner, ticket details, and a QR code image.

`[SCREENSHOT: Email ticket layout — horizontal card with banner on left, details + QR on right]`

---

### By SMS — Order Confirmation

A short SMS is sent to the buyer's mobile number with the order number and event details for quick reference.

`[SCREENSHOT: SMS confirmation message]`

---

## 3. Find My Tickets

Customers who lost or didn't save their tickets can retrieve them at:

**`/tickets/find`**

Enter the **email address** and **phone number** used at checkout. All matching orders are returned, showing each ticket's QR code and status.

- If a ticket shows **"✓ Already scanned"**, it has been used at the gate.
- Rate limited to 10 lookups per 5 minutes per IP.

`[SCREENSHOT: Find My Tickets form]`

`[SCREENSHOT: Find My Tickets results — expanded order showing QR codes]`

---

## 4. At the Venue — Gate Entry

Guards use the Scanner app at **`/scanner`** — a full-screen PWA optimized for mobile.

### How scanning works

1. The guard opens the scanner on their phone/tablet.
2. The camera activates automatically and continuously scans for QR codes.
3. The customer presents their QR code (from email, download, or Find My Tickets).
4. The scanner reads the QR and checks the ticket against the database.

### Scan results

| Result | Meaning |
|--------|---------|
| **Valid — Admitted** (green) | Ticket is active and has not been used. Entry granted. |
| **Already Used** (red) | Ticket was previously scanned. Deny entry. |
| **Invalid** (red) | QR code not found in the system. Deny entry. |

**Ticket type behavior:**
- **Single Day Pass** — marked as used on first scan. Will show "Already Used" on any subsequent scan.
- **VIP All Events Pass** — valid every day of the event. Each day registers a separate scan log. Cannot be reused on the same day.

`[SCREENSHOT: Scanner camera view]`

`[SCREENSHOT: Valid scan result screen]`

`[SCREENSHOT: Already used / invalid scan result screen]`

---

## 5. Admin — Dashboard

**URL:** `/admin`
**Access:** JWT-protected. Login required at `/admin/login`.

The dashboard shows a live summary of all games:

### Stat Cards (top row)

| Card | Description |
|------|-------------|
| Total Revenue | Sum of all paid orders across all games |
| Tickets Sold | Total tickets issued across all games |
| Upcoming Games | Games whose end date is in the future |
| Trending Games | Upcoming games where ≥10% of capacity is sold |

`[SCREENSHOT: Admin dashboard stat cards]`

### Games Table

Lists every game with:
- Game name + "Upcoming" badge if still active
- Date range
- Venue
- Tickets sold (with visual fill bar — green → yellow → red as it fills up)
- Tickets remaining (turns red when sold out)
- Revenue
- Actions: **Edit**, **Delete**, **Manage Tickets**

`[SCREENSHOT: Admin dashboard games table]`

The footer row shows totals across all games when more than one game exists.

---

## 6. Admin — Managing Games

### Create a New Game

**URL:** `/admin/games/new`

Fields:
- **Game Description** — e.g. `Letran vs San Beda | EAC vs Mapua`
- **Venue**
- **Start Date & Time**
- **End Date & Time** (can span multiple days for multi-day events)
- **Banner Image** — uploaded image shown on the ticket and game detail page

`[SCREENSHOT: New game form]`

### Edit a Game

**URL:** `/admin/games/[gameId]/edit`

Same fields as creation. Changes apply immediately to the public listing.

`[SCREENSHOT: Edit game form]`

### Delete a Game

Triggered from the dashboard table. A confirmation prompt appears before deletion.

> Note: Deleting a game does not refund payments. Only delete games with no sold tickets.

`[SCREENSHOT: Delete confirmation prompt]`

---

## 7. Admin — Managing Ticket Types

**URL:** `/admin/games/[gameId]/tickets`

Each game can have multiple ticket types (e.g. Single Day, Family Pass, VIP).

### Ticket Type Fields

| Field | Description |
|-------|-------------|
| **Name** | Display name (e.g. "Single Day Pass"). Preset suggestions are available. |
| **Validity** | **Single Day** — valid for one day only. **All Events (VIP)** — valid for every day of the event. |
| **Price (₱)** | Base ticket price charged to the buyer. |
| **Service Fee (₱)** | Web service fee added on top of the price (set 0 if none). |
| **Capacity** | Maximum number of tickets that can be sold. |
| **QRs / Purchase** | Number of individual QR codes generated per 1 purchase unit. Set to **5** for family passes. |

`[SCREENSHOT: Ticket type table showing existing types with sold count and capacity]`

`[SCREENSHOT: Add ticket types form — multiple rows]`

### Adding Multiple Types at Once

Click **+ Add another type** to add a second (or more) ticket type row before saving. All rows are submitted together in one action.

### Editing a Ticket Type

Click **Edit** on any active ticket type row to open an inline edit panel below the table. Make changes and click **Save Changes**.

`[SCREENSHOT: Inline edit panel]`

### Deactivating / Deleting a Ticket Type

- If a ticket type has **tickets sold**, it can only be **deactivated** (hidden from the public, no new purchases). Existing tickets remain valid.
- If no tickets have been sold and the user is a **super admin**, the type can be fully **deleted**.

---

## 8. Admin — Orders

**URL:** `/admin/orders`

A searchable table of all paid orders.

### Search

Filter by: **order number**, **buyer name**, **email**, or **phone number**. The filtered result count and subtotal update live.

`[SCREENSHOT: Orders page with search bar]`

### Order Columns

| Column | Description |
|--------|-------------|
| Order # | Unique order ID (format: ORD-YYYYMMDD-XXXXX) |
| Buyer | Name, email, and phone |
| Game | Event name and venue |
| Ticket Type | The type purchased |
| Qty | Number of purchase units |
| Amount | Total charged |
| Date | Date and time of purchase |

The footer row shows the total revenue for the current search result.

`[SCREENSHOT: Orders table with footer total]`

---

## 9. Admin — Reports

**URL:** `/admin/reports`

### Gate Reconciliation Report

**URL:** `/admin/reports/gate/[gameId]`

Available for all games. Shows a per-ticket-type breakdown of:
- Tickets sold
- Tickets scanned (admitted)
- No-shows (sold but not scanned)
- Invalid scan attempts

Select a game from the reports page to view its reconciliation.

`[SCREENSHOT: Reports page — game list]`

`[SCREENSHOT: Gate reconciliation report for a specific game]`

### End of Day Report

Automatically emailed to configured recipients every day at **11:59 PM PHT** via a scheduled cron job. Contains a daily transaction summary. No manual action is needed.

### EOD Report Recipients

**URL:** `/admin/reports/recipients`

Manage which email addresses receive the daily EOD report.

- **Add** — enter an email address and click **+ Add**. Duplicate emails are rejected.
- **Remove** — click **Remove** next to an address, then confirm. The change takes effect at the next scheduled send.

`[SCREENSHOT: EOD Recipients page — list with add form]`

---

## Admin Navigation Reference

| Page | URL |
|------|-----|
| Dashboard | `/admin` |
| New Game | `/admin/games/new` |
| Edit Game | `/admin/games/[gameId]/edit` |
| Manage Ticket Types | `/admin/games/[gameId]/tickets` |
| Orders | `/admin/orders` |
| Reports | `/admin/reports` |
| Gate Report | `/admin/reports/gate/[gameId]` |
| EOD Recipients | `/admin/reports/recipients` |
| Admin Accounts | `/admin/admins` |
| Login | `/admin/login` |
