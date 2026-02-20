const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 20e6
});

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── In-Memory Storage ────────────────────────────────────────────────────────
const users    = new Map(); // username -> user
const sessions = new Map(); // socketId -> username
const messages = new Map(); // chatId   -> msg[]
const online   = new Set(); // usernames

function chatId(a, b) { return [a, b].sort().join('::'); }
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

// ─── REST endpoints ───────────────────────────────────────────────────────────
app.get('/api/users', (req, res) => {
  res.json(Array.from(users.values()).map(safeUser));
});

app.post('/api/avatar', (req, res) => {
  const { username, avatar } = req.body;
  const user = users.get(username);
  if (!user) return res.status(404).json({ error: 'Not found' });
  user.avatar = avatar;
  io.emit('user_updated', { username, avatar, displayName: user.displayName });
  res.json({ ok: true });
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  // ── Auth ──
  socket.on('register', ({ username, password, displayName }, cb) => {
    username = (username || '').trim().toLowerCase();
    if (!username || !password) return cb({ error: 'Username and password required' });
    if (users.has(username)) return cb({ error: 'Username already taken' });
    if (username.length < 3) return cb({ error: 'Username must be at least 3 characters' });
    if (!/^[a-z0-9_]+$/.test(username)) return cb({ error: 'Username: only letters, numbers, underscore' });

    const hashed = bcrypt.hashSync(password, 10);
    const user = {
      username,
      password: hashed,
      displayName: (displayName || username).trim(),
      avatar: null,
      bio: '',
      privacy: { lastSeen: 'everyone', profilePhoto: 'everyone', online: 'everyone' },
      createdAt: Date.now(),
      lastSeen: null
    };
    users.set(username, user);
    _login(socket, user);
    cb({ ok: true, user: safeUser(user) });
  });

  socket.on('login', ({ username, password }, cb) => {
    username = (username || '').trim().toLowerCase();
    const user = users.get(username);
    if (!user || !bcrypt.compareSync(password, user.password))
      return cb({ error: 'Invalid username or password' });
    _login(socket, user);
    cb({ ok: true, user: safeUser(user) });
  });

  function _login(socket, user) {
    sessions.set(socket.id, user.username);
    online.add(user.username);
    socket.username = user.username;
    socket.join(`u:${user.username}`);
    io.emit('user_online', { username: user.username });
  }

  socket.on('logout', () => _cleanup(socket));

  // ── Change Password ──
  socket.on('change_password', ({ oldPassword, newPassword }, cb) => {
    const me = sessions.get(socket.id);
    if (!me) return cb?.({ error: 'Not authenticated' });
    const user = users.get(me);
    if (!bcrypt.compareSync(oldPassword, user.password))
      return cb?.({ error: 'Неверный текущий пароль' });
    if (!newPassword || newPassword.length < 6)
      return cb?.({ error: 'Новый пароль минимум 6 символов' });
    user.password = bcrypt.hashSync(newPassword, 10);
    cb?.({ ok: true });
  });

  // ── Messages ──
  socket.on('send_message', (data, cb) => {
    const from = sessions.get(socket.id);
    if (!from) return cb?.({ error: 'Not authenticated' });
    const { to, content, type, duration, replyTo } = data;
    const cid = chatId(from, to);
    if (!messages.has(cid)) messages.set(cid, []);

    const msg = {
      id: uuidv4(),
      from, to, content,
      type: type || 'text',
      duration: duration || null,
      replyTo: replyTo || null,
      timestamp: Date.now(),
      read: false,
      delivered: online.has(to)
    };

    messages.get(cid).push(msg);
    if (messages.get(cid).length > 500) messages.get(cid).shift();

    io.to(`u:${to}`).emit('new_message', msg);
    cb?.({ ok: true, message: msg });
  });

  socket.on('get_messages', ({ with: other }, cb) => {
    const me = sessions.get(socket.id);
    if (!me) return cb?.([]);
    cb?.(messages.get(chatId(me, other)) || []);
  });

  socket.on('mark_read', ({ chatWith }) => {
    const me = sessions.get(socket.id);
    if (!me) return;
    const cid = chatId(me, chatWith);
    (messages.get(cid) || []).forEach(m => {
      if (m.to === me) m.read = true;
    });
    io.to(`u:${chatWith}`).emit('messages_read', { by: me });
  });

  socket.on('delete_message', ({ msgId, chatWith }, cb) => {
    const me = sessions.get(socket.id);
    if (!me) return;
    const cid = chatId(me, chatWith);
    const msgs = messages.get(cid) || [];
    const idx = msgs.findIndex(m => m.id === msgId && m.from === me);
    if (idx !== -1) {
      msgs.splice(idx, 1);
      io.to(`u:${chatWith}`).emit('message_deleted', { msgId });
      io.to(`u:${me}`).emit('message_deleted', { msgId });
      cb?.({ ok: true });
    }
  });

  // ── Typing ──
  socket.on('typing', ({ to, isTyping }) => {
    const from = sessions.get(socket.id);
    if (!from) return;
    io.to(`u:${to}`).emit('user_typing', { from, isTyping });
  });

  // ── WebRTC Signaling ──
  socket.on('call_user', ({ to, offer, callType }) => {
    const from = sessions.get(socket.id);
    if (!from) return;
    // Check if target user is online
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

  // ── Profile ──
  socket.on('update_profile', ({ displayName, bio, privacy }, cb) => {
    const me = sessions.get(socket.id);
    if (!me) return cb?.({ error: 'Not authenticated' });
    const user = users.get(me);
    if (displayName) user.displayName = displayName.trim();
    if (bio !== undefined) user.bio = bio;
    if (privacy) user.privacy = { ...user.privacy, ...privacy };
    io.emit('user_updated', { username: me, displayName: user.displayName, avatar: user.avatar, bio: user.bio, privacy: user.privacy });
    cb?.({ ok: true, user: safeUser(user) });
  });

  // ── Disconnect ──
  socket.on('disconnect', () => _cleanup(socket));

  function _cleanup(socket) {
    const username = sessions.get(socket.id);
    if (username) {
      const user = users.get(username);
      if (user) user.lastSeen = Date.now();
      sessions.delete(socket.id);
      online.delete(username);
      io.emit('user_offline', { username, lastSeen: Date.now() });
    }
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log(`\n  Freedom Messenger running on port ${process.env.PORT || 3000}\n`);
});
