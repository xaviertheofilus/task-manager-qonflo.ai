Take-Home Task – Full Stack Developer (React + Express)Tujuan

Take-home task ini dirancang untuk mengevaluasi:

Cara berpikir dan pengambilan keputusan teknis

Kemampuan membangun fitur end-to-end (Frontend + Backend)

Kualitas struktur kode dan konsistensi

Kemampuan menjelaskan trade-off dan asumsi

Penggunaan AI diperbolehkan, namun kandidat harus memahami dan mampu menjelaskan seluruh solusi yang dibuat.

Estimasi waktu pengerjaan: 3–5 jam

Product Context

Aplikasi ini digunakan oleh internal team untuk mengelola task sederhana.

Masalah utama yang sering terjadi:

Status task sering berubah tapi tidak jelas siapa mengubah apa

Perubahan data sulit ditelusuri

UI tidak cukup menjelaskan riwayat perubahan

Solusi yang diminta adalah aplikasi sederhana namun jelas secara data dan perubahan.

Problem Statement

Buatlah sebuah Mini Task Manager dimana user dapat:

Membuat task

Mengubah status task

Melihat riwayat perubahan (audit log) per task

Aplikasi harus dibangun menggunakan:

Frontend: React + Typescript

Backend: Node.js + Express + Typescript

Penilaian

Kami menilai berdasarkan:

Kejelasan struktur kode

Konsistensi frontend dan backend

Reasoning & trade-off

Kemampuan menjelaskan solusi sendiri

Tidak dinilai dari jumlah fitur

Catatan

Tidak ada satu solusi benar

Lebih baik solusi sederhana tapi jelas, dibanding kompleks tapi tidak konsisten

Kami lebih menghargai pemikiran yang matang daripada kode yang sempurna

Requirements1. Task Management

Setiap task memiliki struktur minimum:


Fitur wajib:

Create task

Update task status (hanya mengikuti urutan: to_do → pending → in_progress → done)

Delete task

List semua task

2. Audit Log

Setiap perubahan status harus menghasilkan audit log baru

Struktur audit log bebas, namun harus bisa menjawab:

Task mana yang berubah

Siapa yang melakukan perubahan (actor). Actor dapat di hardcoded ke predefined user lists dan menggunakan input via dropdown

Dari status apa → ke status apa

Kapan perubahan terjadi

Contoh log:

User "john.doe" changed Task "Prepare Invoice" status from "pending" to "in_progress" at 2025-01-01 10:00

Ketentuan:

Audit log tidak boleh diubah atau dihapus dalam keadaan apapun

Update task tidak boleh menghapus log lama

Audit log ditampilkan urut secara kronologi

3. API Guidelines

Kandidat bebas mendesain API, contoh:

GET /tasks

POST /tasks

PUT /tasks/:id/status

GET /tasks/:id/audit-logs

4. Frontend Guidelines

UI sederhana tapi jelas

Task list mudah dibaca

Status task terlihat jelas

Audit log bisa ditampilkan per task (modal / expandable section / halaman terpisah)

Tidak dinilai dari estetika visual

5. Non-Functional Requirements (Penting)

Idempotent Update
Update status ke nilai yang sama tidak boleh membuat audit log baru

Data Consistency
Status task dan audit log harus selalu sinkron

Persistence
Data boleh disimpan di memory / file JSON / database bebas

Domain Validation
Sistem diharapkan menolak perubahan yang melanggar alur status. Validasi boleh harus dilakukan di backend, validasi di frontend opsional

No Overengineering
Tidak perlu auth, role, atau UI kompleks

Deliverables

Submit ke dalam Public Repository GitHub

README.md berisi:

Cara menjalankan frontend & backend

Penjelasan singkat arsitektur

Asumsi yang diambil

Trade-off yang dibuat

Jika ada waktu lebih, apa yang akan diperbaiki

Jawab di README atau file terpisah:

Bagaimana kamu memastikan audit log tidak ter-modifikasi?

Bagian mana dari solusi ini yang paling berisiko jika digunakan oleh banyak user?

Jika task ini berkembang menjadi sistem besar, bagian mana yang akan kamu refactor terlebih dahulu dan kenapa?


Jika kamu menggunakan AI, jelaskan bagian mana yang dibantu AI dan bagaimana kamu memvalidasinya.