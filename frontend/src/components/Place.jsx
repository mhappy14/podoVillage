import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Button, Chip, Stack, Paper, IconButton, Divider, Tooltip,
} from "@mui/material";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import CloseIcon from "@mui/icons-material/Close";
import FolderSharedIcon from "@mui/icons-material/FolderShared";
import {
  loadLeaflet, SEOUL_CENTER, buildVworldLayers,
  CATEGORY_COLORS, CATEGORY_LABELS, SITE_TYPE_LABELS, MAP_MAX_ZOOM,
  geometryCenter, makeSiteDivIcon,
} from "./place/placeMap";
import { fetchSitesGeojson, isLoggedIn } from "./place/placeApi";

const CATEGORY_FILTERS = [
  { key: "all", label: "전체" },
  { key: "landscape", label: "조경" },
  { key: "urban", label: "도시계획·설계" },
  { key: "architecture", label: "건축" },
  { key: "etc", label: "기타" },
];

const Place = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const sitesLayerRef = useRef(null);
  const LRef = useRef(null);

  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState(null); // 클릭된 대상지 properties
  const [count, setCount] = useState(0);

  // 오버레이(성과물) 로드 & 렌더
  const renderSites = useCallback(async (cat) => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const params = cat && cat !== "all" ? { category: cat } : {};
    let fc;
    try {
      fc = await fetchSitesGeojson(params);
    } catch (e) {
      return;
    }

    if (sitesLayerRef.current) {
      map.removeLayer(sitesLayerRef.current);
      sitesLayerRef.current = null;
    }

    const group = L.layerGroup();

    // 필지 경계 폴리곤 (확대 시 상세 표시)
    L.geoJSON(fc, {
      style: (feature) => {
        const c = CATEGORY_COLORS[feature.properties.category] || CATEGORY_COLORS.etc;
        return { color: c, weight: 2, fillColor: c, fillOpacity: 0.25 };
      },
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, { radius: 0, opacity: 0, fillOpacity: 0 }),
      onEachFeature: (feature, lyr) => {
        const p = feature.properties;
        lyr.on("click", () => setSelected(p));
        lyr.on("mouseover", () => lyr.setStyle && lyr.setStyle({ fillOpacity: 0.45 }));
        lyr.on("mouseout", () => lyr.setStyle && lyr.setStyle({ fillOpacity: 0.25 }));
      },
    }).addTo(group);

    // 성과물 위치 아이콘 — 줌과 무관하게 고정 크기, 아주 축소해도 항상 표시
    (fc.features || []).forEach((feature) => {
      const p = feature.properties || {};
      const center =
        p.center_lat != null && p.center_lng != null
          ? [p.center_lat, p.center_lng]
          : geometryCenter(feature.geometry);
      if (!center) return;
      const color = CATEGORY_COLORS[p.category] || CATEGORY_COLORS.etc;
      const marker = L.marker(center, {
        icon: makeSiteDivIcon(L, color),
        riseOnHover: true,
        title: p.title || "",
      });
      marker.on("click", () => setSelected(p));
      marker.bindTooltip(
        `<b>${p.title}</b><br/>${p.category_label} · ${p.site_type_label}`,
        { direction: "top", offset: [0, -16] }
      );
      marker.addTo(group);
    });

    group.addTo(map);
    sitesLayerRef.current = group;
    setCount((fc.features || []).length);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        LRef.current = L;

        const map = L.map(containerRef.current, {
          center: SEOUL_CENTER, zoom: 11, minZoom: 7, maxZoom: MAP_MAX_ZOOM,
        });
        mapRef.current = map;

        const { baseGeneral, baseGray, baseSatellite, hybrid, admSigg, admEmd, parcel } =
          buildVworldLayers(L);
        baseGeneral.addTo(map);
        admSigg.addTo(map);

        L.control.layers(
          { "일반지도": baseGeneral, "회색지도": baseGray, "위성영상": baseSatellite },
          {
            "하이브리드(위성 위 도로·지명)": hybrid,
            "행정구역 경계 (시군구)": admSigg,
            "행정구역 경계 (읍면동)": admEmd,
            "필지 / 연속지적도 (확대 시)": parcel,
          },
          { collapsed: true }
        ).addTo(map);
        L.control.scale({ imperial: false }).addTo(map);

        setTimeout(() => map.invalidateSize(), 200);
        renderSites("all");
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
  }, [renderSites]);

  // 카테고리 필터 변경 시 재렌더
  useEffect(() => {
    if (mapRef.current) renderSites(category);
    setSelected(null);
  }, [category, renderSites]);

  const handleNew = () => {
    if (!isLoggedIn()) {
      alert("성과물 등록은 로그인 후 이용할 수 있습니다.");
      navigate("/login");
      return;
    }
    navigate("/place/new");
  };

  const focusSelected = () => {
    const map = mapRef.current;
    if (!map || !selected) return;
    if (selected.center_lat && selected.center_lng) {
      map.setView([selected.center_lat, selected.center_lng], 17);
    }
  };

  return (
    <Box sx={{ p: 1 }}>
      {/* 상단 설명 + 액션 */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
        sx={{ mb: 1 }}
      >
        <Box>
          <Stack direction="row" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            필지 기반 설계·계획 성과물 지도
          </Typography>
          <b>{` 현재 ${count}건`}</b>
          </Stack>
        </Box>
        {/* 카테고리 필터 + 범례 */}
        <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap", gap: 0.5 }}>
          {CATEGORY_FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              size="small"
              color={category === f.key ? "primary" : "default"}
              variant={category === f.key ? "filled" : "outlined"}
              onClick={() => setCategory(f.key)}
              sx={
                f.key !== "all"
                  ? { borderColor: CATEGORY_COLORS[f.key], "& .MuiChip-label": { color: category === f.key ? "#fff" : CATEGORY_COLORS[f.key] } }
                  : {}
              }
            />
          ))}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined" size="small" startIcon={<FolderSharedIcon />}
            onClick={() => (isLoggedIn() ? navigate("/place/mine") : navigate("/login"))}
          >
            내 성과물
          </Button>
          <Button
            variant="contained" size="small" startIcon={<AddLocationAltIcon />}
            onClick={handleNew}
          >
            새 성과물 등록
          </Button>
        </Stack>
      </Stack>


      {/* 지도 + 선택 패널 */}
      <Box sx={{ position: "relative" }}>
        <Box
          ref={containerRef}
          sx={{
            width: "100%",
            height: { xs: 460, md: 600 },
            borderRadius: 1,
            overflow: "hidden",
            border: "1px solid #ddd",
          }}
        />

        {selected && (
          <Paper
            elevation={4}
            sx={{
              position: "absolute", top: 12, right: 12, width: 300, maxWidth: "85%",
              p: 1.5, zIndex: 500, borderTop: `4px solid ${CATEGORY_COLORS[selected.category] || "#888"}`,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Typography variant="subtitle1" sx={{ fontWeight: 700, pr: 1 }}>
                {selected.title}
              </Typography>
              <IconButton size="small" onClick={() => setSelected(null)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ my: 0.5 }}>
              <Chip size="small" label={selected.category_label || CATEGORY_LABELS[selected.category]} />
              <Chip size="small" variant="outlined" label={selected.site_type_label || SITE_TYPE_LABELS[selected.site_type]} />
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="contained" onClick={() => navigate(`/place/site/${selected.id}`)}>
                상세 열람
              </Button>
              <Tooltip title="지도에서 위치로 이동">
                <Button size="small" variant="text" onClick={focusSelected}>위치 보기</Button>
              </Tooltip>
            </Stack>
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default Place;
