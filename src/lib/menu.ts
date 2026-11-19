// Navigasi keyboard untuk menu ringkas (pola menu WAI-ARIA), fungsi murni.

/**
 * Indeks item berikutnya untuk tombol navigasi menu.
 * ↓/↑ berputar, Home/End ke ujung. `null` = tombol itu bukan tombol navigasi.
 */
export function moveMenuIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
      return (current + 1) % count;
    case "ArrowUp":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
