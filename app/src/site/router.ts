/**
 * Path-based routing (History API). The URL hash stays free for the shareable link (share.ts).
 * The host must serve index.html for every path (app/public/_redirects on Netlify).
 */
import { useCallback, useEffect, useState } from "react";

export type Page = "story" | "atlas" | "play" | "lab" | "method";
export const PAGES: Page[] = ["story", "atlas", "play", "lab", "method"];

export function pageFromPath(pathname: string): Page {
  const seg = pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
  return (PAGES as string[]).includes(seg) && seg !== "story" ? (seg as Page) : "story";
}

export function pathOf(page: Page): string {
  return page === "story" ? "/" : `/${page}`;
}

const listeners = new Set<() => void>();

/** Goes to a page (optionally with a hash, e.g. a shareable state) and scrolls to the top. */
export function navigate(page: Page, hash = ""): void {
  const url = pathOf(page) + (hash && !hash.startsWith("#") ? `#${hash}` : hash);
  window.history.pushState(null, "", url);
  window.scrollTo(0, 0);
  listeners.forEach((l) => l());
}

export function useRoute(): { page: Page; navigate: typeof navigate } {
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname));
  const sync = useCallback(() => setPage(pageFromPath(window.location.pathname)), []);
  useEffect(() => {
    listeners.add(sync);
    window.addEventListener("popstate", sync);
    return () => { listeners.delete(sync); window.removeEventListener("popstate", sync); };
  }, [sync]);
  return { page, navigate };
}
