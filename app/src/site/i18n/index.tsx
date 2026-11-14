/**
 * Minimal EN/FR internationalisation: two dictionaries with the same keys (en.ts, fr.ts),
 * {name} placeholders, locale-aware number and date formatting. Language saved in localStorage.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en, type MessageKey } from "./en";
import { fr } from "./fr";

export type Lang = "en" | "fr";
export type { MessageKey };
const DICTS: Record<Lang, Record<MessageKey, string>> = { en, fr };
const STORAGE_KEY = "earthrise.lang";

export function interpolate(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export interface Fmt {
  num(x: number, digits?: number): string;
  pct(x: number): string;
  hours(h: number): string;
  date(ms: number): string;
  dateTime(ms: number): string;
}

export function makeFmt(lang: Lang): Fmt {
  const nf = (d: number) => new Intl.NumberFormat(lang, { minimumFractionDigits: d, maximumFractionDigits: d });
  const num = (x: number, digits = 0) => nf(digits).format(x);
  const dtf = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const dtt = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return {
    num,
    pct: (x) => (lang === "fr" ? `${num(x, 1)} %` : `${num(x, 1)}%`),
    hours: (h) => {
      if (h >= 48) return `${num(h / 24, 1)} ${lang === "fr" ? "jours" : "days"}`;
      const H = Math.floor(h + 1e-9), M = Math.round((h - H) * 60);
      return M === 0 ? `${H} h` : `${H} h ${String(M).padStart(2, "0")}`;
    },
    date: (ms) => dtf.format(new Date(ms)),
    dateTime: (ms) => `${dtt.format(new Date(ms))} UTC`,
  };
}

interface I18n {
  lang: Lang;
  setLang(l: Lang): void;
  t(key: MessageKey, vars?: Record<string, string | number>): string;
  fmt: Fmt;
}

const Ctx = createContext<I18n | null>(null);

function initialLang(): Lang {
  try { return localStorage.getItem(STORAGE_KEY) === "fr" ? "fr" : "en"; } catch { return "en"; }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const value = useMemo<I18n>(() => ({
    lang, setLang,
    t: (key, vars) => interpolate(DICTS[lang][key] ?? en[key] ?? key, vars),
    fmt: makeFmt(lang),
  }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}
