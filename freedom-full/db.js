const { Pool } = require('pg');

// Подключение к PostgreSQL (Railway автоматически предоставит DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Инициализация таблиц
async function initDB() {
  const client = await pool.connect();
  try {
    // Таблица пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(50) PRIMARY KEY,
        password VARCHAR(255) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        avatar TEXT,
        bio TEXT DEFAULT '',
        privacy_last_seen VARCHAR(20) DEFAULT 'everyone',
        privacy_profile_photo VARCHAR(20) DEFAULT 'everyone',
        privacy_online VARCHAR(20) DEFAULT 'everyone',
        created_at BIGINT NOT NULL,
        last_seen BIGINT
      )
    `);

    // Таблица сообщений
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY,
        from_user VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
        to_user VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
        content TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'text',
        duration INTEGER,
        reply_to UUID,
        timestamp BIGINT NOT NULL,
        read BOOLEAN DEFAULT FALSE,
        delivered BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL
      )
    `);

    // Индексы для быстрого поиска
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_users 
      ON messages(from_user, to_user, timestamp DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp 
      ON messages(timestamp DESC)
    `);

    console.log('✓ База данных инициализирована');
  } catch (err) {
    console.error('✗ Ошибка инициализации БД:', err);
    throw err;
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────────────────────
// CRUD операции для пользователей
// ──────────────────────────────────────────────────────────────

async function createUser(userData) {
  const { username, password, displayName, createdAt } = userData;
  const query = `
    INSERT INTO users (username, password, display_name, created_at)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const result = await pool.query(query, [username, password, displayName, createdAt]);
  return result.rows[0];
}

async function getUserByUsername(username) {
  const query = 'SELECT * FROM users WHERE username = $1';
  const result = await pool.query(query, [username]);
  return result.rows[0] || null;
}

async function getAllUsers() {
  const query = 'SELECT * FROM users ORDER BY created_at DESC';
  const result = await pool.query(query);
  return result.rows;
}

async function updateUserAvatar(username, avatar) {
  const query = 'UPDATE users SET avatar = $1 WHERE username = $2 RETURNING *';
  const result = await pool.query(query, [avatar, username]);
  return result.rows[0];
}

async function updateUserProfile(username, updates) {
  const { displayName, bio, privacy } = updates;
  const query = `
    UPDATE users 
    SET display_name = COALESCE($1, display_name),
        bio = COALESCE($2, bio),
        privacy_last_seen = COALESCE($3, privacy_last_seen),
        privacy_profile_photo = COALESCE($4, privacy_profile_photo),
        privacy_online = COALESCE($5, privacy_online)
    WHERE username = $6
    RETURNING *
  `;
  const result = await pool.query(query, [
    displayName,
    bio,
    privacy?.lastSeen,
    privacy?.profilePhoto,
    privacy?.online,
    username
  ]);
  return result.rows[0];
}

async function updateUserPassword(username, hashedPassword) {
  const query = 'UPDATE users SET password = $1 WHERE username = $2';
  await pool.query(query, [hashedPassword, username]);
}

async function updateUserLastSeen(username, timestamp) {
  const query = 'UPDATE users SET last_seen = $1 WHERE username = $2';
  await pool.query(query, [timestamp, username]);
}

// ──────────────────────────────────────────────────────────────
// CRUD операции для сообщений
// ──────────────────────────────────────────────────────────────

async function createMessage(msgData) {
  const { id, from, to, content, type, duration, replyTo, timestamp, delivered } = msgData;
  const query = `
    INSERT INTO messages (id, from_user, to_user, content, type, duration, reply_to, timestamp, delivered)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
  const result = await pool.query(query, [
    id, from, to, content, type, duration, replyTo, timestamp, delivered
  ]);
  return result.rows[0];
}

async function getMessages(user1, user2, limit = 500) {
  const query = `
    SELECT * FROM messages 
    WHERE (from_user = $1 AND to_user = $2) OR (from_user = $2 AND to_user = $1)
    ORDER BY timestamp DESC
    LIMIT $3
  `;
  const result = await pool.query(query, [user1, user2, limit]);
  return result.rows.reverse(); // Возвращаем в хронологическом порядке
}

async function markMessagesAsRead(fromUser, toUser) {
  const query = `
    UPDATE messages 
    SET read = TRUE 
    WHERE from_user = $1 AND to_user = $2 AND read = FALSE
  `;
  await pool.query(query, [fromUser, toUser]);
}

async function deleteMessage(msgId, username) {
  const query = 'DELETE FROM messages WHERE id = $1 AND from_user = $2 RETURNING *';
  const result = await pool.query(query, [msgId, username]);
  return result.rows[0] || null;
}

async function getUnreadCount(username) {
  const query = `
    SELECT from_user, COUNT(*) as count 
    FROM messages 
    WHERE to_user = $1 AND read = FALSE 
    GROUP BY from_user
  `;
  const result = await pool.query(query, [username]);
  return result.rows;
}

// Преобразование DB row в объект приложения
function dbRowToUser(row) {
  if (!row) return null;
  return {
    username: row.username,
    password: row.password,
    displayName: row.display_name,
    avatar: row.avatar,
    bio: row.bio,
    privacy: {
      lastSeen: row.privacy_last_seen,
      profilePhoto: row.privacy_profile_photo,
      online: row.privacy_online
    },
    createdAt: row.created_at,
    lastSeen: row.last_seen
  };
}

function dbRowToMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    from: row.from_user,
    to: row.to_user,
    content: row.content,
    type: row.type,
    duration: row.duration,
    replyTo: row.reply_to,
    timestamp: row.timestamp,
    read: row.read,
    delivered: row.delivered
  };
}

module.exports = {
  pool,
  initDB,
  // Users
  createUser,
  getUserByUsername,
  getAllUsers,
  updateUserAvatar,
  updateUserProfile,
  updateUserPassword,
  updateUserLastSeen,
  // Messages
  createMessage,
  getMessages,
  markMessagesAsRead,
  deleteMessage,
  getUnreadCount,
  // Helpers
  dbRowToUser,
  dbRowToMessage
};
