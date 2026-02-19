const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
  // Обмен ключами
  socket.on('dh-key-exchange', (data) => {
    socket.broadcast.emit('dh-key-exchange', data);
  });

  // Пересылка сообщений
  socket.on('chat message', (data) => {
    socket.broadcast.emit('chat message', data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Freedom Premium on port ${PORT}`));
