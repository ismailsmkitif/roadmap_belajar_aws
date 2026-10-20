# Panduan Praktik Console & IaC — FASE 4: Serverless REST API & CI/CD

Arsitektur: **Client -> API Gateway (HTTP API) -> AWS Lambda (Python 3.12) -> Amazon DynamoDB (+ SQS / EventBridge)**  
Lingkungan: **AWS Academy Learner Lab (Region: us-east-1)**

---

## DAFTAR ISI HARIAN
- [Hari 1 (Console): Provisi Lambda dengan LabRole, Uji Event & Analisis CloudWatch](#hari-1-console-provisi-lambda-dengan-labrole-uji-event--analisis-cloudwatch)
- [Hari 2 (Console): Amazon DynamoDB Table (On-Demand), Query vs Scan & Integrasi](#hari-2-console-amazon-dynamodb-table-on-demand-query-vs-scan--integrasi)
- [Hari 3 (Console): API Gateway HTTP API v2 (CRUD Routes, CORS & Uji Curl)](#hari-3-console-api-gateway-http-api-v2-crud-routes-cors--uji-curl)
- [Hari 4 (Console): Konsep Cognito JWT, SQS Queue & EventBridge Scheduler](#hari-4-console-konsep-cognito-jwt-sqs-queue--eventbridge-scheduler)
- [Hari 5 (IaC): Otomatisasi CloudFormation / AWS SAM (template.yaml & Drift)](#hari-5-iac-otomatisasi-cloudformation--aws-sam-templateyaml--drift)
- [Hari 6 (CI/CD): Pipeline GitHub Actions Otomatis (Build, Test & Deploy)](#hari-6-cicd-pipeline-github-actions-otomatis-build-test--deploy)
- [Hari 7: Ringkasan Arsitektur, Refleksi & Checklist Cleanup](#hari-7-ringkasan-arsitektur-refleksi--checklist-cleanup)

---

## HARI 1 (Console): Provisi Lambda dengan LabRole, Uji Event & Analisis CloudWatch

### Langkah 1.1: Membuat Fungsi Lambda dengan `LabRole`
1. **Tujuan**: Membangun unit komputasi serverless Python 3.12 yang terikat ke hak akses bawaan lab.
2. **Jalur menu**: Lambda Console > **Functions** > tombol **Create function**.
3. **Nilai isian**:

| Bagian Form | Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- | :--- |
| **Pilihan utama** | **Author from scratch** | *Pilih opsi ini* | Membangun dari fungsi kosong |
| **Basic information** | **Function name** | `todo-api-function` | Identitas fungsi Lambda |
| | **Runtime** | **Python 3.12** | Runtime modern dengan eksekusi cepat |
| | **Architecture** | **x86_64** | Arsitektur standar bawaan lab |
| **Permissions** | **Execution role** | Pilih **Use an existing role** | Menghindari error pembatasan IAM Learner Lab |
| | **Existing role** | **`LabRole`** | Role bawaan lab dengan izin CloudWatch & DynamoDB |

4. **Verifikasi**: Klik **Create function**. Halaman detail fungsi muncul dengan jendela *Code source*.
5. **Jebakan umum**: Memilih "Create a new role", yang akan memicu error `AccessDenied` di Learner Lab.
6. **Biaya/risiko**: Aman.

---

### Langkah 1.2: Memasukkan Kode & Uji Event Console
1. **Tujuan**: Menerapkan kode CRUD dan menguji eksekusi tanpa perantara API Gateway.
2. **Jalur menu**: Tab **Code** > Buka file [app.py](file:///e:/2026/Materi/cloud%20computing/road_belajar/phase4-serverless-cicd/src/app.py) di repo lokal Anda > Salin semua isinya ke editor console > Klik tombol **Deploy**.
3. **Uji Coba**:
   - Buka tab **Test** > Pilih **Create new event**.
   - Event name: `Day1PingTest`, Event JSON: `{"action": "ping"}` > Klik **Save** > Klik **Test**.
4. **Verifikasi**: Kotak hijau **Execution result: Succeeded** menampilkan JSON respon status `READY_FOR_DYNAMODB` dengan HTTP 200.
5. **Biaya/risiko**: Aman.

---

### Langkah 1.3: Analisis CloudWatch & Perbandingan Memory/Timeout
1. **Tujuan**: Memeriksa metrik waktu eksekusi, penggunaan memori nyata, dan *cold start*.
2. **Jalur menu**: Tab **Monitor** > **View CloudWatch logs** > Buka Log stream terbaru.
3. **Observasi**:
   - Catat baris: `REPORT RequestId: ... Duration: ... Memory Size: 128 MB Max Memory Used: ... Init Duration: ...`.
   - `Init Duration` adalah waktu *Cold Start* ketika container pertama kali diinisialisasi.
4. **Tuning**:
   - Buka tab **Configuration** > **General configuration** > **Edit**.
   - Ubah Memory dari `128 MB` ke `256 MB`, Timeout dari `3 sec` ke `10 sec` > Klik **Save**.
   - Uji kembali tombol **Test** dan amati penurunan durasi eksekusi di CloudWatch report!
5. **Biaya/risiko**: Aman.

---

## HARI 2 (Console): Amazon DynamoDB Table (On-Demand), Query vs Scan & Integrasi

### Langkah 2.1: Membuat Tabel Amazon DynamoDB
1. **Tujuan**: Menyediakan database NoSQL serverless berlatensi satu digit milidetik dengan kapasitas penskalaan otomatis (*On-Demand*).
2. **Jalur menu**: Search bar > ketik `DynamoDB` > klik **DynamoDB** > tombol **Create table**.
3. **Nilai isian**:

| Bagian Form | Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- | :--- |
| **Table details** | **Table name** | `todos` | Nama tabel yang dipanggil di kode `app.py` |
| **Partition key** | **Partition key** | `id` (Tipe: **String**) | Primary key unik untuk setiap item todo (UUID) |
| **Sort key** | *Biarkan kosong* | Item cukup diidentifikasi oleh Partition Key tunggal |
| **Table settings** | **Table class** | **DynamoDB Standard** | Kelas penyimpanan standar |
| | **Read/write capacity settings** | Pilih **On-demand** | Bebas biaya saat tidak ada request (*Pay per Request*) |
| **Encryption at rest** | **Encryption** | **Amazon DynamoDB managed key** | Enkripsi bawaan tanpa biaya |

4. **Verifikasi**: Klik **Create table**. Tabel `todos` muncul dengan status hijau **Active**.
5. **Jebakan umum**: Memilih mode *Provisioned* dengan RCU/WCU tinggi yang memakan biaya terus-menerus. Selalu pilih **On-demand**.
6. **Biaya/risiko**: Aman (Free Tier mencakup 25 GB storage DynamoDB).

---

### Langkah 2.2: Eksperimen Console: Query vs Scan
1. **Tujuan**: Memahami perbedaan mendasar performa dan biaya antara operasi `Query` dan `Scan`.
2. **Langkah Praktik**:
   - Buka **DynamoDB Console** > **Explore items** > Pilih tabel `todos`.
   - Klik **Create item** > Tambahkan atribut `title` (String): `"Belajar AWS DynamoDB"`, `completed` (Boolean): `false` > Klik **Create item**.
   - Ulangi untuk menambahkan 1-2 item contoh lagi.
3. **Perbandingan Konsep**:
   - **Scan**: Membaca **seluruh tabel** dari baris pertama sampai terakhir, lalu memfilter hasilnya. Sangat lambat dan boros biaya pada tabel besar (dipakai pada endpoint `GET /todos` untuk melihat semua data).
   - **Query**: Mencari item secara presisi berdasarkan **Partition Key (`id`)**. Sangat cepat (O(1)) dan efisien karena langsung meloncat ke partisi penyimpanan terkait (dipakai pada endpoint `GET /todos/{id}`).
4. **Biaya/risiko**: Aman.

---

## HARI 3 (Console): API Gateway HTTP API v2 (CRUD Routes, CORS & Uji Curl)

### Langkah 3.1: Membuat HTTP API di API Gateway
1. **Tujuan**: Membangun gerbang API HTTP v2 yang ringan, murah, dan otomatis terintegrasi ke Lambda.
2. **Jalur menu**: Search bar > ketik `API Gateway` > klik **API Gateway** > Bagian **HTTP API** > tombol **Build**.
3. **Nilai isian**:

| Tahap Wizard | Nama Field | Nilai yang Diisi | Alasan |
| :--- | :--- | :--- | :--- |
| **Step 1: Create an API** | **Integrations** | Klik **Add integration** > pilih **Lambda** | Menghubungkan langsung ke fungsi backend |
| | **AWS Region** | `us-east-1` | Region lab |
| | **Lambda function** | Pilih `todo-api-function` | Target fungsi pemroses |
| | **API name** | `todo-http-api` | Identitas API Gateway |
| **Step 2: Configure routes** | *Hapus route default `$default`* | Kita akan membuat route terstruktur sendiri |
| **Step 3: Define stages** | **Stage name** | `$default` (Centang **Auto-deploy**) | Setiap perubahan route langsung terpublikasi |

4. Klik **Next** sampai selesai, lalu klik **Create**.

---

### Langkah 3.2: Mendaftarkan 5 Route CRUD
1. **Tujuan**: Mendefinisikan rute HTTP REST API standar untuk manajemen Todo.
2. **Jalur menu**: API Gateway Console > Klik `todo-http-api` > Panel kiri: **Routes** > tombol **Create**.
3. **Daftar Route yang Dibuat**:

| Method | Route Path | Target Integration | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/todos` | `todo-api-function` | Membuat todo baru |
| `GET` | `/todos` | `todo-api-function` | Mengambil seluruh daftar todos |
| `GET` | `/todos/{id}` | `todo-api-function` | Mengambil detail todo spesifik |
| `PUT` | `/todos/{id}` | `todo-api-function` | Memperbarui status/isi todo |
| `DELETE` | `/todos/{id}` | `todo-api-function` | Menghapus todo berdasarkan ID |

4. **Konfigurasi Integrasi**: Pada setiap route yang dibuat, klik route tersebut > Klik **Attach integration** > Pilih integrasi `todo-api-function`.
5. **Verifikasi**: Di menu Routes, kelima rute memiliki tanda panah ke fungsi Lambda.

---

### Langkah 3.3: Konfigurasi CORS (Cross-Origin Resource Sharing)
1. **Tujuan**: Mengizinkan browser dari domain frontend web (seperti web portofolio Fase 1) untuk memanggil API ini.
2. **Jalur menu**: API Gateway Console > Panel kiri: **CORS** > tombol **Configure**.
3. **Nilai isian**:
   - Access-Control-Allow-Origin: `*`
   - Access-Control-Allow-Headers: `Content-Type,Authorization`
   - Access-Control-Allow-Methods: `GET,POST,PUT,DELETE,OPTIONS`
   - Klik **Save**.
4. **Verifikasi**: Salin **Invoke URL** API Anda (misal: `https://xyz123.execute-api.us-east-1.amazonaws.com`).

---

### Langkah 3.4: Uji Coba Lengkap Menggunakan Curl
Jalankan perintah ini di terminal laptop / Git Bash Anda (ganti `<API-URL>` dengan Invoke URL Anda):

```bash
# 1. CREATE Todo Baru (POST)
curl -X POST "https://<API-URL>/todos" \
  -H "Content-Type: application/json" \
  -d '{"title": "Mengerjakan Fase 4 Serverless", "description": "Praktik Lambda dan DynamoDB"}'

# 2. LIST Semua Todos (GET)
curl -X GET "https://<API-URL>/todos"

# 3. UPDATE Status Todo (PUT) - ganti <TODO-ID> dari respon create
curl -X PUT "https://<API-URL>/todos/<TODO-ID>" \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

# 4. DELETE Todo (DELETE)
curl -X DELETE "https://<API-URL>/todos/<TODO-ID>"
```

---

## HARI 4 (Console): Konsep Cognito JWT, SQS Queue & EventBridge Scheduler

### Langkah 4.1: Konsep Amazon Cognito & JWT Authorizer
- **Konsep**: Amazon Cognito User Pool mengelola pendaftaran pengguna (*Sign-Up*), login (*Sign-In*), dan MFA. Setelah login sukses, Cognito menerbitkan **JSON Web Token (JWT)**.
- **JWT Authorizer di API Gateway**: API Gateway memvalidasi token JWT di header `Authorization: Bearer <token>` sebelum meneruskannya ke Lambda. Jika token tidak valid, request langsung ditolak dengan HTTP 401 Unauthorized tanpa membebani biaya eksekusi Lambda!
- *Catatan Learner Lab*: Pembuatan User Pool di Amazon Cognito terkadang dibatasi oleh Service Control Policy (SCP) lab. Jika dibatasi, fitur ini dipelajari sebagai pemahaman arsitektur standar produksi.

---

### Langkah 4.2: Praktik SQS Queue + Lambda Asynchronous Processing
1. **Tujuan**: Memisahkan pemrosesan berat (*Decoupling*) agar API merespon cepat dan pekerjaan berat diantrekan secara aman.
2. **Jalur menu**: Search bar > ketik `SQS` > klik **Simple Queue Service** > tombol **Create queue**.
3. **Nilai isian**:
   - Type: **Standard**
   - Name: `todo-events-queue`
   - Klik **Create queue**.
4. **Menghubungkan SQS Trigger ke Lambda**:
   - Buka Lambda Console > Fungsi `todo-api-function` > Bagian *Function overview* > Klik **Add trigger**.
   - Source: **SQS** > Queue: pilih `todo-events-queue` > Batch size: `10` > Klik **Add**.
5. **Verifikasi**: SQS terdaftar sebagai trigger aktif pada diagram Lambda. Setiap pesan yang masuk ke SQS otomatis memicu fungsi Lambda untuk memprosesnya.
6. **Biaya/risiko**: Aman.

---

### Langkah 4.3: Praktik Amazon EventBridge Scheduler (Tugas Terjadwal)
1. **Tujuan**: Menjalankan cron job serverless tanpa memerlukan server cron Linux yang menyala 24/7.
2. **Jalur menu**: Search bar > ketik `EventBridge` > **Schedules** > tombol **Create schedule**.
3. **Nilai isian**:
   - Schedule name: `nightly-todo-cleanup`
   - Schedule pattern: **Recurring schedule** > **Cron-based schedule** > `cron(0 2 * * ? *)` (setiap jam 2 pagi).
   - Flexible time window: **Off**.
   - Target: **AWS Lambda** > Fungsi: `todo-api-function`.
   - Execution role: Pilih **Use existing role** > `LabRole`.
4. **Verifikasi**: Jadwal cron aktif di EventBridge Scheduler.
5. **Biaya/risiko**: Aman.

---

## HARI 5 (IaC): Otomatisasi CloudFormation / AWS SAM (template.yaml & Drift)

> [!IMPORTANT]
> **Sebelum Deploy IaC:** Hapus terlebih dahulu tabel `todos`, fungsi `todo-api-function`, dan API Gateway yang tadi dibuat secara manual di console, agar tidak terjadi error bentrok nama (*Resource already exists*).

### Konsep Infrastructure as Code (IaC)
- **Stack**: Kumpulan resource AWS yang dikelola sebagai satu kesatuan unit lifecycle.
- **Change Set**: Tinjauan perubahan (*preview diff*) sebelum CloudFormation benar-benar mengeksekusi perubahan resource.
- **Drift Detection**: Fitur untuk mendeteksi apakah ada resource di AWS yang diubah secara manual di luar kode template.

Template AWS SAM berikut telah disiapkan di repo untuk mereplikasi seluruh resource Hari 1 s.d. 3:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Fase 4 Serverless REST API SAM Template

Parameters:
  LabRoleArn:
    Type: String
    Default: arn:aws:iam::ACCOUNT_ID:role/LabRole
    Description: ARN dari LabRole bawaan AWS Academy Learner Lab

Resources:
  # 1. DynamoDB Table On-Demand
  TodosTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: todos-sam
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH

  # 2. HTTP API Gateway v2
  TodoHttpApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      CorsConfiguration:
        AllowMethods:
          - GET
          - POST
          - PUT
          - DELETE
          - OPTIONS
        AllowHeaders:
          - Content-Type
          - Authorization
        AllowOrigins:
          - '*'

  # 3. Lambda Function Python 3.12
  TodoFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: todo-api-function-sam
      CodeUri: src/
      Handler: app.lambda_handler
      Runtime: python3.12
      MemorySize: 256
      Timeout: 10
      Role: !Ref LabRoleArn
      Environment:
        Variables:
          TABLE_NAME: !Ref TodosTable
      Events:
        CreateTodo:
          Type: HttpApi
          Properties:
            ApiId: !Ref TodoHttpApi
            Path: /todos
            Method: post
        ListTodos:
          Type: HttpApi
          Properties:
            ApiId: !Ref TodoHttpApi
            Path: /todos
            Method: get
        GetTodo:
          Type: HttpApi
          Properties:
            ApiId: !Ref TodoHttpApi
            Path: /todos/{id}
            Method: get
        UpdateTodo:
          Type: HttpApi
          Properties:
            ApiId: !Ref TodoHttpApi
            Path: /todos/{id}
            Method: put
        DeleteTodo:
          Type: HttpApi
          Properties:
            ApiId: !Ref TodoHttpApi
            Path: /todos/{id}
            Method: delete

Outputs:
  ApiUrl:
    Description: Endpoint URL dari HTTP API
    Value: !Sub "https://${TodoHttpApi}.execute-api.${AWS::Region}.amazonaws.com"
```

---

## HARI 6 (CI/CD): Pipeline GitHub Actions Otomatis (Build, Test & Deploy)

### Langkah 6.1: Menyiapkan GitHub Secrets
Buka repositori GitHub Anda > **Settings** > **Secrets and variables** > **Actions** > Masukkan 3 rahasia dari tab *AWS Details* di portal Learner Lab:
1. `AWS_ACCESS_KEY_ID`
2. `AWS_SECRET_ACCESS_KEY`
3. `AWS_SESSION_TOKEN` (Wajib di Learner Lab karena menggunakan sesi federasi sementara).

> [!CAUTION]
> Sesi kredensial Learner Lab kadaluarsa setiap sesi lab ditutup/dimulai ulang. Anda harus memperbarui nilai secrets ini di GitHub setiap kali memulai sesi lab baru! **JANGAN PERNAH menaruh kredensial ini di file repo git.**

---

### Langkah 6.2: Workflow File GitHub Actions (`.github/workflows/deploy.yml`)
Workflow otomatis menjalankan testing `pytest`, melakukan build SAM, dan mendeploy stack ke AWS us-east-1:

```yaml
name: Serverless CI/CD Pipeline

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install Test Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r phase4-serverless-cicd/requirements.txt

      - name: Run Unit Tests with Pytest & Moto
        run: |
          cd phase4-serverless-cicd
          pytest tests/ -v

      - name: Setup AWS SAM CLI
        uses: aws-actions/setup-sam@v2
        with:
          use-installer: true

      - name: Configure AWS Credentials (Learner Lab)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-session-token: ${{ secrets.AWS_SESSION_TOKEN }}
          aws-region: us-east-1

      - name: SAM Build
        run: |
          cd phase4-serverless-cicd
          sam build --template template.yaml

      - name: SAM Deploy
        run: |
          cd phase4-serverless-cicd
          sam deploy \
            --stack-name todo-serverless-stack \
            --resolve-s3 \
            --capabilities CAPABILITY_IAM \
            --no-confirm-changeset \
            --no-fail-on-empty-changeset
```

---

## HARI 7: Ringkasan Arsitektur, Refleksi & Checklist Cleanup

### Jawaban Pertanyaan Refleksi Fase 4
1. **Kapan Serverless lebih cocok dibanding EC2?**  
   *Serverless sangat unggul untuk beban kerja yang fluktuatif, memiliki pola idle yang panjang, atau aplikasi mikroservis API berbasis event. Anda tidak membayar sepeser pun saat tidak ada request, dan tidak perlu memelihara OS/keamanan server. EC2 lebih cocok untuk beban kerja monolitik yang berjalan nonstop dengan utilisasi CPU konstan dan kebutuhan kendali penuh atas sistem operasi.*
2. **Apa risiko Cold Start pada Lambda dan cara memitigasinya?**  
   *Cold start menambah latensi awal (ratusan milidetik hingga beberapa detik) saat container baru dinyalakan. Cara memitigasinya: menggunakan bahasa runtime ringan (Python/Node.js/Go), meminimalkan ukuran package dependensi, menambah alokasi memori (vCPU lebih besar), atau menggunakan fitur Provisioned Concurrency pada lingkungan enterprise.*
3. **Kenapa Infrastructure as Code (IaC) jauh lebih baik dibanding klik konsol manual?**  
   *IaC menyediakan dokumentasi kode yang dapat di-review (version control), menjamin konsistensi reproduksi lingkungan (*reproducibility*), mencegah *human error* saat konfigurasi manual, serta memungkinkan integrasi otomatis dalam pipeline CI/CD modern.*

---

### Checklist Cleanup Berurutan Fase 4
- [ ] **Langkah 1 (CloudFormation Stack)**: Jika menggunakan SAM/IaC, buka CloudFormation Console > Centang `todo-serverless-stack` > Klik **Delete**. CloudFormation otomatis menghapus Lambda, API Gateway, dan DynamoDB secara bersih.
- [ ] **Langkah 2 (Resource Console Manual)**: Jika membuat manual:
  - Hapus API Gateway `todo-http-api`.
  - Hapus fungsi Lambda `todo-api-function`.
  - Hapus tabel DynamoDB `todos`.
  - Hapus SQS queue `todo-events-queue` dan schedule di EventBridge.
- [ ] **Langkah 3 (CloudWatch Logs)**: Buka CloudWatch > Log groups > Hapus `/aws/lambda/todo-api-function`.
- [ ] **Langkah 4 (Vocareum)**: Klik tombol **End Lab** di portal Learner Lab untuk mengakhiri sesi dengan aman.
