# PRD — Mini Task Manager

## Acuan dan tujuan

Dokumen ini menerjemahkan ketentuan pada [TASK_SPEC.md](TASK_SPEC.md) menjadi ruang lingkup implementasi. Aplikasi dipakai tim internal untuk membuat task, mengubah statusnya, dan melihat siapa yang mengubah status, dari apa ke apa, serta kapan.

Targetnya adalah aplikasi React + TypeScript dan Node.js + Express + TypeScript yang dapat dijalankan dan diuji dari UI sampai penyimpanan data. Acuan tugas memperkirakan pengerjaan 3–5 jam.

## Ruang lingkup

| ID | Kebutuhan wajib | Perilaku yang diterima |
| --- | --- | --- |
| F1 | Buat task | Pengguna memasukkan judul; task baru muncul dengan status `to_do`. |
| F2 | Lihat task | Daftar menampilkan task aktif beserta judul dan statusnya. |
| F3 | Ubah status | Pengguna memilih actor dan memajukan status tepat satu langkah. |
| F4 | Hapus task | Task hilang dari daftar aktif, sementara riwayat statusnya tetap tersimpan. |
| F5 | Lihat audit log | Riwayat per task menampilkan actor, status asal, status tujuan, dan waktu, dari yang paling lama. |

Tambahan navigasi yang diminta pengguna: ringkasan, daftar dengan pencarian/filter status, board menurut status, halaman detail dan riwayat, task terhapus, Timeline, Users, dan Insights. Semua memakai data task dan audit log yang sama. Autentikasi, role, editor dokumen, dan fitur workspace dari `open-silong` tidak termasuk ruang lingkup.

| ID | Fitur tambahan | Perilaku yang diterima |
| --- | --- | --- |
| F6 | Prioritas dan tenggat | Pengguna dapat memilih `low`, `medium`, atau `high`, serta tanggal tenggat opsional saat membuat task dan mengedit keduanya pada detail task. |
| F7 | Timeline | Task aktif ditampilkan menurut tanggal tenggat; task tanpa tenggat tetap dapat ditemukan. |
| F8 | Users | Daftar actor tetap dapat dilihat dan dipilih untuk perubahan status berikutnya. Tidak ada login atau akun pengguna. |
| F9 | Insights | Filter tanggal pembuatan, metrik total/tingkat selesai/in progress/terlambat, serta distribusi status dan prioritas dihitung dari task aktif. |

## Aturan domain dan asumsi

Spesifikasi awal tidak mengisi daftar field setelah kalimat “Setiap task memiliki struktur minimum”. Untuk implementasi ini, task berisi `id`, `title`, `status`, `priority`, `dueDate`, `createdAt`, dan `deletedAt`. `title` wajib berisi teks setelah spasi di awal/akhir dihapus. Prioritas awal `medium`; tanggal tenggat boleh kosong. ID dan waktu dibuat oleh server.

Alur status bersifat maju satu langkah:

| Status saat ini | Status berikutnya |
| --- | --- |
| `to_do` | `pending` |
| `pending` | `in_progress` |
| `in_progress` | `done` |
| `done` | Tidak ada |

- **Idempotent update:** permintaan mengubah status ke nilai yang sama berhasil tanpa mengubah task atau membuat audit log baru.
- Lompatan status, perubahan mundur, atau perubahan dari `done` ke status lain ditolak oleh backend. UI hanya menawarkan langkah yang valid.
- Actor dipilih dari daftar nama tetap melalui dropdown. Backend memvalidasi nama terhadap daftar yang sama. Actor merupakan nama yang dipilih, bukan identitas yang diverifikasi, karena autentikasi tidak diminta.
- Audit log dibuat hanya untuk perubahan status yang benar-benar terjadi. Pembuatan dan penghapusan task tidak dianggap perubahan status.
- Penghapusan memakai `deletedAt` (*soft delete*). Task terhapus tidak muncul di daftar aktif; audit log tetap dapat diminta dengan ID task tersebut.
- Task dianggap terlambat jika `dueDate` sebelum tanggal lokal hari ini dan status belum `done`. Tingkat selesai = jumlah task `done` dibagi jumlah task aktif pada rentang tanggal, atau 0% saat tidak ada task.
- Filter tanggal Insights memakai tanggal pembuatan task, inklusif pada kedua batas. Perubahan prioritas atau tenggat tidak membuat audit log; log sesuai ketentuan tugas hanya mencatat status.

## Penyimpanan dan konsistensi

Gunakan PostgreSQL yang dikelola Supabase. Spesifikasi juga mengizinkan penyimpanan memory atau JSON; Supabase dipilih karena data perlu bertahan saat aplikasi berjalan di Vercel. Express menjadi satu-satunya pengakses database memakai kunci server yang disimpan dalam environment variable. Skema logisnya ada di [ERD.md](ERD.md).

Pada permintaan perubahan status, backend memanggil satu fungsi database. Fungsi itu membaca dan mengunci task, memvalidasi transisi, lalu memperbarui status dan menambah **satu** log dalam satu transaksi. Jika salah satu operasi gagal, keduanya dibatalkan. Status asal pada log selalu diambil dari data server, bukan dari request pengguna.

Audit log bersifat append-only: tidak ada endpoint untuk mengubah atau menghapusnya, dan trigger database menolak operasi `UPDATE` serta `DELETE`. Kedua tabel memakai Row Level Security tanpa kebijakan akses browser; kunci server hanya tersedia di Express. Riwayat tetap terhubung ke task yang dihapus karena task tidak dihapus secara fisik. Operator database tetap berada di luar batas perlindungan aplikasi.

## Kontrak API minimum

Semua endpoint menggunakan JSON kecuali respons `204`.

| Endpoint | Input | Hasil |
| --- | --- | --- |
| `GET /api/tasks` | — | `200`, daftar task aktif. |
| `GET /api/tasks?deleted=true` | — | `200`, daftar task terhapus. |
| `GET /api/tasks/:id` | — | `200`, detail task aktif atau terhapus. |
| `POST /api/tasks` | `{ "title": "Prepare Invoice", "priority": "high", "dueDate": "2026-10-10" }` | `201`, task baru berstatus `to_do`; prioritas dan tenggat opsional. |
| `PATCH /api/tasks/:id` | `{ "priority": "low", "dueDate": null }` | `200`, prioritas/tenggat task aktif diperbarui. |
| `PUT /api/tasks/:id/status` | `{ "status": "pending", "actor": "john.doe" }` | `200`, task terkini; status sama tidak menambah log. |
| `DELETE /api/tasks/:id` | — | `204`, task disembunyikan dari daftar aktif. |
| `GET /api/tasks/:id/audit-logs` | — | `200`, log task tersebut secara kronologis, termasuk jika task sudah dihapus. |

Input tidak valid menghasilkan `400`; ID task yang tidak ada menghasilkan `404`; transisi terlarang atau task yang sudah dihapus menghasilkan `409`. Respons kesalahan berisi pesan yang dapat ditampilkan UI. Urutan log adalah `changedAt` menaik, lalu `id` menaik jika waktunya sama.

## Kebutuhan UI

Sidebar kiri menyediakan alur: Ringkasan → Semua task → Detail task → Riwayat status. Pengguna juga dapat membuka Board untuk melihat empat kolom status dan memajukan task satu langkah, Timeline untuk jadwal berdasarkan tenggat, Users untuk memilih actor, Insights untuk analitik, atau Task terhapus untuk membuka kembali riwayat. Daftar task memiliki pencarian judul dan filter status di browser. Actor dipilih melalui dropdown ikon pengguna di kanan atas; teks actor tidak ditampilkan di header. Tombol tema mengganti terang/gelap dengan satu klik dan menyimpan pilihan di browser. Sidebar dapat disembunyikan pada desktop, sedangkan tablet/mobile menggunakan panel navigasi yang dibuka melalui tombol. Form task, aksi hapus, keadaan kosong, proses memuat, dan pesan kesalahan tetap tersedia. Board tidak memakai drag-and-drop karena transisi hanya boleh mengikuti urutan status.

[open-silong](open-silong/) dan gambar referensi pengguna menjadi acuan visual. UI memakai sidebar, font Inter, bentuk ikon Lucide dari `react-icons/lu`, aksen biru, kartu metrik, dan grafik CSS sederhana. Elemen yang dapat diklik memberi bayangan ringan saat hover. Aplikasi tidak bergantung pada kode runtime `open-silong` atau pustaka grafik tambahan.

## Kriteria penerimaan end-to-end

1. Pengguna membuka Ringkasan, masuk ke Semua task, membuat task dari UI, lalu halaman detail menampilkan status `to_do`; task tersedia melalui API.
2. Pengguna memilih actor lalu memajukan status `to_do → pending → in_progress → done`; ada tepat tiga log dengan actor, pasangan status, dan waktu yang benar, urut dari yang paling lama.
3. Mengirim status yang sama lagi tidak menambah log. Mengirim status yang melompati atau mundur ditolak; status dan jumlah log tetap sama.
4. Pencarian judul, filter status, dan board menampilkan task sesuai data yang sama. Board hanya menawarkan transisi yang valid.
5. Task dengan prioritas dan tenggat dapat dibuat dan diedit; Timeline dan Insights menampilkan hasil yang sesuai. Filter tanggal Insights mengubah metrik dan distribusi.
6. Setelah task dihapus, task tidak tampil dalam daftar aktif, masuk ke Task terhapus, dan audit log lama masih dapat dibuka berdasarkan ID.
7. Setelah halaman dan backend dimulai ulang, task aktif dan audit log yang tersimpan tetap tersedia.
8. Build/typecheck frontend dan backend, tes aturan API, serta satu tes browser yang melewati alur utama di atas berhasil.

## Hasil akhir yang harus diserahkan

Repository publik berisi kode frontend/backend dan README yang menjelaskan cara menjalankan keduanya, arsitektur singkat, asumsi, trade-off, serta perbaikan berikutnya jika ada waktu. README juga menjawab cara menjaga audit log, risiko saat dipakai banyak pengguna, bagian pertama yang perlu direfactor jika sistem membesar, dan penggunaan serta validasi bantuan AI sesuai ketentuan tugas.
