const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const FilmManagerService = require('../../shared-services/src/services/FilmManagerService');

function publicUser(user) {
  return user && FilmManagerService.user(user.id);
}

function requireAuthentication(request, response, next) {
  if (request.isAuthenticated()) return next();
  return response.status(401).json({ error: 'Authentication required.' });
}

function runWithRequestIdentity(request, callback) {
  return FilmManagerService.runAsUser(request.user?.id, callback);
}

function configureSessionAuthentication(app) {
  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
  }, async (email, password, done) => {
    try {
      const user = await FilmManagerService.verifyCredentials(email, password);
      return done(null, user || false);
    } catch (error) {
      return done(error);
    }
  }));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => done(null, FilmManagerService.internalUser(id) || false));

  app.use(session({
    secret: process.env.SESSION_SECRET || 'dsp-lab01-development-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' },
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  app.post(
    '/api/sessions',
    (request, response, next) => {
      // Passport regenerates the session (and its id) on every successful
      // login as session-fixation protection, so the id read *after*
      // authenticate() is always different from the one this request
      // arrived with. Capturing it here, before that regeneration, lets
      // FilmManagerService.recordLogin recognize a same-cookie repeat login
      // as a continuation of the existing tracked session rather than an
      // unrelated new one.
      request.incomingSessionId = request.sessionID;
      next();
    },
    passport.authenticate('local'),
    (request, response) => {
      // A failed authenticate() call never reaches this handler, so a
      // rejected login never registers a session.
      FilmManagerService.recordLogin(request.user.id, request.sessionID, request.incomingSessionId);
      response.status(200).json(publicUser(request.user));
    },
  );
  app.get('/api/sessions/current', requireAuthentication, (request, response) => {
    response.status(200).json(publicUser(request.user));
  });
  app.delete('/api/sessions/current', requireAuthentication, (request, response, next) => {
    const userId = request.user.id;
    // Captured before logout()/session.destroy() run, since those mutate
    // request.session — request.sessionID itself remains the id this
    // request's session was tracked under.
    const sessionId = request.sessionID;
    request.logout((logoutError) => {
      if (logoutError) return next(logoutError);
      return request.session.destroy((sessionError) => {
        if (sessionError) return next(sessionError);
        FilmManagerService.recordLogout(userId, sessionId);
        response.clearCookie('connect.sid');
        return response.status(204).end();
      });
    });
  });

  app.use((request, response, next) => (
    FilmManagerService.runAsUser(request.user?.id, next)
  ));
}

module.exports = {
  configureSessionAuthentication,
  runWithRequestIdentity,
  securityHandler: (request) => request.isAuthenticated(),
};
