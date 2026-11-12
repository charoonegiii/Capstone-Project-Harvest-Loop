// Wrap async route handlers so errors reach the error middleware
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Great-circle distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v === null || v === undefined || isNaN(v))) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

// Convert a quantity to kilograms based on its unit
const KG_PER_UNIT = { kg: 1, quintal: 100, tonne: 1000 };
const toKg = (qty, unit) => qty * (KG_PER_UNIT[unit] || 1);

// SQL fragment converting `<qtyCol>` in `<unitCol>` into quintals (used by dashboards)
const sqlQuintals = (qtyCol, unitCol) =>
  `(${qtyCol} * CASE ${unitCol} WHEN 'kg' THEN 0.01 WHEN 'tonne' THEN 10 ELSE 1 END)`;

const RESIDUE_TYPES = [
  'paddy_straw',
  'wheat_straw',
  'sugarcane_residue',
  'cotton_stalk',
  'maize_stalk',
  'mustard_stalk',
  'rice_husk',
  'other',
];
const UNITS = ['kg', 'quintal', 'tonne'];

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

module.exports = { wrap, HttpError, haversineKm, toKg, sqlQuintals, RESIDUE_TYPES, UNITS, num };
