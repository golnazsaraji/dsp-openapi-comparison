const WebSocket = require('ws');
const WebSocketStatusHub = require('./WebSocketStatusHub');

function createStatusWebSocketServer(httpServer, getSnapshot) {
  const hub = new WebSocketStatusHub();
  const server = new WebSocket.Server({ server: httpServer, path: '/ws/status' });

  server.on('connection', (client) => {
    hub.addClient(client, getSnapshot());
  });

  return {
    server,
    hub,
    broadcastLogin: (message) => hub.broadcast({ ...message, typeMessage: 'login' }),
    broadcastUpdate: (message) => hub.broadcast({ ...message, typeMessage: 'update' }),
    broadcastLogout: (userId) => hub.broadcast({ typeMessage: 'logout', userId }),
  };
}

module.exports = { createStatusWebSocketServer };
