require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const os = require('os');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 80;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Metadata EC2 (IMDSv2) Cache
let ec2Metadata = {
  instanceId: process.env.INSTANCE_ID || 'ec2-loading...',
  availabilityZone: process.env.AZ || 'az-detecting...',
  hostname: os.hostname(),
  privateIp: 'detecting...',
  platform: os.platform(),
  uptimeSeconds: 0
};

// Fungsi helper untuk mengambil metadata EC2 via IMDSv2 (Aman & AWS Standard)
function fetchIMDSv2() {
  const tokenOptions = {
    hostname: '169.254.169.254',
    port: 80,
    path: '/latest/api/token',
    method: 'PUT',
    headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '60' },
    timeout: 1000
  };

  const reqToken = http.request(tokenOptions, (resToken) => {
    let token = '';
    resToken.on('data', chunk => { token += chunk; });
    resToken.on('end', () => {
      if (resToken.statusCode !== 200 || !token) return;

      const getMeta = (metaPath, callback) => {
        const metaReq = http.request({
          hostname: '169.254.169.254',
          port: 80,
          path: '/latest/meta-data/' + metaPath,
          method: 'GET',
          headers: { 'X-aws-ec2-metadata-token': token },
          timeout: 1000
        }, (resMeta) => {
          let val = '';
          resMeta.on('data', chunk => { val += chunk; });
          resMeta.on('end', () => callback(null, val.trim()));
        });
        metaReq.on('error', err => callback(err));
        metaReq.end();
      };

      getMeta('instance-id', (err, id) => { if (!err && id) ec2Metadata.instanceId = id; });
      getMeta('placement/availability-zone', (err, az) => { if (!err && az) ec2Metadata.availabilityZone = az; });
      getMeta('local-ipv4', (err, ip) => { if (!err && ip) ec2Metadata.privateIp = ip; });
    });
  });

  reqToken.on('error', () => {
    // Berjalan di lingkungan non-EC2 (local dev fallback)
    ec2Metadata.instanceId = 'local-dev-instance';
    ec2Metadata.availabilityZone = 'local-az';
    ec2Metadata.privateIp = '127.0.0.1';
  });
  reqToken.end();
}

fetchIMDSv2();
setInterval(fetchIMDSv2, 60000);

// Pool Koneksi RDS MySQL (Stateless DB)
let dbPool = null;
let dbStatus = {
  connected: false,
  error: 'Menunggu inisialisasi koneksi RDS',
  host: null,
  database: null
};

async function initDatabase() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'webappdb';

  if (!host || !user) {
    dbStatus = {
      connected: false,
      error: 'Variabel DB_HOST atau DB_USER belum dikonfigurasi di .env',
      host: null,
      database: null
    };
    return;
  }

  try {
    dbPool = mysql.createPool({
      host,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 4000
    });

    const conn = await dbPool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        handled_by_instance VARCHAR(100),
        handled_by_az VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    conn.release();

    dbStatus = {
      connected: true,
      host,
      database,
      error: null
    };
    console.log('[HA-APP] Sukses terhubung ke RDS MySQL:', host);
  } catch (err) {
    dbStatus = {
      connected: false,
      error: err.message,
      host,
      database
    };
    console.error('[HA-APP] Gagal konek ke RDS:', err.message);
  }
}

initDatabase();

// Health Check Endpoint untuk Target Group ALB
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    instanceId: ec2Metadata.instanceId,
    availabilityZone: ec2Metadata.availabilityZone,
    timestamp: new Date().toISOString()
  });
});

// API Info Node & Status
app.get('/api/node-info', (req, res) => {
  ec2Metadata.uptimeSeconds = Math.floor(os.uptime());
  res.json({
    instance: ec2Metadata,
    database: dbStatus,
    cpuUsage: os.loadavg()
  });
});

// API Get Data (Stateless Query ke RDS)
app.get('/api/notes', async (req, res) => {
  if (!dbPool || !dbStatus.connected) {
    return res.status(503).json({ error: 'Database belum terhubung', status: dbStatus });
  }

  try {
    const [rows] = await dbPool.query('SELECT * FROM notes ORDER BY created_at DESC LIMIT 30');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data', details: err.message });
  }
});

// API Post Data (Stateless Insert ke RDS mencatat ID instance pemroses)
app.post('/api/notes', async (req, res) => {
  if (!dbPool || !dbStatus.connected) {
    return res.status(503).json({ error: 'Database belum terhubung' });
  }

  const { title, content } = req.body;
  if (!title) return res.status(400).json({ error: 'Title wajib diisi' });

  try {
    const [result] = await dbPool.query(
      'INSERT INTO notes (title, content, handled_by_instance, handled_by_az) VALUES (?, ?, ?, ?)',
      [title, content || '', ec2Metadata.instanceId, ec2Metadata.availabilityZone]
    );
    res.status(201).json({
      id: result.insertId,
      message: 'Catatan tersimpan di RDS melalui instance ini',
      handledBy: ec2Metadata.instanceId,
      az: ec2Metadata.availabilityZone
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal insert ke DB', details: err.message });
  }
});

// Endpoint Uji Beban CPU (Simulasi Beban untuk Auto Scaling Target Tracking 50%)
app.get('/api/stress', (req, res) => {
  const durationMs = parseInt(req.query.duration || '10000', 10);
  const start = Date.now();
  
  // CPU Loop spike
  while (Date.now() - start < Math.min(durationMs, 30000)) {
    Math.sqrt(Math.random() * 1000000);
  }

  res.json({
    message: `Stress test loop selesai dijalankan selama ${durationMs}ms`,
    instanceId: ec2Metadata.instanceId,
    loadAvg: os.loadavg()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[HA-APP] High Availability App running on port ${PORT}`);
  console.log(`[HA-APP] Initial Hostname: ${os.hostname()}`);
});
