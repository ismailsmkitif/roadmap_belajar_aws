# Panduan Praktik Console — FASE 1: Static Website Portfolio & CDN

Arsitektur: **User -> CloudFront (HTTPS) -> Amazon S3 (Bucket Privat)**  
Lingkungan: **AWS Academy Learner Lab (Region: us-east-1)**

---

## DAFTAR ISI HARIAN
- [Hari 1: Orientasi Learner Lab, Region & AZ, Sesi & Budget](#hari-1-orientasi-learner-lab-region--az-sesi--budget)
- [Hari 2: Eksplorasi IAM & Membaca Policy JSON LabRole](#hari-2-eksplorasi-iam--membaca-policy-json-labrole)
- [Hari 3: Pembuatan S3 Bucket, Upload, Versioning & Static Website Hosting](#hari-3-pembuatan-s3-bucket-upload-versioning--static-website-hosting)
- [Hari 4: Block Public Access, Bucket Policy & Mengunci Bucket Menjadi Privat](#hari-4-block-public-access-bucket-policy--mengunci-bucket-menjadi-privat)
- [Hari 5: Distribusi CloudFront + Origin Access Control (OAC) & Invalidation](#hari-5-distribusi-cloudfront--origin-access-control-oac--invalidation)
- [Hari 6: Teori Route 53 & ACM, Praktik S3 Lifecycle Rules & CloudFront Caching](#hari-6-teori-route-53--acm-praktik-s3-lifecycle-rules--cloudfront-caching)
- [Hari 7: Ringkasan Arsitektur, Refleksi & Checklist Cleanup](#hari-7-ringkasan-arsitektur-refleksi--checklist-cleanup)

---

## HARI 1: Orientasi Learner Lab, Region & AZ, Sesi & Budget

### Langkah 1.1: Memulai Sesi Lab dan Membuka Console
1. **Tujuan**: Mengaktifkan infrastruktur AWS Academy Learner Lab dan membuka konsol manajemen dengan sesi IAM terautentikasi otomatis.
2. **Jalur menu**: Portal Vocareum Learner Lab > Tombol **Start Lab** > Tunggu status titik berubah hijau (🟢) > Klik tombol/teks **AWS**.
3. **Nilai isian**:

| Nama Elemen / Tombol | Aksi / Nilai | Alasan |
| :--- | :--- | :--- |
| **Start Lab** | Klik tombol ini | Memulai provisi sesi sementara AWS Vocareum |
| Indikator Status AWS | Tunggu hingga berubah hijau (🟢) | Menandakan sesi AWS siap menerima koneksi |
| **AWS** (teks dengan titik hijau) | Klik tautan tersebut | Membuka jendela baru AWS Management Console |

4. **Verifikasi**: Tab baru terbuka menampilkan **AWS Management Console Dashboard**. Pojok kanan atas menampilkan federasi seperti `voclabs/...` atau `LabUser`.
5. **Jebakan umum**: Menekan link AWS saat titik masih merah/kuning. Ini memicu error `Access Denied` atau gagal auth.
6. **Biaya/risiko**: Aman (Free credit voucher $100).

---

### Langkah 1.2: Memeriksa dan Mengunci Region ke us-east-1 (N. Virginia)
1. **Tujuan**: Memastikan console beroperasi di Region yang didukung (`us-east-1`).
2. **Jalur menu**: Bar navigasi atas (paling kanan di sebelah user) > **Region Selector**.
3. **Nilai isian**:

| Nama Field / Dropdown | Nilai yang Dipilih | Alasan |
| :--- | :--- | :--- |
| **Select a Region** | **US East (N. Virginia) `us-east-1`** | Region wajib dan didukung penuh di AWS Academy Learner Lab |

4. **Verifikasi**: Teks pada bar navigasi atas menampilkan **N. Virginia**.
5. **Jebakan umum**: Berpindah region ke Ohio atau Singapore menyebabkan pembuatan resource ditolak oleh SCP (*Service Control Policy*).
6. **Biaya/risiko**: Aman.

---

### Langkah 1.3: Eksplorasi Availability Zones (AZ)
1. **Tujuan**: Memahami ketersediaan zona fisik di Region `us-east-1` yang menjadi dasar redundansi cloud.
2. **Jalur menu**: Search Bar atas > ketik `VPC` > klik **VPC** > Panel kiri: **Subnets**.
3. **Nilai isian**: Tampilkan subnet default yang ada. Amati kolom **Availability Zone**.
4. **Verifikasi**: Terlihat AZ seperti `us-east-1a`, `us-east-1b`, `us-east-1c`, `us-east-1d`, `us-east-1f`.
5. **Jebakan umum**: Mengubah atau menghapus default subnet. **Dilarang menghapus default VPC/subnet**.
6. **Biaya/risiko**: Aman.

---

## HARI 2: Eksplorasi IAM & Membaca Policy JSON LabRole

### Langkah 2.1: Menemukan dan Membuka LabRole di IAM
1. **Tujuan**: Mempelajari konsep identitas IAM (*Role*) dan izin berbasis *Policy JSON* tanpa mengubahnya (read-only).
2. **Jalur menu**: Search Bar > ketik `IAM` > klik **IAM** > Panel kiri: **Roles**.
3. **Nilai isian**:

| Nama Elemen | Nilai Filter / Pencarian | Alasan |
| :--- | :--- | :--- |
| Search box di tabel Roles | Ketik `LabRole` | Menemukan execution role bawaan Learner Lab |

4. **Verifikasi**: Klik nama role **`LabRole`**. Di tab **Permissions**, terlihat policy yang terpasang (misal: policy administrator atau policy kustom lab).
5. **Jebakan umum**: Mencoba membuat IAM user atau role baru. Learner Lab akan menolaknya dengan pesan `AccessDenied`.
6. **Biaya/risiko**: Aman.

---

### Langkah 2.2: Membaca Struktur Policy JSON
1. **Tujuan**: Memahami komponen standar AWS IAM Policy: `Effect`, `Action`, `Resource`, dan `Condition`.
2. **Jalur menu**: IAM Console > **Roles** > **LabRole** > Tab **Permissions** > Klik nama policy > Tab **JSON**.
3. **Nilai isian**: Baca struktur JSON tanpa mengedit:
   - `Effect`: `"Allow"` atau `"Deny"`.
   - `Action`: Daftar izin API (misal: `"s3:GetObject"`, `"dynamodb:*"`, dll).
   - `Resource`: Target ARN dari resource yang diizinkan.
4. **Verifikasi**: Kode JSON policy dapat terbaca dengan jelas.
5. **Jebakan umum**: Mengklik tombol Edit dan menyimpan perubahan. **Jangan simpan perubahan apa pun pada LabRole**.
6. **Biaya/risiko**: Aman.

---

## HARI 3: Pembuatan S3 Bucket, Upload, Versioning & Static Website Hosting

### Langkah 3.1: Membuat S3 Bucket
1. **Tujuan**: Membuat wadah penyimpanan objek global dengan nama yang unik di seluruh dunia (*globally unique*).
2. **Jalur menu**: Search bar > ketik `S3` > klik **S3** > tombol **Create bucket**.
3. **Nilai isian**:

| Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- |
| **Bucket type** | **General purpose** | Tipe standar penyimpanan objek S3 |
| **Bucket name** | `portfolio-ismail-[angka-acak-unik]` (contoh: `portfolio-ismail-20261020`) | Nama bucket S3 harus unik secara global di seluruh dunia |
| **AWS Region** | **US East (N. Virginia) `us-east-1`** | Region wajib Learner Lab |
| **Object Ownership** | **ACLs disabled (recommended)** | Best practice keamanan AWS modern |
| **Block Public Access settings for this bucket** | *Biarkan semua tercentang (Block all public access)* | Menjaga bucket tetap aman sejak awal |
| **Bucket Versioning** | **Enable** | Mengaktifkan riwayat revisi file objek |
| **Default encryption** | **Server-side encryption with Amazon S3 managed keys (SSE-S3)** | Enkripsi standar tanpa biaya tambahan |

4. **Verifikasi**: Klik **Create bucket**. Bucket baru muncul di daftar S3 Buckets dengan Region `us-east-1`.
5. **Jebakan umum**: Menggunakan huruf kapital atau karakter terlarang dalam nama bucket (hanya huruf kecil, angka, dan tanda strip yang diizinkan).
6. **Biaya/risiko**: Aman (Free Tier S3 mencakup 5 GB storage).

---

### Langkah 3.2: Mengunggah File Website
1. **Tujuan**: Menempatkan file web HTML/CSS ke dalam bucket S3.
2. **Jalur menu**: S3 Console > Klik nama bucket Anda > Tab **Objects** > Tombol **Upload**.
3. **Nilai isian**:
   - Klik **Add files**.
   - Pilih berkas dari repo lokal: `index.html`, `style.css`, dan `error.html` dari folder `phase1-static-site/site/`.
   - Klik tombol **Upload** di bagian bawah.
4. **Verifikasi**: Status upload menunjukkan *Succeeded (100%)*. File `index.html`, `style.css`, dan `error.html` terdaftar di tab Objects.
5. **Jebakan umum**: Mengunggah folder pembungkusnya, bukan file langsung di dalamnya. Pastikan `index.html` berada di root bucket.
6. **Biaya/risiko**: Aman.

---

### Langkah 3.3: Menguji S3 Bucket Versioning
1. **Tujuan**: Memahami bagaimana S3 menyimpan versi masa lalu saat file ditimpa (*overwrite*).
2. **Jalur menu**: S3 Console > Tab **Objects**.
3. **Langkah Pengujian**:
   - Aktifkan toggle **Show versions** di atas daftar objek.
   - Edit baris judul di `index.html` lokal Anda secara singkat, lalu upload ulang file `index.html`.
   - Amati daftar versi: Anda akan melihat 2 versi `index.html` dengan *Version ID* berbeda.
   - Hapus versi terbaru: S3 akan otomatis mengembalikan versi sebelumnya sebagai versi aktif!
4. **Verifikasi**: Versi lama tetap aman tersimpan tanpa tertimpa permanen.
5. **Jebakan umum**: Menghapus objek tanpa toggle versioning akan menghasilkan *Delete marker*, bukan menghapus file secara permanen.
6. **Biaya/risiko**: Aman.

---

## HARI 4: Block Public Access, Bucket Policy & Mengunci Bucket Menjadi Privat

### Langkah 4.1: Eksperimen Static Website Hosting & Mengapa Tidak Direkomendasikan
1. **Tujuan**: Memahami fitur lama *Static website hosting* S3 dan mengapa metode ini mengharuskan bucket terbuka ke publik (risiko keamanan).
2. **Jalur menu**: S3 Console > Klik nama bucket > Tab **Properties** > Gulir ke paling bawah: **Static website hosting** > Klik **Edit**.
3. **Nilai isian**:
   - Static website hosting: **Enable**
   - Hosting type: **Host a static website**
   - Index document: `index.html`
   - Error document: `error.html`
   - Klik **Save changes**.
4. **Verifikasi**: Endpoint HTTP dibuat (contoh: `http://portfolio-ismail-xxx.s3-website-us-east-1.amazonaws.com`). Jika dibuka, menghasilkan `403 Forbidden` karena bucket masih terproteksi oleh *Block Public Access*.
5. **Pelajaran penting**: Membuka bucket ke publik via website hosting membuat bucket rentan terhadap biaya tak terkendali dan pembacaan data publik. Oleh karena itu, kita akan menonaktifkannya kembali dan beralih ke **CloudFront + OAC**.
6. **Aksi**: Kembalikan **Static website hosting** ke **Disable**!

---

### Langkah 4.2: Memastikan Bucket Sepenuhnya Privat (Block All Public Access)
1. **Tujuan**: Memastikan tidak ada celah akses publik langsung ke bucket S3.
2. **Jalur menu**: S3 Console > Klik nama bucket > Tab **Permissions**.
3. **Nilai isian**:
   - Pada bagian **Block public access (bucket settings)**, klik **Edit**.
   - Pastikan opsi **Block all public access** tercentang penuh.
   - Klik **Save changes** dan ketik `confirm` di modal konfirmasi.
4. **Verifikasi**: Status *Block public access* bertuliskan warna merah tegas: **On (All blocked)**.
5. **Jebakan umum**: Tergoda membuka public access saat menemui error 403. Ingat: CloudFront OAC bekerja dengan bucket yang 100% tertutup!
6. **Biaya/risiko**: Aman.

---

## HARI 5: Distribusi CloudFront + Origin Access Control (OAC) & Invalidation

### Langkah 5.1: Membuat CloudFront Distribution dengan OAC
1. **Tujuan**: Memasang CDN global dengan enkripsi HTTPS, cache di Edge Location, dan izin baca eksklusif ke S3 menggunakan *Origin Access Control (OAC)*.
2. **Jalur menu**: Search bar > ketik `CloudFront` > klik **CloudFront** > tombol **Create distribution**.
3. **Nilai isian**:

| Bagian Form | Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- | :--- |
| **Origin** | **Origin domain** | Pilih nama bucket S3 Anda dari dropdown (pilih format: `portfolio-ismail-xxx.s3.us-east-1.amazonaws.com`) | S3 bucket sebagai origin storage |
| | **Origin access** | Pilih **Origin access control settings (recommended)** | Mengizinkan hanya CloudFront yang dapat membaca objek |
| | **Origin access control** | Klik **Create new OAC** > beri nama `s3-portfolio-oac` > klik **Create** | Mengikat identitas OAC ke distribusi |
| **Default cache behavior** | **Viewer protocol policy** | **Redirect HTTP to HTTPS** | Memaksa koneksi aman terenkripsi |
| | **Allowed HTTP methods** | **GET, HEAD** | Website statis hanya memerlukan metode baca |
| | **Cache key and origin requests** | **Cache policy: CachingOptimized** | Performa cache maksimal di edge server |
| **Web Application Firewall (WAF)** | **Web Application Firewall** | **Do not enable security protections** | Menghindari biaya tambahan AWS WAF di lab |
| **Settings** | **Price class** | **Use only North America and Europe** (atau Use all edge locations) | Optimasi biaya edge distribution |
| | **Default root object** | `index.html` | Membuka `index.html` saat pengunjung mengakses root URL |

4. **Verifikasi**: Klik **Create distribution**. Muncul banner biru berisi pesan: *"The S3 bucket policy needs to be updated"*. Klik tombol **Copy policy**.
5. **Jebakan umum**: Lupa mengisi *Default root object* (`index.html`). Akibatnya saat membuka domain CloudFront tanpa akhiran file, muncul error `AccessDenied`.
6. **Biaya/risiko**: Aman (Free Tier CloudFront 1 TB data transfer out per bulan).

---

### Langkah 5.2: Menempelkan OAC Policy ke S3 Bucket
1. **Tujuan**: Mengizinkan CloudFront Distribution yang baru kita buat untuk membaca objek S3 secara aman.
2. **Jalur menu**: S3 Console > Klik bucket Anda > Tab **Permissions** > Bagian **Bucket policy** > Klik **Edit**.
3. **Nilai isian**: Tempelkan (*paste*) JSON policy yang tadi disalin dari CloudFront. Formatnya serupa dengan:
```json
{
  "Version": "2012-10-17",
  "Statement": {
    "Sid": "AllowCloudFrontServicePrincipalReadOnly",
    "Effect": "Allow",
    "Principal": {
      "Service": "cloudfront.amazonaws.com"
    },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::NAMA-BUCKET-ANDA/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::NOMOR-AKUN-ANDA:distribution/DISTRIBUTION-ID-ANDA"
      }
    }
  }
}
```
4. Klik **Save changes**.
5. **Verifikasi**: Buka tab baru browser dan buka URL CloudFront Anda (misal: `https://d123456abcdef8.cloudfront.net`). Website portofolio Anda langsung tampil dengan koneksi gembok aman (HTTPS)!
6. **Jebakan umum**: Menempelkan policy tanpa mengganti placeholder ARN atau terjadi salah format koma pada JSON.
7. **Biaya/risiko**: Aman.

---

### Langkah 5.3: Melakukan Cache Invalidation
1. **Tujuan**: Memaksa Edge Location CloudFront membuang cache file lama saat Anda baru saja mengupdate konten website di S3.
2. **Jalur menu**: CloudFront Console > Klik distribusi Anda > Tab **Invalidations** > tombol **Create invalidation**.
3. **Nilai isian**:

| Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- |
| **Object paths** | `/*` (atau `/index.html`) | Menghapus seluruh cache objek agar pengunjung melihat versi terbaru secara instan |

4. Klik **Create invalidation**.
5. **Verifikasi**: Status invalidation berubah dari *In progress* menjadi *Completed*. Refresh browser Anda dengan `Ctrl + F5` untuk melihat perubahan terbaru.
6. **Biaya/risiko**: Aman (1.000 path invalidation pertama per bulan gratis).

---

## HARI 6: Teori Route 53 & ACM, Praktik S3 Lifecycle Rules & CloudFront Caching

### Langkah 6.1: Konsep Route 53 & ACM (Pembelajaran Teori)
Di lingkungan AWS Academy Learner Lab, layanan **Route 53** (DNS publik berbayar) dan **AWS Certificate Manager (ACM)** untuk custom domain publik tidak didukung. Namun konsepnya wajib dipahami:
1. **Route 53 (DNS)**: Mengarahkan domain kustom (misal: `portfolio.ismail.com`) ke CloudFront Distribution menggunakan **Alias Record (A Record)**. Keunggulan alias record adalah bebas biaya query DNS ke resource AWS.
2. **ACM (SSL/TLS Certificate)**: Menyediakan sertifikat HTTPS gratis yang otomatis diperpanjang.
3. **Pertanyaan Refleksi ACM**: *Kenapa sertifikat ACM untuk CloudFront wajib dibuat di Region `us-east-1`?*
   - **Jawaban**: CloudFront adalah layanan global yang pusat kontrol distribusinya berada di Region `us-east-1` (N. Virginia). Semua Edge Location di seluruh dunia membaca sertifikat SSL dari store sertifikat di `us-east-1`.

---

### Langkah 6.2: Praktik S3 Lifecycle Rules
1. **Tujuan**: Mengotomatiskan manajemen biaya penyimpanan dengan memindahkan atau menghapus objek versi lama secara terjadwal.
2. **Jalur menu**: S3 Console > Klik bucket Anda > Tab **Management** > Bagian **Lifecycle rules** > tombol **Create lifecycle rule**.
3. **Nilai isian**:

| Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- |
| **Lifecycle rule name** | `cleanup-old-versions` | Identitas aturan siklus hidup |
| **Choose a rule scope** | **Apply to all objects in the bucket** | Berlaku untuk semua file di dalam bucket |
| **Peringatan konfirmasi** | Centang *I acknowledge that this rule will apply to all objects in the bucket* | Konfirmasi cakupan |
| **Lifecycle rule actions** | Centang **Permanently delete noncurrent versions of objects** | Menghapus versi file lama yang tidak terpakai |
| **Days after objects become noncurrent** | `30` | Versi lama disimpan selama 30 hari sebelum dihapus permanen |

4. Klik **Create rule**.
5. **Verifikasi**: Aturan `cleanup-old-versions` muncul dengan status **Enabled**.
6. **Biaya/risiko**: Aman.

---

## HARI 7: Ringkasan Arsitektur, Refleksi & Checklist Cleanup

### Jawaban Pertanyaan Refleksi Fase 1
1. **Kenapa bucket S3 harus privat?**  
   *Mencegah akses langsung publik tanpa kontrol, menghindari risiko kebocoran data, dan menghentikan pembengkakan biaya bandwidth S3. Seluruh lalu lintas wajib melewati CloudFront agar mendapat proteksi enkripsi HTTPS, caching, dan filtering.*
2. **Apa fungsi Origin Access Control (OAC)?**  
   *OAC adalah mekanisme autentikasi berbasis signature (AWS Signature Version 4) yang memverifikasi bahwa permintaan yang datang ke S3 benar-benar berasal dari distribusi CloudFront terdaftar, bukan dari pihak luar.*
3. **Kenapa sertifikat ACM untuk CloudFront harus di us-east-1?**  
   *Karena infrastruktur arsitektur kontrol CloudFront secara global terikat dengan Region N. Virginia (`us-east-1`) untuk propagasi sertifikat SSL/TLS ke ratusan edge locations di seluruh dunia.*

---

### Checklist Cleanup Berurutan (Sebelum End Lab)
Ikuti urutan ini dengan cermat agar tidak terjadi dependensi terkunci:
- [ ] **Langkah 1 (CloudFront)**: Buka CloudFront Console > Centang distribusi Anda > Klik **Disable** > Tunggu status menjadi *Disabled* > Klik **Delete**.
- [ ] **Langkah 2 (S3 Objects)**: Buka S3 Console > Masuk ke bucket Anda > Klik tombol **Empty** > Ketik `permanently delete` untuk menghapus seluruh objek dan versinya.
- [ ] **Langkah 3 (S3 Bucket)**: Klik tombol **Delete** pada bucket > Ketik nama bucket > Konfirmasi penghapusan.
- [ ] **Langkah 4 (Vocareum)**: Klik tombol **End Lab** di portal Learner Lab untuk menghentikan timer dan menghemat kredit $100 Anda.
