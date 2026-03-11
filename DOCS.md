# Global Hoops — System Documentation

> Visual guide for customers and admins. Add screenshots at each `[SCREENSHOT]` marker.

---

## Table of Contents

1. [Customer Flow — How to Buy Passes](#1-customer-flow--how-to-buy-passes)
2. [What Customers Receive](#2-what-customers-receive)
3. [Find My Passes](#3-find-my-passes)
4. [At the Venue — Gate Entry](#4-at-the-venue--gate-entry)
5. [Admin — Roles & Permissions](#5-admin--roles--permissions)
6. [Admin — Dashboard](#6-admin--dashboard)
7. [Admin — Managing Games](#7-admin--managing-games)
8. [Admin — Managing Pass Types](#8-admin--managing-pass-types)
9. [Admin — Orders](#9-admin--orders)
10. [Admin — Reports](#10-admin--reports)

---

## 1. Customer Flow — How to Buy Passes

### Step 1 — Browse Upcoming Games

The homepage lists all available games. Each game card shows the event name, venue, date, and a link to buy passes.

`[SCREENSHOT: Games listing page — /tickets]`

---

### Step 2 — Select a Game

Clicking a game opens the game detail page. The banner shows the event name, venue, and date in a scrolling marquee. Below it is the pass purchase panel.

`[SCREENSHOT: Game detail page with banner and pass panel — /tickets/[gameId]]`

---

### Step 3 — Choose Pass Types and Quantities

Each available pass type is shown as a card with its name, price, service fee, and remaining availability. Urgency badges (e.g. "Almost Sold Out") appear automatically based on stock levels.

- Tap a pass type card to add it to the cart.
- Once added, a quantity stepper appears — use **+** and **−** to adjust.
- Multiple pass types can be added in one checkout (e.g. 2× Single Day + 1× VIP).
- The grand total (passes + web service fees) updates live at the bottom.

`[SCREENSHOT: Pass type cards — one unselected (button style), one selected (stepper style)]`

`[SCREENSHOT: Cart summary showing multiple pass types and grand total]`

---

### Step 4 — Enter Buyer Details

Fill in:
- **Full Name**
- **Email Address** — passes and QR codes will be sent here
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

### On-Screen — Pass Cards

Once confirmed, each pass appears as a digital card showing:

| Field | Example |
|-------|---------|
| Pass Type | Single Day Pass |
| Validity | Single Day Pass / All Events Pass |
| Pass # | 1 / 3 |
| Date & Time | March 15, 2026, 10:00 AM |
| Total Paid | ₱1,500 |
| Pass No. | GH26-000042 |
| Venue | Ynares Center Antipolo |
| Pass Holder | Juan dela Cruz |
| QR Code | Unique per pass |

`[SCREENSHOT: Full pass card on success page]`

Customers can:
- **Download Pass** — saves the card as a PNG image (yellow button below each pass)
- **Save / Print** — exports all passes to print or save as PDF

`[SCREENSHOT: Download and Save/Print buttons]`

---

### By Email — Pass Confirmation

A confirmation email is sent to the buyer's email address containing all purchased passes in a single email. Each pass includes the event banner, pass details, and a QR code image.

**Subject:** `Your Global Hoops Passes – Order ORD-YYYYMMDD-XXXXX`

`[SCREENSHOT: Email pass layout — horizontal card with banner on left, details + QR on right]`

---

### By SMS — Order Confirmation

A short SMS is sent to the buyer's mobile number with the order number and event details for quick reference.

`[SCREENSHOT: SMS confirmation message]`

---

## 3. Find My Passes

Customers who lost or didn't save their passes can retrieve them at:

**`/tickets/find`**

Enter the **email address** and **phone number** used at checkout. All matching orders are returned, showing each pass's QR code and status.

- If a pass shows **"✓ Already scanned"**, it has been used at the gate.
- Rate limited to 10 lookups per 5 minutes per IP.

`[SCREENSHOT: Find My Passes form]`

`[SCREENSHOT: Find My Passes results — expanded order showing QR codes]`

---

## 4. At the Venue — Gate Entry

Guards use the Scanner app at **`/scanner`** — a full-screen PWA optimized for mobile.

### How scanning works

1. The guard opens the scanner on their phone/tablet.
2. The camera activates automatically and continuously scans for QR codes.
3. The customer presents their QR code (from email, download, or Find My Passes).
4. The scanner reads the QR and checks the pass against the database.
5. Guard can also enter a pass ID manually (e.g. `GH26-000001`) if the camera can't read the QR.

### Scan results

| Result | Meaning |
|--------|---------|
| **Valid — Entry Granted** (green) | Pass is active and has not been used. Entry granted. |
| **Already Used** (amber) | Pass was previously scanned. Deny entry. |
| **Pass not recognised** (red) | QR code not found in the system. Deny entry. |

**Pass type behavior:**
- **Single Day Pass** — marked as used on first scan. Will show "Already Used" on any subsequent scan.
- **VIP All Events Pass** — valid every day of the event. Each day registers a separate scan log. Cannot be reused on the same day.

`[SCREENSHOT: Scanner camera view]`

`[SCREENSHOT: Valid scan result screen]`

`[SCREENSHOT: Already used / invalid scan result screen]`

---

## 5. Admin — Roles & Permissions

There are three admin roles. Each role is assigned at account creation and controls what the user can see and do.

| Feature | `super_admin` | `admin` | `scanner` |
|---------|:---:|:---:|:---:|
| Dashboard (view games & stats) | ✅ | ✅ | — |
| Add / Edit / Delete games | ✅ | — | — |
| Create pass types | ✅ | — | — |
| Edit / deactivate pass types | ✅ | ✅ | — |
| View orders | ✅ | ✅ | — |
| Find passes (by name/email) | ✅ | — | — |
| View reports | ✅ | ✅ | — |
| Manage EOD recipients | ✅ | — | — |
| Manage teams | ✅ | — | — |
| Manage admin accounts | ✅ | — | — |
| Scan QR codes at gate | ✅ | ✅ | ✅ |

### Login

**URL:** `/admin/login`

All admin users log in with their email and password. The password field has a show/hide toggle. After login, the user is redirected to `/admin` (dashboard) or `/scanner` depending on their role.

---

## 6. Admin — Dashboard

**URL:** `/admin`
**Access:** All admin roles (except `scanner`). Login required at `/admin/login`.

The dashboard shows a live summary of all games:

### Stat Cards (top row)

| Card | Description |
|------|-------------|
| Total Revenue | Sum of all paid orders across all games |
| Passes Sold | Total passes issued across all games |
| Upcoming Games | Games whose end date is in the future |
| Trending Games | Upcoming games where ≥10% of capacity is sold |

`[SCREENSHOT: Admin dashboard stat cards]`

### Games Table

Lists every game with:
- Game name + "Upcoming" badge if still active
- Date range
- Venue
- Passes sold (with visual fill bar — green → yellow → red as it fills up)
- Passes remaining (turns red when sold out)
- Revenue
- Actions: **Edit**, **Delete** *(super_admin only)*, **Manage Passes** *(all roles)*

`[SCREENSHOT: Admin dashboard games table]`

The footer row shows totals across all games when more than one game exists.

---

## 7. Admin — Managing Games

> **super_admin only** — `admin` users cannot create, edit, or delete games.

### Create a New Game

**URL:** `/admin/games/new`

Fields:
- **Game Description** — e.g. `Letran vs San Beda | EAC vs Mapua`
- **Venue**
- **Start Date & Time**
- **End Date & Time** (can span multiple days for multi-day events)
- **Banner Image** — uploaded image shown on the pass and game detail page

`[SCREENSHOT: New game form]`

### Edit a Game

**URL:** `/admin/games/[gameId]/edit`

Same fields as creation. Changes apply immediately to the public listing.

`[SCREENSHOT: Edit game form]`

### Delete a Game

Triggered from the dashboard table. A confirmation prompt appears before deletion.

> Note: Deleting a game does not refund payments. Only delete games with no sold passes.

`[SCREENSHOT: Delete confirmation prompt]`

---

## 8. Admin — Managing Pass Types

**URL:** `/admin/games/[gameId]/tickets`
**Access:** All admin roles can view. `admin` can edit and deactivate. Only `super_admin` can create or delete.

Each game can have multiple pass types (e.g. Single Day, Family Pass, VIP).

### Pass Type Fields

| Field | Description |
|-------|-------------|
| **Name** | Display name (e.g. "Single Day Pass"). Preset suggestions are available. |
| **Validity** | **Single Day** — valid for one day only. **All Events (VIP)** — valid for every day of the event. |
| **Price (₱)** | Base pass price charged to the buyer. |
| **Service Fee (₱)** | Web service fee added on top of the price (set 0 if none). |
| **Capacity** | Maximum number of passes that can be sold. |
| **QRs / Purchase** | Number of individual QR codes generated per 1 purchase unit. Set to **5** for family passes. |

`[SCREENSHOT: Pass type table showing existing types with sold count and capacity]`

`[SCREENSHOT: Add pass types form — multiple rows]`

### Adding Multiple Types at Once

Click **+ Add another type** to add a second (or more) pass type row before saving. All rows are submitted together in one action.

### Editing a Pass Type

Click **Edit** on any active pass type row to open an inline edit panel below the table. Make changes and click **Save Changes**.

`[SCREENSHOT: Inline edit panel]`

### Deactivating / Deleting a Pass Type

- If a pass type has **passes sold**, it can only be **deactivated** (hidden from the public, no new purchases). Existing passes remain valid.
- If no passes have been sold and the user is a **super_admin**, the type can be fully **deleted**.

---

## 9. Admin — Orders

**URL:** `/admin/orders`
**Access:** `super_admin` and `admin`.

A searchable, paginated table of all paid orders.

### Search

Filter by: **order number**, **buyer name**, **email**, or **phone number**. The filtered result count and subtotal update live.

`[SCREENSHOT: Orders page with search bar]`

### Order Columns

| Column | Description |
|--------|-------------|
| Order # | Unique order ID (format: ORD-YYYYMMDD-XXXXX) |
| Buyer | Name, email, and phone |
| Game | Event name and venue |
| Pass Type | The type purchased |
| Qty | Number of purchase units |
| Amount | Total charged |
| Date | Date and time of purchase |

The footer row shows the total revenue for the current search result. Orders are paginated at **25 per page**; use the page controls at the bottom to navigate.

`[SCREENSHOT: Orders table with footer total]`

`[SCREENSHOT: Pagination controls]`

---

## 10. Admin — Reports

**URL:** `/admin/reports`

### Gate Reconciliation Report

**URL:** `/admin/reports/gate/[gameId]`

Available for all games. Shows a per-pass-type breakdown of:
- Passes sold
- Passes scanned (admitted)
- No-shows (sold but not scanned)
- Invalid scan attempts

Select a game from the reports page to view its reconciliation.

`[SCREENSHOT: Reports page — game list]`

`[SCREENSHOT: Gate reconciliation report for a specific game]`

### End of Day Report

Automatically emailed to configured recipients every day at **11:59 PM PHT** via a scheduled cron job. Contains:

- **Summary** — total revenue, passes sold, and transaction count for the day
- **Sales by Game** — revenue and passes sold per game
- **Sales by Pass Type** — revenue and quantity sold per pass type
- **Scans Today** — gate scan counts broken down by result:
  - **Valid** (green) — passes successfully admitted
  - **Already Used** (amber) — duplicate scan attempts
  - **Invalid** (red) — unrecognised QR codes
  - **Total** — sum of all scan attempts

A CSV attachment (`transactions-YYYY-MM-DD.csv`) with all individual orders is included.

No manual action is needed — the report runs automatically.

### Transaction Notification Emails

In addition to the nightly EOD report, **every confirmed purchase** triggers an immediate notification email to all active EOD recipients. This email includes:

- Game name and date
- Buyer name and email
- Passes purchased (type and quantity)
- Total amount paid
- Timestamp (Asia/Manila)

This allows recipients to monitor sales in real time throughout the day.

### EOD Report Recipients

**URL:** `/admin/reports/recipients`

Manage which email addresses receive both the daily EOD report and real-time transaction notifications.

- **Add** — enter an email address and click **+ Add**. Duplicate emails are rejected.
- **Remove** — click **Remove** next to an address, then confirm. The change takes effect immediately.

`[SCREENSHOT: EOD Recipients page — list with add form]`

---

## Admin Navigation Reference

| Page | URL | Access |
|------|-----|--------|
| Dashboard | `/admin` | all roles |
| New Game | `/admin/games/new` | super_admin |
| Edit Game | `/admin/games/[gameId]/edit` | super_admin |
| Manage Pass Types | `/admin/games/[gameId]/tickets` | all roles |
| Orders | `/admin/orders` | super_admin, admin |
| Find Passes | `/admin/tickets/find` | super_admin |
| Reports | `/admin/reports` | super_admin, admin |
| Gate Report | `/admin/reports/gate/[gameId]` | super_admin, admin |
| EOD Recipients | `/admin/reports/recipients` | super_admin |
| Teams | `/admin/teams` | super_admin |
| Admin Accounts | `/admin/admins` | super_admin |
| Login | `/admin/login` | all |
