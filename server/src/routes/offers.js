const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrap, HttpError } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

const OFFER_SELECT = `
  SELECT o.*,
         l.title AS listing_title, l.unit, l.residue_type, l.price_per_unit AS asking_price,
         l.quantity_left, l.farmer_id, l.location_text, l.photo_url,
         fu.name AS farmer_name, bu.name AS buyer_name, bu.organization AS buyer_org,
         b.id AS booking_id, b.status AS booking_status
  FROM offers o
  JOIN listings l ON l.id = o.listing_id
  JOIN users fu ON fu.id = l.farmer_id
  JOIN users bu ON bu.id = o.buyer_id
  LEFT JOIN bookings b ON b.offer_id = o.id`;

// GET /api/offers - role-aware list
router.get(
  '/',
  wrap(async (req, res) => {
    const { role, id } = req.user;
    let where = '';
    const params = [];
    if (role === 'buyer') {
      where = 'WHERE o.buyer_id = $1';
      params.push(id);
    } else if (role === 'farmer') {
      where = 'WHERE l.farmer_id = $1';
      params.push(id);
    } else if (role !== 'admin') {
      throw new HttpError(403, 'Transporters do not have offers.');
    }
    if (req.query.listing_id) {
      params.push(Number(req.query.listing_id));
      where += `${where ? ' AND' : 'WHERE'} o.listing_id = $${params.length}`;
    }
    const { rows } = await db.query(`${OFFER_SELECT} ${where} ORDER BY o.updated_at DESC`, params);
    res.json({ offers: rows });
  })
);

// POST /api/offers - buyer submits an offer
router.post(
  '/',
  requireRole('buyer'),
  wrap(async (req, res) => {
    const b = req.body || {};
    const listingId = Number(b.listing_id);
    const qty = Number(b.quantity);
    const price = Number(b.price_per_unit);
    if (!listingId) throw new HttpError(400, 'listing_id is required.');
    if (!(qty > 0)) throw new HttpError(400, 'Quantity must be greater than 0.');
    if (!(price >= 0)) throw new HttpError(400, 'Price must be a valid amount.');

    const l = (await db.query('SELECT * FROM listings WHERE id = $1', [listingId])).rows[0];
    if (!l || l.status !== 'active') throw new HttpError(404, 'This listing is no longer available.');
    if (qty > l.quantity_left)
      throw new HttpError(400, `Only ${l.quantity_left} ${l.unit} is currently available.`);

    const open = await db.query(
      `SELECT 1 FROM offers WHERE listing_id = $1 AND buyer_id = $2 AND status IN ('pending','countered')`,
      [listingId, req.user.id]
    );
    if (open.rowCount)
      throw new HttpError(409, 'You already have an open offer on this listing. Withdraw it first to make a new one.');

    const { rows } = await db.query(
      `INSERT INTO offers (listing_id,buyer_id,quantity,price_per_unit,message)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [listingId, req.user.id, qty, price, b.message || null]
    );
    const full = await db.query(`${OFFER_SELECT} WHERE o.id = $1`, [rows[0].id]);
    res.status(201).json({ offer: full.rows[0] });
  })
);

// Turn an agreed offer into a booking (runs inside a transaction)
async function acceptOffer(client, offer, qty, price, actorId) {
  const l = (
    await client.query('SELECT * FROM listings WHERE id = $1 FOR UPDATE', [offer.listing_id])
  ).rows[0];
  if (!l || l.status !== 'active') throw new HttpError(409, 'This listing is no longer available.');
  if (qty > l.quantity_left)
    throw new HttpError(409, `Only ${l.quantity_left} ${l.unit} is left on this listing.`);

  const buyer = (await client.query('SELECT address FROM users WHERE id = $1', [offer.buyer_id])).rows[0];
  await client.query(`UPDATE offers SET status = 'accepted', updated_at = NOW() WHERE id = $1`, [offer.id]);

  const total = Math.round(qty * price * 100) / 100;
  const booking = (
    await client.query(
      `INSERT INTO bookings
        (offer_id,listing_id,farmer_id,buyer_id,quantity,agreed_price,total_amount,pickup_address,delivery_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [offer.id, l.id, l.farmer_id, offer.buyer_id, qty, price, total, l.location_text, buyer.address]
    )
  ).rows[0];

  const left = l.quantity_left - qty;
  await client.query(
    `UPDATE listings SET quantity_left = $1, status = $2, updated_at = NOW() WHERE id = $3`,
    [left, left > 0 ? 'active' : 'sold', l.id]
  );
  await client.query(
    `INSERT INTO booking_events (booking_id,status,note,actor_id) VALUES ($1,'requested',$2,$3)`,
    [booking.id, `Offer accepted: ${qty} ${l.unit} at ₹${price}/${l.unit}. Pickup requested.`, actorId]
  );
  return booking;
}

async function inTransaction(fn) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// POST /api/offers/:id/respond - farmer: accept | reject | counter
router.post(
  '/:id(\\d+)/respond',
  requireRole('farmer'),
  wrap(async (req, res) => {
    const { action, counter_price, counter_quantity, counter_message } = req.body || {};
    if (!['accept', 'reject', 'counter'].includes(action))
      throw new HttpError(400, 'action must be accept, reject or counter.');

    const result = await inTransaction(async (client) => {
      const offer = (
        await client.query(
          `SELECT o.*, l.farmer_id, l.quantity_left, l.unit FROM offers o
           JOIN listings l ON l.id = o.listing_id WHERE o.id = $1 FOR UPDATE OF o`,
          [req.params.id]
        )
      ).rows[0];
      if (!offer) throw new HttpError(404, 'Offer not found.');
      if (offer.farmer_id !== req.user.id) throw new HttpError(403, 'This offer is not on your listing.');
      if (offer.status !== 'pending')
        throw new HttpError(409, `This offer is already ${offer.status}.`);

      if (action === 'accept') {
        const booking = await acceptOffer(client, offer, offer.quantity, offer.price_per_unit, req.user.id);
        return { booking_id: booking.id };
      }
      if (action === 'reject') {
        await client.query(`UPDATE offers SET status = 'rejected', counter_message = $2, updated_at = NOW() WHERE id = $1`, [
          offer.id,
          counter_message || null,
        ]);
        return {};
      }
      // counter
      const cp = Number(counter_price);
      const cq = counter_quantity ? Number(counter_quantity) : offer.quantity;
      if (!(cp >= 0) || counter_price === undefined || counter_price === '')
        throw new HttpError(400, 'A counter price is required.');
      if (!(cq > 0)) throw new HttpError(400, 'Counter quantity must be greater than 0.');
      if (cq > offer.quantity_left)
        throw new HttpError(400, `Only ${offer.quantity_left} ${offer.unit} is available.`);
      await client.query(
        `UPDATE offers SET status = 'countered', counter_price = $2, counter_quantity = $3,
           counter_message = $4, updated_at = NOW() WHERE id = $1`,
        [offer.id, cp, cq, counter_message || null]
      );
      return {};
    });

    const full = await db.query(`${OFFER_SELECT} WHERE o.id = $1`, [req.params.id]);
    res.json({ offer: full.rows[0], ...result });
  })
);

// POST /api/offers/:id/buyer-respond - buyer: accept | reject a counter-offer
router.post(
  '/:id(\\d+)/buyer-respond',
  requireRole('buyer'),
  wrap(async (req, res) => {
    const { action } = req.body || {};
    if (!['accept', 'reject'].includes(action))
      throw new HttpError(400, 'action must be accept or reject.');

    const result = await inTransaction(async (client) => {
      const offer = (
        await client.query('SELECT * FROM offers WHERE id = $1 FOR UPDATE', [req.params.id])
      ).rows[0];
      if (!offer) throw new HttpError(404, 'Offer not found.');
      if (offer.buyer_id !== req.user.id) throw new HttpError(403, 'This is not your offer.');
      if (offer.status !== 'countered')
        throw new HttpError(409, 'There is no counter-offer to respond to.');
      if (action === 'reject') {
        await client.query(`UPDATE offers SET status = 'rejected', updated_at = NOW() WHERE id = $1`, [offer.id]);
        return {};
      }
      const booking = await acceptOffer(client, offer, offer.counter_quantity, offer.counter_price, req.user.id);
      return { booking_id: booking.id };
    });

    const full = await db.query(`${OFFER_SELECT} WHERE o.id = $1`, [req.params.id]);
    res.json({ offer: full.rows[0], ...result });
  })
);

// POST /api/offers/:id/withdraw - buyer withdraws an open offer
router.post(
  '/:id(\\d+)/withdraw',
  requireRole('buyer'),
  wrap(async (req, res) => {
    const o = (await db.query('SELECT * FROM offers WHERE id = $1', [req.params.id])).rows[0];
    if (!o) throw new HttpError(404, 'Offer not found.');
    if (o.buyer_id !== req.user.id) throw new HttpError(403, 'This is not your offer.');
    if (!['pending', 'countered'].includes(o.status))
      throw new HttpError(409, `This offer is already ${o.status}.`);
    await db.query(`UPDATE offers SET status = 'withdrawn', updated_at = NOW() WHERE id = $1`, [o.id]);
    const full = await db.query(`${OFFER_SELECT} WHERE o.id = $1`, [o.id]);
    res.json({ offer: full.rows[0] });
  })
);

module.exports = router;
