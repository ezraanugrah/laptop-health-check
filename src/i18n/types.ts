// Tipe dasar i18n.

export type Lang = "id-ID" | "en-US";

/** Satu entri katalog: kedua bahasa wajib ada (dijaga TypeScript + test). */
export interface Entry {
  id: string;
  en: string;
}

/**
 * Parameter template. Nilai string berawalan "@" adalah kunci terjemahan yang
 * ikut diterjemahkan; array digabung dengan ", " (tiap item diproses sama).
 */
export type Params = Record<string, string | number | string[]>;

/** Pesan dari backend Rust (`Text`): teks Indonesia + kode + parameter. */
export interface CodedText {
  text: string;
  code?: string;
  params?: Record<string, string>;
}
