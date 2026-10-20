#!/bin/bash
# ==============================================================================
# AWS EC2 User Data Script - Amazon Linux 2023
# Fase 3: High Availability & Auto Scaling Bootstrap
# ==============================================================================

exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "[HA-BOOTSTRAP] Memulai bootstrap node Auto Scaling Group..."

# 1. Update packages & install dependencies
dnf update -y
dnf install -y nodejs npm git mariadb105

# 2. Siapkan direktori aplikasi
mkdir -p /opt/webapp/public
cd /opt/webapp

# 3. Buat package.json
cat << 'EOF' > /opt/webapp/package.json
{
  "name": "aws-ha-scaling-demo",
  "version": "1.0.0",
  "description": "Aplikasi Stateless High Availability untuk ALB dan Auto Scaling Group di AWS",
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

# 4. Install npm dependencies
npm install --omit=dev

# 5. Konfigurasi .env
# PENTING: Ganti nilai DB_HOST dan DB_PASSWORD sesuai kredensial RDS MySQL Fase 2 Anda
cat << 'EOF' > /opt/webapp/.env
PORT=80
DB_HOST=GANTI_DENGAN_RDS_ENDPOINT_ANDA
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=GANTI_DENGAN_PASSWORD_RDS_ANDA
DB_NAME=webappdb
EOF

# 6. Buat systemd service agar aplikasi berjalan di background pada port 80
cat << 'EOF' > /etc/systemd/system/webapp.service
[Unit]
Description=NodeJS Three-Tier HA Web Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/webapp
ExecStart=/usr/bin/node /opt/webapp/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 7. Aktifkan dan jalankan service webapp
systemctl daemon-reload
systemctl enable webapp
systemctl start webapp

echo "[HA-BOOTSTRAP] Setup selesai. Node siap melayani traffic dari ALB!"
