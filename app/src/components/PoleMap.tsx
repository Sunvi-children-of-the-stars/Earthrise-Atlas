import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { latLonToXY, xyToLatLon, xyToPx, type Dem } from "../astro/horizon";
import type { ArtemisRegionSet } from "../astro/regions";
import type { SiteRecord } from "../data";

const SIZE = 600;
const ZOOMS = [
  { label: "75°S", half: 457_000 },
  { label: "±200 km", half: 200_000 },
  { label: "±40 km", half: 40_000 },
];

interface Props {
  dem: Dem;
  sites: SiteRecord[];
  selected: SiteRecord;
  onPick: (lat: number, lon: number) => void;
  onSelect: (id: string) => void;
  regions?: ArtemisRegionSet | null;
}

/** Shaded-relief map of the south pole (reduced LOLA DEM) with the sites. */
export function PoleMap({ dem, sites, selected, onPick, onSelect, regions }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [showRegions, setShowRegions] = useState(true);

  // Shaded relief computed once
  const relief = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = dem.cols;
    c.height = dem.rows;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(dem.cols, dem.rows);
    const px = (dem.factor * 120);
    const L = [-0.5, 0.5, 0.7]; // light from the north-west
    const nL = Math.hypot(...L);
    for (let r = 1; r < dem.rows - 1; r++) {
      for (let col = 1; col < dem.cols - 1; col++) {
        const i = r * dem.cols + col;
        const dzdx = (dem.data[i + 1] - dem.data[i - 1]) / (2 * px);
        const dzdy = (dem.data[i - dem.cols] - dem.data[i + dem.cols]) / (2 * px);
        const shade = Math.max(0, (-dzdx * L[0] - dzdy * L[1] + L[2]) / (Math.hypot(dzdx, dzdy, 1) * nL));
        const h = (dem.data[i] - dem.min) / (dem.max - dem.min);
        const g = 30 + 200 * shade * (0.55 + 0.45 * h);
        img.data[i * 4] = g * 0.96;
        img.data[i * 4 + 1] = g * 0.97;
        img.data[i * 4 + 2] = g * 1.02;
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }, [dem]);

  const view = useMemo(() => {
    const half = ZOOMS[zoom].half;
    const [cx, cy] = zoom === 2 && selected.in_dem ? latLonToXY(selected.lat, selected.lon) : [0, 0];
    return { half, cx, cy };
  }, [zoom, selected]);

  const toCanvas = (x: number, y: number): [number, number] => [
    ((x - view.cx + view.half) / (2 * view.half)) * SIZE,
    ((view.cy + view.half - y) / (2 * view.half)) * SIZE,
  ];

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#05070d";
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Source window in reduced-DEM pixels
    const [c0, r0] = xyToPx(dem, view.cx - view.half, view.cy + view.half);
    const [c1, r1] = xyToPx(dem, view.cx + view.half, view.cy - view.half);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(relief, c0, r0, c1 - c0, r1 - r0, 0, 0, SIZE, SIZE);

    // Latitude circles
    ctx.strokeStyle = "rgba(140,170,220,0.35)";
    ctx.lineWidth = 1;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(170,190,230,0.8)";
    for (const lat of [-89, -88, -86, -84, -82, -80, -78, -76]) {
      const [x, y] = toCanvas(...latLonToXY(lat, 0));
      const [cx, cy] = toCanvas(0, 0);
      const rr = Math.hypot(x - cx, y - cy);
      if (rr < 8 || rr > SIZE * 2) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.fillText(`${-lat}°S`, cx + 3, cy - rr - 3);
    }
    // Earth-facing meridian (0°)
    const [px0, py0] = toCanvas(0, 0);
    ctx.strokeStyle = "rgba(78,163,255,0.6)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(px0, py0);
    ctx.lineTo(px0, -10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#4ea3ff";
    ctx.fillText("0° → vers la Terre", px0 + 6, 14);

    // Official Artemis III candidate regions (NASA 2022 list)
    if (showRegions && regions) {
      ctx.save();
      ctx.strokeStyle = "#5ad1e6";
      ctx.fillStyle = "rgba(90,209,230,0.10)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.font = "10px system-ui, sans-serif";
      for (const r of regions.regions) {
        ctx.beginPath();
        r.xy.forEach(([x, y], i) => { const [px, py] = toCanvas(x, y); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        const [lx, ly] = toCanvas(...r.center);
        if (lx > 0 && ly > 0 && lx < SIZE && ly < SIZE && zoom > 0) {
          ctx.fillStyle = "#a6ecf7";
          ctx.textAlign = "center";
          ctx.fillText(r.name, lx, ly);
          ctx.fillStyle = "rgba(90,209,230,0.10)";
        }
      }
      ctx.restore();
    }

    for (const s of sites) {
      if (!s.in_dem) continue;
      const [x, y] = toCanvas(...latLonToXY(s.lat, s.lon));
      const sel = s.id === selected.id;
      ctx.beginPath();
      ctx.arc(x, y, sel ? 7 : 5, 0, 2 * Math.PI);
      ctx.fillStyle = s.category === "candidat" ? "#f5b942" : s.category === "custom" ? "#e06cf0" : "#c9ccd4";
      ctx.fill();
      ctx.lineWidth = sel ? 3 : 1.5;
      ctx.strokeStyle = sel ? "#fff" : "#05070d";
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = sel ? "bold 12px system-ui, sans-serif" : "11px system-ui, sans-serif";
      ctx.fillText(s.short, x + 9, y + 4);
    }
  }, [relief, view, sites, selected, regions, showRegions, zoom]); // toCanvas depends only on view

  const click = (e: MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = ((e.clientX - r.left) / r.width) * SIZE;
    const cy = ((e.clientY - r.top) / r.height) * SIZE;
    // Click on an existing marker?
    for (const s of sites) {
      if (!s.in_dem || s.category === "custom") continue;
      const [x, y] = toCanvas(...latLonToXY(s.lat, s.lon));
      if (Math.hypot(x - cx, y - cy) < 9) return onSelect(s.id);
    }
    const x = view.cx - view.half + (cx / SIZE) * 2 * view.half;
    const y = view.cy + view.half - (cy / SIZE) * 2 * view.half;
    const [lat, lon] = xyToLatLon(x, y);
    const [c, rr] = xyToPx(dem, x, y);
    if (c < 1 || rr < 1 || c > dem.cols - 2 || rr > dem.rows - 2) return;
    onPick(lat, lon);
  };

  return (
    <div className="map">
      <canvas ref={ref} width={SIZE} height={SIZE} onClick={click}
        title="Cliquer sur un site, ou n'importe où pour créer un site personnalisé" />
      <div className="seg">
        {ZOOMS.map((z, i) => (
          <button key={z.label} className={i === zoom ? "on" : ""} onClick={() => setZoom(i)}>
            {z.label}
          </button>
        ))}
      </div>
      {regions && (
        <label className="check">
          <input type="checkbox" checked={showRegions} onChange={(e) => setShowRegions(e.target.checked)} />
          Régions candidates Artemis III <span className="muted">(NASA, liste {regions.listYear})</span>
        </label>
      )}
    </div>
  );
}
