// 필지 기반 성과물 지도 공용 유틸 (Leaflet + Leaflet.draw + VWorld)
// - Place.jsx / PlaceUpload.jsx / PlaceSiteDetail.jsx 가 공유합니다.

export const VWORLD_KEY =
  import.meta.env.VITE_VWORLD_KEY || "60F47693-5E7D-37C4-B609-0A71EEC0DF27";

export const DOMAIN =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";

// 서울시청 좌표 (지도 초기 중심)
export const SEOUL_CENTER = [37.5665, 126.978];

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const DRAW_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css";
const DRAW_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js";

function injectCss(href) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

function injectScript(src) {
  return new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${src}"]`);
    if (script) {
      if (script.dataset.loaded === "true") return resolve();
      script.addEventListener("load", () => resolve());
      script.addEventListener("error", reject);
      return;
    }
    script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

// Leaflet (+ 선택적으로 Leaflet.draw) 을 CDN 에서 1회만 로드
export async function loadLeaflet({ withDraw = false } = {}) {
  injectCss(LEAFLET_CSS);
  if (!window.L) {
    await injectScript(LEAFLET_JS);
  }
  if (withDraw) {
    injectCss(DRAW_CSS);
    if (!(window.L && window.L.Draw)) {
      await injectScript(DRAW_JS);
    }
  }
  return window.L;
}

// 브이월드 WMTS 배경지도 타일 URL (표준 XYZ / Web Mercator)
export const wmtsUrl = (layer, ext = "png") =>
  `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/${layer}/{z}/{y}/{x}.${ext}`;

export const ATTR = "공간정보 오픈플랫폼(브이월드)";

// 전공(category)별 색상
export const CATEGORY_COLORS = {
  landscape: "#2e7d32", // 조경 - 녹색
  urban: "#1565c0", // 도시계획 - 파랑
  architecture: "#c62828", // 건축 - 빨강
  etc: "#6d4c41", // 기타 - 갈색
};

export const CATEGORY_LABELS = {
  landscape: "조경",
  urban: "도시계획·설계",
  architecture: "건축",
  etc: "기타",
};

export const SITE_TYPE_LABELS = {
  park: "공원부지",
  idle: "유휴부지",
  green: "녹지",
  etc: "기타",
};

// VWorld 배경지도(WMTS)가 실제 타일을 제공하는 최대 줌. 그 이상은 마지막 타일을 확대해 표시.
export const VWORLD_NATIVE_MAX_ZOOM = 19;
// VWorld WMS(지적도/행정경계)가 타일을 제공하는 최대 줌. 그 이상으로 확대하면
// 이 줌의 타일을 업스케일해 필지선이 계속 보이게 한다.
export const VWORLD_WMS_NATIVE_MAX_ZOOM = 18;
// 지도에서 허용하는 최대 줌(네이티브보다 더 확대 가능 — 필지선이 업스케일되어 계속 보임).
export const MAP_MAX_ZOOM = 21;

// 배경지도/오버레이 레이어 구성 (Place / Detail 공용)
export function buildVworldLayers(L) {
  const baseOpts = { attribution: ATTR, maxNativeZoom: VWORLD_NATIVE_MAX_ZOOM, maxZoom: MAP_MAX_ZOOM };
  const baseGeneral = L.tileLayer(wmtsUrl("Base"), { ...baseOpts });
  const baseGray = L.tileLayer(wmtsUrl("gray"), { ...baseOpts });
  const baseSatellite = L.tileLayer(wmtsUrl("Satellite", "jpeg"), { ...baseOpts });
  const hybrid = L.tileLayer(wmtsUrl("Hybrid"), { ...baseOpts, opacity: 1 });

  const wms = (layers) =>
    L.tileLayer.wms("https://api.vworld.kr/req/wms", {
      layers,
      styles: layers,
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      key: VWORLD_KEY,
      domain: DOMAIN,
      attribution: ATTR,
      // VWorld WMS 는 줌 18 까지만 타일을 제공하므로, 그 이상은 줌 18 타일을
      // 업스케일해 필지선이 계속 보이도록 한다.
      maxNativeZoom: VWORLD_WMS_NATIVE_MAX_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
    });

  const admSigg = wms("LT_C_ADSIGG_INFO");
  const admEmd = wms("LT_C_ADEMD_INFO");
  const parcel = wms("lt_c_landinfobasemap");

  return { baseGeneral, baseGray, baseSatellite, hybrid, admSigg, admEmd, parcel };
}

// GeoJSON geometry 의 대략적 중심 [lat, lng]
export function geometryCenter(geometry) {
  if (!geometry || !geometry.coordinates) return null;
  let polys = [];
  if (geometry.type === "Polygon") polys = [geometry.coordinates];
  else if (geometry.type === "MultiPolygon") polys = geometry.coordinates;
  else return null;
  let sx = 0, sy = 0, n = 0;
  polys.forEach((poly) => {
    (poly[0] || []).forEach(([lng, lat]) => {
      sx += lng; sy += lat; n += 1;
    });
  });
  if (!n) return null;
  return [sy / n, sx / n];
}

export function formatArea(area) {
  if (!area && area !== 0) return "—";
  if (area >= 10000) return `${(area / 10000).toFixed(2)} ha (${Math.round(area).toLocaleString()} ㎡)`;
  return `${Math.round(area).toLocaleString()} ㎡`;
}

// ---------------------------------------------------------------------------
// 성과물 위치 마커 (CSS 전용 · 줌과 무관하게 크기 고정 · 항상 표시)
// 동그라미 안에 보석·광택·회전 링·맥동 글로우 장식이 들어간 화려한 아이콘.
// ---------------------------------------------------------------------------
let _siteMarkerCssInjected = false;
export function ensureSiteMarkerCss() {
  if (_siteMarkerCssInjected || typeof document === "undefined") return;
  _siteMarkerCssInjected = true;
  const css = `
.pmk-wrap{background:none!important;border:none!important;}
.pmk{position:relative;width:34px;height:34px;pointer-events:auto;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));transform:scale(.5);transform-origin:top left;}
.pmk span{position:absolute;display:block;}
.pmk__glow{inset:-6px;border-radius:50%;background:radial-gradient(circle,var(--pmk) 0%,transparent 70%);opacity:.45;animation:pmk-pulse 1.8s ease-in-out infinite;}
.pmk__ring{inset:-2px;border-radius:50%;background:conic-gradient(from 0deg,var(--pmk),#fff,var(--pmk),#fff,var(--pmk));animation:pmk-spin 4s linear infinite;}
.pmk__core{inset:3px;border-radius:50%;border:2px solid #fff;background:radial-gradient(circle at 32% 28%,#fff 0%,var(--pmk) 45%,rgba(0,0,0,.45) 135%);box-shadow:inset 0 -2px 4px rgba(0,0,0,.35);}
.pmk__shine{top:5px;left:6px;width:9px;height:6px;border-radius:50%;background:rgba(255,255,255,.85);filter:blur(1px);}
.pmk__gem{top:50%;left:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:1px;background:linear-gradient(135deg,#fff,var(--pmk));transform:rotate(45deg);box-shadow:0 0 5px #fff,0 0 2px var(--pmk);}
.pmk:hover .pmk__ring{animation-duration:1.1s;}
.pmk:hover{filter:drop-shadow(0 3px 5px rgba(0,0,0,.5));}
@keyframes pmk-spin{to{transform:rotate(360deg);}}
@keyframes pmk-pulse{0%,100%{opacity:.25;transform:scale(.9);}50%{opacity:.55;transform:scale(1.15);}}
`;
  const el = document.createElement("style");
  el.setAttribute("data-pmk", "1");
  el.textContent = css;
  document.head.appendChild(el);
}

// 고정 크기 divIcon 생성 (지도 줌과 무관하게 34px 유지)
export function makeSiteDivIcon(L, color) {
  ensureSiteMarkerCss();
  const c = color || CATEGORY_COLORS.etc;
  return L.divIcon({
    className: "pmk-wrap",
    iconSize: [17, 17],
    iconAnchor: [9, 9],
    tooltipAnchor: [0, -9],
    html:
      `<div class="pmk" style="--pmk:${c}">` +
      `<span class="pmk__glow"></span>` +
      `<span class="pmk__ring"></span>` +
      `<span class="pmk__core"><span class="pmk__shine"></span><span class="pmk__gem"></span></span>` +
      `</div>`,
  });
}
