# Streamify

Streamify adalah aplikasi web pemutar musik dengan tampilan yang terinspirasi dari Spotify. Aplikasi ini memakai React + Vite untuk frontend dan Express untuk backend lokal. Lagu dicari dari YouTube, lalu diputar sebagai audio melalui YouTube IFrame API tanpa menampilkan video sebagai konten utama.

## Fitur

- Tampilan desktop dan mobile yang responsif.
- Pencarian lagu dari YouTube.
- Player audio dengan play, pause, next, previous, shuffle, repeat, seek, dan volume.
- Queue playback, sehingga lagu dari playlist tetap lanjut sesuai antrean walaupun user pindah halaman.
- Import playlist Spotify public dengan paste link playlist.
- Playlist tersimpan di browser lewat `localStorage`.
- Smoke test otomatis untuk mengecek alur desktop, mobile, playlist, player, dan API dasar.

## Kebutuhan

- Node.js versi modern.
- npm.

## Cara Menjalankan

Install dependency:

```bash
npm install
```

Jalankan aplikasi dalam mode development:

```bash
npm run dev
```

Setelah server berjalan, buka:

```text
http://127.0.0.1:5173/
```

Frontend berjalan di port `5173`, sedangkan backend API berjalan di port `4177`.

## Script

```bash
npm run dev
```

Menjalankan frontend Vite dan backend Express secara bersamaan.

```bash
npm run build
```

Membuat build production ke folder `dist`.

```bash
npm run preview
```

Menjalankan preview untuk hasil build production.

```bash
npm run test:smoke
```

Menjalankan smoke test dengan Playwright.

## Catatan

Fitur pencarian YouTube dan import playlist Spotify bergantung pada halaman publik dari masing-masing layanan. Jika struktur halaman berubah, scraping bisa perlu disesuaikan lagi.
