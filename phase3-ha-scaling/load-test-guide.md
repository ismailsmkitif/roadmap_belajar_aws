# Panduan Uji Beban (Load Testing) & CPU Stress — Fase 3

Panduan ini berisi kumpulan perintah untuk menguji **High Availability (Load Balancing)** dan memicu **Auto Scaling Scale-Out** saat utilisasi CPU mencapai target (misal: > 50%).

Semua perintah di bawah ini Anda jalankan **sendiri** dari terminal lokal Anda, Git Bash, atau dari salah satu instance EC2.

---

## 1. Uji Distribusi Beban ALB (Round-Robin Test)

Gunakan perintah ini untuk memverifikasi bahwa Application Load Balancer membagi traffic secara bergantian ke instance di `us-east-1a` dan `us-east-1b`.

### Dari Bash / Git Bash / PowerShell / Terminal:
Ganti `<ALB-DNS-NAME>` dengan DNS name Load Balancer Anda (misal: `three-tier-alb-123456789.us-east-1.elb.amazonaws.com`).

```bash
# Uji 10 kali request berurutan untuk melihat instance ID dan AZ yang merespons
for i in {1..10}; do
  curl -s "http://<ALB-DNS-NAME>/api/node-info" | grep -o '"instanceId":"[^"]*"' ;
  sleep 0.5;
done
```

**Hasil yang diharapkan**:
Output akan menampilkan ID instance yang bergantian (contoh: `i-0a1b2c...` kemudian `i-0f8e9d...`).

---

## 2. Uji Beban HTTP Menggunakan Apache Bench (`ab`)

Apache Bench mengirimkan ribuan request konkuren untuk menaikkan utilisasi CPU web server.

### Instalasi Apache Bench (Opsional di mesin lokal / Linux EC2):
- Ubuntu/Debian: `sudo apt-get install apache2-utils`
- Amazon Linux / CentOS: `sudo dnf install httpd-tools -y`
- Mac: `ab` sudah terpasang secara bawaan.

### Menjalankan Uji Beban Konkuren:
```bash
# 50.000 total request dengan 100 koneksi simultan (concurrency)
ab -n 50000 -c 100 http://<ALB-DNS-NAME>/
```

---

## 3. Uji Beban CPU Langsung via Browser / Endpoint Bawaan

Aplikasi Node.js Fase 3 sudah dilengkapi endpoint khusus `/api/stress` yang menghitung fungsi matematika berulang untuk memicu lonjakan CPU.

### Cara A: Klik Tombol di Browser
Buka antarmuka web di browser melalui DNS ALB, lalu klik tombol **"Spike CPU Beban 15s"**.

### Cara B: Perulangan Bash Curl (Sangat Efektif untuk Auto Scaling)
Jalankan satu baris perintah ini di terminal Anda:
```bash
while true; do
  curl -s "http://<ALB-DNS-NAME>/api/stress?duration=10000" > /dev/null &
  sleep 0.2;
done
```
*Tekan `Ctrl + C` jika ingin menghentikan pengujian.*

---

## 4. Uji Stres Komputasi via SSH (`stress` tool)

Jika Anda ingin membakar CPU langsung dari dalam instance EC2:
1. Hubungkan SSH ke salah satu instance EC2:
   ```bash
   ssh -i ~/.ssh/labsuser.pem ec2-user@<PUBLIC-IP-EC2>
   ```
2. Pasang tool `stress`:
   ```bash
   sudo dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm
   sudo dnf install -y stress
   ```
3. Pacu beban CPU ke 100% selama 5 menit (300 detik):
   ```bash
   stress --cpu 2 --timeout 300s
   ```

Pantau grafik di **EC2 Console > Auto Scaling Groups > Monitoring** atau **CloudWatch Alarms** untuk menyaksikan instance baru otomatis lahir (*Scale-Out*)!
