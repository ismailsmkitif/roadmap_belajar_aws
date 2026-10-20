require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 80;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let dbPool = null;
let dbStatus = {
  connected: false,
  error: 'DB belum diinisialisasi atau file .env belum dikonfigurasi',
  lastCheck: new Date()
};

// Fungsi inisialisasi koneksi pool ke MySQL
async function initDatabase() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'webappdb';

  if (!host || !user) {
    dbStatus = {
      connected: false,
      error: 'Variabel DB_HOST atau DB_USER tidak ditemukan di .env',
      lastCheck: new Date()
    };
    console.log('[DB] Konfigurasi DB belum lengkap di .env');
    return;
  }

  try {
    dbPool = mysql.createPool({
      host: host,
      user: user,
      password: password,
      database: database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000
    });

    // Test ping koneksi
    const connection = await dbPool.getConnection();
    console.log('[DB] Sukses terkoneksi ke RDS MySQL:', host);
    
    // Pastikan tabel notes sudah ada
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    connection.release();

    dbStatus = {
      connected: true,
      host: host,
      database: database,
      error: null,
      lastCheck: new Date()
    };
  } catch (err) {
    console.error('[DB] Gagal terkoneksi ke RDS:', err.message);
    dbStatus = {
      connected: false,
      error: err.message,
      lastCheck: new Date()
    };
  }
}

// Inisialisasi DB saat start
initDatabase();

// API Status Server & Koneksi DB
app.get('/api/status', async (req, res) => {
  res.json({
    server: {
      hostname: os.hostname(),
      platform: os.platform(),
      uptimeSeconds: Math.floor(os.uptime())
    },
    database: dbStatus
  });
});

// API Get Notes
app.get('/api/notes', async (req, res) => {
  if (!dbPool || !dbStatus.connected) {
    return res.status(503).json({
      error: 'Database belum terhubung',
      details: dbStatus.error
    });
  }

  try {
    const [rows] = await dbPool.query('SELECT * FROM notes ORDER BY created_at DESC LIMIT 50');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data dari DB', message: err.message });
  }
});

// API Create Note
app.post('/api/notes', async (req, res) => {
  if (!dbPool || !dbStatus.connected) {
    return res.status(503).json({
      error: 'Database belum terhubung',
      details: dbStatus.error
    });
  }

  const { title, content } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Judul catatan (title) wajib diisi' });
  }

  try {
    const [result] = await dbPool.query(
      'INSERT INTO notes (title, content) VALUES (?, ?)',
      [title, content || '']
    );
    res.status(201).json({ id: result.insertId, title, content, message: 'Catatan berhasil disimpan ke RDS!' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan catatan ke DB', message: err.message });
  }
});

// Endpoint reconnect manual
app.post('/api/reconnect', async (req, res) => {
  await initDatabase();
  res.json({ message: 'Proses koneksi ulang selesai', status: dbStatus });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[APP] Server 3-Tier running on port ${PORT}`);
  console.log(`[APP] Hostname: ${os.hostname()}`);
});
