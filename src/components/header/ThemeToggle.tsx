import { useI18n } from "../../lib/preferences";
import { otherTheme, THEME_LABEL } from "../../lib/settings";
import { MoonIcon, SunIcon } from "./icons";
import { HEADER_BUTTON } from "./styles";

/** Tombol tema ringkas: menampilkan tema aktif; klik = ganti ke tema lain (langsung & tersimpan). */
export function ThemeToggle() {
  const { t, settings, update } = useI18n();
  const current = settings.theme;
  const next = otherTheme(current);
  const label = t("prefs.themeButton", { current: t(THEME_LABEL[current]), next: t(THEME_LABEL[next]) });
  return (
    <button type="button" onClick={() => update({ theme: next })} aria-label={label} title={label} className={HEADER_BUTTON}>
      {current === "dark" ? <MoonIcon /> : <SunIcon />}
      <span>{t(THEME_LABEL[current])}</span>
    </button>
  );
}
