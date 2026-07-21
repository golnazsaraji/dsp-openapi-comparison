const FilmManagerService = require('../../shared-services/src/services/FilmManagerService');
const { attachRealtimeGateway } = require('../../shared-services/src/realtime/attachRealtimeGateway');

// Configurable WebSocket path (never hard-coded); defaults to /ws. Uses the
// same configured HTTP port as the Film Manager server since it shares that
// server's instance (see out/expressServer.mustache) rather than opening a
// second, unrelated port.
const WS_PATH = process.env.WS_PATH || '/ws';

function attach(httpServer) {
  return attachRealtimeGateway(httpServer, FilmManagerService, { path: WS_PATH });
}

module.exports = { attach, WS_PATH };
