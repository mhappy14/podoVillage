import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box, Typography, Button, TextField, MenuItem, Stack, Paper, Chip,
  ToggleButton, ToggleButtonGroup, IconButton, Divider, CircularProgress, Alert,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import GestureIcon from "@mui/icons-material/Gesture";
import {
  loadLeaflet, SEOUL_CENTER, buildVworldLayers, CATEGORY_COLORS, formatArea, geometryCenter, MAP_MAX_ZOOM,
} from "./place/placeMap";
import {
  fetchParcel, createSite, updateSite, fetchSite, deleteSiteFile, isLoggedIn,
} from "./place/placeApi";

const CATEGORIES = [
  { value: "landscape", label: "조경" },
  { value: "urban", label: "도시계획·설계" },
  { value: "architecture", label: "건축" },
  { value: "etc", label: "기타" },
];
const SITE_TYPES = [
  { value: "park", label: "공원부지" },
  { value: "idle", label: "유휴부지" },
  { value: "green", label: "녹지" },
  { value: "etc", label: "기타" },
];

const PlaceUpload = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // 있으면 수정 모드
  const isEdit = !!id;

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const LRef = useRef(null);
  const selectionLayerRef = useRef(null); // 선택된 필지/그린 폴리곤 표시
  const drawnItemsRef = useRef(null);
  const drawControlRef = useRef(null);

  const [mode, setMode] = useState("parcel"); // parcel | draw
  const [parcels, setParcels] = useState([]); // {pnu, jibun, addr, geometry}
  const [drawnGeometry, setDrawnGeometry] = useState(null);
  const [loadingParcel, setLoadingParcel] = useState(false);

  const [form, setForm] = useState({
    title: "", category: "landscape", site_type: "park",
    summary: "", description: "", external_link: "", status: "published",
  });
  const [files, setFiles] = useState([]); // 새로 추가할 File[]
  const [existingFiles, setExistingFiles] = useState([]); // 수정 모드: 기존 파일
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // ---- 선택 영역을 지도에 다시 그림 ----
  const redrawSelection = useCallback(() => {
    const L = LRef.current, map = mapRef.current;
    if (!L || !map) return;
    if (selectionLayerRef.current) {
      map.removeLayer(selectionLayerRef.current);
      selectionLayerRef.current = null;
    }
    const color = CATEGORY_COLORS[form.category] || "#1565c0";
    const group = L.featureGroup();
    if (mode === "parcel") {
      parcels.forEach((p) => {
        if (p.geometry) {
          L.geoJSON(p.geometry, { style: { color, weight: 2, fillColor: color, fillOpacity: 0.3 } }).addTo(group);
        }
      });
    } else if (drawnGeometry) {
      L.geoJSON(drawnGeometry, { style: { color, weight: 2, fillColor: color, fillOpacity: 0.3 } }).addTo(group);
    }
    if (group.getLayers().length) {
      group.addTo(map);
      selectionLayerRef.current = group;
    }
  }, [mode, parcels, drawnGeometry, form.category]);

  useEffect(() => { redrawSelection(); }, [redrawSelection]);

  // ---- 지도 초기화 ----
  useEffect(() => {
    if (!isLoggedIn()) {
      alert("성과물 등록은 로그인 후 이용할 수 있습니다.");
      navigate("/login");
      return;
    }
    let cancelled = false;
    loadLeaflet({ withDraw: true }).then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(containerRef.current, { center: SEOUL_CENTER, zoom: 12, minZoom: 7, maxZoom: MAP_MAX_ZOOM });
      mapRef.current = map;

      const { baseGeneral, baseSatellite, hybrid, parcel } = buildVworldLayers(L);
      baseGeneral.addTo(map);
      parcel.addTo(map); // 필지 선택을 돕기 위해 지적도 기본 ON
      L.control.layers(
        { "일반지도": baseGeneral, "위성영상": baseSatellite },
        { "하이브리드": hybrid, "연속지적도(확대 시)": parcel },
        { collapsed: true }
      ).addTo(map);
      L.control.scale({ imperial: false }).addTo(map);

      // Leaflet.draw 준비
      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);
      drawnItemsRef.current = drawnItems;

      // 필지 클릭 핸들러
      map.on("click", onMapClick);

      setTimeout(() => map.invalidateSize(), 200);

      if (isEdit) loadExisting(L, map);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.off("click", onMapClick);
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 수정 모드: 기존 데이터 로드
  const loadExisting = async (L, map) => {
    try {
      const s = await fetchSite(id);
      setForm({
        title: s.title || "", category: s.category || "landscape",
        site_type: s.site_type || "park", summary: s.summary || "",
        description: s.description || "", external_link: s.external_link || "",
        status: s.status || "published",
      });
      setExistingFiles(s.files || []);
      if (s.geometry) {
        if (s.geometry_source === "draw") {
          setMode("draw");
          setDrawnGeometry(s.geometry);
        } else {
          setMode("parcel");
          setParcels([{ pnu: s.pnu, jibun: s.jibun, addr: s.address, geometry: s.geometry }]);
        }
        const c = geometryCenter(s.geometry);
        if (c) map.setView(c, 17);
      }
    } catch (e) {
      setError("기존 성과물을 불러오지 못했습니다.");
    }
  };

  // 지도 클릭 → 필지 조회 (parcel 모드일 때만)
  const onMapClick = async (e) => {
    if (modeRef.current !== "parcel") return;
    const { lat, lng } = e.latlng;
    setLoadingParcel(true);
    setError("");
    try {
      const data = await fetchParcel(lat, lng);
      if (data.error) {
        // 인증/도메인/권한 등 실제 VWorld 오류는 그대로 노출 (원인 진단용)
        setError(data.error);
        return;
      }
      if (!data.found || !data.geometry) {
        setError("해당 위치에서 필지를 찾지 못했습니다. 클릭 지점을 필지 경계 안쪽으로 다시 찍어 보세요.");
        return;
      }
      setParcels((prev) => {
        if (prev.some((p) => p.pnu && p.pnu === data.pnu)) return prev; // 중복 방지
        return [...prev, { pnu: data.pnu, jibun: data.jibun, addr: data.addr, geometry: data.geometry }];
      });
    } catch (err) {
      const msg = err?.response?.data?.error;
      setError(msg || "필지 조회 중 오류가 발생했습니다. (VWorld 인증키/도메인/Data API 권한 확인)");
    } finally {
      setLoadingParcel(false);
    }
  };
  // onMapClick 안에서 최신 mode 참조용
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // 그리기 모드 토글 시 Draw 컨트롤 on/off
  useEffect(() => {
    const L = LRef.current, map = mapRef.current, drawnItems = drawnItemsRef.current;
    if (!L || !map || !drawnItems) return;

    // 기존 컨트롤 제거
    if (drawControlRef.current) {
      map.removeControl(drawControlRef.current);
      drawControlRef.current = null;
    }
    map.off(L.Draw.Event.CREATED, onDrawCreated);

    if (mode === "draw") {
      const drawControl = new L.Control.Draw({
        draw: {
          polygon: { allowIntersection: false, showArea: true },
          polyline: false, rectangle: true, circle: false, marker: false, circlemarker: false,
        },
        edit: { featureGroup: drawnItems, edit: false, remove: true },
      });
      map.addControl(drawControl);
      drawControlRef.current = drawControl;
      map.on(L.Draw.Event.CREATED, onDrawCreated);
      map.on(L.Draw.Event.DELETED, onDrawDeleted);
    }
    return () => {
      if (LRef.current) {
        map.off(L.Draw.Event.CREATED, onDrawCreated);
        map.off(L.Draw.Event.DELETED, onDrawDeleted);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const onDrawCreated = (e) => {
    const drawnItems = drawnItemsRef.current;
    drawnItems.clearLayers(); // 1개만 유지
    drawnItems.addLayer(e.layer);
    const gj = e.layer.toGeoJSON();
    setDrawnGeometry(gj.geometry);
  };
  const onDrawDeleted = () => setDrawnGeometry(null);

  const handleMode = (_e, val) => {
    if (!val) return;
    // 모드 변경 시 해당 모드 선택값 초기화
    if (val === "parcel") setDrawnGeometry(null);
    else setParcels([]);
    if (drawnItemsRef.current) drawnItemsRef.current.clearLayers();
    setMode(val);
  };

  const removeParcel = (idx) => setParcels((prev) => prev.filter((_, i) => i !== idx));
  const clearSelection = () => {
    setParcels([]); setDrawnGeometry(null);
    if (drawnItemsRef.current) drawnItemsRef.current.clearLayers();
  };

  const onPickFiles = (e) => {
    setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    e.target.value = "";
  };
  const removeNewFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const removeExistingFile = async (fileId) => {
    if (!window.confirm("이 파일을 삭제할까요?")) return;
    try {
      await deleteSiteFile(id, fileId);
      setExistingFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch {
      setError("파일 삭제에 실패했습니다.");
    }
  };

  // 제출용 geometry 계산
  const buildGeometry = () => {
    if (mode === "draw") return drawnGeometry;
    if (!parcels.length) return null;
    if (parcels.length === 1) return parcels[0].geometry;
    // 여러 필지 → MultiPolygon 으로 합침
    const coords = [];
    parcels.forEach((p) => {
      const g = p.geometry;
      if (!g) return;
      if (g.type === "Polygon") coords.push(g.coordinates);
      else if (g.type === "MultiPolygon") g.coordinates.forEach((c) => coords.push(c));
    });
    return { type: "MultiPolygon", coordinates: coords };
  };

  const handleSubmit = async () => {
    setError("");
    const geometry = buildGeometry();
    if (!form.title.trim()) return setError("제목을 입력해 주세요.");
    if (!geometry) return setError("대상지(필지 또는 직접 그린 영역)를 먼저 선택해 주세요.");

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("category", form.category);
    fd.append("site_type", form.site_type);
    fd.append("summary", form.summary);
    fd.append("description", form.description);
    fd.append("external_link", form.external_link);
    fd.append("status", form.status);
    fd.append("geometry", JSON.stringify(geometry));
    fd.append("geometry_source", mode);
    if (mode === "parcel" && parcels.length) {
      fd.append("pnu", parcels.map((p) => p.pnu).filter(Boolean).join(","));
      fd.append("jibun", parcels.map((p) => p.jibun).filter(Boolean).join(" / "));
      fd.append("address", parcels.map((p) => p.addr).filter(Boolean).join(" / "));
    }
    files.forEach((f) => fd.append("files", f));

    setSubmitting(true);
    try {
      const saved = isEdit ? await updateSite(id, fd) : await createSite(fd);
      navigate(`/place/site/${saved.id}`);
    } catch (err) {
      setError("저장에 실패했습니다. 입력값과 로그인 상태를 확인해 주세요.");
      setSubmitting(false);
    }
  };

  const selectionArea = (() => {
    const g = buildGeometry();
    if (!g) return null;
    const c = geometryCenter(g);
    return c;
  })();

  return (
    <Box sx={{ p: 1 }}>
      <Stack>
        <Stack direction="row" alignItems="center" spacing={3}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            {isEdit ? "성과물 수정" : "새 성과물 등록"}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <ToggleButtonGroup size="small" exclusive value={mode} onChange={handleMode}>
              <ToggleButton value="parcel"><MyLocationIcon fontSize="small" sx={{ mr: 0.5 }} />필지 자동인식</ToggleButton>
              <ToggleButton value="draw"><GestureIcon fontSize="small" sx={{ mr: 0.5 }} />직접 그리기</ToggleButton>
            </ToggleButtonGroup>
            {loadingParcel && <CircularProgress size={18} />}
            <Button size="small" onClick={clearSelection}>선택 초기화</Button>
          </Stack>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {mode === "parcel"
            ? "대상지 필지를 클릭하면 경계가 자동 인식됩니다. 여러 필지를 이어 선택할 수 있습니다. (인식은 줌 레벨과 무관합니다)"
            : "우측 상단 그리기 도구로 대상지 영역(다각형/사각형)을 직접 그리세요. 1개 영역만 저장됩니다."}
        </Typography>
      </Stack>

      {error && <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>}

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        {/* 좌: 지도 + 선택 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>


          <Box
            ref={containerRef}
            sx={{ width: "100%", height: { xs: 380, md: 520 }, mt: 1, borderRadius: 1, overflow: "hidden", border: "1px solid #ddd" }}
          />

          {/* 선택된 필지 목록 */}
          {mode === "parcel" && parcels.length > 0 && (
            <Paper variant="outlined" sx={{ mt: 1, p: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>선택된 필지 {parcels.length}개</Typography>
              <Stack spacing={0.5}>
                {parcels.map((p, i) => (
                  <Stack key={i} direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2">
                      {p.jibun || p.addr || p.pnu || "필지"}
                    </Typography>
                    <IconButton size="small" onClick={() => removeParcel(i)}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          )}
        </Box>

        {/* 우: 메타데이터 폼 */}
        <Box sx={{ width: { xs: "100%", md: 360 } }}>
          <Stack spacing={1.5}>
            <TextField label="제목" size="small" fullWidth value={form.title} onChange={onField("title")} required />
            <Stack direction="row" spacing={1}>
              <TextField select label="전공분야" size="small" fullWidth value={form.category} onChange={onField("category")}>
                {CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </TextField>
              <TextField select label="대상지 유형" size="small" fullWidth value={form.site_type} onChange={onField("site_type")}>
                {SITE_TYPES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField label="한 줄 개요" size="small" fullWidth value={form.summary} onChange={onField("summary")} />
            <TextField label="설계·계획 설명" size="small" fullWidth multiline minRows={5} value={form.description} onChange={onField("description")} />
            <TextField label="외부 링크 (포트폴리오/영상 등)" size="small" fullWidth value={form.external_link} onChange={onField("external_link")} placeholder="https://" />
            <TextField select label="공개 상태" size="small" fullWidth value={form.status} onChange={onField("status")}>
              <MenuItem value="published">공개 (누구나 열람)</MenuItem>
              <MenuItem value="draft">비공개 (나만 보기)</MenuItem>
            </TextField>

            <Divider />
            <Box>
              <Button variant="outlined" component="label" size="small">
                이미지·PDF 첨부
                <input hidden type="file" multiple accept="image/*,application/pdf" onChange={onPickFiles} />
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                설계도판·투시도·배치도(이미지), 계획보고서(PDF)
              </Typography>

              {/* 새 첨부 */}
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {files.map((f, i) => (
                  <Stack key={i} direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>{f.name}</Typography>
                    <IconButton size="small" onClick={() => removeNewFile(i)}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                ))}
              </Stack>

              {/* 기존 첨부 (수정 모드) */}
              {existingFiles.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">기존 첨부</Typography>
                  <Stack spacing={0.5}>
                    {existingFiles.map((f) => (
                      <Stack key={f.id} direction="row" alignItems="center" justifyContent="space-between">
                        <Chip size="small" label={`${f.kind === "pdf" ? "PDF" : "이미지"}`} />
                        <a href={f.file_url} target="_blank" rel="noreferrer" style={{ flex: 1, marginLeft: 8, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.caption || f.file_url}
                        </a>
                        <IconButton size="small" onClick={() => removeExistingFile(f.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>

            <Divider />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleSubmit} disabled={submitting} fullWidth>
                {submitting ? "저장 중…" : isEdit ? "수정 저장" : "등록"}
              </Button>
              <Button variant="text" onClick={() => navigate(-1)}>취소</Button>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default PlaceUpload;
