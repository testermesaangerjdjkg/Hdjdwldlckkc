require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./db');
const { initSocketHandlers, safeUser } = require('./socket-handlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 20e6
});

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ──────────────────────────────────────────────────────────────
// REST API Endpoints
// ──────────────────────────────────────────────────────────────

app.get('/api/users', async (req, res) => {
  try {
    const dbUsers = await db.getAllUsers();
    const users = dbUsers.map(u => safeUser(db.dbRowToUser(u)));
    res.json(users);
  } catch (err) {
    console.error('API /users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/avatar', async (req, res) => {
  try {
    const { username, avatar } = req.body;
    const dbUser = await db.updateUserAvatar(username, avatar);
    
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = db.dbRowToUser(dbUser);
    io.emit('user_updated', {
      username,
      avatar: user.avatar,
      displayName: user.displayName
    });
    
    res.json({ ok: true });
  } catch (err) {
    console.error('API /avatar error:', err);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

// Health check для Railway
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ──────────────────────────────────────────────────────────────
// Инициализация
// ──────────────────────────────────────────────────────────────

async function startServer() {
  try {
    // Инициализация БД
    await db.initDB();
    
    // Инициализация Socket.IO обработчиков
    initSocketHandlers(io);
    
    // Запуск сервера
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║   🚀 Freedom Messenger                    ║
║                                           ║
║   Server: http://localhost:${PORT.toString().padEnd(23)}║
║   Database: PostgreSQL                    ║
║   Status: Online ✓                        ║
║                                           ║
╚═══════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Обработка ошибок
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

startServer();
