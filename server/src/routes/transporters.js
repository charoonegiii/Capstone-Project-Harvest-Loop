const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrap, HttpError, num } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

// GET /api/transporters - available transporters (for assignment)
router.get(
  '/',
  requireRole('farmer', 'buyer', 'admin'),
  wrap(async (req, res) => {
    const minKg = Number(req.query.min_capacity_kg) || 0;
    const { rows } = await db.query(
      `SELECT t.id, t.vehicle_type, t.vehicle_number, t.capacity_kg, t.rate_per_km,
              t.base_location, t.is_available, u.name, u.phone
       FROM transporters t JOIN users u ON u.id = t.user_id
       WHERE u.is_active AND t.is_available AND t.capacity_kg >= $1
       ORDER BY t.rate_per_km NULLS LAST, t.capacity_kg DESC`,
      [minKg]
    );
    res.json({ transporters: rows });
  })
);

// GET /api/transporters/me
router.get(
  '/me',
  requireRole('transporter'),
  wrap(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM transporters WHERE user_id = $1', [req.user.id]);
    res.json({ transporter: rows[0] || null });
  })
);

// PUT /api/transporters/me
router.put(
  '/me',
  requireRole('transporter'),
  wrap(async (req, res) => {
    const b = req.body || {};
    if (b.capacity_kg !== undefined && !(Number(b.capacity_kg) > 0))
      throw new HttpError(400, 'Capacity must be a positive number.');
    const { rows } = await db.query(
      `UPDATE transporters SET
         vehicle_type = COALESCE($1, vehicle_type),
         vehicle_number = COALESCE($2, vehicle_number),
         capacity_kg = COALESCE($3, capacity_kg),
         rate_per_km = COALESCE($4, rate_per_km),
         base_location = COALESCE($5, base_location),
         is_available = COALESCE($6, is_available)
       WHERE user_id = $7 RETURNING *`,
      [
        b.vehicle_type || null,
        b.vehicle_number ?? null,
        b.capacity_kg !== undefined ? Math.round(Number(b.capacity_kg)) : null,
        num(b.rate_per_km),
        b.base_location ?? null,
        typeof b.is_available === 'boolean' ? b.is_available : null,
        req.user.id,
      ]
    );
    if (!rows[0]) throw new HttpError(404, 'Transporter profile not found.');
    res.json({ transporter: rows[0] });
  })
);

module.exports = router;
