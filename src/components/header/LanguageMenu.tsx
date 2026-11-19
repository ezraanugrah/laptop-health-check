import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { Lang } from "../../i18n/translate";
import { moveMenuIndex } from "../../lib/menu";
import { useI18n } from "../../lib/preferences";
import { LANGUAGE_OPTIONS, languageOption } from "../../lib/settings";
import { CheckIcon, ChevronDownIcon } from "./icons";
import { HEADER_BUTTON } from "./styles";

/**
 * Dropdown bahasa ringkas (pola menu WAI-ARIA): Enter/Spasi/↓/↑ membuka, ↑/↓/Home/End
 * berpindah, Enter/Spasi memilih, Esc menutup & mengembalikan fokus, klik di luar menutup.
 */
export function LanguageMenu() {
  const { t, settings, update } = useI18n();
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const current = languageOption(settings.language);
  const activeIndex = Math.max(
    0,
    LANGUAGE_OPTIONS.findIndex((o) => o.value === settings.language),
  );

  const openAt = (index: number) => {
    setFocusIndex(index);
    setOpen(true);
  };
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  // Fokus mengikuti item aktif selama menu terbuka.
  useEffect(() => {
    if (open) itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  // Klik di luar menu menutupnya (tanpa memindahkan fokus).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const choose = (lang: Lang) => {
    if (lang !== settings.language) update({ language: lang });
    close(true);
  };

  const onButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openAt(activeIndex);
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = moveMenuIndex(focusIndex, e.key, LANGUAGE_OPTIONS.length);
    if (next !== null) {
      e.preventDefault();
      setFocusIndex(next);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const buttonLabel = t("prefs.languageButton", { name: t(current.label) });

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={buttonLabel}
        title={buttonLabel}
        onClick={() => (open ? close(false) : openAt(activeIndex))}
        onKeyDown={onButtonKeyDown}
        className={HEADER_BUTTON}
      >
        <span aria-hidden className="text-base leading-none">
          {current.flag}
        </span>
        <span>{current.code}</span>
        <ChevronDownIcon className={`h-3.5 w-3.5 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={t("prefs.language")}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-30 mt-2 w-max min-w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
        >
          {LANGUAGE_OPTIONS.map((o, i) => {
            const checked = o.value === settings.language;
            return (
              <button
                key={o.value}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={i === focusIndex ? 0 : -1}
                onClick={() => choose(o.value)}
                onMouseEnter={() => setFocusIndex(i)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800 ${
                  checked
                    ? "font-medium text-slate-900 dark:text-slate-100"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                } ${i === focusIndex ? "bg-slate-100 dark:bg-slate-800" : ""}`}
              >
                <span aria-hidden className="text-base leading-none">
                  {o.flag}
                </span>
                <span aria-hidden className="w-6 font-semibold tabular-nums">
                  {o.code}
                </span>
                <span aria-hidden className="text-slate-500 dark:text-slate-400">
                  —
                </span>
                <span lang={o.htmlLang} className="flex-1 whitespace-nowrap pr-2">
                  {t(o.label)}
                </span>
                {checked && <CheckIcon className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
