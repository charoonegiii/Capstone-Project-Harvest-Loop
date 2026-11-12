const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrap, HttpError, haversineKm, toKg } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

const BOOKING_SELECT = `
  SELECT b.*,
    l.title AS listing_title, l.unit, l.residue_type, l.photo_url,
    l.location_text, l.latitude AS pickup_lat, l.longitude AS pickup_lng,
    fu.name AS farmer_name, fu.phone AS farmer_phone,
    bu.name AS buyer_name, bu.organization AS buyer_org, bu.phone AS buyer_phone,
    bu.latitude AS drop_lat, bu.longitude AS drop_lng,
    t.user_id AS transporter_user_id, tu.name AS transporter_name, tu.phone AS transporter_phone,
    t.vehicle_type, t.vehicle_number, t.capacity_kg, t.rate_per_km
  FROM bookings b
  JOIN listings l ON l.id = b.listing_id
  JOIN users fu ON fu.id = b.farmer_id
  JOIN users bu ON bu.id = b.buyer_id
  LEFT JOIN transporters t ON t.id = b.transporter_id
  LEFT JOIN users tu ON tu.id = t.user_id`;

async function transporterIdForUser(userId) {
  const r = await db.query('SELECT id FROM transporters WHERE user_id = $1', [userId]);
  return r.rows[0] ? r.rows[0].id : null;
}

async function getBooking(id) {
  const b = (await db.query(`${BOOKING_SELECT} WHERE b.id = $1`, [id])).rows[0];
  if (!b) throw new HttpError(404, 'Booking not found.');
  return b;
}

function canView(user, b) {
  if (user.role === 'admin') return true;
  if (user.role === 'farmer') return b.farmer_id === user.id;
  if (user.role === 'buyer') return b.buyer_id === user.id;
  if (user.role === 'transporter')
    return b.transporter_user_id === user.id || (b.status === 'confirmed' && !b.transporter_id);
  return false;
}

async function addEvent(client, bookingId, status, note, actorId, lat, lng) {
  await client.query(
    `INSERT INTO booking_events (booking_id,status,note,actor_id,latitude,longitude)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [bookingId, status, note || null, actorId, lat ?? null, lng ?? null]
  );
}

async function inTransaction(fn) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// GET /api/bookings - role-aware list
router.get(
  '/',
  wrap(async (req, res) => {
    const { role, id } = req.user;
    const params = [];
    const where = [];
    if (role === 'farmer') {
      params.push(id);
      where.push(`b.farmer_id = $${params.length}`);
    } else if (role === 'buyer') {
      params.push(id);
      where.push(`b.buyer_id = $${params.length}`);
    } else if (role === 'transporter') {
      params.push(id);
      where.push(`t.user_id = $${params.length}`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      where.push(`b.status = $${params.length}`);
    }
    const { rows } = await db.query(
      `${BOOKING_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY b.updated_at DESC`,
      params
    );
    res.json({ bookings: rows });
  })
);

// GET /api/bookings/open-jobs - confirmed bookings waiting for a transporter
router.get(
  '/open-jobs',
  requireRole('transporter', 'admin'),
  wrap(async (req, res) => {
    const { rows } = await db.query(
      `${BOOKING_SELECT} WHERE b.status = 'confirmed' AND b.transporter_id IS NULL ORDER BY b.pickup_date NULLS LAST, b.created_at`
    );
    let capacity = null;
    let me = null;
    if (req.user.role === 'transporter') {
      me = (await db.query('SELECT * FROM transporters WHERE user_id = $1', [req.user.id])).rows[0];
      capacity = me ? me.capacity_kg : null;
    }
    const jobs = rows.map((b) => ({
      ...b,
      quantity_kg: toKg(b.quantity, b.unit),
      distance_km: haversineKm(b.pickup_lat, b.pickup_lng, b.drop_lat, b.drop_lng),
      fits_vehicle: capacity === null ? null : toKg(b.quantity, b.unit) <= capacity,
    }));
    res.json({ jobs });
  })
);

// GET /api/bookings/:id
router.get(
  '/:id(\\d+)',
  wrap(async (req, res) => {
    const b = await getBooking(req.params.id);
    if (!canView(req.user, b)) throw new HttpError(403, 'You cannot view this booking.');
    const events = (
      await db.query(
        `SELECT e.*, u.name AS actor_name FROM booking_events e
         LEFT JOIN users u ON u.id = e.actor_id
         WHERE e.booking_id = $1 ORDER BY e.created_at, e.id`,
        [b.id]
      )
    ).rows;
    res.json({
      booking: { ...b, distance_km: haversineKm(b.pickup_lat, b.pickup_lng, b.drop_lat, b.drop_lng) },
      events,
    });
  })
);

// POST /api/bookings/:id/confirm - farmer confirms pickup details
router.post(
  '/:id(\\d+)/confirm',
  requireRole('farmer'),
  wrap(async (req, res) => {
    const b = await getBooking(req.params.id);
    if (b.farmer_id !== req.user.id) throw new HttpError(403, 'This is not your booking.');
    if (b.status !== 'requested') throw new HttpError(409, `Booking is already ${b.status}.`);
    const { pickup_date, pickup_address, delivery_address } = req.body || {};
    if (!pickup_date) throw new HttpError(400, 'Pickup date is required.');
    const d = new Date(pickup_date);
    if (isNaN(d)) throw new HttpError(400, 'Invalid pickup date.');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) throw new HttpError(400, 'Pickup date cannot be in the past.');

    await inTransaction(async (client) => {
      await client.query(
        `UPDATE bookings SET status = 'confirmed', pickup_date = $2,
           pickup_address = COALESCE($3, pickup_address),
           delivery_address = COALESCE($4, delivery_address), updated_at = NOW()
         WHERE id = $1`,
        [b.id, pickup_date, pickup_address || null, delivery_address || null]
      );
      await addEvent(client, b.id, 'confirmed', `Pickup confirmed for ${pickup_date}.`, req.user.id);
    });
    res.json({ booking: await getBooking(b.id) });
  })
);

// Shared assignment logic
async function assignTransporter(booking, transporterId, actor) {
  if (booking.status !== 'confirmed')
    throw new HttpError(409, 'A transporter can only be assigned to a confirmed booking.');
  const t = (
    await db.query(
      `SELECT t.*, u.name FROM transporters t JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
      [transporterId]
    )
  ).rows[0];
  if (!t) throw new HttpError(404, 'Transporter not found.');
  if (!t.is_available) throw new HttpError(409, 'This transporter is not currently available.');
  const kg = toKg(booking.quantity, booking.unit);
  if (kg > t.capacity_kg)
    throw new HttpError(400, `Load is ${kg} kg but this vehicle carries up to ${t.capacity_kg} kg.`);

  const km = haversineKm(booking.pickup_lat, booking.pickup_lng, booking.drop_lat, booking.drop_lng);
  const fee = km !== null && t.rate_per_km !== null ? Math.round(km * t.rate_per_km * 100) / 100 : null;

  await inTransaction(async (client) => {
    await client.query(
      `UPDATE bookings SET transporter_id = $2, status = 'transporter_assigned',
         delivery_fee = $3, updated_at = NOW() WHERE id = $1 AND status = 'confirmed'`,
      [booking.id, t.id, fee]
    );
    await addEvent(
      client,
      booking.id,
      'transporter_assigned',
      `${t.name} (${t.vehicle_type}) assigned${fee !== null ? `; estimated delivery fee ₹${fee}` : ''}.`,
      actor.id
    );
  });
}

// POST /api/bookings/:id/assign - farmer or buyer selects a transporter
router.post(
  '/:id(\\d+)/assign',
  requireRole('farmer', 'buyer'),
  wrap(async (req, res) => {
    const b = await getBooking(req.params.id);
    if (!canView(req.user, b)) throw new HttpError(403, 'This is not your booking.');
    const tid = Number(req.body && req.body.transporter_id);
    if (!tid) throw new HttpError(400, 'transporter_id is required.');
    await assignTransporter(b, tid, req.user);
    res.json({ booking: await getBooking(b.id) });
  })
);

// POST /api/bookings/:id/accept-job - transporter self-assigns an open job
router.post(
  '/:id(\\d+)/accept-job',
  requireRole('transporter'),
  wrap(async (req, res) => {
    const b = await getBooking(req.params.id);
    const tid = await transporterIdForUser(req.user.id);
    if (!tid) throw new HttpError(400, 'Complete your vehicle profile first.');
    await assignTransporter(b, tid, req.user);
    res.json({ booking: await getBooking(b.id) });
  })
);

// POST /api/bookings/:id/status - transporter updates picked_up / delivered
router.post(
  '/:id(\\d+)/status',
  requireRole('transporter', 'admin'),
  wrap(async (req, res) => {
    const b = await getBooking(req.params.id);
    if (req.user.role === 'transporter' && b.transporter_user_id !== req.user.id)
      throw new HttpError(403, 'This job is not assigned to you.');
    const { status, note, latitude, longitude } = req.body || {};
    const flow = { picked_up: 'transporter_assigned', delivered: 'picked_up' };
    if (!flow[status]) throw new HttpError(400, 'Status must be picked_up or delivered.');
    if (b.status !== flow[status])
      throw new HttpError(409, `Cannot mark as ${status} while booking is ${b.status}.`);

    await inTransaction(async (client) => {
      await client.query(`UPDATE bookings SET status = $2, updated_at = NOW() WHERE id = $1`, [b.id, status]);
      await addEvent(
        client,
        b.id,
        status,
        note || (status === 'picked_up' ? 'Material picked up from farm.' : 'Material delivered to buyer.'),
        req.user.id,
        latitude ? Number(latitude) : null,
        longitude ? Number(longitude) : null
      );
    });
    res.json({ booking: await getBooking(b.id) });
  })
);

// POST /api/bookings/:id/cancel
router.post(
  '/:id(\\d+)/cancel',
  requireRole('farmer', 'buyer', 'admin'),
  wrap(async (req, res) => {
    const b = await getBooking(req.params.id);
    if (!canView(req.user, b)) throw new HttpError(403, 'This is not your booking.');
    if (!['requested', 'confirmed', 'transporter_assigned'].includes(b.status))
      throw new HttpError(409, `A booking that is ${b.status} cannot be cancelled.`);

    await inTransaction(async (client) => {
      await client.query(`UPDATE bookings SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [b.id]);
      // release the reserved material back to the listing
      await client.query(
        `UPDATE listings SET quantity_left = quantity_left + $2,
           status = CASE WHEN status = 'sold' THEN 'active' ELSE status END, updated_at = NOW()
         WHERE id = $1`,
        [b.listing_id, b.quantity]
      );
      await addEvent(
        client,
        b.id,
        'cancelled',
        `Cancelled by ${req.user.role}${req.body && req.body.reason ? `: ${req.body.reason}` : '.'}`,
        req.user.id
      );
    });
    res.json({ booking: await getBooking(b.id) });
  })
);

module.exports = router;
