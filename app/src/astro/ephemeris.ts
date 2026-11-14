/**
 * Built-in ephemeris for the Sun and Earth as seen from the lunar surface.
 *
 * - Geocentric Sun and Moon: low-precision series from the Astronomical Almanac
 *   (the Moon is accurate to ~0.3° in longitude), corrected for precession to J2000.
 * - Lunar orientation: IAU model (Archinal et al. 2011, "mean Earth" frame,
 *   the frame LOLA uses).
 *
 * Accuracy measured against JPL Horizons: see docs/membre3_application.md.
 * This is the project's official ephemeris source (docs/decision_ephemerides.md);
 * JPL Horizons is used only as a validation reference.
 */

export type Vec3 = [number, number, number];

export const R_MOON_KM = 1737.4;
const DEG = Math.PI / 180;
const AU_KM = 149_597_870.7;
const EARTH_RADIUS_KM = 6378.14;
const DELTA_T_S = 69.2; // TT - UTC (2020s)

const sind = (x: number) => Math.sin(x * DEG);
const cosd = (x: number) => Math.cos(x * DEG);

/** Days since J2000.0 (TT). */
export function daysJ2000(date: Date): number {
  return (date.getTime() + DELTA_T_S * 1000) / 86_400_000 + 2440587.5 - 2451545.0;
}

function eclipticToEquatorialJ2000(lonDeg: number, latDeg: number, r: number): Vec3 {
  const x = r * cosd(latDeg) * cosd(lonDeg);
  const y = r * cosd(latDeg) * sind(lonDeg);
  const z = r * sind(latDeg);
  const eps = 23.4392911;
  return [x, y * cosd(eps) - z * sind(eps), y * sind(eps) + z * cosd(eps)];
}

/** Geocentric Moon (km, J2000 equatorial). */
export function moonGeocentric(d: number): Vec3 {
  const T = d / 36525;
  const lon = 218.32 + 481267.881 * T
    + 6.29 * sind(135.0 + 477198.87 * T) - 1.27 * sind(259.3 - 413335.36 * T)
    + 0.66 * sind(235.7 + 890534.22 * T) + 0.21 * sind(269.9 + 954397.74 * T)
    - 0.19 * sind(357.5 + 35999.05 * T) - 0.11 * sind(186.5 + 966404.03 * T);
  const lat = 5.13 * sind(93.3 + 483202.02 * T) + 0.28 * sind(228.2 + 960400.89 * T)
    - 0.28 * sind(318.3 + 6003.15 * T) - 0.17 * sind(217.6 - 407332.21 * T);
  const par = 0.9508 + 0.0518 * cosd(135.0 + 477198.87 * T)
    + 0.0095 * cosd(259.3 - 413335.36 * T) + 0.0078 * cosd(235.7 + 890534.22 * T)
    + 0.0028 * cosd(269.9 + 954397.74 * T);
  const r = EARTH_RADIUS_KM / sind(par);
  return eclipticToEquatorialJ2000(lon - 1.396971 * T, lat, r);
}

/** Geocentric Sun (km, J2000 equatorial). */
export function sunGeocentric(d: number): Vec3 {
  const T = d / 36525;
  const L = 280.460 + 0.9856474 * d;
  const g = 357.528 + 0.9856003 * d;
  const lon = L + 1.915 * sind(g) + 0.020 * sind(2 * g);
  const r = (1.00014 - 0.01671 * cosd(g) - 0.00014 * cosd(2 * g)) * AU_KM;
  return eclipticToEquatorialJ2000(lon - 1.396971 * T, 0, r);
}

/** IAU orientation of the Moon: returns the J2000 → body-fixed rotation matrix. */
export function moonRotation(d: number): number[][] {
  const T = d / 36525;
  const E = [
    0,
    125.045 - 0.0529921 * d, 250.089 - 0.1059842 * d, 260.008 + 13.0120009 * d,
    176.625 + 13.3407154 * d, 357.529 + 0.9856003 * d, 311.589 + 26.4057084 * d,
    134.963 + 13.0649930 * d, 276.617 + 0.3287146 * d, 34.226 + 1.7484877 * d,
    15.134 - 0.1589763 * d, 119.743 + 0.0036096 * d, 239.961 + 0.1643573 * d,
    25.053 + 12.9590088 * d,
  ];
  const a0 = 269.9949 + 0.0031 * T - 3.8787 * sind(E[1]) - 0.1204 * sind(E[2])
    + 0.0700 * sind(E[3]) - 0.0172 * sind(E[4]) + 0.0072 * sind(E[6])
    - 0.0052 * sind(E[10]) + 0.0043 * sind(E[13]);
  const d0 = 66.5392 + 0.0130 * T + 1.5419 * cosd(E[1]) + 0.0239 * cosd(E[2])
    - 0.0278 * cosd(E[3]) + 0.0068 * cosd(E[4]) - 0.0029 * cosd(E[6])
    + 0.0009 * cosd(E[7]) + 0.0008 * cosd(E[10]) - 0.0009 * cosd(E[13]);
  const W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d
    + 3.5610 * sind(E[1]) + 0.1208 * sind(E[2]) - 0.0642 * sind(E[3])
    + 0.0158 * sind(E[4]) + 0.0252 * sind(E[5]) - 0.0066 * sind(E[6])
    - 0.0047 * sind(E[7]) - 0.0046 * sind(E[8]) + 0.0028 * sind(E[9])
    + 0.0052 * sind(E[10]) + 0.0040 * sind(E[11]) + 0.0019 * sind(E[12])
    - 0.0044 * sind(E[13]);
  // R = Rz(W) · Rx(90° - δ0) · Rz(90° + α0)
  const rz = (t: number) => [[cosd(t), sind(t), 0], [-sind(t), cosd(t), 0], [0, 0, 1]];
  const rx = (t: number) => [[1, 0, 0], [0, cosd(t), sind(t)], [0, -sind(t), cosd(t)]];
  return mul(rz(W), mul(rx(90 - d0), rz(90 + a0)));
}

function mul(a: number[][], b: number[][]): number[][] {
  return a.map((row) => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)));
}

const apply = (m: number[][], v: Vec3): Vec3 =>
  [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]) as Vec3;

/** Sun and Earth positions relative to the Moon's center, in the body-fixed frame (km). */
export function bodiesFixed(date: Date): { sun: Vec3; earth: Vec3 } {
  const d = daysJ2000(date);
  const moon = moonGeocentric(d);
  const sun = sunGeocentric(d);
  const R = moonRotation(d);
  return {
    sun: apply(R, [sun[0] - moon[0], sun[1] - moon[1], sun[2] - moon[2]]),
    earth: apply(R, [-moon[0], -moon[1], -moon[2]]),
  };
}

export interface Site { lat: number; lon: number; elevation_m?: number | null }

/** Topocentric elevation / azimuth (degrees, azimuth from north, clockwise). */
export function altAz(site: Site, target: Vec3): { alt: number; az: number } {
  const la = site.lat * DEG, lo = site.lon * DEG;
  const up: Vec3 = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const east: Vec3 = [-Math.sin(lo), Math.cos(lo), 0];
  const north: Vec3 = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const r = R_MOON_KM + (site.elevation_m ?? 0) / 1000;
  const v: Vec3 = [target[0] - r * up[0], target[1] - r * up[1], target[2] - r * up[2]];
  const n = Math.hypot(...v);
  const dot = (a: Vec3) => (a[0] * v[0] + a[1] * v[1] + a[2] * v[2]) / n;
  return {
    alt: Math.asin(dot(up)) / DEG,
    az: ((Math.atan2(dot(east), dot(north)) / DEG) + 360) % 360,
  };
}

/** Sub-solar / sub-Earth point (lat, lon in degrees). */
export function subPoint(v: Vec3): { lat: number; lon: number } {
  const n = Math.hypot(...v);
  return { lat: Math.asin(v[2] / n) / DEG, lon: Math.atan2(v[1], v[0]) / DEG };
}
