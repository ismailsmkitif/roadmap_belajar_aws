# Panduan Praktik Console — FASE 2: Three-Tier Web Application (VPC, EC2 & RDS)

Arsitektur: **User -> Internet Gateway -> EC2 (Subnet Publik) -> RDS MySQL (Subnet Privat)**  
Lingkungan: **AWS Academy Learner Lab (Region: us-east-1)**

---

## DAFTAR ISI HARIAN
- [Hari 1: Membangun Custom VPC Manual (4 Subnet, IGW, Route Tables)](#hari-1-membangun-custom-vpc-manual-4-subnet-igw-route-tables)
- [Hari 2: Security Groups Berjenjang (web-sg, db-sg) & Analisis Default NACL](#hari-2-security-groups-berjenjang-web-sg-db-sg--analisis-default-nacl)
- [Hari 3: Peluncuran EC2 Web Tier, User Data, Snapshot EBS & Pembuatan AMI](#hari-3-peluncuran-ec2-web-tier-user-data-snapshot-ebs--pembuatan-ami)
- [Hari 4: DB Subnet Group & Provisi Amazon RDS MySQL (Single-AZ Private)](#hari-4-db-subnet-group--provisi-amazon-rds-mysql-single-az-private)
- [Hari 5: Deployment Aplikasi Node.js & Integrasi Database via .env](#hari-5-deployment-aplikasi-nodejs--integrasi-database-via-env)
- [Hari 6: ⚠️ Uji Coba NAT Gateway Singkat & Skenario Debugging](#hari-6-️-uji-coba-nat-gateway-singkat--skenario-debugging)
- [Hari 7: Ringkasan Arsitektur, Refleksi & Checklist Cleanup](#hari-7-ringkasan-arsitektur-refleksi--checklist-cleanup)

---

## HARI 1: Membangun Custom VPC Manual (4 Subnet, IGW, Route Tables)

### Langkah 1.1: Membuat Custom VPC Manual
1. **Tujuan**: Membuat jaringan virtual pribadi terisolasi dengan blok IP `10.0.0.0/16` menggunakan opsi "VPC only".
2. **Jalur menu**: VPC Console > **Your VPCs** > tombol **Create VPC**.
3. **Nilai isian**:

| Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- |
| **Resources to create** | **VPC only** | Jangan pilih "VPC and more" agar tidak otomatis membuat NAT Gateway |
| **Name tag** | `three-tier-vpc` | Identitas VPC proyek |
| **IPv4 CIDR manual input** | `10.0.0.0/16` | Memberikan ruang hingga 65.536 IP privat |
| **Tenancy** | **Default** | Menghindari biaya dedicated hardware |

4. **Verifikasi**: Klik **Create VPC**. VPC berstatus `Available`.
5. **Jebakan umum**: Terpilih opsi default "VPC and more" yang otomatis membuat NAT Gateway (berbayar per jam).
6. **Biaya/risiko**: Aman.

---

### Langkah 1.2: Membuat 4 Subnet Manual (2 Publik + 2 Privat di 2 AZ)
1. **Tujuan**: Membagi ruang IP VPC ke 2 AZ (`us-east-1a` dan `us-east-1b`) untuk kebutuhan Multi-AZ RDS.
2. **Jalur menu**: VPC Console > Panel kiri: **Subnets** > tombol **Create subnet**.
3. **Nilai isian**:
   - Pilih VPC ID: `three-tier-vpc`.
   - Buat 4 subnet berikut menggunakan tombol **Add new subnet**:

| Subnet name | Availability Zone | IPv4 CIDR block | Tipe Tier |
| :--- | :--- | :--- | :--- |
| `public-subnet-1a` | `us-east-1a` | `10.0.1.0/24` | Web/App Tier (AZ-A) |
| `public-subnet-1b` | `us-east-1b` | `10.0.2.0/24` | Standby / LB (AZ-B) |
| `private-subnet-1a` | `us-east-1a` | `10.0.11.0/24` | RDS MySQL Tier (AZ-A) |
| `private-subnet-1b` | `us-east-1b` | `10.0.12.0/24` | RDS MySQL Tier (AZ-B) |

4. **Verifikasi**: Klik **Create subnet**. Ke-4 subnet terdaftar dengan status `Available`.
5. **Jebakan umum**: Alokasi subnet privat hanya di 1 AZ. RDS DB Subnet Group mewajibkan minimal 2 AZ berbeda!
6. **Biaya/risiko**: Aman.

---

### Langkah 1.3: Mengaktifkan Auto-assign Public IP di Subnet Publik
1. **Tujuan**: Agar instance EC2 di subnet publik otomatis mendapatkan Public IPv4.
2. **Jalur menu**: VPC Console > **Subnets** > Centang `public-subnet-1a` > **Actions** > **Edit subnet settings**.
3. **Nilai isian**: Centang **Enable auto-assign public IPv4 address** > Klik **Save**.
4. **Ulangi**: Lakukan langkah yang sama untuk `public-subnet-1b`. (Subnet privat biarkan `No`).
5. **Verifikasi**: Kolom *Auto-assign public IPv4* untuk kedua subnet publik bernilai **Yes**.
6. **Biaya/risiko**: Aman.

---

### Langkah 1.4: Membuat dan Menempelkan Internet Gateway (IGW)
1. **Tujuan**: Memasang gateway lalu lintas keluar/masuk internet ke VPC kita.
2. **Jalur menu**: VPC Console > **Internet gateways** > tombol **Create internet gateway**.
3. **Nilai isian**: Name tag: `three-tier-igw` > Klik **Create internet gateway**.
4. **Attach ke VPC**: Di halaman detail IGW, klik **Actions** > **Attach to VPC** > Pilih `three-tier-vpc` > Klik **Attach**.
5. **Verifikasi**: Status IGW berwarna hijau **Attached**.
6. **Jebakan umum**: Membuat IGW tetapi lupa melakukan *Attach to VPC*.
7. **Biaya/risiko**: Aman.

---

### Langkah 1.5: Route Table Publik & Privat
1. **Tujuan**: Menghubungkan subnet publik ke IGW dan menjaga subnet privat tetap lokal.
2. **Jalur menu**: VPC Console > **Route tables** > tombol **Create route table**.
3. **Langkah Route Table Publik**:
   - Buat RT dengan nama `public-rt`, VPC: `three-tier-vpc`.
   - Di tab **Routes** > **Edit routes** > Add route: `0.0.0.0/0` target: Internet Gateway `three-tier-igw` > **Save changes**.
   - Di tab **Subnet associations** > **Edit subnet associations** > Centang `public-subnet-1a` dan `public-subnet-1b` > **Save**.
4. **Langkah Route Table Privat**:
   - Buat RT dengan nama `private-rt`, VPC: `three-tier-vpc`.
   - Biarkan tab **Routes** hanya berisi rute lokal `10.0.0.0/16` -> `local`.
   - Di tab **Subnet associations** > **Edit subnet associations** > Centang `private-subnet-1a` dan `private-subnet-1b` > **Save**.
5. **Verifikasi**: Subnet publik memiliki rute `0.0.0.0/0` ke IGW; subnet privat hanya memiliki rute lokal.
6. **Biaya/risiko**: Aman.

---

## HARI 2: Security Groups Berjenjang (web-sg, db-sg) & Analisis Default NACL

### Langkah 2.1: Membuat web-sg (Tier Web/Komputasi)
1. **Tujuan**: Mengatur firewall virtual instance EC2 agar menerima traffic HTTP publik dan SSH aman.
2. **Jalur menu**: EC2 Console atau VPC Console > Panel kiri: **Security Groups** > tombol **Create security group**.
3. **Nilai isian**:

| Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- |
| **Security group name** | `web-sg` | Identitas SG web tier |
| **Description** | `Allow HTTP and SSH to Web Instances` | Deskripsi fungsi |
| **VPC** | Pilih `three-tier-vpc` | Sangat penting: jangan pilih default VPC |
| **Inbound rule 1** | Type: **HTTP**, Port: `80`, Source: **Anywhere-IPv4 (`0.0.0.0/0`)** | Mengizinkan pengunjung membuka website |
| **Inbound rule 2** | Type: **SSH**, Port: `22`, Source: **My IP** | Membatasi akses remote terminal hanya dari IP publik Anda |
| **Outbound rules** | Type: **All traffic**, Destination: `0.0.0.0/0` | Mengizinkan server mengunduh update paket OS |

4. **Verifikasi**: Klik **Create security group**. `web-sg` terdaftar dan terikat ke `three-tier-vpc`.
5. **Jebakan umum**: Mengizinkan SSH dari `0.0.0.0/0` (berisiko brute force). Selalu utamakan opsi **My IP**.
6. **Biaya/risiko**: Aman.

---

### Langkah 2.2: Membuat db-sg dengan Referensi ke web-sg (Prinsip Least Privilege)
1. **Tujuan**: Mengamankan database RDS agar HANYA menerima koneksi MySQL port 3306 dari instance yang memiliki `web-sg`.
2. **Jalur menu**: VPC Console > **Security Groups** > tombol **Create security group**.
3. **Nilai isian**:

| Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- |
| **Security group name** | `db-sg` | Identitas SG database tier |
| **Description** | `Allow MySQL 3306 only from web-sg` | Deskripsi fungsi |
| **VPC** | `three-tier-vpc` | VPC proyek |
| **Inbound rule 1** | Type: **MySQL/Aurora**, Port: `3306`, Source: **Custom** > ketik `sg-` lalu pilih ID `web-sg` | Mengikat izin ke identitas Security Group web, bukan ke IP statis |

4. **Verifikasi**: Pada kolom *Source* di `db-sg`, tertulis ID dari `web-sg` (misal: `sg-0abc123...`).
5. **Pelajaran arsitektur**: Jika instance web bertambah atau berganti IP (seperti pada Auto Scaling), database tetap mengizinkannya secara dinamis karena acuannya adalah keanggotaan `web-sg`.
6. **Biaya/risiko**: Aman.

---

### Langkah 2.3: Memeriksa Default Network ACL (NACL)
1. **Tujuan**: Menganalisis lapisan keamanan subnet level (stateless) vs Security Group (stateful).
2. **Jalur menu**: VPC Console > **Network ACLs** > Pilih default NACL `three-tier-vpc`.
3. **Observasi**:
   - Inbound Rules: Rule #100 `ALL Traffic` dari `0.0.0.0/0` bernilai **ALLOW**.
   - Outbound Rules: Rule #100 `ALL Traffic` ke `0.0.0.0/0` bernilai **ALLOW**.
4. **Pelajaran**: Default NACL bersifat terbuka (*allow all*). Titik kendali isolasi utama tier kita diatur ketat pada tingkat **Security Group**.
5. **Biaya/risiko**: Aman.

---

## HARI 3: Peluncuran EC2 Web Tier, User Data, Snapshot EBS & Pembuatan AMI

### Langkah 3.1: Meluncurkan Instance EC2 Web Tier
1. **Tujuan**: Menyediakan server komputasi web di subnet publik menggunakan AMI Amazon Linux 2023 dan kredensial bawaan lab.
2. **Jalur menu**: EC2 Console > **Instances** > tombol **Launch instances**.
3. **Nilai isian**:

| Bagian Form | Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- | :--- |
| **Name** | `three-tier-web-server` | Nama instance |
| **OS Images** | **Amazon Linux 2023 AMI** | OS standar AWS terbaru |
| **Instance type** | `t3.micro` | Ukuran hemat biaya yang didukung lab |
| **Key pair** | `vockey` | Key pair bawaan Learner Lab |
| **Network settings** | **VPC**: `three-tier-vpc` | VPC kustom kita |
| | **Subnet**: `public-subnet-1a` | Menempatkan server di tier publik |
| | **Auto-assign public IP**: **Enable** | Mendapatkan IP publik |
| | **Security groups**: **Select existing** > `web-sg` | Menerapkan firewall HTTP & SSH |
| **Advanced details** | **IAM instance profile**: `LabInstanceProfile` | Memberi izin IAM instance di Learner Lab |
| | **User data**: Salin isi berkas [user-data.sh](file:///e:/2026/Materi/cloud%20computing/road_belajar/phase2-three-tier/user-data.sh) | Bootstrap otomatis Node.js & dependencies |

4. **Verifikasi**: Klik **Launch instance**. Tunggu status instance berubah menjadi **Running** dan *Status check* **2/2 checks passed**.
5. **Biaya/risiko**: Aman (t3.micro dicakup kredit lab).

---

### Langkah 3.2: Snapshot EBS dan Pembuatan AMI (Golden Image)
1. **Tujuan**: Menyimpan citra mesin utuh yang siap dilipatgandakan untuk Auto Scaling di Fase 3.
2. **Jalur menu**: EC2 Console > Centang `three-tier-web-server` > **Actions** > **Image and templates** > **Create image**.
3. **Nilai isian**:
   - Image name: `three-tier-web-ami`
   - Image description: `AMI aplikasi 3-tier Node.js dengan webapp service`
   - Klik **Create image**.
4. **Verifikasi**: Buka panel kiri **AMIs**. Citra `three-tier-web-ami` akan berstatus `Available` setelah beberapa menit.
5. **Biaya/risiko**: Aman.

---

## HARI 4: DB Subnet Group & Provisi Amazon RDS MySQL (Single-AZ Private)

### Langkah 4.1: Membuat DB Subnet Group
1. **Tujuan**: Mendaftarkan subnet privat lintas 2 AZ tempat mesin database RDS boleh dialokasikan.
2. **Jalur menu**: RDS Console > Panel kiri: **Subnet groups** > tombol **Create DB subnet group**.
3. **Nilai isian**:

| Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- |
| **Name** | `three-tier-db-subnet-group` | Identitas subnet group |
| **Description** | `Subnet privat untuk RDS MySQL` | Deskripsi |
| **VPC** | `three-tier-vpc` | VPC proyek |
| **Availability Zones** | Pilih `us-east-1a` dan `us-east-1b` | Minimal 2 AZ sesuai syarat RDS |
| **Subnets** | Centang subnet dengan CIDR `10.0.11.0/24` dan `10.0.12.0/24` (`private-subnet-1a` & `private-subnet-1b`) | Menjamin RDS HANYA hidup di subnet privat |

4. **Verifikasi**: Klik **Create**. Subnet group muncul dengan 2 subnet terdaftar.
5. **Jebakan umum**: Memasukkan subnet publik ke DB Subnet Group. Jika dilakukan, ada risiko instance DB mendapatkan IP publik.
6. **Biaya/risiko**: Aman.

---

### Langkah 4.2: Meluncurkan Database Amazon RDS MySQL
1. **Tujuan**: Membangun database relasional terkelola (Managed Service) Single-AZ yang aman di subnet privat.
2. **Jalur menu**: RDS Console > **Databases** > tombol **Create database**.
3. **Nilai isian**:

| Bagian Form | Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- | :--- |
| **Engine options** | **MySQL** (Versi default MySQL 8.0) | Engine database relasional |
| **Templates** | **Free tier** | Membatasi opsi ke konfigurasi Single-AZ hemat biaya |
| **Settings** | **DB instance identifier**: `three-tier-db` | Nama instance RDS |
| | **Master username**: `admin` | Akun administrator DB |
| | **Master password**: Masukkan password kuat (misal: `LabAws2026Password!`) | Kredensial rahasia |
| **Instance configuration** | **db.t3.micro** | Tipe instance RDS standar lab |
| **Storage** | **Allocated storage**: `20 GiB`, Matikan Storage autoscaling | Menghemat alokasi biaya penyimpanan |
| **Connectivity** | **Virtual private cloud (VPC)**: `three-tier-vpc` | VPC kustom kita |
| | **DB subnet group**: `three-tier-db-subnet-group` | Subnet privat kita |
| | **Public access**: **No** | **Sangat Penting:** Tidak mengizinkan IP publik |
| | **VPC security group (firewall)**: **Choose existing** > hapus default > pilih **`db-sg`** | Mengunci port 3306 hanya dari `web-sg` |
| **Additional configuration** | **Initial database name**: `webappdb` | Otomatis membuat skema database awal |
| | Matikan Automated backups / Performance Insights | Mempercepat provisi dan hemat kredit |

4. **Verifikasi**: Klik **Create database**. Status database berubah dari *Creating* menjadi **Available** (proses membutuhkan waktu 5–10 menit). Salin **Endpoint** database (misal: `three-tier-db.c9xxx.us-east-1.rds.amazonaws.com`).
5. **Biaya/risiko**: Aman (RDS db.t3.micro Single-AZ dicakup kredit lab).

---

## HARI 5: Deployment Aplikasi Node.js & Integrasi Database via .env

### Langkah 5.1: Konfigurasi File .env Langsung di Server EC2
1. **Tujuan**: Menghubungkan aplikasi web Node.js ke database RDS tanpa menyimpan password di repository publik.
2. **Jalur menu**: Hubungkan SSH ke instance EC2 Anda via terminal:
   ```bash
   ssh -i ~/.ssh/labsuser.pem ec2-user@<PUBLIC-IP-EC2>
   ```
3. **Langkah di server**:
   - Unggah atau buat file `server.js` dan folder `public` dari repo lokal ke `/opt/webapp/`.
   - Buka file `/opt/webapp/.env` menggunakan nano:
     ```bash
     sudo nano /opt/webapp/.env
     ```
   - Isi kredensial asli RDS Anda:
     ```env
     PORT=80
     DB_HOST=three-tier-db.c9xxxx.us-east-1.rds.amazonaws.com
     DB_PORT=3306
     DB_USER=admin
     DB_PASSWORD=PasswordRahasiaAnda
     DB_NAME=webappdb
     ```
   - Simpan (`Ctrl + O`, `Enter`) dan keluar (`Ctrl + X`).
   - Buat service systemd dan jalankan aplikasi:
     ```bash
     sudo systemctl restart webapp
     # atau jalankan manual bila belum ada service:
     cd /opt/webapp && sudo node server.js
     ```

4. **Verifikasi**: Buka browser di laptop Anda dan akses `http://<PUBLIC-IP-EC2>`.
   - Indikator database berubah menjadi hijau: **Terhubung (Port 3306)**.
   - Form Uji Tulis/Baca dapat digunakan: Masukkan catatan, klik *Simpan ke RDS MySQL*, dan catatan langsung muncul di tabel.
5. **Uji Keamanan**: Coba koneksikan MySQL Workbench atau DBeaver di laptop Anda langsung ke RDS Endpoint. Hasilnya **pasti timeout/gagal**, membuktikan database privat terlindungi total dari internet publik!
6. **Biaya/risiko**: Aman.

---

## HARI 6: ⚠️ Uji Coba NAT Gateway Singkat & Skenario Debugging

> [!WARNING]
> NAT Gateway adalah resource **berbayar per jam** (~$0.045/jam) di AWS. Langkah ini dilakukan singkat untuk memahami fungsinya, lalu **WAJIB LANGSUNG DIHAPUS** beserta Elastic IP-nya!

### Langkah 6.1: Menjalankan NAT Gateway Singkat
1. **Tujuan**: Memahami bagaimana instance di subnet privat dapat mengakses internet keluar (misal: untuk patch OS) tanpa membuka akses masuk dari luar.
2. **Jalur menu**: VPC Console > **NAT gateways** > tombol **Create NAT gateway**.
3. **Nilai isian**:
   - Name: `temp-nat-gw`
   - Subnet: `public-subnet-1a` (NAT Gateway WAJIB berada di subnet publik!)
   - Elastic IP allocation ID: Klik tombol **Allocate Elastic IP**.
   - Klik **Create NAT gateway**.
4. **Perutean Subnet Privat**:
   - Buka **Route tables** > Pilih `private-rt` > Tab **Routes** > **Edit routes**.
   - Tambahkan route: Destination `0.0.0.0/0` > Target: **NAT Gateway** (`temp-nat-gw`) > **Save changes**.
   - Sekarang semua resource di subnet privat bisa melakukan ping/curl keluar ke internet!

---

### Langkah 6.2: ⚠️ PEMBERSIHAN SEGERA NAT Gateway & Elastic IP
1. **Hapus Rute**: Buka `private-rt` > **Edit routes** > Hapus baris rute `0.0.0.0/0` ke NAT Gateway > **Save changes**.
2. **Hapus NAT Gateway**: Buka **NAT gateways** > Centang `temp-nat-gw` > **Actions** > **Delete NAT gateway** > Ketik `delete`.
3. **Release Elastic IP**: Buka panel kiri **Elastic IPs** > Centang IP yang tadi dialokasikan > **Actions** > **Release Elastic IP addresses** > Konfirmasi. (EIP yang tidak terpakai dikenakan denda per jam jika tidak dirilis!).
4. **Verifikasi**: NAT Gateway berstatus *Deleted*, dan daftar Elastic IP kosong.

---

### Langkah 6.3: Latihan Debugging Jaringan
1. **Skenario Rusak 1 (Security Group)**: Ubah Inbound rule `db-sg`, ganti source port 3306 dari `web-sg` menjadi IP salah. Buka website Anda dan klik "Cek Koneksi Ulang". Website langsung menampilkan status *Terputus/Database Disconnected*. Kembalikan ke `web-sg`.
2. **Skenario Rusak 2 (Route Table)**: Hapus rute `0.0.0.0/0` dari `public-rt`. Website langsung tidak dapat diakses dari browser. Pasang kembali target `three-tier-igw`.

---

## HARI 7: Ringkasan Arsitektur, Refleksi & Checklist Cleanup

### Jawaban Pertanyaan Refleksi Fase 2
1. **Kenapa Database diletakkan di Subnet Privat?**  
   *Mencegah akses langsung dari internet publik, meminimalkan attack surface dari serangan SQL Injection langsung, brute force port database, atau ransomware. Database hanya boleh diajak berkomunikasi oleh aplikasi backend internal.*
2. **Kenapa db-sg merujuk ke web-sg (bukan IP statis)?**  
   *Referensi Security Group bersifat dinamis. Ketika instance web bertambah atau berganti IP privat karena Auto Scaling atau pergantian server, database secara otomatis mengizinkan instance tersebut tanpa perlu admin mengedit aturan IP berulang kali.*
3. **Apa perbedaan Security Group dan Network ACL (NACL)?**  
   - **Security Group**: Berada di tingkat *Instance virtual NIC*, bersifat **Stateful** (jika request masuk diizinkan, return traffic keluar otomatis diizinkan), hanya mendukung aturan *Allow*.
   - **NACL**: Berada di tingkat batas *Subnet*, bersifat **Stateless** (aturan inbound dan outbound harus didefinisikan terpisah), dievaluasi berurutan berdasarkan nomor rule, dan mendukung aturan *Allow* maupun *Deny*.

---

### Checklist Cleanup Berurutan Fase 2
- [ ] **Langkah 1 (NAT Gateway & EIP)**: Pastikan NAT Gateway sudah *Deleted* dan Elastic IP sudah di-*Release*.
- [ ] **Langkah 2 (EC2 Instance)**: Buka EC2 Console > Instances > Centang `three-tier-web-server` > **Instance state** > **Terminate instance**.
- [ ] **Langkah 3 (RDS Database)**: Buka RDS Console > Databases > Centang `three-tier-db` > **Actions** > **Delete** > Jangan centang "Create final snapshot" > Centang "I acknowledge..." > Ketik `delete me`.
- [ ] **Langkah 4 (DB Subnet Group)**: Hapus `three-tier-db-subnet-group`.
- [ ] **Langkah 5 (Security Groups)**: Hapus `db-sg`, lalu hapus `web-sg`.
- [ ] **Langkah 6 (VPC & Dependensi)**: Detach `three-tier-igw` dari VPC > Hapus `three-tier-igw` > Hapus 4 subnet > Hapus `three-tier-vpc`.
- [ ] **Langkah 7 (Vocareum)**: Klik tombol **End Lab** di portal Learner Lab.
