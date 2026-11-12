-- HarvestLoop database schema (PostgreSQL)
-- Run: psql -d harvestloop -f database/schema.sql

DROP TABLE IF EXISTS booking_events CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS offers CASCADE;
DROP TABLE IF EXISTS listings CASCADE;
DROP TABLE IF EXISTS transporters CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users: farmers, buyers, transporters, admins
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('farmer','buyer','transporter','admin')),
  phone         VARCHAR(30),
  organization  VARCHAR(160),          -- e.g. compost plant / biomass plant (buyers)
  buyer_type    VARCHAR(30),           -- compost | biomass | animal_feed | fertilizer | other
  address       VARCHAR(255),
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transporter details (one row per transporter user)
CREATE TABLE transporters (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type      VARCHAR(60) NOT NULL,
  vehicle_number    VARCHAR(30),
  capacity_kg       INTEGER NOT NULL CHECK (capacity_kg > 0),
  rate_per_km       NUMERIC(8,2) CHECK (rate_per_km >= 0),
  base_location     VARCHAR(160),
  is_available      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Residue listings created by farmers
CREATE TABLE listings (
  id             SERIAL PRIMARY KEY,
  farmer_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          VARCHAR(160) NOT NULL,
  residue_type   VARCHAR(40)  NOT NULL
                 CHECK (residue_type IN ('paddy_straw','wheat_straw','sugarcane_residue','cotton_stalk','maize_stalk','mustard_stalk','rice_husk','other')),
  description    TEXT,
  quantity       NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  quantity_left  NUMERIC(12,2) NOT NULL CHECK (quantity_left >= 0),
  unit           VARCHAR(10)  NOT NULL DEFAULT 'quintal' CHECK (unit IN ('kg','quintal','tonne')),
  price_per_unit NUMERIC(10,2) NOT NULL CHECK (price_per_unit >= 0),
  photo_url      TEXT,
  location_text  VARCHAR(255) NOT NULL,   -- approximate location (village / district)
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  available_from DATE NOT NULL DEFAULT CURRENT_DATE,
  status         VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','removed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_listings_status_type ON listings(status, residue_type);
CREATE INDEX idx_listings_farmer ON listings(farmer_id);

-- Offers / counter-offers (negotiation)
CREATE TABLE offers (
  id               SERIAL PRIMARY KEY,
  listing_id       INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quantity         NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  price_per_unit   NUMERIC(10,2) NOT NULL CHECK (price_per_unit >= 0),
  message          TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','countered','accepted','rejected','withdrawn')),
  counter_quantity NUMERIC(12,2) CHECK (counter_quantity > 0),
  counter_price    NUMERIC(10,2) CHECK (counter_price >= 0),
  counter_message  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_offers_listing ON offers(listing_id);
CREATE INDEX idx_offers_buyer ON offers(buyer_id);

-- Bookings (pickup + delivery) created once an offer is accepted
CREATE TABLE bookings (
  id               SERIAL PRIMARY KEY,
  offer_id         INTEGER NOT NULL UNIQUE REFERENCES offers(id) ON DELETE CASCADE,
  listing_id       INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  farmer_id        INTEGER NOT NULL REFERENCES users(id),
  buyer_id         INTEGER NOT NULL REFERENCES users(id),
  transporter_id   INTEGER REFERENCES transporters(id),
  quantity         NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  agreed_price     NUMERIC(10,2) NOT NULL CHECK (agreed_price >= 0),
  total_amount     NUMERIC(14,2) NOT NULL,
  pickup_date      DATE,
  pickup_address   VARCHAR(255),
  delivery_address VARCHAR(255),
  delivery_fee     NUMERIC(10,2) CHECK (delivery_fee >= 0),
  status           VARCHAR(30) NOT NULL DEFAULT 'requested'
                   CHECK (status IN ('requested','confirmed','transporter_assigned','picked_up','delivered','cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_transporter ON bookings(transporter_id);

-- Status history / tracking timeline
CREATE TABLE booking_events (
  id          SERIAL PRIMARY KEY,
  booking_id  INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status      VARCHAR(30) NOT NULL,
  note        TEXT,
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  actor_id    INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_events_booking ON booking_events(booking_id, created_at);
