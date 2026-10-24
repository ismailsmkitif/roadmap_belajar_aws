# 📘 Panduan Lengkap: Konsep, Peran, & Konfigurasi Service AWS (Roadmap 4 Fase)

Dokumen ini merangkum konsep dasar, peran spesifik, dan langkah-langkah konfigurasi kunci dari layanan-layanan AWS yang terdapat dalam repositori [roadmap_belajar_aws](https://github.com/ismailsmkitif/roadmap_belajar_aws/tree/main). 

## ⚠️ Aturan Lingkungan AWS Academy Learner Lab (Wajib Dipatuhi)
1. **Region**: Selalu gunakan **`us-east-1`** (N. Virginia).
2. **IAM Role**: Dilarang membuat IAM Role/Policy baru secara manual. Selalu gunakan **`LabRole`** dan **`LabInstanceProfile`**.
3. **EC2 Instance**: Gunakan tipe **`t3.micro`** dengan Key Pair **`vockey`**.
4. **RDS**: Gunakan engine **MySQL**, tipe **`db.t3.micro`**, Single-AZ, dan *Public Access: No*.
5. **Timer Sesi**: Sesi berdurasi 4 jam. Selalu klik **End Lab** setelah selesai untuk menghemat kredit.

---

## 🏗️ Fase 1: Static Website & CDN
*Fokus: Hosting website statis yang aman, cepat, dan terdistribusi secara global.*

### 1. Amazon S3 (Simple Storage Service)
- **Konsep**: Layanan penyimpanan objek (*object storage*) yang sangat tahan lama, aman, dan skalabel.
- **Peran dalam Roadmap Ini**: Bertindak sebagai **Origin Server** atau tempat penyimpanan utama untuk file-file statis website (`index.html`, `style.css`, `error.html`). Bucket diatur menjadi *Private* agar tidak bisa diakses publik secara langsung, memaksa trafik melewati lapisan keamanan CloudFront.
- **Hal yang Perlu Disetting**:
  1. Buat Bucket dengan nama unik di Region `us-east-1`.
  2. Biarkan **Block Public Access** tetap **Enabled** (Nyala).
  3. Upload file aset website ke dalam bucket.
  4. Siapkan untuk menerima *Bucket Policy* dari CloudFront (OAC) di tab *Permissions*.

### 2. Amazon CloudFront
- **Konsep**: Layanan *Content Delivery Network* (CDN) global yang mendistribusikan konten melalui jaringan *edge server* untuk latensi rendah.
- **Peran dalam Roadmap Ini**: Bertindak sebagai **"Wajah Publik"** website. Ia mengambil konten dari S3 yang privat, menyimpannya di *cache* edge, dan menyajikannya ke pengguna via HTTPS. Menggunakan **OAC (Origin Access Control)** untuk memastikan *hanya* CloudFront yang diizinkan membaca isi bucket S3.
- **Hal yang Perlu Disetting**:
  1. Buat *Distribution* jenis *Web*.
  2. Pilih bucket S3 sebagai **Origin Domain**.
  3. Pada **Origin Access**, pilih **Origin Access Control settings (OAC)** dan buat baru.
  4. Set **Viewer Protocol Policy** ke **Redirect HTTP to HTTPS**.
  5. Salin *Bucket Policy* yang di-generate CloudFront dan tempel di pengaturan *Permissions* bucket S3.

---

## 🏗️ Fase 2: Three-Tier Web App
*Fokus: Membangun arsitektur aplikasi web klasik yang memisahkan lapisan presentasi, logika, dan data.*

### 3. VPC (Virtual Private Cloud) & Internet Gateway (IGW)
- **Konsep**: VPC adalah jaringan virtual terisolasi di AWS. IGW memungkinkan komunikasi antara sumber daya di dalam VPC (dengan IP publik) dan internet.
- **Peran dalam Roadmap Ini**: Menjadi **fondasi jaringan** yang memisahkan lingkungan. Subnet Publik (dengan rute ke IGW) untuk komponen yang perlu diakses internet (EC2 Web Tier), dan Subnet Privat untuk komponen yang harus terisolasi (RDS Database).
- **Hal yang Perlu Disetting**:
  1. Gunakan *Default VPC* di `us-east-1`.
  2. Pastikan Public Subnet memiliki Route Table dengan rute `0.0.0.0/0` yang mengarah ke Internet Gateway.

### 4. Amazon EC2 (Elastic Compute Cloud)
- **Konsep**: Server virtual (*instance*) yang dapat dikonfigurasi kapasitas dan sistem operasinya.
- **Peran dalam Roadmap Ini**: Bertindak sebagai **Web/App Tier**. Server ini menjalankan kode aplikasi (misalnya Node.js atau Python) yang memproses permintaan pengguna dan berkomunikasi dengan database.
- **Hal yang Perlu Disetting**:
  1. Pilih AMI (Amazon Linux 2023/Ubuntu) dan Instance Type **`t3.micro`**.
  2. Pilih Key Pair **`vockey`**.
  3. Letakkan di **Public Subnet** dengan *Auto-assign Public IP: Enable*.
  4. **Security Group**: Izinkan *Inbound* HTTP (Port 80) dari `0.0.0.0/0` dan SSH (Port 22) dari IP Anda.
  5. Gunakan **User Data** untuk menginstal web server/app secara otomatis saat *booting*.

### 5. Amazon RDS (Relational Database Service)
- **Konsep**: Layanan database relasional terkelola (*managed*). AWS menangani *provisioning*, *patching*, *backup*, dan *recovery*.
- **Peran dalam Roadmap Ini**: Bertindak sebagai **Data Tier**. Menyediakan database MySQL yang berjalan di subnet privat, sehingga hanya bisa diakses oleh server EC2, bukan langsung dari internet, menjamin keamanan data.
- **Hal yang Perlu Disetting**:
  1. Pilih Engine **MySQL**, Template **Free Tier**, Instance Class **`db.t3.micro`**.
  2. Letakkan di **Private Subnet**.
  3. Set **Public Access** ke **No**.
  4. **Security Group**: Izinkan *Inbound* MySQL (Port 3306) **hanya dari Security Group milik EC2** (bukan `0.0.0.0/0`).

---

## 🏗️ Fase 3: High Availability & Scaling
*Fokus: Meningkatkan arsitektur Fase 2 agar tahan terhadap kegagalan (*fault-tolerant*) dan bisa menyesuaikan diri dengan lonjakan trafik.*

### 6. Application Load Balancer (ALB)
- **Konsep**: Penyeimbang beban Layer 7 (HTTP/HTTPS) yang mendistribusikan lalu lintas ke beberapa target di berbagai *Availability Zone* (AZ).
- **Peran dalam Roadmap Ini**: Menjadi **satu titik masuk (*single entry point*)** bagi pengguna. ALB menyembunyikan IP address EC2 di belakangnya dan membagi trafik secara merata ke beberapa server EC2 agar tidak ada satu server yang kelebihan beban (*single point of failure* dihilangkan).
- **Hal yang Perlu Disetting**:
  1. Scheme: **Internet-facing**.
  2. Network Mapping: Pilih minimal **2 Public Subnet** yang berbeda AZ (misal: `us-east-1a` dan `us-east-1b`).
  3. **Security Group**: Izinkan *Inbound* HTTP (80) dan HTTPS (443) dari `0.0.0.0/0`.
  4. Buat **Target Group** tipe *Instance* (Port 80) dengan *Health Checks* aktif.

### 7. Auto Scaling Group (ASG)
- **Konsep**: Layanan yang secara otomatis menambah (*scale out*) atau mengurangi (*scale in*) jumlah instance EC2 berdasarkan kondisi tertentu.
- **Peran dalam Roadmap Ini**: Bekerja sama dengan ALB untuk **menjaga ketersediaan dan mengoptimalkan biaya**. Saat trafik tinggi (CPU naik), ASG membuat EC2 baru. Saat trafik rendah, ASG mematikan EC2 yang tidak diperlukan.
- **Hal yang Perlu Disetting**:
  1. Buat **Launch Template** (menggunakan `t3.micro`, `vockey`, dan *User Data* yang sama).
  2. Network: Pilih **Private Subnet** (Best Practice: EC2 di belakang ALB tidak butuh IP publik).
  3. Capacity: *Desired*: 1, *Minimum*: 1, *Maximum*: 3.
  4. Scaling Policy: *Target Tracking* pada *Average CPU Utilization* (target 50-60%).
  5. Attach ke **Target Group** ALB yang sudah dibuat.

### 8. Amazon CloudWatch & Amazon SNS
- **Konsep**: CloudWatch untuk memantau metrik dan log. SNS untuk mengirim notifikasi *publish/subscribe* (email/SMS).
- **Peran dalam Roadmap Ini**: Bertindak sebagai **sistem peringatan dini**. CloudWatch memantau kesehatan sistem (misalnya, CPU ASG), dan jika melewati ambang batas, ia memicu SNS untuk mengirim email alert kepada administrator.
- **Hal yang Perlu Disetting**:
  1. Buat **SNS Topic** (Standard) dan lakukan **Subscribe** menggunakan Email (konfirmasi via inbox email).
  2. Buat **CloudWatch Alarm** pada metrik `CPUUtilization` dari ASG.
  3. Set threshold (misal: >= 70% selama 2 periode).
  4. Pada aksi "In alarm state", pilih **Send notification to** SNS Topic yang dibuat.

---

## 🏗️ Fase 4: Serverless REST API & CI/CD
*Fokus: Beralih ke arsitektur modern tanpa server (*serverless*) dan mengotomatisasi deployment.*

### 9. Amazon DynamoDB
- **Konsep**: Layanan database NoSQL *key-value* yang sepenuhnya terkelola, sangat cepat, dan skalabel secara otomatis.
- **Peran dalam Roadmap Ini**: Bertindak sebagai **penyimpanan data untuk aplikasi serverless**. Karena tidak ada server yang perlu di-*provision*, DynamoDB (mode On-Demand) sangat cocok untuk menangani permintaan baca/tulis dari Lambda secara instan tanpa manajemen kapasitas manual.
- **Hal yang Perlu Disetting**:
  1. Buat Table (misal: `TodoTable`).
  2. Tentukan **Partition Key** (misal: `id` tipe String).
  3. Pilih **On-Demand** untuk *Read/write capacity*.

### 10. AWS Lambda
- **Konsep**: Komputasi *event-driven* yang menjalankan kode sebagai respons terhadap sebuah peristiwa, tanpa perlu mengelola server.
- **Peran dalam Roadmap Ini**: Bertindak sebagai **mesin logika bisnis (App Tier serverless)**. Ia menerima permintaan dari API Gateway, memproses data (misalnya, validasi atau transformasi), dan menyimpan/mengambil data dari DynamoDB.
- **Hal yang Perlu Disetting**:
  1. Function Name: Misal `ApiHandler`, Runtime: **Python 3.12**.
  2. Execution Role: Buat role baru dengan izin dasar Lambda.
  3. **Permissions**: Tambahkan policy **`AmazonDynamoDBFullAccess`** (atau inline policy spesifik) ke Role tersebut agar Lambda bisa mengakses database.
  4. Upload kode `app.py` yang menangani *event* API Gateway.

### 11. Amazon API Gateway
- **Konsep**: Layanan terkelola untuk membuat, mempublikasikan, dan mengamankan API pada skala apa pun.
- **Peran dalam Roadmap Ini**: Bertindak sebagai **"Pintu Depan" (Front Door)** aplikasi. Ia menerima permintaan HTTP/HTTPS dari klien (browser/mobile), melakukan validasi awal, dan meneruskan permintaan (*route*) tersebut ke fungsi Lambda yang sesuai.
- **Hal yang Perlu Disetting**:
  1. Pilih jenis **HTTP API** (lebih murah dan sederhana).
  2. Integrasi: Pilih fungsi **Lambda** (`ApiHandler`).
  3. Configure Routes: Tentukan Method (misal: `POST`) dan Path (misal: `/items`).
  4. Aktifkan **CORS** jika dipanggil dari frontend yang berbeda domain.
  5. **Deploy** API untuk mendapatkan *Invoke URL*.

### 12. AWS SAM (Serverless Application Model)
- **Konsep**: Framework *open-source* (ekstensi AWS CloudFormation) untuk menyederhanakan penulisan infrastruktur sebagai kode (*Infrastructure as Code* / IaC) khusus aplikasi serverless.
- **Peran dalam Roadmap Ini**: Bertindak sebagai **alat otomatisasi dan standarisasi**. Alih-alih mengklik satu per satu di konsol untuk membuat Lambda, API Gateway, dan DynamoDB, SAM mendefinisikan semuanya dalam satu file `template.yaml` yang bisa di-deploy secara konsisten melalui pipeline CI/CD (GitHub Actions).
- **Hal yang Perlu Disetting**:
  1. Buat file **`template.yaml`** yang mendefinisikan resource `AWS::Serverless::Function`, `AWS::Serverless::Api`, dan izin DynamoDB.
  2. Install **AWS CLI** dan **AWS SAM CLI** di lingkungan development Anda.
  3. Jalankan perintah `sam build` lalu `sam deploy --guided` untuk membuat seluruh stack secara otomatis melalui CloudFormation.

---

## 💡 Tips Penting & Jebakan Umum (Common Pitfalls)
1. **LabRole adalah Kunci**: Jangan membuat IAM Role/Policy manual. Gunakan `LabRole` dan `LabInstanceProfile` yang disediakan.
2. **Konsistensi Region**: Pastikan *selector* region selalu **N. Virginia (us-east-1)**. Salah region = resource tidak saling menemukan (misal: Lambda tidak bisa akses DynamoDB).
3. **Manajemen Timer Sesi**: Selalu klik **End Lab** setelah selesai. Sesi yang *idle* akan berakhir paksa, berpotensi menghapus pekerjaan yang belum di-*commit* atau di-*save*.
4. **Prinsip Least Privilege pada Security Group**: Jangan pernah membuka Port 3306 (MySQL) ke `0.0.0.0/0`. Selalu batasi agar hanya Security Group EC2 (Fase 2) atau Lambda (Fase 4) yang bisa mengakses RDS/DynamoDB.

