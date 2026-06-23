import React, { useEffect, useRef } from "react";
import { Box, Typography } from "@mui/material";
import { Flex } from "antd";
import Column from "antd/es/table/Column";

/**
 * 브이월드(VWorld) 인증키
 * - 운영 시에는 .env 의 VITE_VWORLD_KEY 로 옮기는 것을 권장합니다.
 *   (예: frontend/.env 에  VITE_VWORLD_KEY=60F47693-... 추가 후 재시작)
 * - 브이월드 인증키는 "발급 시 등록한 도메인"에서만 동작합니다.
 *   개발 환경이라면 http://localhost:5173 (Vite 기본 포트) 가 등록돼 있어야 합니다.
 */
const VWORLD_KEY =
  import.meta.env.VITE_VWORLD_KEY || "60F47693-5E7D-37C4-B609-0A71EEC0DF27";

// 브이월드는 요청 도메인을 검증하므로 현재 접속 origin 을 그대로 사용합니다.
const DOMAIN =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";

// 서울시청 좌표 (지도 초기 중심)
const SEOUL_CENTER = [37.5665, 126.978];

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

// Leaflet 을 CDN 에서 1회만 로드 (중복 로드 방지)
function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }

    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    let script = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (script) {
      script.addEventListener("load", () => resolve(window.L));
      script.addEventListener("error", reject);
      if (window.L) resolve(window.L);
      return;
    }

    script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

// 브이월드 WMTS 배경지도 타일 URL (표준 XYZ / Web Mercator)
const wmtsUrl = (layer, ext = "png") =>
  `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/${layer}/{z}/{y}/{x}.${ext}`;

const ATTR = "공간정보 오픈플랫폼(브이월드)";

const Place = () => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
          center: SEOUL_CENTER,
          zoom: 11,
          minZoom: 7,
          maxZoom: 19,
        });
        mapRef.current = map;

        // ----- 배경지도 (택1) -----
        const baseGeneral = L.tileLayer(wmtsUrl("Base"), {
          attribution: ATTR,
          maxZoom: 19,
        });
        const baseGray = L.tileLayer(wmtsUrl("gray"), {
          attribution: ATTR,
          maxZoom: 19,
        });
        const baseSatellite = L.tileLayer(wmtsUrl("Satellite", "jpeg"), {
          attribution: ATTR,
          maxZoom: 19,
        });

        baseGeneral.addTo(map); // 기본 배경: 일반지도(도로·건물·시설물·지명 포함)

        // ----- 오버레이 (다중 선택) -----
        // 위성영상 위 도로·지명·건물 라벨
        const hybrid = L.tileLayer(wmtsUrl("Hybrid"), {
          attribution: ATTR,
          maxZoom: 19,
          opacity: 1,
        });

        // 공통 WMS 옵션 생성기 (브이월드 WMS 데이터 레이어)
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
          });

        // 행정구역 경계 - 시군구(구 경계)
        const admSigg = wms("LT_C_ADSIGG_INFO");
        // 행정구역 경계 - 읍면동(동 경계)
        const admEmd = wms("LT_C_ADEMD_INFO");
        // 필지 / 연속지적도 (LX맵 편집지적도) - 가까이 확대해야 표출됩니다
        const parcel = wms("lt_c_landinfobasemap");

        // 시군구 경계는 기본으로 켜 둠
        admSigg.addTo(map);

        const baseMaps = {
          "일반지도": baseGeneral,
          "회색지도": baseGray,
          "위성영상": baseSatellite,
        };
        const overlayMaps = {
          "하이브리드(위성 위 도로·지명)": hybrid,
          "행정구역 경계 (시군구)": admSigg,
          "행정구역 경계 (읍면동)": admEmd,
          "필지 / 연속지적도 (확대 시)": parcel,
        };

        L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);
        L.control.scale({ imperial: false }).addTo(map);

        // 지도 컨테이너 크기 보정
        setTimeout(() => map.invalidateSize(), 200);
      })
      .catch(() => {
        if (containerRef.current) {
          containerRef.current.innerHTML =
            '<div style="padding:16px;color:#b00">지도를 불러오지 못했습니다. 네트워크 또는 브이월드 인증키/도메인 등록을 확인해 주세요.</div>';
        }
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <Box sx={{ p: 1 }}>
      <div style={{ display: "flex" }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        서울시 지도  
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        브이월드(VWorld) 배경지도 위에 행정구역·필지 등 정보를 켜고 끌 수 있습니다.
        우측 상단 레이어 메뉴에서 선택하세요. (필지·지적은 충분히 확대해야 표시됩니다.)
      </Typography>
      </div>
      <Box
        ref={containerRef}
        sx={{
          width: "100%",
          height: { xs: 420, md: 620 },
          borderRadius: 1,
          overflow: "hidden",
          border: "1px solid #ddd",
        }}
      />
    </Box>
  );
};

export default Place;
