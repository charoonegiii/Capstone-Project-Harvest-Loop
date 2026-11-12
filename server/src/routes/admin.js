const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrap, HttpError } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// GET /api/admin/users?role=
router.get(
  '/users',
  wrap(async (req, res) => {
    const params = [];
    let where = '';
    if (req.query.role) {
      params.push(req.query.role);
      where = 'WHERE role = $1';
    }
    const { rows } = await db.query(
      `SELECT id,name,email,role,phone,organization,address,is_active,created_at
       FROM users ${where} ORDER BY created_at DESC`,
      params
    );
    res.json({ users: rows });
  })
);

// POST /api/admin/users/:id/active  { active: true|false }
router.post(
  '/users/:id(\\d+)/active',
  wrap(async (req, res) => {
    if (Number(req.params.id) === req.user.id)
      throw new HttpError(400, 'You cannot deactivate your own account.');
    const active = !!(req.body && req.body.active);
    const { rows } = await db.query(
      'UPDATE users SET is_active = $2 WHERE id = $1 RETURNING id,name,role,is_active',
      [req.params.id, active]
    );
    if (!rows[0]) throw new HttpError(404, 'User not found.');
    res.json({ user: rows[0] });
  })
);

// GET /api/admin/listings - all listings for moderation
router.get(
  '/listings',
  wrap(async (req, res) => {
    const { rows } = await db.query(
      `SELECT l.id,l.title,l.residue_type,l.quantity,l.quantity_left,l.unit,l.price_per_unit,
              l.status,l.location_text,l.created_at,u.name AS farmer_name
       FROM listings l JOIN users u ON u.id = l.farmer_id ORDER BY l.created_at DESC`
    );
    res.json({ listings: rows });
  })
);

// GET /api/admin/bookings
router.get(
  '/bookings',
  wrap(async (req, res) => {
    const { rows } = await db.query(
      `SELECT b.id,b.status,b.quantity,b.agreed_price,b.total_amount,b.created_at,
              l.title AS listing_title,l.unit,fu.name AS farmer_name,bu.name AS buyer_name
       FROM bookings b JOIN listings l ON l.id = b.listing_id
       JOIN users fu ON fu.id = b.farmer_id JOIN users bu ON bu.id = b.buyer_id
       ORDER BY b.created_at DESC`
    );
    res.json({ bookings: rows });
  })
);

module.exports = router;
