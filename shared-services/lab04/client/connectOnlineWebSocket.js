const { applyWebSocketMessage } = require('./onlineListReducer');

function connectOnlineWebSocket(url, onOnlineListChange, initialOnlineList = []) {
  let onlineList = initialOnlineList;
  const socket = new WebSocket(url);

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    onlineList = applyWebSocketMessage(onlineList, message);
    onOnlineListChange(onlineList);
  });

  return socket;
}

module.exports = { connectOnlineWebSocket };
