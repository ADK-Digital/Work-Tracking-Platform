import type { Express, RequestHandler } from 'express';
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oidc');

export const parseAllowedDomains = (): Set<string> =>
  new Set(
    (process.env.ALLOWED_EMAIL_DOMAINS ?? '')
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean),
  );

export const setupAuth = (app: Express, options: { pgPool: any | null }) => {
  const PgStore = connectPgSimple(session);
  const sessionSecret = process.env.SESSION_SECRET;
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3001/auth/google/callback';

  if (!sessionSecret || !googleClientId || !googleClientSecret) {
    throw new Error('SESSION_SECRET, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET are required to enable authentication.');
  }

  const allowedDomains = parseAllowedDomains();

  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackUrl,
        scope: ['openid', 'profile', 'email'],
      },
      (_issuer: string, profile: { emails?: Array<{ value?: string }>; displayName?: string; id: string }, cb: (err: unknown, user?: Express.User | false, info?: { message: string }) => void) => {
        const email = profile.emails?.[0]?.value?.toLowerCase();

        if (!email) {
          return cb(null, false, { message: 'No email returned from Google account.' });
        }

        const domain = email.split('@')[1];

        if (allowedDomains.size > 0 && (!domain || !allowedDomains.has(domain))) {
          return cb(null, false, { message: 'Account domain is not allowed.' });
        }

        return cb(null, {
          email,
          name: profile.displayName ?? email,
          googleSub: profile.id,
        });
      },
    ),
  );

  passport.serializeUser((user: Express.User, done: (err: unknown, user?: Express.User) => void) => done(null, user));
  passport.deserializeUser((user: Express.User, done: (err: unknown, user?: Express.User) => void) => done(null, user));

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production' ? 'auto' : false,
      },
      store: options.pgPool
        ? new PgStore({
            pool: options.pgPool,
            tableName: 'user_sessions',
            createTableIfMissing: true,
          })
        : undefined,
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());
};

export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({ message: 'Unauthorized' });
};
