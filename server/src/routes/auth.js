const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const { wrap, HttpError, num } = require('../utils/helpers');

const router = express.Router();
const SELF_REGISTER_ROLES = ['farmer', 'buyer', 'transporter'];
const BUYER_TYPES = ['compost', 'biomass', 'animal_feed', 'fertilizer', 'other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone,
  organization: u.organization,
  buyer_type: u.buyer_type,
  address: u.address,
  latitude: u.latitude,
  longitude: u.longitude,
});

async function fetchProfile(userId) {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!rows[0]) return null;
  const user = publicUser(rows[0]);
  if (user.role === 'transporter') {
    const t = await db.query('SELECT * FROM transporters WHERE user_id = $1', [userId]);
    user.transporter = t.rows[0] || null;
  }
  return user;
}

// POST /api/auth/register
router.post(
  '/register',
  wrap(async (req, res) => {
    const b = req.body || {};
    const name = (b.name || '').trim();
    const email = (b.email || '').trim().toLowerCase();
    const role = b.role;

    if (!name) throw new HttpError(400, 'Name is required.');
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'A valid email is required.');
    if (!b.password || b.password.length < 6)
      throw new HttpError(400, 'Password must be at least 6 characters.');
    if (!SELF_REGISTER_ROLES.includes(role))
      throw new HttpError(400, 'Role must be farmer, buyer or transporter.');
    if (role === 'buyer' && b.buyer_type && !BUYER_TYPES.includes(b.buyer_type))
      throw new HttpError(400, 'Invalid buyer type.');
    if (role === 'transporter') {
      if (!b.vehicle_type) throw new HttpError(400, 'Vehicle type is required for transporters.');
      if (!(Number(b.capacity_kg) > 0))
        throw new HttpError(400, 'Vehicle capacity (kg) must be a positive number.');
    }

    const exists = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rowCount) throw new HttpError(409, 'An account with this email already exists.');

    const hash = await bcrypt.hash(b.password, 10);
    const client = await db.pool.connect();
    let user;
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO users (name,email,password_hash,role,phone,organization,buyer_type,address,latitude,longitude)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          name,
          email,
          hash,
          role,
          b.phone || null,
          b.organization || null,
          role === 'buyer' ? b.buyer_type || null : null,
          b.address || null,
          num(b.latitude),
          num(b.longitude),
        ]
      );
      user = ins.rows[0];
      if (role === 'transporter') {
        await client.query(
          `INSERT INTO transporters (user_id,vehicle_type,vehicle_number,capacity_kg,rate_per_km,base_location)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            user.id,
            b.vehicle_type,
            b.vehicle_number || null,
            Math.round(Number(b.capacity_kg)),
            num(b.rate_per_km),
            b.address || null,
          ]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.status(201).json({ token: signToken(user), user: await fetchProfile(user.id) });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  wrap(async (req, res) => {
    const email = ((req.body && req.body.email) || '').trim().toLowerCase();
    const password = (req.body && req.body.password) || '';
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      throw new HttpError(401, 'Incorrect email or password.');
    if (!user.is_active) throw new HttpError(403, 'This account has been deactivated.');
    res.json({ token: signToken(user), user: await fetchProfile(user.id) });
  })
);

// GET /api/auth/me
router.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    res.json({ user: await fetchProfile(req.user.id) });
  })
);

// PUT /api/auth/me  (update profile)
router.put(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const b = req.body || {};
    if (b.buyer_type && !BUYER_TYPES.includes(b.buyer_type))
      throw new HttpError(400, 'Invalid buyer type.');
    await db.query(
      `UPDATE users SET
         name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         organization = COALESCE($3, organization),
         buyer_type = COALESCE($4, buyer_type),
         address = COALESCE($5, address),
         latitude = COALESCE($6, latitude),
         longitude = COALESCE($7, longitude)
       WHERE id = $8`,
      [
        b.name || null,
        b.phone ?? null,
        b.organization ?? null,
        b.buyer_type || null,
        b.address ?? null,
        num(b.latitude),
        num(b.longitude),
        req.user.id,
      ]
    );
    res.json({ user: await fetchProfile(req.user.id) });
  })
);

module.exports = router;
