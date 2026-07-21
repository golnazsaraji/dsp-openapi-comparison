const config = require('./config');
const logger = require('./logger');
const ExpressServer = require('./expressServer');

// A locally-scoped reference (previously `this.expressServer` at module top
// level, which in CommonJS actually assigned a property onto `module.exports`
// rather than anything usable by a signal handler) so shutdown() below can
// reliably call close() on the same instance that was launched.
const expressServer = new ExpressServer(config.URL_PORT, config.OPENAPI_YAML);

const launchServer = async () => {
  try {
    expressServer.launch();
    logger.info('Express server running');
  } catch (error) {
    logger.error('Express Server failure', error.message);
    await expressServer.close();
  }
};

// Deterministic shutdown: a test harness or process manager sending SIGTERM/
// SIGINT gets a clean close() (HTTP server + WebSocket gateway) instead of an
// abrupt process kill. process.exit(0) is reached only after close() actually
// resolves; a rejection is logged and exits non-zero instead of leaving the
// process hanging on an unhandled rejection (which close() alone, without
// this try/catch, would previously do — signal handlers are not awaited by
// Node, so a rejected promise here would never be reported or retried).
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down.`);
  try {
    await expressServer.close();
    process.exit(0);
  } catch (error) {
    logger.error('Shutdown failed', error.message);
    process.exit(1);
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

launchServer().catch(e => logger.error(e));
