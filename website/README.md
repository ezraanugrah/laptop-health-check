# Website Laptop Health Check

Landing page statis (HTML + CSS + JS kecil) untuk Laptop Health Check. Tanpa dependency, build, cookie,
analitik, atau font/aset eksternal. Dua bahasa (ID default, EN) dan tema gelap/terang; preferensi hanya di
`localStorage` pengunjung.

| File | Isi |
|---|---|
| `index.html` | Konten (teks Indonesia sebagai default) |
| `app.js` | Kamus English + tombol bahasa/tema |
| `theme-init.js` | Terapkan tema/bahasa tersimpan sebelum tampil (file terpisah agar CSP ketat) |
| `styles.css` | Tampilan, tema lewat kelas `dark` di `<html>` |
| `vercel.json` | Header keamanan (CSP `'self'`, tanpa iframe, kamera/mikrofon/lokasi dimatikan) |

## Pratinjau lokal

```bash
python3 -m http.server 4173 -d website   # server bawaan, tanpa unduhan
```

## Deploy (Vercel)

- Root Directory proyek Vercel: `website` (tanpa build command, output = folder itu sendiri).
- Proyek Vercel: `laptop-health-check` (ditautkan lewat `vercel link`; `.vercel/` dan `.env*` tidak masuk git maupun unggahan, lihat `.vercelignore`).
- Preview: `cd website && vercel deploy --environment preview` — **selalu sebut `--environment preview`**: deploy pertama proyek baru tanpa opsi itu menjadi production.
- Production (`--prod`) hanya dengan persetujuan pemilik. Preview dilindungi login Vercel (Deployment Protection).
- `vercel.json` mematikan build (`framework: null`, `buildCommand: ""`): situs statis murni.
- Belum ada tautan unduhan: tombol "Unduh" sengaja bertanda "segera" sampai ada rilis resmi yang disetujui pemilik.

Isi harus tetap jujur terhadap status aplikasi (beta, baru diuji di Mac Intel, belum ditandatangani Apple).
