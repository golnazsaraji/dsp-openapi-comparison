class WebSocketStatusHub {
  constructor() {
    this.clients = new Set();
  }

  addClient(client, snapshot = []) {
    this.clients.add(client);
    client.on?.('close', () => this.clients.delete(client));
    snapshot.forEach((message) => this.send(client, message));
  }

  broadcast(message) {
    this.clients.forEach((client) => this.send(client, message));
  }

  send(client, message) {
    if (client.readyState !== undefined && client.readyState !== 1) return;
    client.send(JSON.stringify(message));
  }
}

module.exports = WebSocketStatusHub;
