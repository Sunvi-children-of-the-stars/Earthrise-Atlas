import { useMemo } from "react";
import { useData, useMask } from "../data/store";
import { Chapters } from "./Chapters";
import { storyFigures } from "./figures";
import { Hero } from "./Hero";

/** Home page: hero, then the five chapters on the fixed reference period. */
export function Story() {
  const { sites, lro, ephReady } = useData();
  const ridge = sites.find((s) => s.id === "connecting-ridge") ?? null;
  const { mask } = useMask(ridge);
  const figs = useMemo(() => (ridge && mask && ephReady ? storyFigures(ridge, mask, lro) : null), [ridge, mask, ephReady, lro]);
  return (
    <div className="story">
      <Hero mask={mask} />
      <Chapters ridge={ridge} ridgeMask={mask} lro={lro} figs={figs} />
    </div>
  );
}
