/**
 * Public-facing texts of the 14 sites, in English and French. The data files (sites.json) stay
 * untouched; the site shows these texts instead. No em dash.
 */
import type { SiteRecord } from "../../data";
import type { Lang } from "./index";

export interface SiteText { name: string; short: string; region: string; context: string }

type Entry = Record<Lang, SiteText>;

export const SITE_TEXT: Record<string, Entry> = {
  "connecting-ridge": {
    en: { name: "Shackleton and de Gerlache Connecting Ridge", short: "Connecting Ridge", region: "South pole, less than 15 km away",
      context: "A narrow ridge joining the rims of two craters, among the best lit places near the south pole. Right next to it, craters in permanent shadow may hold water ice. Artemis III candidate region." },
    fr: { name: "Crête de liaison Shackleton et de Gerlache", short: "Crête de liaison", region: "Pôle Sud, à moins de 15 km",
      context: "Une crête étroite qui relie les remparts de deux cratères, parmi les lieux les mieux éclairés près du pôle Sud. Juste à côté, des cratères en ombre permanente pourraient abriter de la glace d'eau. Région candidate Artemis III." },
  },
  "malapert-massif": {
    en: { name: "Malapert Massif summit", short: "Malapert Massif", region: "South pole, about 120 km away",
      context: "A mountain about 5 km high that faces the near side: from its summit the Earth stays in view most of the time, and the Sun lingers for long periods. Artemis III candidate region." },
    fr: { name: "Sommet du massif de Malapert", short: "Massif de Malapert", region: "Pôle Sud, à environ 120 km",
      context: "Une montagne d'environ 5 km de haut tournée vers la face visible : depuis son sommet, la Terre reste visible la plupart du temps et le Soleil s'attarde longtemps. Région candidate Artemis III." },
  },
  "mons-mouton": {
    en: { name: "Mons Mouton, Athena landing site (IM-2)", short: "Mons Mouton", region: "South pole, about 160 km away",
      context: "The flat top of a 6 km high mountain, where Intuitive Machines landed its IM-2 mission on 6 March 2025. Artemis III candidate region." },
    fr: { name: "Mons Mouton, site d'Athena (IM-2)", short: "Mons Mouton", region: "Pôle Sud, à environ 160 km",
      context: "Le plateau sommital d'une montagne de 6 km, où Intuitive Machines a posé sa mission IM-2 le 6 mars 2025. Région candidate Artemis III." },
  },
  "im1-malapert-a": {
    en: { name: "Near Malapert A, Odysseus landing site (IM-1)", short: "IM-1 Odysseus", region: "South polar region, about 300 km from the pole",
      context: "The first commercial lander of NASA's CLPS programme, by Intuitive Machines (22 February 2024). It touched down on a slope and tipped over, yet kept working." },
    fr: { name: "Près de Malapert A, site d'Odysseus (IM-1)", short: "IM-1 Odysseus", region: "Région polaire sud, à environ 300 km du pôle",
      context: "Le premier atterrisseur commercial du programme CLPS de la NASA, par Intuitive Machines (22 février 2024). Posé sur une pente, il s'est couché sur le flanc mais a continué à fonctionner." },
  },
  "chandrayaan-3": {
    en: { name: "Statio Shiv Shakti, Chandrayaan-3", short: "Chandrayaan-3", region: "High southern latitudes, about 600 km from the pole",
      context: "India's Vikram lander (ISRO, 23 August 2023), the first landing this close to the south pole." },
    fr: { name: "Statio Shiv Shakti, Chandrayaan-3", short: "Chandrayaan-3", region: "Hautes latitudes sud, à environ 600 km du pôle",
      context: "L'atterrisseur indien Vikram (ISRO, 23 août 2023), le premier à se poser aussi près du pôle Sud." },
  },
  "change-6": {
    en: { name: "Apollo basin, Chang'e-6", short: "Chang'e-6", region: "Far side",
      context: "China's sample return mission (CNSA, June 2024). On the far side the Earth is never visible: every message goes through the Queqiao-2 relay satellite." },
    fr: { name: "Bassin Apollo, Chang'e-6", short: "Chang'e-6", region: "Face cachée",
      context: "Mission chinoise de retour d'échantillons (CNSA, juin 2024). Sur la face cachée, la Terre n'est jamais visible : chaque message passe par le satellite relais Queqiao-2." },
  },
  "apollo-11": {
    en: { name: "Sea of Tranquility, Apollo 11", short: "Apollo 11", region: "Equator, near side",
      context: "The first crewed landing (20 July 1969). A useful contrast: near the equator the Sun climbs high, days and nights last about two weeks each, and the Earth hangs almost overhead." },
    fr: { name: "Mer de la Tranquillité, Apollo 11", short: "Apollo 11", region: "Équateur, face visible",
      context: "Le premier alunissage habité (20 juillet 1969). Un contraste utile : près de l'équateur, le Soleil monte haut, jours et nuits durent environ deux semaines chacun, et la Terre est presque au zénith." },
  },
  "apollo-12": {
    en: { name: "Ocean of Storms, Apollo 12", short: "Apollo 12", region: "Equator, near side",
      context: "The second crewed landing (19 November 1969), 180 m from the Surveyor 3 probe. Near the equator, days and nights last about two weeks each." },
    fr: { name: "Océan des Tempêtes, Apollo 12", short: "Apollo 12", region: "Équateur, face visible",
      context: "Le deuxième alunissage habité (19 novembre 1969), à 180 m de la sonde Surveyor 3. Près de l'équateur, jours et nuits durent environ deux semaines chacun." },
  },
  "apollo-15": {
    en: { name: "Hadley Apennine, Apollo 15", short: "Apollo 15", region: "Northern mid-latitudes, near side",
      context: "The first lunar rover (30 July 1971), at the foot of the Apennine mountains. Away from the poles, this atlas uses a smooth horizon without relief." },
    fr: { name: "Hadley-Apennin, Apollo 15", short: "Apollo 15", region: "Latitudes moyennes nord, face visible",
      context: "Le premier rover lunaire (30 juillet 1971), au pied des Apennins. Loin des pôles, cet atlas utilise un horizon lisse, sans relief." },
  },
  "apollo-17": {
    en: { name: "Taurus-Littrow, Apollo 17", short: "Apollo 17", region: "Northern mid-latitudes, near side",
      context: "The last crewed landing so far (11 December 1972), in the Taurus-Littrow valley. Smooth horizon: relief is only modelled south of 75°S." },
    fr: { name: "Taurus-Littrow, Apollo 17", short: "Apollo 17", region: "Latitudes moyennes nord, face visible",
      context: "Le dernier alunissage habité à ce jour (11 décembre 1972), dans la vallée de Taurus-Littrow. Horizon lisse : le relief n'est modélisé qu'au sud de 75°S." },
  },
  "change-4": {
    en: { name: "Von Kármán crater, Chang'e-4", short: "Chang'e-4", region: "Far side, South Pole Aitken basin",
      context: "The first landing on the far side (CNSA, 3 January 2019). The Earth is never visible there: all communication goes through the Queqiao relay." },
    fr: { name: "Cratère Von Kármán, Chang'e-4", short: "Chang'e-4", region: "Face cachée, bassin Pôle Sud-Aitken",
      context: "Le premier atterrissage sur la face cachée (CNSA, 3 janvier 2019). La Terre n'y est jamais visible : toutes les communications passent par le relais Queqiao." },
  },
  "change-5": {
    en: { name: "Mons Rümker, Chang'e-5", short: "Chang'e-5", region: "Ocean of Storms, near side",
      context: "China's sample return mission (CNSA, 1 December 2020), the northernmost site in this atlas." },
    fr: { name: "Mons Rümker, Chang'e-5", short: "Chang'e-5", region: "Océan des Tempêtes, face visible",
      context: "Mission chinoise de retour d'échantillons (CNSA, 1er décembre 2020), le site le plus au nord de cet atlas." },
  },
  "slim": {
    en: { name: "Near Shioli crater, SLIM", short: "SLIM", region: "Sea of Nectar, near side",
      context: "Japan's precision landing (JAXA, 19 January 2024), less than 100 m from its target. It landed on its side and still survived several lunar nights." },
    fr: { name: "Près du cratère Shioli, SLIM", short: "SLIM", region: "Mer du Nectar, face visible",
      context: "L'atterrissage de précision japonais (JAXA, 19 janvier 2024), à moins de 100 m de sa cible. Posée sur le flanc, la sonde a pourtant survécu à plusieurs nuits lunaires." },
  },
  "blue-ghost-1": {
    en: { name: "Mare Crisium, Blue Ghost M1", short: "Blue Ghost 1", region: "Sea of Crises, near side",
      context: "Firefly's CLPS lander (2 March 2025), the first fully successful commercial landing. It worked for one lunar day and stopped when night fell." },
    fr: { name: "Mare Crisium, Blue Ghost M1", short: "Blue Ghost 1", region: "Mer des Crises, face visible",
      context: "L'atterrisseur CLPS de Firefly (2 mars 2025), le premier atterrissage commercial entièrement réussi. Il a fonctionné pendant un jour lunaire et s'est arrêté à la tombée de la nuit." },
  },
};

const CUSTOM: Entry = {
  en: { name: "Custom site", short: "Custom site", region: "Your point",
    context: "A point you picked on the map. Its horizon is computed in your browser from the lunar relief." },
  fr: { name: "Site personnalisé", short: "Site personnalisé", region: "Votre point",
    context: "Un point choisi sur la carte. Son horizon est calculé dans votre navigateur à partir du relief lunaire." },
};

export function siteText(site: SiteRecord, lang: Lang): SiteText {
  if (site.category === "custom") {
    const c = CUSTOM[lang];
    return { ...c, short: site.short || c.short };
  }
  const e = SITE_TEXT[site.id];
  if (e) return e[lang];
  // Unknown site (data added later): fall back to the data file
  return { name: site.name, short: site.short, region: site.region, context: site.context };
}
