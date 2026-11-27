import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  JWT_SECRET is not set. Set it in Railway variables.');
}

export const sign = (user) =>
  jwt.sign(
    { uid: user.id, tid: user.tenant_id, role: user.role, name: user.name },
    SECRET,
    { expiresIn: '30d' } // long-lived so tills keep working through long offline stretches
  );

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Your session expired. Sign in again.' });
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: 'Your role does not have access to this.' });

export const requireTenant = (req, res, next) =>
  req.user?.tid ? next() : res.status(403).json({ error: 'This action needs a business account.' });

// Wrap async handlers so thrown errors reach the error middleware.
export const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
