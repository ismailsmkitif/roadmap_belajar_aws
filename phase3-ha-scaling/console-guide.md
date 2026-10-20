# Panduan Praktik Console — FASE 3: High Availability & Elasticity (ALB & Auto Scaling)

Arsitektur: **User -> Application Load Balancer (2 AZ) -> Auto Scaling Group (EC2 Multi-AZ) -> RDS MySQL Sentral**  
Lingkungan: **AWS Academy Learner Lab (Region: us-east-1)**

---

## DAFTAR ISI HARIAN
- [Hari 1: Cetak Biru Auto Scaling (AMI & Launch Template)](#hari-1-cetak-biru-auto-scaling-ami--launch-template)
- [Hari 2: Security Group ALB, Target Group & ⚠️ Application Load Balancer Multi-AZ](#hari-2-security-group-alb-target-group--️-application-load-balancer-multi-az)
- [Hari 3: Provisi Auto Scaling Group (ASG) & Validasi ELB Health Check](#hari-3-provisi-auto-scaling-group-asg--validasi-elb-health-check)
- [Hari 4: Dynamic Scaling Policy (Target Tracking CPU 50%) & Uji Beban](#hari-4-dynamic-scaling-policy-target-tracking-cpu-50--uji-beban)
- [Hari 5: CloudWatch Dashboard, Alarm UnHealthyHostCount & Notifikasi SNS](#hari-5-cloudwatch-dashboard-alarm-unhealthyhostcount--notifikasi-sns)
- [Hari 6: Chaos Engineering Test & Konsep RDS Multi-AZ (HA vs FT)](#hari-6-chaos-engineering-test--konsep-rds-multi-az-ha-vs-ft)
- [Hari 7: Ringkasan Arsitektur, Refleksi & Checklist Cleanup](#hari-7-ringkasan-arsitektur-refleksi--checklist-cleanup)

---

## HARI 1: Cetak Biru Auto Scaling (AMI & Launch Template)

### Langkah 1.1: Membuat Launch Template
1. **Tujuan**: Membuat spesifikasi deklaratif peluncuran instance otomatis oleh Auto Scaling Group.
2. **Jalur menu**: EC2 Console > Panel kiri: **Launch Templates** > tombol **Create launch template**.
3. **Nilai isian**:

| Bagian Form | Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- | :--- |
| **Launch template name** | `ha-web-template` | Identitas template |
| **Auto Scaling guidance** | **Centang** (Provide guidance...) | Membantu penyesuaian parameter ASG |
| **Application and OS Images** | **Amazon Linux 2023 AMI** (atau AMI Fase 2 `three-tier-web-ami`) | OS dasar instance |
| **Instance type** | `t3.micro` | Ukuran hemat biaya standar lab |
| **Key pair** | `vockey` | Key pair bawaan lab |
| **Network settings** | **Subnet**: **Don't include in launch template** | **Sangat Penting:** Biarkan kosong agar ASG dapat membagi ke 2 AZ |
| | **Security groups**: `web-sg` | Firewall port 80 dan SSH |
| **Advanced details** | **IAM instance profile**: `LabInstanceProfile` | Hak akses IAM bawaan |
| | **User data**: Salin isi berkas [user-data.sh](file:///e:/2026/Materi/cloud%20computing/road_belajar/phase3-ha-scaling/user-data.sh) | Bootstrap otomatis app stateless dengan IMDSv2 |

4. **Verifikasi**: Klik **Create launch template**. Template muncul dengan `Default version: 1`.
5. **Jebakan umum**: Menentukan subnet spesifik di dalam template. Jika diisi, ASG tidak akan bisa meluncurkan instance di Multi-AZ.
6. **Biaya/risiko**: Aman.

---

## HARI 2: Security Group ALB, Target Group & ⚠️ Application Load Balancer Multi-AZ

### Langkah 2.1: Membuat alb-sg dan Memperketat web-sg
1. **Tujuan**: Mengatur agar pengunjung HANYA bisa mengakses Load Balancer, dan instance EC2 HANYA menerima traffic dari Load Balancer (bukan dari publik langsung).
2. **Jalur menu**: EC2 Console > **Security Groups** > tombol **Create security group**.
3. **Langkah A (Buat alb-sg)**:
   - Name: `alb-sg`, VPC: `three-tier-vpc`.
   - Inbound Rule: Type **HTTP**, Port **80**, Source **Anywhere-IPv4 (`0.0.0.0/0`)**.
   - Klik **Create security group**.
4. **Langkah B (Perketat web-sg)**:
   - Buka `web-sg` > Tab **Inbound rules** > **Edit inbound rules**.
   - Pada baris port 80 (HTTP): Ubah Source dari `0.0.0.0/0` menjadi **Custom** > pilih ID **`alb-sg`**.
   - Klik **Save rules**.
5. **Verifikasi**: Port 80 pada instance EC2 sekarang hanya mau melayani paket yang diteruskan oleh `alb-sg`.
6. **Biaya/risiko**: Aman.

---

### Langkah 2.2: Membuat Target Group
1. **Tujuan**: Mendaftarkan kelompok tujuan beban (pool instance) beserta pengaturan pemeriksaan kesehatan (*Health Check*).
2. **Jalur menu**: EC2 Console > Panel kiri: **Target Groups** > tombol **Create target group**.
3. **Nilai isian**:

| Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- |
| **Target type** | **Instances** | Target berupa EC2 instances |
| **Target group name** | `ha-web-tg` | Identitas pool target |
| **Protocol : Port** | **HTTP : 80** | Port aplikasi Node.js |
| **VPC** | `three-tier-vpc` | VPC kustom kita |
| **Health checks** | Health check protocol: **HTTP** | Protokol cek |
| | Health check path: `/` (atau `/health`) | Endpoint yang mengembalikan HTTP 200 OK |
| **Advanced health check settings** | Healthy threshold: `2`, Unhealthy threshold: `2`, Timeout: `5`, Interval: `15` | Respon deteksi sehat/rusak yang cepat |

4. Klik **Next**. Di halaman *Register targets*, **JANGAN daftarkan instance manual apa pun** (karena nanti ASG yang akan mendaftarkannya otomatis!). Klik **Create target group**.
5. **Verifikasi**: `ha-web-tg` terdaftar dengan *Total targets: 0*.
6. **Biaya/risiko**: Aman.

---

### Langkah 2.3: ⚠️ Meluncurkan Application Load Balancer (ALB)
> [!WARNING]
> Application Load Balancer dikenakan biaya sewa per jam (~$0.0225/jam) di AWS. Buat saat sesi lab berjalan dan bersihkan sebelum lab berakhir.

1. **Tujuan**: Memasang penyeimbang beban lalu lintas HTTP layer 7 publik yang mendistribusikan traffic ke 2 AZ.
2. **Jalur menu**: EC2 Console > Panel kiri: **Load Balancers** > tombol **Create load balancer** > **Application Load Balancer (Create)**.
3. **Nilai isian**:

| Bagian Form | Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- | :--- |
| **Basic configuration** | **Load balancer name** | `three-tier-alb` | Identitas ALB |
| | **Scheme** | **Internet-facing** | Menerima traffic publik dari internet |
| | **IP address type** | **IPv4** | Alamat IPv4 standar |
| **Network mapping** | **VPC** | `three-tier-vpc` | VPC proyek |
| | **Mappings (AZs & Subnets)** | Centang `us-east-1a` > pilih `public-subnet-1a`<br>Centang `us-east-1b` > pilih `public-subnet-1b` | **Wajib minimal 2 AZ di subnet publik** |
| **Security groups** | **Security groups** | Hapus default > pilih **`alb-sg`** | Mengizinkan HTTP port 80 publik |
| **Listeners and routing** | **Listener HTTP:80** | Default action: Forward to **`ha-web-tg`** | Mengarahkan semua request masuk ke pool target group |

4. Klik **Create load balancer**.
5. **Verifikasi**: Status ALB berubah dari *Provisioning* menjadi **Active**. Salin **DNS Name** ALB (misal: `three-tier-alb-123456789.us-east-1.elb.amazonaws.com`).
6. **Biaya/risiko**: ⚠️ Berbayar per jam (~$0.0225/jam).

---

## HARI 3: Provisi Auto Scaling Group (ASG) & Validasi ELB Health Check

### Langkah 3.1: Membuat Auto Scaling Group (ASG)
1. **Tujuan**: Menjalankan cluster instance EC2 yang otomatis menjaga ketersediaan minimum 2 instance di 2 AZ berbeda.
2. **Jalur menu**: EC2 Console > Panel kiri: **Auto Scaling Groups** > tombol **Create Auto Scaling group**.
3. **Nilai isian**:

| Tahap Wizard | Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- | :--- |
| **Step 1: Choose launch template** | **Auto Scaling group name** | `ha-web-asg` | Identitas ASG |
| | **Launch template** | Pilih `ha-web-template` (Versi: `1`) | Cetak biru yang dibuat di Hari 1 |
| **Step 2: Choose instance launch options** | **VPC** | `three-tier-vpc` | VPC proyek |
| | **Availability Zones and subnets** | Pilih `public-subnet-1a` dan `public-subnet-1b` | ASG akan menyebar instance secara seimbang di kedua AZ |
| **Step 3: Configure advanced options** | **Load balancing** | Pilih **Attach to an existing load balancer** | Mengintegrasikan ASG dengan ALB |
| | **Existing load balancer target groups** | Pilih `ha-web-tg` | Mendaftarkan instance baru ke pool tg |
| | **Health checks** | Centang **Turn on Elastic Load Balancing health checks** | Mengganti instance jika gagal merespon HTTP dari ALB |
| | **Health check grace period** | `300 seconds` (5 menit) | Memberi waktu instance menjalankan bootstrap user data sebelum dievaluasi |
| **Step 4: Configure group size and scaling** | **Desired capacity** | `2` | Jumlah instance normal aktif |
| | **Minimum capacity** | `2` | Jumlah paling sedikit yang harus hidup |
| | **Maximum capacity** | `3` (atau `4`) | Batas maksimal ekspansi saat traffic memuncak |
| | **Automatic scaling** | Pilih **No scaling policies** untuk saat ini (diatur Hari 4) | Fokus pengujian kapasitas dasar |

4. Klik **Next** melewati SNS dan Tags, lalu klik **Create Auto Scaling group**.
5. **Verifikasi**:
   - Di tab **Instance management** pada ASG, Anda melihat **2 instance baru** sedang dalam status *Pending* -> *Running*.
   - Buka **Target Groups** > `ha-web-tg` > Tab **Targets**: Kedua instance terdaftar dan berubah status menjadi **Healthy**.
   - Buka **DNS Name ALB** di browser: Website aplikasi muncul!
6. **Biaya/risiko**: Aman (2 instance t3.micro dicakup kredit lab).

---

### Langkah 3.2: Uji Distribusi Beban (Round-Robin)
1. **Langkah Pengujian**:
   - Buka URL DNS ALB di browser Anda.
   - Amati baris **EC2 Instance ID** dan **Availability Zone**.
   - Tekan tombol **Refresh (F5)** berkali-kali.
2. **Verifikasi**: Nilai Instance ID dan AZ bergantian secara dinamis antara `us-east-1a` dan `us-east-1b`, membuktikan ALB membagi beban secara merata lintas zona fisik!

---

## HARI 4: Dynamic Scaling Policy (Target Tracking CPU 50%) & Uji Beban

### Langkah 4.1: Mengonfigurasi Dynamic Scaling Policy (Target Tracking)
1. **Tujuan**: Menginstruksikan ASG agar otomatis menambah instance (*scale out*) jika rata-rata utilisasi CPU cluster melampaui 50%, dan mengurangi instance (*scale in*) saat beban reda.
2. **Jalur menu**: EC2 Console > **Auto Scaling Groups** > Klik `ha-web-asg` > Tab **Automatic scaling** > Bagian *Dynamic scaling policies* > tombol **Create dynamic scaling policy**.
3. **Nilai isian**:

| Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- |
| **Policy type** | **Target tracking scaling** | Menjaga metrik tetap di sekitar nilai target |
| **Scaling policy name** | `cpu50-target-tracking` | Identitas policy |
| **Metric type** | **Average CPU utilization** | Metrik standar pemantauan beban server |
| **Target value** | `50` | Mempertahankan batas rata-rata CPU pada 50% |
| **Warm-up duration** | `120 seconds` | Jeda waktu sebelum instance baru dihitung dalam metrik |

4. Klik **Create**.
5. **Verifikasi**: Policy `cpu50-target-tracking` aktif. AWS otomatis membuat 2 CloudWatch Alarm internal (Alarm High CPU untuk scale-out, dan Alarm Low CPU untuk scale-in).
6. **Biaya/risiko**: Aman.

---

### Langkah 4.2: Menjalankan Uji Beban & Mengamati Scale-Out
1. **Tujuan**: Memacu utilisasi CPU hingga di atas 50% untuk menyaksikan kelahiran instance ke-3 secara otomatis.
2. **Langkah Eksekusi**:
   - Buka file [load-test-guide.md](file:///e:/2026/Materi/cloud%20computing/road_belajar/phase3-ha-scaling/load-test-guide.md).
   - Jalankan perintah bash loop atau klik tombol **"Spike CPU Beban 15s"** di browser secara bertubi-tubi.
   - Atau gunakan Apache Bench:
     ```bash
     ab -n 50000 -c 100 http://<DNS-ALB>/
     ```
3. **Observasi di Console**:
   - Buka **Auto Scaling Groups** > `ha-web-asg` > Tab **Activity history**.
   - Setelah 3–5 menit, muncul entri aktivitas: *"Launching a new EC2 instance: i-0xxxxxx status: InProgress"*.
   - Jumlah instance bertambah dari 2 menjadi 3 (*Desired capacity: 3*)!
4. **Observasi Scale-In**: Hentikan uji beban. Tunggu 10–15 menit, ASG akan memicu alarm scale-in dan menghentikan (*terminate*) instance ke-3 kembali ke kapasitas 2.
5. **Biaya/risiko**: Aman.

---

## HARI 5: CloudWatch Dashboard, Alarm UnHealthyHostCount & Notifikasi SNS

### Langkah 5.1: Membuat SNS Topic & Berlangganan Email
1. **Tujuan**: Menyediakan saluran notifikasi darurat saat ada host yang rusak di Target Group.
2. **Jalur menu**: Search bar > ketik `SNS` > klik **Simple Notification Service** > **Topics** > tombol **Create topic**.
3. **Nilai isian**:
   - Type: **Standard**
   - Name: `ha-alert-topic`
   - Klik **Create topic**.
4. **Subscription**:
   - Di halaman topik `ha-alert-topic`, klik **Create subscription**.
   - Protocol: **Email**
   - Endpoint: Masukkan alamat email aktif Anda.
   - Klik **Create subscription**.
   - **Buka Inbox Email Anda**: Klik tautan **Confirm subscription** pada email konfirmasi dari AWS.
5. **Verifikasi**: Status subscription berubah dari *PendingConfirmation* menjadi **Confirmed**.
6. **Biaya/risiko**: Aman.

---

### Langkah 5.2: Membuat CloudWatch Alarm (UnHealthyHostCount > 0)
1. **Tujuan**: Memicu alarm dan mengirim email jika ada instance di target group yang gagal health check.
2. **Jalur menu**: Search bar > ketik `CloudWatch` > **Alarms** > **All alarms** > tombol **Create alarm**.
3. **Nilai isian**:
   - Klik **Select metric** > **ApplicationELB** > **Per AppELB, per TG Metrics** > Centang metrik **`UnHealthyHostCount`** untuk `ha-web-tg` > Klik **Select metric**.
   - Threshold condition: **Static** > **Greater than ( > )** > Threshold: `0`.
   - Datapoints to alarm: `1 out of 1`.
   - Klik **Next**.
   - Alarm state trigger: **In alarm** > Send a notification to: pilih **`ha-alert-topic`**.
   - Alarm name: `tg-unhealthy-host-alarm`.
4. Klik **Create alarm**.
5. **Verifikasi**: Alarm terdaftar dengan status hijau **OK** (karena semua target saat ini healthy).
6. **Biaya/risiko**: Aman.

---

### Langkah 5.3: Merancang CloudWatch Dashboard
1. **Tujuan**: Membangun satu layar monitoring terpusat untuk metrik ALB dan ASG.
2. **Jalur menu**: CloudWatch Console > **Dashboards** > tombol **Create dashboard**.
3. **Nilai isian**:
   - Dashboard name: `ha-infrastructure-dashboard` > Klik **Create dashboard**.
   - Tambahkan Widget 1: **Number** > Metric ALB `RequestCount` dan `TargetResponseTime`.
   - Tambahkan Widget 2: **Line** > Metric EC2 / ASG `CPUUtilization`.
   - Tambahkan Widget 3: **Number** > Metric Target Group `HealthyHostCount` dan `UnHealthyHostCount`.
4. Klik **Save dashboard**.
5. **Verifikasi**: Dashboard menampilkan grafik real-time kesehatan sistem secara menyeluruh.
6. **Biaya/risiko**: Aman.

---

## HARI 6: Chaos Engineering Test & Konsep RDS Multi-AZ (HA vs FT)

### Langkah 6.1: Chaos Test 1 (Simulasi Crash: Hentikan Web Service)
1. **Langkah Pengujian**:
   - SSH ke salah satu instance EC2.
   - Matikan service web secara paksa:
     ```bash
     sudo systemctl stop webapp
     ```
2. **Dampak yang Terjadi**:
   - Dalam 30 detik, ALB Health Check gagal mendapatkan respons HTTP 200 dari instance tersebut.
   - Status target di `ha-web-tg` berubah menjadi **Unhealthy**.
   - CloudWatch Alarm `tg-unhealthy-host-alarm` berbunyi (berubah warna merah) dan mengirim email peringatan ke inbox Anda!
   - Karena kita menyalakan *ELB Health Check* pada ASG, Auto Scaling Group mendeteksi status tidak sehat ini, langsung menghentikan (*terminate*) instance tersebut, dan melahirkan instance baru sebagai gantinya!

---

### Langkah 6.2: Chaos Test 2 (Simulasi Bencana Data Center: Terminate Instance Manual)
1. **Langkah Pengujian**:
   - Buka EC2 Console > **Instances** > Centang salah satu instance ASG > **Instance state** > **Terminate instance**.
2. **Dampak**:
   - Kapasitas instance turun menjadi 1.
   - ASG segera merespon penurunan di bawah batas *Desired capacity (2)*.
   - Dalam hitungan menit, ASG meluncurkan instance pengganti baru di Availability Zone yang sama atau seimbang.
   - Pengunjung web tidak merasakan downtime karena ALB secara transparan hanya mengalirkan request ke instance yang tersisa sehat!

---

### Langkah 6.3: Konsep RDS Multi-AZ (HA vs Fault Tolerance)
1. **High Availability (HA)**:
   - Desain sistem yang meminimalkan downtime (misal: ALB + ASG lintas 2 AZ). Jika satu node gagal, traffic dialihkan dalam hitungan detik.
2. **Fault Tolerance (FT)**:
   - Desain sistem yang beroperasi **tanpa interupsi sedikit pun** (zero downtime / zero data loss), namun biayanya jauh lebih mahal (membutuhkan replikasi hardware identik real-time).
3. **RDS Multi-AZ**:
   - Menjalankan instance database sekunder (*Standby*) secara sinkron di AZ terpisah.
   - Jika AZ primer mengalami pemadaman listrik/bencana, RDS otomatis melakukan failover DNS ke instance standby dalam 60–120 detik tanpa perubahan endpoint pada kode aplikasi!

---

## HARI 7: Ringkasan Arsitektur, Refleksi & Checklist Cleanup

### Jawaban Pertanyaan Refleksi Fase 3
1. **Kenapa web-sg HANYA boleh menerima traffic dari alb-sg?**  
   *Mencegah pengunjung melewati (bypass) proteksi Load Balancer. Jika pengunjung bisa langsung mengakses IP publik EC2, fitur load balancing, DDoS mitigation, dan SSL termination tidak berfungsi efektif.*
2. **Apa perbedaan EC2 Status Check vs ELB Health Check pada ASG?**  
   - **EC2 Status Check**: Hanya memeriksa level fisik hardware dan OS instance (apakah mesin menyala dan kernel running). Jika aplikasi Node.js crash/hang pada port 80, EC2 status check tetap menganggap mesin sehat!
   - **ELB Health Check**: Memeriksa respons aplikasi nyata (HTTP GET `/` harus mengembalikan HTTP 200 OK). Jika aplikasi crash, ELB menandainya unhealthy dan memerintahkan ASG untuk mereplace mesin tersebut.
3. **Kenapa server tier komputasi harus Stateless?**  
   *Karena dalam arsitektur Auto Scaling, instance dapat dibuat atau dihancurkan sewaktu-waktu. Jika ada sesi login atau file upload disimpan lokal di harddisk instance A, maka saat request pengunjung berikutnya diarahkan ke instance B oleh ALB, sesi pengguna akan hilang (ter-logout).*

---

### Checklist Cleanup Berurutan Fase 3 (Wajib Sebelum End Lab)
- [ ] **Langkah 1 (Auto Scaling Group)**: Buka EC2 Console > Auto Scaling Groups > Centang `ha-web-asg` > Ubah Desired: 0, Min: 0, Max: 0 > Tunggu semua instance terminate > Klik **Delete**.
- [ ] **Langkah 2 (Application Load Balancer)**: Buka Load Balancers > Centang `three-tier-alb` > **Actions** > **Delete**.
- [ ] **Langkah 3 (Target Group)**: Buka Target Groups > Centang `ha-web-tg` > **Actions** > **Delete**.
- [ ] **Langkah 4 (Launch Template)**: Buka Launch Templates > Hapus `ha-web-template`.
- [ ] **Langkah 5 (CloudWatch & SNS)**: Hapus Alarm `tg-unhealthy-host-alarm` dan Topic `ha-alert-topic`.
- [ ] **Langkah 6 (RDS Database)**: Pastikan RDS database Fase 2 sudah dihapus jika tidak digunakan lagi.
- [ ] **Langkah 7 (Vocareum)**: Klik tombol **End Lab** di portal Learner Lab.
