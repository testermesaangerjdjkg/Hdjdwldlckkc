const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// In-memory хранилище для онлайн статусов и сессий
const sessions = new Map(); // socketId -> username
const online = new Set(); // usernames

function safeUser(u) {
  return {
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar || null,
    bio: u.bio || '',
    privacy: u.privacy,
    online: online.has(u.username),
    lastSeen: u.lastSeen || null
  };
}

// ──────────────────────────────────────────────────────────────
// Инициализация Socket.IO обработчиков
// ──────────────────────────────────────────────────────────────
function initSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ────────────────────────────────────────────────────────
    // Авторизация
    // ────────────────────────────────────────────────────────
    socket.on('register', async ({ username, password, displayName }, cb) => {
      try {
        username = (username || '').trim().toLowerCase();
        if (!username || !password) {
          return cb({ error: 'Username and password required' });
        }
        if (username.length < 3) {
          return cb({ error: 'Username must be at least 3 characters' });
        }
        if (!/^[a-z0-9_]+$/.test(username)) {
          return cb({ error: 'Username: only letters, numbers, underscore' });
        }

        // Проверка существования
        const existing = await db.getUserByUsername(username);
        if (existing) {
          return cb({ error: 'Username already taken' });
        }

        const hashed = bcrypt.hashSync(password, 10);
        const userData = {
          username,
          password: hashed,
          displayName: (displayName || username).trim(),
          createdAt: Date.now()
        };

        const dbUser = await db.createUser(userData);
        const user = db.dbRowToUser(dbUser);
        
        _login(socket, user);
        cb({ ok: true, user: safeUser(user) });
      } catch (err) {
        console.error('Register error:', err);
        cb({ error: 'Registration failed' });
      }
    });

    socket.on('login', async ({ username, password }, cb) => {
      try {
        username = (username || '').trim().toLowerCase();
        const dbUser = await db.getUserByUsername(username);
        
        if (!dbUser || !bcrypt.compareSync(password, dbUser.password)) {
          return cb({ error: 'Invalid username or password' });
        }

        const user = db.dbRowToUser(dbUser);
        _login(socket, user);
        cb({ ok: true, user: safeUser(user) });
      } catch (err) {
        console.error('Login error:', err);
        cb({ error: 'Login failed' });
      }
    });

    function _login(socket, user) {
      sessions.set(socket.id, user.username);
      online.add(user.username);
      socket.username = user.username;
      socket.join(`u:${user.username}`);
      io.emit('user_online', { username: user.username });
    }

    socket.on('logout', () => _cleanup(socket));

    // ────────────────────────────────────────────────────────
    // Смена пароля
    // ────────────────────────────────────────────────────────
    socket.on('change_password', async ({ oldPassword, newPassword }, cb) => {
      try {
        const me = sessions.get(socket.id);
        if (!me) return cb?.({ error: 'Not authenticated' });

        const dbUser = await db.getUserByUsername(me);
        if (!bcrypt.compareSync(oldPassword, dbUser.password)) {
          return cb?.({ error: 'Неверный текущий пароль' });
        }
        if (!newPassword || newPassword.length < 6) {
          return cb?.({ error: 'Новый пароль минимум 6 символов' });
        }

        const hashed = bcrypt.hashSync(newPassword, 10);
        await db.updateUserPassword(me, hashed);
        cb?.({ ok: true });
      } catch (err) {
        console.error('Change password error:', err);
        cb?.({ error: 'Failed to change password' });
      }
    });

    // ────────────────────────────────────────────────────────
    // Сообщения
    // ────────────────────────────────────────────────────────
    socket.on('send_message', async (data, cb) => {
      try {
        const from = sessions.get(socket.id);
        if (!from) return cb?.({ error: 'Not authenticated' });

        const { to, content, type, duration, replyTo } = data;
        const msgData = {
          id: uuidv4(),
          from,
          to,
          content,
          type: type || 'text',
          duration: duration || null,
          replyTo: replyTo || null,
          timestamp: Date.now(),
          delivered: online.has(to)
        };

        const dbMsg = await db.createMessage(msgData);
        const msg = db.dbRowToMessage(dbMsg);

        io.to(`u:${to}`).emit('new_message', msg);
        cb?.({ ok: true, message: msg });
      } catch (err) {
        console.error('Send message error:', err);
        cb?.({ error: 'Failed to send message' });
      }
    });

    socket.on('get_messages', async ({ with: other }, cb) => {
      try {
        const me = sessions.get(socket.id);
        if (!me) return cb?.([]);

        const dbMsgs = await db.getMessages(me, other);
        const msgs = dbMsgs.map(db.dbRowToMessage);
        cb?.(msgs);
      } catch (err) {
        console.error('Get messages error:', err);
        cb?.([]);
      }
    });

    socket.on('mark_read', async ({ chatWith }) => {
      try {
        const me = sessions.get(socket.id);
        if (!me) return;

        await db.markMessagesAsRead(chatWith, me);
        io.to(`u:${chatWith}`).emit('messages_read', { by: me });
      } catch (err) {
        console.error('Mark read error:', err);
      }
    });

    socket.on('delete_message', async ({ msgId, chatWith }, cb) => {
      try {
        const me = sessions.get(socket.id);
        if (!me) return;

        const deleted = await db.deleteMessage(msgId, me);
        if (deleted) {
          io.to(`u:${chatWith}`).emit('message_deleted', { msgId });
          io.to(`u:${me}`).emit('message_deleted', { msgId });
          cb?.({ ok: true });
        }
      } catch (err) {
        console.error('Delete message error:', err);
        cb?.({ error: 'Failed to delete message' });
      }
    });

    // ────────────────────────────────────────────────────────
    // Typing индикатор
    // ────────────────────────────────────────────────────────
    socket.on('typing', ({ to, isTyping }) => {
      const from = sessions.get(socket.id);
      if (!from) return;
      io.to(`u:${to}`).emit('user_typing', { from, isTyping });
    });

    // ────────────────────────────────────────────────────────
    // WebRTC Signaling
    // ────────────────────────────────────────────────────────
    socket.on('call_user', ({ to, offer, callType }) => {
      const from = sessions.get(socket.id);
      if (!from) return;
      if (!online.has(to)) {
        socket.emit('call_user_offline', { to });
        return;
      }
      io.to(`u:${to}`).emit('incoming_call', { from, offer, callType });
    });

    socket.on('call_answer', ({ to, answer }) => {
      io.to(`u:${to}`).emit('call_answered', { answer });
    });

    socket.on('ice_candidate', ({ to, candidate }) => {
      io.to(`u:${to}`).emit('ice_candidate', { candidate });
    });

    socket.on('call_end', ({ to }) => {
      io.to(`u:${to}`).emit('call_ended');
    });

    socket.on('call_reject', ({ to }) => {
      io.to(`u:${to}`).emit('call_rejected');
    });

    socket.on('call_busy', ({ to }) => {
      io.to(`u:${to}`).emit('call_busy');
    });

    // ────────────────────────────────────────────────────────
    // Профиль
    // ────────────────────────────────────────────────────────
    socket.on('update_profile', async ({ displayName, bio, privacy }, cb) => {
      try {
        const me = sessions.get(socket.id);
        if (!me) return cb?.({ error: 'Not authenticated' });

        const updates = { displayName, bio, privacy };
        const dbUser = await db.updateUserProfile(me, updates);
        const user = db.dbRowToUser(dbUser);

        io.emit('user_updated', {
          username: me,
          displayName: user.displayName,
          avatar: user.avatar,
          bio: user.bio,
          privacy: user.privacy
        });
        
        cb?.({ ok: true, user: safeUser(user) });
      } catch (err) {
        console.error('Update profile error:', err);
        cb?.({ error: 'Failed to update profile' });
      }
    });

    // ────────────────────────────────────────────────────────
    // Отключение
    // ────────────────────────────────────────────────────────
    socket.on('disconnect', () => _cleanup(socket));

    async function _cleanup(socket) {
      const username = sessions.get(socket.id);
      if (username) {
        try {
          await db.updateUserLastSeen(username, Date.now());
          sessions.delete(socket.id);
          online.delete(username);
          io.emit('user_offline', { username, lastSeen: Date.now() });
        } catch (err) {
          console.error('Cleanup error:', err);
        }
      }
    }
  });
}

module.exports = { initSocketHandlers, sessions, online, safeUser };
