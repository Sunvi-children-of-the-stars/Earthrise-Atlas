import type { HorizonMask } from "../../astro/horizon";
import { useI18n } from "../i18n";
import { navigate } from "../router";
import { Silhouette } from "../viz/Silhouette";

/** First screen, after the validated "Polar Night" mockup: centred text, thin ice arcs, real relief, the Earth on the horizon. */
export function Hero({ mask }: { mask: HorizonMask | null }) {
  const { t } = useI18n();
  return (
    <section className="hero">
      <svg className="hero-arcs" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <circle cx="600" cy="760" r="560" className="arc a1" />
        <circle cx="600" cy="760" r="420" className="arc a2" />
        <circle cx="600" cy="760" r="300" className="arc a3" />
      </svg>
      <div className="hero-inner container">
        <div className="eyebrow">{t("hero.eyebrow")}</div>
        <h1>{t("hero.title")}</h1>
        <p className="hero-lead">{t("hero.lead")}</p>
        <div className="row hero-cta">
          <a className="btn btn-primary" href="#chapter-1">{t("hero.start")}</a>
          <a className="btn btn-ghost" href="/play" onClick={(e) => { e.preventDefault(); navigate("play"); }}>{t("hero.play")}</a>
        </div>
      </div>
      <div className="hero-ground">
        <span className="hero-earth" aria-hidden="true" />
        {mask && <Silhouette mask={mask} height={170} exaggeration={14} />}
      </div>
    </section>
  );
}
