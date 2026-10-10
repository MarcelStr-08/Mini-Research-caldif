# Mini Riset Kalkulus Diferensial

**Analisis Laju Perubahan Penggunaan RAM Komputer terhadap Durasi Penggunaan Aplikasi Menggunakan Konsep Turunan**

- Mahasiswa: Marcel Sianturi
- Kelas/kelompok: PSIK 26 B
- Mata kuliah: Kalkulus Diferensial
- Aplikasi yang diamati: Adobe Photoshop

> **Penting:** seluruh data pada situs ini adalah **data simulasi** untuk demonstrasi konsep matematika. Tidak ada pengukuran nyata, eksperimen, survei pengguna, atau rata-rata empiris Adobe Photoshop yang dilakukan dalam proyek ini.

## Fitur

- Hero, latar belakang, tabel data, grafik, model matematika, kalkulator, ringkasan, dan batasan penelitian dalam Bahasa Indonesia.
- Grafik garis SVG interaktif (tooltip saat mouse diarahkan, ketuk/klik untuk memilih titik, navigasi keyboard dengan Tab dan tombol panah).
- Model interpolasi linear per interval dan turunan pada tiap interval.
- Pemeriksaan turunan di titik sambungan dari sisi kiri dan kanan. Jika kemiringan berbeda, situs menampilkan bahwa turunan dua sisi tidak terdefinisi.
- Kalkulator laju perubahan rata-rata dan laju sesaat, dengan validasi rentang waktu (tanpa ekstrapolasi).
- Edit data langsung di tabel, tambah dan hapus titik, kembalikan data awal, dan unduh CSV.
- Ringkasan dan kesimpulan otomatis yang selalu mengikuti data aktif.
- Responsif, fokus keyboard terlihat, dan menghormati preferensi *reduced motion*.

## Struktur berkas

```
index.html   struktur halaman
style.css    desain dan responsivitas
script.js    logika, grafik SVG, localStorage, kalkulasi, ekspor CSV
README.md    dokumentasi ini
```

Semua berkas terhubung dengan path relatif. Tidak ada framework, proses build, backend, API key, atau layanan berbayar.

## Menjalankan secara lokal

1. Unduh atau salin keempat berkas ke satu folder yang sama.
2. Buka `index.html` dengan klik dua kali, atau seret ke jendela browser.
3. (Opsional) Jalankan server lokal sederhana dari folder tersebut, misalnya `python -m http.server 8000`, lalu buka `http://localhost:8000`.

## Mengunggah ke GitHub Pages

1. Buat repository baru di GitHub, misalnya `mini-riset-kalkulus`.
2. Unggah `index.html`, `style.css`, `script.js`, dan `README.md` ke cabang `main`. `index.html` harus berada di akar repository.
3. Buka **Settings → Pages**.
4. Pada **Build and deployment**, pilih **Deploy from a branch**, pilih cabang `main` dan folder `/ (root)`, lalu simpan.
5. Tunggu satu sampai beberapa menit. Alamat situs biasanya `https://<nama-pengguna>.github.io/mini-riset-kalkulus/`.

## Rumus yang dipakai

Untuk dua titik berurutan (t_i, R_i) dan (t_{i+1}, R_{i+1}):

```
R(t)  = R_i + [(R_{i+1} - R_i) / (t_{i+1} - t_i)] (t - t_i),   t_i <= t <= t_{i+1}
R'(t) = (R_{i+1} - R_i) / (t_{i+1} - t_i)                       di dalam interval
```

Satuan: GB dibagi jam = GB/jam. Contoh pada data awal, interval jam ke-2 sampai ke-3: `(3,6 - 3,1) / (3 - 2) = 0,5 GB/jam`.

Di titik sambungan, kemiringan kiri dan kanan dibandingkan dengan toleransi numerik yang kecil. Jika berbeda, turunan dua sisi tidak terdefinisi. Pada titik awal dan akhir hanya tersedia turunan satu sisi dalam domain data.

## Tentang penyimpanan data (localStorage)

Perubahan data disimpan di `localStorage`, sehingga **hanya tersimpan di browser dan perangkat yang sama**. Perubahan tidak dibagikan ke pengunjung lain karena GitHub Pages tidak memiliki backend. Jika data tersimpan rusak atau tidak valid, situs memulihkannya ke data awal dan menampilkan pemberitahuan. Tombol **Kembalikan Data Awal** juga memperbarui penyimpanan lokal.

## Batas verifikasi

Logika perhitungan (validasi, interpolasi, turunan, kalkulator, ringkasan, penyimpanan, CSV, skala grafik) diuji dengan skrip Node.js. Tampilan, interaksi grafik, dan tata letak pada layar ponsel belum dijalankan di browser sungguhan oleh pembuat berkas ini, sehingga sebaiknya dicek langsung di browser sebelum dikumpulkan.

## Catatan

Proyek ini dibuat untuk tujuan pembelajaran.
