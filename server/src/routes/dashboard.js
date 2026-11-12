const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { wrap, sqlQuintals } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

// Quantities are normalised to quintals (1 quintal = 100 kg) so mixed units add up.
// Earnings are ESTIMATES: recorded quantity x agreed price on bookings (no payment processing).
const Q = sqlQuintals('b.quantity', 'l.unit');

router.get(
  '/',
  wrap(async (req, res) => {
    const { role, id } = req.user;

    if (role === 'farmer') {
      const [listings, bookings, monthly, byType, offers] = await Promise.all([
        db.query(
          `SELECT COUNT(*) FILTER (WHERE status = 'active') AS active_listings,
                  COUNT(*) FILTER (WHERE status = 'sold') AS sold_out_listings,
                  COALESCE(SUM(${sqlQuintals('quantity', 'unit')}) FILTER (WHERE status <> 'removed'), 0) AS total_listed_q
           FROM listings WHERE farmer_id = $1`,
          [id]
        ),
        db.query(
          `SELECT
             COALESCE(SUM(${Q}) FILTER (WHERE b.status = 'delivered'), 0) AS quantity_sold_q,
             COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'delivered'), 0) AS earnings_completed,
             COALESCE(SUM(b.total_amount) FILTER (WHERE b.status IN ('requested','confirmed','transporter_assigned','picked_up')), 0) AS earnings_pending,
             COUNT(*) FILTER (WHERE b.status IN ('requested','confirmed','transporter_assigned','picked_up')) AS active_bookings,
             COUNT(*) FILTER (WHERE b.status = 'delivered') AS completed_deliveries,
             COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled
           FROM bookings b JOIN listings l ON l.id = b.listing_id WHERE b.farmer_id = $1`,
          [id]
        ),
        db.query(
          `SELECT to_char(date_trunc('month', b.updated_at), 'YYYY-MM') AS month,
                  SUM(b.total_amount) AS earnings, SUM(${Q}) AS quantity_q
           FROM bookings b JOIN listings l ON l.id = b.listing_id
           WHERE b.farmer_id = $1 AND b.status = 'delivered'
           GROUP BY 1 ORDER BY 1 DESC LIMIT 6`,
          [id]
        ),
        db.query(
          `SELECT l.residue_type, SUM(${Q}) AS quantity_q, SUM(b.total_amount) AS earnings
           FROM bookings b JOIN listings l ON l.id = b.listing_id
           WHERE b.farmer_id = $1 AND b.status = 'delivered' GROUP BY 1 ORDER BY 3 DESC`,
          [id]
        ),
        db.query(
          `SELECT COUNT(*) FILTER (WHERE o.status = 'pending') AS pending_offers
           FROM offers o JOIN listings l ON l.id = o.listing_id WHERE l.farmer_id = $1`,
          [id]
        ),
      ]);
      return res.json({
        role,
        stats: { ...listings.rows[0], ...bookings.rows[0], ...offers.rows[0] },
        monthly: monthly.rows.reverse(),
        byType: byType.rows,
      });
    }

    if (role === 'buyer') {
      const [stats, monthly, openOffers] = await Promise.all([
        db.query(
          `SELECT
             COALESCE(SUM(${Q}) FILTER (WHERE b.status = 'delivered'), 0) AS quantity_procured_q,
             COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'delivered'), 0) AS total_spent,
             COALESCE(SUM(b.total_amount) FILTER (WHERE b.status IN ('requested','confirmed','transporter_assigned','picked_up')), 0) AS committed,
             COUNT(*) FILTER (WHERE b.status IN ('requested','confirmed','transporter_assigned','picked_up')) AS active_bookings,
             COUNT(*) FILTER (WHERE b.status = 'delivered') AS completed_orders
           FROM bookings b JOIN listings l ON l.id = b.listing_id WHERE b.buyer_id = $1`,
          [id]
        ),
        db.query(
          `SELECT to_char(date_trunc('month', b.updated_at), 'YYYY-MM') AS month,
                  SUM(b.total_amount) AS earnings, SUM(${Q}) AS quantity_q
           FROM bookings b JOIN listings l ON l.id = b.listing_id
           WHERE b.buyer_id = $1 AND b.status = 'delivered'
           GROUP BY 1 ORDER BY 1 DESC LIMIT 6`,
          [id]
        ),
        db.query(
          `SELECT COUNT(*) FILTER (WHERE status = 'pending') AS pending_offers,
                  COUNT(*) FILTER (WHERE status = 'countered') AS counter_offers
           FROM offers WHERE buyer_id = $1`,
          [id]
        ),
      ]);
      return res.json({
        role,
        stats: { ...stats.rows[0], ...openOffers.rows[0] },
        monthly: monthly.rows.reverse(),
        byType: [],
      });
    }

    if (role === 'transporter') {
      const t = (await db.query('SELECT id FROM transporters WHERE user_id = $1', [id])).rows[0];
      const tid = t ? t.id : -1;
      const [stats, open, monthly] = await Promise.all([
        db.query(
          `SELECT
             COUNT(*) FILTER (WHERE b.status IN ('transporter_assigned','picked_up')) AS active_jobs,
             COUNT(*) FILTER (WHERE b.status = 'delivered') AS completed_jobs,
             COALESCE(SUM(${Q}) FILTER (WHERE b.status = 'delivered'), 0) AS quantity_moved_q,
             COALESCE(SUM(b.delivery_fee) FILTER (WHERE b.status = 'delivered'), 0) AS fees_earned,
             COALESCE(SUM(b.delivery_fee) FILTER (WHERE b.status IN ('transporter_assigned','picked_up')), 0) AS fees_pending
           FROM bookings b JOIN listings l ON l.id = b.listing_id WHERE b.transporter_id = $1`,
          [tid]
        ),
        db.query(`SELECT COUNT(*) AS open_jobs FROM bookings WHERE status = 'confirmed' AND transporter_id IS NULL`),
        db.query(
          `SELECT to_char(date_trunc('month', b.updated_at), 'YYYY-MM') AS month,
                  COALESCE(SUM(b.delivery_fee),0) AS earnings, SUM(${Q}) AS quantity_q
           FROM bookings b JOIN listings l ON l.id = b.listing_id
           WHERE b.transporter_id = $1 AND b.status = 'delivered'
           GROUP BY 1 ORDER BY 1 DESC LIMIT 6`,
          [tid]
        ),
      ]);
      return res.json({
        role,
        stats: { ...stats.rows[0], ...open.rows[0] },
        monthly: monthly.rows.reverse(),
        byType: [],
      });
    }

    // admin
    const [counts, gmv, byType] = await Promise.all([
      db.query(
        `SELECT
           (SELECT COUNT(*) FROM users WHERE role = 'farmer') AS farmers,
           (SELECT COUNT(*) FROM users WHERE role = 'buyer') AS buyers,
           (SELECT COUNT(*) FROM users WHERE role = 'transporter') AS transporters,
           (SELECT COUNT(*) FROM listings WHERE status = 'active') AS active_listings,
           (SELECT COUNT(*) FROM offers WHERE status IN ('pending','countered')) AS open_offers,
           (SELECT COUNT(*) FROM bookings WHERE status IN ('requested','confirmed','transporter_assigned','picked_up')) AS active_bookings,
           (SELECT COUNT(*) FROM bookings WHERE status = 'delivered') AS completed_deliveries`
      ),
      db.query(
        `SELECT COALESCE(SUM(${Q}),0) AS quantity_traded_q, COALESCE(SUM(b.total_amount),0) AS trade_value
         FROM bookings b JOIN listings l ON l.id = b.listing_id WHERE b.status = 'delivered'`
      ),
      db.query(
        `SELECT l.residue_type, SUM(${Q}) AS quantity_q, SUM(b.total_amount) AS earnings
         FROM bookings b JOIN listings l ON l.id = b.listing_id
         WHERE b.status = 'delivered' GROUP BY 1 ORDER BY 2 DESC`
      ),
    ]);
    res.json({ role, stats: { ...counts.rows[0], ...gmv.rows[0] }, monthly: [], byType: byType.rows });
  })
);

module.exports = router;
