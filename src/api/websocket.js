const WebSocket = require('ws');

const setupWebSocket = (server) => {
  try {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
      console.log('New WebSocket connection');

      ws.on('message', (message) => {
        console.log('Received:', message);
        // Broadcast the message to all connected clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
      });
    });

    return wss;
  } catch (err) {
    console.error('WebSocket initialization error:', err.message);
    return null;
  }
};

module.exports = setupWebSocket;