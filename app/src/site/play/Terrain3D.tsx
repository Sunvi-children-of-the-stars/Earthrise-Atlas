/**
 * 3D view of the terrain around a site (Three.js, loaded on demand): the real relief from the 200 m
 * regional map, the Sun as the only light (real direction at the cursor time, with cast shadows),
 * and the Earth in the sky. Drag to orbit, scroll or pinch to zoom.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Sample } from "../../astro/analysis";
import { mapsBaseUrl } from "../../optim/client";
import { loadRegion } from "../../optim/region";
import type { SiteRecord } from "../../data";
import { useI18n } from "../i18n";
import { findRegionFor, loadRegionMetas } from "./nearby";
import { azToGrid, terrainPatch, type TerrainPatch } from "./terrain";

const HALF_KM = 10;
const SKY_DIST = 40_000;
const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/** Scene direction (x east-ish, y up, z = minus stereographic y) of a body seen from the site. */
function dirOf(az: number, alt: number, siteXY: [number, number]): THREE.Vector3 {
  const [gx, gy] = azToGrid(az, siteXY[0], siteXY[1]);
  const c = Math.cos((alt * Math.PI) / 180);
  return new THREE.Vector3(gx * c, Math.sin((alt * Math.PI) / 180), -gy * c).normalize();
}

interface Props { site: SiteRecord; samples: Sample[]; cursor: number; onCursor: (i: number) => void }

export default function Terrain3D({ site, samples, cursor, onCursor }: Props) {
  const { t, fmt } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const [patch, setPatch] = useState<TerrainPatch | null | "none" | "loading">("loading");
  const [photo, setPhoto] = useState(false);
  const [exag, setExag] = useState(1);
  const scene = useRef<{ sun: THREE.DirectionalLight; sunBall: THREE.Mesh; earth: THREE.Mesh; render: () => void } | null>(null);

  // Terrain around the site
  useEffect(() => {
    let alive = true;
    setPatch("loading");
    loadRegionMetas().then(async (metas) => {
      const hit = findRegionFor(site.lat, site.lon, metas.map((m) => m.meta), HALF_KM);
      if (!hit) { if (alive) setPatch("none"); return; }
      const file = metas.find((m) => m.meta.id === hit.id)!.file;
      const region = await loadRegion(mapsBaseUrl(), file, false);
      const wf = (region.meta.files as { wac?: string }).wac;
      const wac = wf ? new Uint8Array(await (await fetch(`${mapsBaseUrl()}${wf}`)).arrayBuffer()) : null;
      if (alive) setPatch(terrainPatch({ meta: region.meta, elev: region.elev, wac }, site.lat, site.lon, HALF_KM) ?? "none");
    }).catch(() => alive && setPatch("none"));
    return () => { alive = false; };
  }, [site.lat, site.lon]);

  // Scene
  useEffect(() => {
    const el = host.current;
    if (!el || !patch || typeof patch === "string") return;
    const w = el.clientWidth, h = Math.min(560, Math.max(320, w * 0.56));
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const sc = new THREE.Scene();
    sc.background = new THREE.Color(css("--bg") || "black");

    const { n, stepM, heights, shade } = patch;
    const size = (n - 1) * stepM;
    const geo = new THREE.PlaneGeometry(size, size, n - 1, n - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < n * n; i++) pos.setY(i, heights[i] * exag);
    geo.computeVertexNormals();
    let map: THREE.DataTexture | null = null;
    if (photo && shade) {
      const rgba = new Uint8Array(n * n * 4);
      for (let i = 0; i < n * n; i++) { const g = shade[i]; rgba.set([g, g, g, 255], i * 4); }
      map = new THREE.DataTexture(rgba, n, n);
      map.flipY = false;
      map.needsUpdate = true;
    }
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: map ? 0xffffff : 0x9a9a9a, map, roughness: 1, metalness: 0 }));
    ground.receiveShadow = true;
    ground.castShadow = true;
    sc.add(ground);

    const ice = new THREE.Color(css("--ice") || "white"), gold = new THREE.Color(css("--sun") || "white");
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 260, 24), new THREE.MeshBasicMaterial({ color: ice }));
    marker.position.y = 130;
    sc.add(marker);

    sc.add(new THREE.AmbientLight(0xffffff, 0.04)); // earthshine
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -size / 1.5, right: size / 1.5, top: size / 1.5, bottom: -size / 1.5, near: 10, far: SKY_DIST * 2 });
    sun.shadow.bias = -0.0005;
    sc.add(sun, sun.target);
    const sunBall = new THREE.Mesh(new THREE.SphereGeometry(SKY_DIST * Math.tan((0.6 * Math.PI) / 180), 24, 16), new THREE.MeshBasicMaterial({ color: gold }));
    const earth = new THREE.Mesh(new THREE.SphereGeometry(SKY_DIST * Math.tan((1.4 * Math.PI) / 180), 32, 16), new THREE.MeshBasicMaterial({ color: ice }));
    sc.add(sunBall, earth);

    const camera = new THREE.PerspectiveCamera(50, w / h, 10, SKY_DIST * 3);
    camera.position.set(-size * 0.35, size * 0.22, size * 0.45);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 500;
    controls.maxDistance = size * 1.5;
    const render = () => renderer.render(sc, camera);
    controls.addEventListener("change", render);
    scene.current = { sun, sunBall, earth, render };
    const onResize = () => { const W = el.clientWidth, H = Math.min(560, Math.max(320, W * 0.56)); renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); render(); };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      controls.dispose(); renderer.dispose(); geo.dispose(); map?.dispose();
      el.removeChild(renderer.domElement);
      scene.current = null;
    };
  }, [patch, photo, exag]);

  // Sun and Earth at the cursor time
  useEffect(() => {
    const s = scene.current, smp = samples[Math.min(cursor, samples.length - 1)];
    if (!s || !smp || !patch || typeof patch === "string") return;
    const sd = dirOf(smp.sAz, smp.sAlt, patch.siteXY), ed = dirOf(smp.eAz, smp.eAlt, patch.siteXY);
    s.sun.position.copy(sd.clone().multiplyScalar(SKY_DIST));
    s.sun.intensity = smp.sunFrac > 0 ? 3 * smp.sunFrac : 0;
    s.sunBall.position.copy(sd.clone().multiplyScalar(SKY_DIST));
    s.earth.position.copy(ed.clone().multiplyScalar(SKY_DIST));
    // The patch stops at 10 km: a body below the site's real horizon would otherwise show above the cut edge
    s.earth.visible = smp.earthFrac >= 0.5;
    s.sunBall.visible = smp.sunFrac > 0;
    s.render();
  }, [cursor, samples, patch, photo, exag]);

  if (patch === "loading") return <p className="muted">{t("common.loading")}</p>;
  if (patch === "none" || !patch) return <p className="muted">{t("td.none")}</p>;
  const now = samples[Math.min(cursor, samples.length - 1)];
  return (
    <div className="stack">
      <div ref={host} className="terrain3d" role="img" aria-label={t("td.aria")} />
      <div className="row player">
        <input type="range" min={0} max={samples.length - 1} value={cursor} aria-label={t("tl.cursor")} onChange={(e) => onCursor(Number(e.target.value))} />
        <span className="small muted">{now && fmt.dateTime(now.t)}</span>
      </div>
      <div className="row">
        <label className="row-check small"><input type="checkbox" checked={photo} onChange={(e) => setPhoto(e.target.checked)} disabled={!patch.shade} /> {t("td.photo")}</label>
        <label className="row-check small"><input type="checkbox" checked={exag > 1} onChange={(e) => setExag(e.target.checked ? 2 : 1)} /> {t("td.exag")}</label>
      </div>
      <p className="small faint">{t("td.legend", { km: HALF_KM * 2 })}</p>
    </div>
  );
}
