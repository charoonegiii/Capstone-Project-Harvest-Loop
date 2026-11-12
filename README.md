# HarvestLoop: Crop Waste to Wealth Marketplace

A three-sided marketplace where **farmers** list crop residue, **buyers** (compost makers, biomass plants,
animal-feed producers) search, negotiate and book pickups, and **transporters** collect and deliver the material.
Built as a full-stack capstone project for Chandigarh University, following the project synopsis.

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Frontend | React 18 (Vite), React Router, Leaflet maps     |
| Backend  | Node.js + Express REST API, JWT auth            |
| Database | PostgreSQL (relational, with FK/CHECK constraints) |
| Maps     | Leaflet + OpenStreetMap tiles (no API key needed) |

## Features (mapped to the synopsis modules)

1. **Registration & role management**: farmer, buyer, transporter (self-register) and admin (seeded). Passwords are bcrypt-hashed; sessions use JWT; every API route enforces role-based access.
2. **Farmer residue listing**: type, quantity and unit (kg/quintal/tonne), price, photo upload, approximate location with map pin, availability date; edit, mark sold, remove.
3. **Buyer search & discovery**: filter by type, text, minimum quantity, max price, availability date, and distance from a chosen city or your GPS location; list or map view.
4. **Offers & negotiation**: buyer offers, farmer accepts / rejects / counters, buyer accepts or declines the counter. The agreed price and quantity are stored on the booking.
5. **Pickup booking & transporter assignment**: accepting an offer creates a booking and reserves stock; the farmer confirms a pickup date; a transporter is assigned by the farmer/buyer or accepts the job from the open-jobs board (vehicle capacity is checked).
6. **Delivery tracking**: requested → confirmed → transporter assigned → picked up → delivered (or cancelled), with a timeline, optional GPS point per update, and a route map. Cancelling releases the reserved material back to the listing.
7. **Dashboards & reports**: role-specific stats. Farmer: quantity sold, estimated earnings, pending value, monthly earnings, earnings by residue type. Buyer: spend and procurement. Transporter: jobs and delivery fees. Admin: platform totals, user/listing/booking management.

### Scope notes (as stated in the synopsis)

- Earnings are **estimates** = recorded quantity x agreed price on delivered bookings. No payments are processed.
- No environmental-impact figures are shown because no validated calculation method is implemented.
- Distances are straight-line (haversine) estimates, not road routes; delivery fees are `distance x rate per km`.
- HarvestLoop is a coordination tool, not a guarantee of material quality, legal compliance or environmental outcome.

## Project structure

```
harvestloop/
├── database/schema.sql        # PostgreSQL schema (6 tables)
├── server/                    # Express API
│   └── src/
│       ├── index.js           # app setup, static serving, error handler
│       ├── db.js              # pg pool
│       ├── middleware/auth.js # JWT + role checks
│       ├── routes/            # auth, listings, offers, bookings, transporters, dashboard, admin
│       └── utils/             # initDb.js, seed.js, smokeTest.js, helpers.js
└── client/                    # React app (Vite)
    └── src/ pages/, components/, api.js, auth.jsx
```

### Database tables

`users` · `transporters` · `listings` · `offers` · `bookings` · `booking_events`

## Setup

**Prerequisites:** Node.js 18+ and PostgreSQL 13+.

```bash
# 1. Backend
cd server
cp .env.example .env          # edit DATABASE_URL (and JWT_SECRET) for your PostgreSQL
npm install
npm run db:reset              # creates the database, applies schema, loads demo data
npm run dev                   # API on http://localhost:5000

# 2. Frontend (new terminal)
cd client
npm install
npm run dev                   # app on http://localhost:5173 (proxies /api to :5000)
```

`DATABASE_URL` format: `postgresql://USER:PASSWORD@localhost:5432/harvestloop`

### Single-server mode

```bash
cd client && npm run build     # creates client/dist
cd ../server && npm start      # serves the API and the built app on http://localhost:5000
```

### Demo accounts (password: `password123`)

| Role        | Email                          |
|-------------|--------------------------------|
| Farmer      | farmer1@harvestloop.test       |
| Buyer       | buyer1@harvestloop.test        |
| Buyer       | buyer2@harvestloop.test        |
| Transporter | transporter1@harvestloop.test  |
| Admin       | admin@harvestloop.test         |

The seed data includes listings across Punjab, a pending offer, a counter-offer, and bookings in the
requested / confirmed / delivered states so every dashboard has something to show.

### Suggested demo walkthrough

1. Log in as **buyer1**, open *Find residue*, filter "near Ludhiana", and send an offer.
2. Log in as **farmer1**, open *Offers*, counter or accept it. Open the new booking and confirm a pickup date.
3. Log in as **transporter1**, open *Open jobs*, accept the job, then mark it picked up and delivered.
4. Check the farmer and buyer dashboards for updated quantities and earnings.

## API overview

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET/PUT /api/auth/me` |
| Listings | `GET /api/listings` (filters), `GET /api/listings/mine`, `GET/PUT/DELETE /api/listings/:id`, `POST /api/listings` |
| Offers | `GET/POST /api/offers`, `POST /api/offers/:id/respond`, `/buyer-respond`, `/withdraw` |
| Bookings | `GET /api/bookings`, `GET /api/bookings/open-jobs`, `GET /api/bookings/:id`, `POST .../confirm`, `/assign`, `/accept-job`, `/status`, `/cancel` |
| Transporters | `GET /api/transporters`, `GET/PUT /api/transporters/me` |
| Dashboard | `GET /api/dashboard` (role-aware) |
| Admin | `GET /api/admin/users`, `POST /api/admin/users/:id/active`, `GET /api/admin/listings`, `GET /api/admin/bookings` |

Search query parameters: `q, type, minQty, maxPrice, availableBy, lat, lng, radius, sort`.

## Testing

```bash
cd server
npm run db:reset
npm test        # 40+ end-to-end API checks: auth, RBAC, negotiation, booking flow, stock, dashboards
```

## Future scope (from the synopsis)

PWA / Android app, local-language support, demand forecasting and price suggestions, verified profiles and ratings,
digital payments and invoices, weighing/pickup evidence, and validated residue-diversion estimates.
