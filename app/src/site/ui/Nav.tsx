import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { pathOf, type Page } from "../router";
import { Logo } from "./Logo";

const LINKS: { page: Page; key: "nav.story" | "nav.atlas" | "nav.play" | "nav.lab" | "nav.method" }[] = [
  { page: "story", key: "nav.story" }, { page: "atlas", key: "nav.atlas" }, { page: "play", key: "nav.play" },
  { page: "lab", key: "nav.lab" }, { page: "method", key: "nav.method" },
];

export function Nav({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [page]);
  const go = (e: React.MouseEvent, p: Page) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(p);
  };
  return (
    <header className="nav">
      <a className="skip" href="#main">{t("nav.skip")}</a>
      <div className="container">
        <a className="brand" href="/" onClick={(e) => go(e, "story")}><Logo />{t("brand")}</a>
        <button className="nav-toggle" aria-expanded={open} aria-controls="nav-links" onClick={() => setOpen((o) => !o)}>{t("nav.menu")}</button>
        <nav id="nav-links" className={open ? "nav-links open" : "nav-links"} aria-label={t("brand")}>
          {LINKS.map((l) => (
            <a key={l.page} href={pathOf(l.page)} aria-current={page === l.page ? "page" : undefined} onClick={(e) => go(e, l.page)}>
              {t(l.key)}
            </a>
          ))}
          <div className="lang" role="group" aria-label={t("nav.lang")}>
            <button aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
            <button aria-pressed={lang === "fr"} onClick={() => setLang("fr")}>FR</button>
          </div>
        </nav>
      </div>
    </header>
  );
}
