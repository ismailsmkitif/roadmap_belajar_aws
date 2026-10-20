#!/bin/bash
# ==============================================================================
# AWS EC2 User Data Script - Amazon Linux 2023
# Fase 2: Three-Tier Web App Automated Bootstrap
# ==============================================================================

# Catat semua log instalasi ke file log untuk debugging
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "[BOOTSTRAP] Memulai instalasi lingkungan aplikasi 3-tier..."

# 1. Update OS packages
dnf update -y

# 2. Install Node.js v20 (LTS), Git, dan MySQL CLI client untuk pengujian
dnf install -y nodejs npm git mariadb105

echo "[BOOTSTRAP] Node version: $(node -v)"
echo "[BOOTSTRAP] NPM version: $(npm -v)"

# 3. Buat direktori aplikasi
mkdir -p /opt/webapp
cd /opt/webapp

# 4. Buat package.json langsung di server
cat << 'EOF' > /opt/webapp/package.json
{
  "name": "aws-three-tier-demo",
  "version": "1.0.0",
  "description": "Aplikasi 3-tier Node.js Express terhubung ke AWS RDS MySQL",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "mysql2": "^3.9.7"
  }
}
EOF

# 5. Install dependencies via npm
npm install --omit=dev

# 6. Buat template file .env awal (placeholder sampai diisi di Hari 5)
cat << 'EOF' > /opt/webapp/.env
PORT=80
DB_HOST=localhost
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=placeholder
DB_NAME=webappdb
EOF

# Berikan hak akses ke user ec2-user
chown -R ec2-user:ec2-user /opt/webapp

# Catatan: File server.js dan public assets diunggah / di-pull pada Hari 5.
# Atau dapat di-clone langsung dari git repo siswa bila tersedia.
echo "[BOOTSTRAP] Setup awal direktori /opt/webapp selesai."
