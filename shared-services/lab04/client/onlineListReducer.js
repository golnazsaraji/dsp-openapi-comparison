function applyWebSocketMessage(onlineList, message) {
  if (Array.isArray(message)) {
    return message.reduce(applyWebSocketMessage, []);
  }

  const current = Array.isArray(onlineList) ? onlineList : [];

  if (message.typeMessage === 'logout') {
    return current.filter((item) => item.userId !== message.userId);
  }

  const nextMessage = {
    typeMessage: message.typeMessage,
    userId: message.userId,
    userName: message.userName,
    ...(message.filmId ? { filmId: message.filmId, filmTitle: message.filmTitle } : {}),
  };

  const index = current.findIndex((item) => item.userId === message.userId);
  if (index === -1) return [...current, nextMessage];

  return current.map((item, itemIndex) => (itemIndex === index ? nextMessage : item));
}

module.exports = { applyWebSocketMessage };
