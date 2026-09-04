// @ts-nocheck -- JWT request augmentation is narrowed by Auth route contracts.
import jwt from 'jsonwebtoken';

import { IS_PLATFORM } from '@/shared/utils.js';
import { LOGIN_DISABLED } from '@/shared/localLogin.js';

import { userDb, appConfigDb } from '../database/index.js';

// Use env var if set, otherwise auto-generate a unique secret per installation
const JWT_SECRET = process.env.JWT_SECRET || appConfigDb.getOrCreateJwtSecret();

// Optional API key middleware
const validateApiKey = (req, res, next) => {
  // Skip API key validation if not configured
  if (!process.env.API_KEY) {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

// JWT authentication middleware
const authenticateToken = async (req, res, next) => {
  // Platform mode, and a local server whose login was switched off: both
  // answer as the single database user.
  if (IS_PLATFORM || LOGIN_DISABLED) {
    try {
      const user = userDb.getFirstUser();
      if (!user) {
        // Nobody has registered yet: the setup screen has to run, and it is
        // the one thing this bypass must not skip past.
        return res.status(401).json({
          error: 'No user account exists yet. Complete the first-run setup.',
          code: 'AUTH_SETUP_REQUIRED',
        });
      }
      req.user = user;
      return next();
    } catch (error) {
      console.error('Single-user authentication failed:', error);
      return res.status(500).json({ error: 'Could not read the user account' });
    }
  }

  // Normal OSS JWT validation
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // Also check query param for SSE endpoints (EventSource can't set headers)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    res.setHeader('X-Auth-Error', 'invalid-token');
    return res.status(401).json({
      error: 'Access denied. No token provided.',
      code: 'AUTH_TOKEN_INVALID',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user still exists and is active
    const user = userDb.getUserById(decoded.userId);
    if (!user) {
      res.setHeader('X-Auth-Error', 'invalid-token');
      return res.status(401).json({
        error: 'Invalid token. User not found.',
        code: 'AUTH_TOKEN_INVALID',
      });
    }

    // Auto-refresh: if token is past halfway through its lifetime, issue a new one
    if (decoded.exp && decoded.iat) {
      const now = Math.floor(Date.now() / 1000);
      const halfLife = (decoded.exp - decoded.iat) / 2;
      if (now > decoded.iat + halfLife) {
        const newToken = generateToken(user);
        res.setHeader('X-Refreshed-Token', newToken);
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.setHeader('X-Auth-Error', 'session-expired');
      return res.status(401).json({
        error: 'Session expired. Please log in again.',
        code: 'AUTH_TOKEN_EXPIRED',
      });
    }

    console.warn(
      'Token verification failed:',
      error instanceof Error ? error.message : String(error),
    );
    res.setHeader('X-Auth-Error', 'invalid-token');
    return res.status(401).json({
      error: 'Invalid token',
      code: 'AUTH_TOKEN_INVALID',
    });
  }
};

/**
 * How long a login lasts, from `CLOUDCLI_TOKEN_TTL`.
 *
 * The default is finite. It used to be no expiry at all, on the grounds that
 * this server binds to 127.0.0.1 and serves one person on their own machine -
 * but a token that never lapses is one that stays valid wherever it ends up,
 * and the comfort it bought is now covered properly by `CLOUDCLI_NO_LOGIN`,
 * which asks for no sign-in in the first place.
 *
 * Any value `jsonwebtoken` takes works (`7d`, `12h`). A token that never
 * expires is still available, but only by asking for it by name - `never`,
 * `none`, `infinite`, `nie` or `unbegrenzt` - never by leaving the variable
 * unset. Turn it on only where the server cannot be reached from outside;
 * "Allow LAN Access to Local Server" in the desktop menu is exactly the case
 * where it must stay off.
 */
const DEFAULT_TOKEN_TTL = '30d';
const TOKEN_TTL_RAW = (process.env.CLOUDCLI_TOKEN_TTL ?? '').trim();
const TOKEN_NEVER_EXPIRES = ['0', 'unbegrenzt', 'nie', 'never', 'none', 'infinite']
  .includes(TOKEN_TTL_RAW.toLowerCase());
const TOKEN_TTL = TOKEN_TTL_RAW || DEFAULT_TOKEN_TTL;

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username
    },
    JWT_SECRET,
    TOKEN_NEVER_EXPIRES ? {} : { expiresIn: TOKEN_TTL }
  );
};

// WebSocket authentication function
const authenticateWebSocket = (token) => {
  // Platform mode, and a local server whose login was switched off.
  if (IS_PLATFORM || LOGIN_DISABLED) {
    try {
      const user = userDb.getFirstUser();
      if (user) {
        return { id: user.id, userId: user.id, username: user.username };
      }
      return null;
    } catch (error) {
      console.error('Single-user WebSocket authentication failed:', error);
      return null;
    }
  }

  // Normal OSS JWT validation
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Verify user actually exists in database (matches REST authenticateToken behavior)
    const user = userDb.getUserById(decoded.userId);
    if (!user) {
      return null;
    }
    return { userId: user.id, username: user.username };
  } catch (error) {
    if (!(error instanceof jwt.TokenExpiredError)) {
      console.warn(
        'WebSocket token verification failed:',
        error instanceof Error ? error.message : String(error),
      );
    }
    return null;
  }
};

export {
  validateApiKey,
  authenticateToken,
  generateToken,
  authenticateWebSocket,
  JWT_SECRET
};
