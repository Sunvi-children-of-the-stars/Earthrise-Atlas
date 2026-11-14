/** Parses typed coordinates: decimal degrees with "." or ",", optional N/S and E/W/O letters, longitudes 0 to 360. */
function parseOne(raw: string, pos: string, neg: string): number | null {
  const s = raw.trim().replace(",", ".").toUpperCase();
  const m = s.match(/^([+-]?\d+(?:\.\d+)?)\s*°?\s*([A-Z])?$/);
  if (!m) return null;
  let v = Number(m[1]);
  const letter = m[2];
  if (letter) {
    if (pos.includes(letter)) v = Math.abs(v);
    else if (neg.includes(letter)) v = -Math.abs(v);
    else return null;
  }
  return Number.isFinite(v) ? v : null;
}

export function parseCoords(latStr: string, lonStr: string): { lat: number; lon: number } | null {
  const lat = parseOne(latStr, "N", "S");
  let lon = parseOne(lonStr, "E", "WO");
  if (lat === null || lon === null || Math.abs(lat) > 90 || lon < -180 || lon > 360) return null;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}
