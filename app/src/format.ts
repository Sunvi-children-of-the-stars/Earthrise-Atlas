export const fmtDeg = (v: number, d = 1) => `${v.toFixed(d).replace(".", ",")}°`;
export const fmtPct = (v: number) => `${Math.round(v)} %`;
export const fmtNum = (v: number, d = 0) => v.toFixed(d).replace(".", ",");

export function fmtDuration(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
  return `${fmtNum(h / 24, 1)} j`;
}

export function fmtDate(t: number, withTime = true): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  const s = `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  return withTime ? `${s} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC` : s;
}

/** Value for <input type="datetime-local">, in UTC. */
export const toInput = (t: number) => new Date(t).toISOString().slice(0, 16);
export const fromInput = (s: string) => Date.parse(`${s}:00Z`);

export const fmtLatLon = (lat: number, lon: number) =>
  `${fmtNum(Math.abs(lat), 3)}°${lat < 0 ? "S" : "N"}, ${fmtNum(Math.abs(lon), 3)}°${lon < 0 ? "O" : "E"}`;
