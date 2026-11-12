const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');
const { wrap, HttpError, haversineKm, RESIDUE_TYPES, UNITS, num } = require('../utils/helpers');

const router = express.Router();

// ---- photo upload (stored on local disk in /uploads) ----
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `listing-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, 'Only JPG, PNG, WEBP or GIF images are allowed.'));
  },
});

const SELECT = `
  SELECT l.*, u.name AS farmer_name, u.organization AS farmer_org
  FROM listings l JOIN users u ON u.id = l.farmer_id`;

// GET /api/listings  - public search & filter
// query: q, type, minQty, maxPrice, availableBy, lat, lng, radius, sort, includeAll
router.get(
  '/',
  wrap(async (req, res) => {
    const { q, type, minQty, maxPrice, availableBy, lat, lng, radius, sort } = req.query;
    const where = [`l.status = 'active'`, `l.quantity_left > 0`];
    const params = [];
    const add = (sql, v) => {
      params.push(v);
      where.push(sql.replace('?', `$${params.length}`));
    };

    if (type) {
      if (!RESIDUE_TYPES.includes(type)) throw new HttpError(400, 'Unknown residue type.');
      add('l.residue_type = ?', type);
    }
    if (q) {
      params.push(`%${q}%`);
      const n = `$${params.length}`;
      where.push(`(l.title ILIKE ${n} OR l.location_text ILIKE ${n} OR l.description ILIKE ${n})`);
    }
    if (minQty && Number(minQty) > 0) add('l.quantity_left >= ?', Number(minQty));
    if (maxPrice && Number(maxPrice) >= 0) add('l.price_per_unit <= ?', Number(maxPrice));
    if (availableBy) add('l.available_from <= ?', availableBy);

    const sql = `${SELECT} WHERE ${where.join(' AND ')}`;
    const { rows } = await db.query(sql, params);

    let out = rows;
    const hasPoint = lat !== undefined && lng !== undefined && lat !== '' && lng !== '';
    if (hasPoint) {
      out = out.map((l) => ({
        ...l,
        distance_km: haversineKm(Number(lat), Number(lng), l.latitude, l.longitude),
      }));
      if (radius && Number(radius) > 0) {
        out = out.filter((l) => l.distance_km !== null && l.distance_km <= Number(radius));
      }
    }

    const sorters = {
      price_asc: (a, b) => a.price_per_unit - b.price_per_unit,
      price_desc: (a, b) => b.price_per_unit - a.price_per_unit,
      quantity: (a, b) => b.quantity_left - a.quantity_left,
      distance: (a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9),
      newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    };
    const key = sort && sorters[sort] ? sort : hasPoint ? 'distance' : 'newest';
    out.sort(sorters[key]);

    res.json({ listings: out });
  })
);

// GET /api/listings/mine - farmer's own listings (all statuses except removed)
router.get(
  '/mine',
  requireAuth,
  requireRole('farmer'),
  wrap(async (req, res) => {
    const { rows } = await db.query(
      `${SELECT} WHERE l.farmer_id = $1 AND l.status <> 'removed' ORDER BY l.created_at DESC`,
      [req.user.id]
    );
    res.json({ listings: rows });
  })
);

// GET /api/listings/:id
router.get(
  '/:id(\\d+)',
  optionalAuth,
  wrap(async (req, res) => {
    const { rows } = await db.query(`${SELECT} WHERE l.id = $1`, [req.params.id]);
    const l = rows[0];
    if (!l || (l.status === 'removed' && !(req.user && req.user.id === l.farmer_id)))
      throw new HttpError(404, 'Listing not found.');
    res.json({ listing: l });
  })
);

function parseListingBody(b, partial = false) {
  const out = {};
  const need = (k, msg) => {
    if (!partial && (b[k] === undefined || b[k] === '')) throw new HttpError(400, msg);
  };
  need('title', 'Title is required.');
  need('residue_type', 'Residue type is required.');
  need('quantity', 'Quantity is required.');
  need('price_per_unit', 'Expected price is required.');
  need('location_text', 'Location is required.');

  if (b.title !== undefined) {
    if (!String(b.title).trim()) throw new HttpError(400, 'Title is required.');
    out.title = String(b.title).trim();
  }
  if (b.residue_type !== undefined) {
    if (!RESIDUE_TYPES.includes(b.residue_type)) throw new HttpError(400, 'Unknown residue type.');
    out.residue_type = b.residue_type;
  }
  if (b.unit !== undefined) {
    if (!UNITS.includes(b.unit)) throw new HttpError(400, 'Unit must be kg, quintal or tonne.');
    out.unit = b.unit;
  }
  if (b.quantity !== undefined) {
    if (!(Number(b.quantity) > 0)) throw new HttpError(400, 'Quantity must be greater than 0.');
    out.quantity = Number(b.quantity);
  }
  if (b.price_per_unit !== undefined) {
    if (!(Number(b.price_per_unit) >= 0)) throw new HttpError(400, 'Price cannot be negative.');
    out.price_per_unit = Number(b.price_per_unit);
  }
  if (b.description !== undefined) out.description = b.description || null;
  if (b.location_text !== undefined) {
    if (!String(b.location_text).trim()) throw new HttpError(400, 'Location is required.');
    out.location_text = String(b.location_text).trim();
  }
  if (b.latitude !== undefined) out.latitude = num(b.latitude);
  if (b.longitude !== undefined) out.longitude = num(b.longitude);
  if (b.available_from) out.available_from = b.available_from;
  if (b.photo_url !== undefined) out.photo_url = b.photo_url || null;
  return out;
}

// POST /api/listings
router.post(
  '/',
  requireAuth,
  requireRole('farmer'),
  upload.single('photo'),
  wrap(async (req, res) => {
    const d = parseListingBody(req.body || {});
    if (req.file) d.photo_url = `/uploads/${req.file.filename}`;
    const { rows } = await db.query(
      `INSERT INTO listings
        (farmer_id,title,residue_type,description,quantity,quantity_left,unit,price_per_unit,
         photo_url,location_text,latitude,longitude,available_from)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,COALESCE($12, CURRENT_DATE))
       RETURNING *`,
      [
        req.user.id,
        d.title,
        d.residue_type,
        d.description || null,
        d.quantity,
        d.unit || 'quintal',
        d.price_per_unit,
        d.photo_url || null,
        d.location_text,
        d.latitude ?? null,
        d.longitude ?? null,
        d.available_from || null,
      ]
    );
    res.status(201).json({ listing: rows[0] });
  })
);

// PUT /api/listings/:id
router.put(
  '/:id(\\d+)',
  requireAuth,
  requireRole('farmer'),
  upload.single('photo'),
  wrap(async (req, res) => {
    const cur = (await db.query('SELECT * FROM listings WHERE id = $1', [req.params.id])).rows[0];
    if (!cur || cur.status === 'removed') throw new HttpError(404, 'Listing not found.');
    if (cur.farmer_id !== req.user.id) throw new HttpError(403, 'This is not your listing.');

    const d = parseListingBody(req.body || {}, true);
    if (req.file) d.photo_url = `/uploads/${req.file.filename}`;

    // changing quantity keeps already-reserved material intact
    const reserved = cur.quantity - cur.quantity_left;
    if (d.quantity !== undefined) {
      if (d.quantity < reserved)
        throw new HttpError(400, `Quantity cannot be below the ${reserved} already reserved in bookings.`);
      d.quantity_left = d.quantity - reserved;
    }
    if (d.unit && d.unit !== cur.unit && reserved > 0)
      throw new HttpError(400, 'Unit cannot be changed while bookings exist for this listing.');
    if (req.body && req.body.status) {
      if (!['active', 'sold'].includes(req.body.status)) throw new HttpError(400, 'Invalid status.');
      d.status = req.body.status;
    } else if (d.quantity_left !== undefined) {
      d.status = d.quantity_left > 0 ? 'active' : 'sold';
    }

    const keys = Object.keys(d);
    if (!keys.length) throw new HttpError(400, 'Nothing to update.');
    const sets = keys.map((k, i) => `${k} = $${i + 1}`);
    const { rows } = await db.query(
      `UPDATE listings SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map((k) => d[k]), req.params.id]
    );
    res.json({ listing: rows[0] });
  })
);

// DELETE /api/listings/:id  (soft delete)
router.delete(
  '/:id(\\d+)',
  requireAuth,
  requireRole('farmer', 'admin'),
  wrap(async (req, res) => {
    const cur = (await db.query('SELECT * FROM listings WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) throw new HttpError(404, 'Listing not found.');
    if (req.user.role === 'farmer' && cur.farmer_id !== req.user.id)
      throw new HttpError(403, 'This is not your listing.');
    const open = await db.query(
      `SELECT 1 FROM bookings WHERE listing_id = $1 AND status IN ('requested','confirmed','transporter_assigned','picked_up') LIMIT 1`,
      [cur.id]
    );
    if (open.rowCount)
      throw new HttpError(409, 'This listing has active bookings. Complete or cancel them first.');
    await db.query(
      `UPDATE listings SET status = 'removed', updated_at = NOW() WHERE id = $1`,
      [cur.id]
    );
    await db.query(
      `UPDATE offers SET status = 'rejected', updated_at = NOW()
       WHERE listing_id = $1 AND status IN ('pending','countered')`,
      [cur.id]
    );
    res.json({ ok: true });
  })
);

module.exports = router;
