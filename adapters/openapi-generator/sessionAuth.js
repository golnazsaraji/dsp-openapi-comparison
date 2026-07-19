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

  app.post('/api/sessions', passport.authenticate('local'), (request, response) => {
    FilmManagerService.recordLogin(request.user.id);
    response.status(200).json(publicUser(request.user));
  });
  app.get('/api/sessions/current', requireAuthentication, (request, response) => {
    response.status(200).json(publicUser(request.user));
  });
  app.delete('/api/sessions/current', requireAuthentication, (request, response, next) => {
    const userId = request.user.id;
    request.logout((logoutError) => {
      if (logoutError) return next(logoutError);
      return request.session.destroy((sessionError) => {
        if (sessionError) return next(sessionError);
        FilmManagerService.recordLogout(userId);
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
