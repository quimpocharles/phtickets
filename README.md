# Global Hoops Ticketing System

Full-stack platform for selling and managing basketball event passes. Fans browse upcoming games, select pass types, and pay via PayMongo. QR-coded passes are generated and delivered by email and SMS on payment confirmation. Gate staff scan QR codes at the venue. Admins manage games and view sales reports through a protected dashboard.

---

## Stack

| Layer | Technology |
|---|---|
| API | Node.js + Express 4 |
| Database | MongoDB Atlas (Mongoose 8) |
| Payment | PayMongo (hosted checkout) |
| Email | Resend API |
| SMS | Semaphore PH |
| Images | Cloudinary |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Hosting | Render (API) + Vercel (frontend) |

---

## Running Locally

### Backend
```bash
npm install --legacy-peer-deps
cp .env.example .env   # fill in values
npm run dev            # nodemon, port 3000
```

### Frontend
```bash
cd web
npm install --legacy-peer-deps
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL
npm run dev                        # port 3001
```

---

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `PAYMONGO_SECRET_KEY` | PayMongo secret key |
| `PAYMONGO_WEBHOOK_SECRET` | HMAC-SHA256 webhook signature key |
| `RESEND_API_KEY` | Resend API key (email) |
| `EMAIL_FROM` | Verified sender address |
| `JWT_SECRET` | Admin auth secret (32+ bytes) |
| `ALLOWED_ORIGIN` | Frontend domain (CORS) |
| `RENDER_EXTERNAL_URL` | Auto-set by Render — enables keep-alive ping |

See [DOCUMENTATION.md](./DOCUMENTATION.md#environment-variables) for the full list.

---

## Documentation

Full technical reference — architecture, data models, API endpoints, payment flow, and deployment notes — is in **[DOCUMENTATION.md](./DOCUMENTATION.md)**.
