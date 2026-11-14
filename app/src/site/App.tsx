import { lazy, Suspense, useEffect } from "react";
import { DataProvider } from "./data/store";
import { I18nProvider, useI18n, type MessageKey } from "./i18n";
import { useRoute, type Page } from "./router";
import { Method } from "./method/Method";
import { Play } from "./play/Play";
import { Story } from "./story/Story";
import { Atlas } from "./atlas/Atlas";
import { Nav } from "./ui/Nav";

const Lab = lazy(() => import("./lab/Lab"));

const TITLE: Record<Page, MessageKey> = {
  story: "page.story", atlas: "page.atlas", play: "page.play", lab: "page.lab", method: "page.method",
};

/** Placeholder page, replaced task by task. */
function Placeholder({ page }: { page: Page }) {
  const { t } = useI18n();
  return (
    <section className="page container">
      <div className="page-head"><h1>{t(TITLE[page])}</h1></div>
    </section>
  );
}

function Shell() {
  const { page, navigate } = useRoute();
  const { t, lang } = useI18n();
  useEffect(() => {
    document.title = page === "story" ? t("brand") : `${t(TITLE[page])} · ${t("brand")}`;
  }, [page, lang, t]);
  return (
    <>
      <Nav page={page} onNavigate={(p) => navigate(p)} />
      <main id="main">{page === "method" ? <Method /> : page === "play" ? <Play /> : page === "story" ? <Story /> : page === "atlas" ? <Atlas /> : page === "lab" ? <Suspense fallback={<Placeholder page={page} />}><Lab /></Suspense> : <Placeholder page={page} />}</main>
      <footer className="footer">
        <div className="container"><span>{t("footer.challenge")}</span><span>{t("footer.data")}</span></div>
      </footer>
    </>
  );
}

export default function App() {
  return <I18nProvider><DataProvider><Shell /></DataProvider></I18nProvider>;
}
