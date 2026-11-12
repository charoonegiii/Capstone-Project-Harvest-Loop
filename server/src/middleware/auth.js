const jwt = require('jsonwebtoken');
const db = require('../db');
const { HttpError, wrap } = require('../utils/helpers');

const SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-me';

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

async function loadUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, SECRET());
  } catch {
    throw new HttpError(401, 'Invalid or expired session. Please log in again.');
  }
  const { rows } = await db.query(
    'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
    [payload.id]
  );
  const user = rows[0];
  if (!user || !user.is_active) throw new HttpError(401, 'Account not found or deactivated.');
  return user;
}

// Requires a valid token
const requireAuth = wrap(async (req, res, next) => {
  const user = await loadUser(req);
  if (!user) throw new HttpError(401, 'Please log in to continue.');
  req.user = user;
  next();
});

// Attaches req.user if a token is present, but does not require it
const optionalAuth = wrap(async (req, res, next) => {
  req.user = (await loadUser(req)) || null;
  next();
});

// Role-based access control
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new HttpError(403, 'You do not have permission to do that.'));
  }
  next();
};

module.exports = { signToken, requireAuth, optionalAuth, requireRole };
