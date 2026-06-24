import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Button, Chip, Stack, Paper, Divider, IconButton,
  ImageList, ImageListItem, Link as MuiLink, CircularProgress, Alert,
} from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  loadLeaflet, buildVworldLayers, CATEGORY_COLORS, geometryCenter, formatArea, MAP_MAX_ZOOM,
} from "./place/placeMap";
import { fetchSite, deleteSite, toggleLike, isLoggedIn } from "./place/placeApi";

const PlaceSiteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  const [site, setSite] = useState(null);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchSite(id)
      .then((s) => { if (!cancelled) setSite(s); })
      .catch(() => { if (!cancelled) setError("성과물을 불러오지 못했습니다."); });
    return () => { cancelled = true; };
  }, [id]);

  // 미니맵: geometry 표시
  useEffect(() => {
    if (!site || !site.geometry || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { center: geometryCenter(site.geometry) || [37.5665, 126.978], zoom: 16, minZoom: 7, maxZoom: MAP_MAX_ZOOM });
      mapRef.current = map;
      const { baseGeneral } = buildVworldLayers(L);
      baseGeneral.addTo(map);
      const color = CATEGORY_COLORS[site.category] || "#1565c0";
      const gj = L.geoJSON(site.geometry, { style: { color, weight: 3, fillColor: color, fillOpacity: 0.3 } }).addTo(map);
      try { map.fitBounds(gj.getBounds(), { padding: [30, 30], maxZoom: 18 }); } catch (e) {}
      setTimeout(() => map.invalidateSize(), 200);
    });
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [site]);

  const handleLike = async () => {
    if (!isLoggedIn()) { navigate("/login"); return; }
    try {
      const r = await toggleLike(id);
      setSite((s) => ({ ...s, is_liked: r.is_liked, like_count: r.like_count }));
    } catch (e) {}
  };

  const handleDelete = async () => {
    if (!window.confirm("이 성과물을 삭제할까요? 되돌릴 수 없습니다.")) return;
    try { await deleteSite(id); navigate("/place"); }
    catch (e) { setError("삭제에 실패했습니다."); }
  };

  if (error) return <Box sx={{ p: 2 }}><Alert severity="error">{error}</Alert></Box>;
  if (!site) return <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>;

  const images = (site.files || []).filter((f) => f.kind === "image");
  const pdfs = (site.files || []).filter((f) => f.kind === "pdf");
  const otherFiles = (site.files || []).filter((f) => f.kind === "file");
  const color = CATEGORY_COLORS[site.category] || "#1565c0";

  return (
    <Box sx={{ p: 1, maxWidth: 1100, mx: "auto" }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/place")} size="small" sx={{ mb: 1 }}>
        지도로 돌아가기
      </Button>

      <Paper sx={{ p: 2, borderTop: `5px solid ${color}` }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{site.title}</Typography>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap">
              <Chip size="small" sx={{ bgcolor: color, color: "#fff" }} label={site.category_label} />
              <Chip size="small" variant="outlined" label={site.site_type_label} />
              {site.status === "draft" && <Chip size="small" color="warning" label="비공개" />}
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small" variant="outlined"
              startIcon={site.is_liked ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
              onClick={handleLike}
            >
              {site.like_count ?? 0}
            </Button>
            {site.is_owner && (
              <>
                <IconButton size="small" onClick={() => navigate(`/place/edit/${id}`)}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={handleDelete}><DeleteIcon fontSize="small" /></IconButton>
              </>
            )}
          </Stack>
        </Stack>

        {site.summary && <Typography variant="body1" sx={{ mt: 1.5, fontStyle: "italic", color: "text.secondary" }}>{site.summary}</Typography>}

        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 2 }}>
          {/* 미니맵 + 대상지 정보 */}
          <Box sx={{ width: { xs: "100%", md: 380 } }}>
            <Box ref={containerRef} sx={{ width: "100%", height: 280, borderRadius: 1, overflow: "hidden", border: "1px solid #ddd" }} />
            <Paper variant="outlined" sx={{ mt: 1, p: 1.5 }}>
              <Typography variant="subtitle2" gutterBottom>대상지 정보</Typography>
              <InfoRow label="지번" value={site.jibun} />
              <InfoRow label="주소" value={site.address} />
              <InfoRow label="PNU" value={site.pnu} />
              <InfoRow label="면적" value={formatArea(site.area_sqm)} />
              <InfoRow label="선택 방식" value={site.geometry_source === "draw" ? "직접 그리기" : "필지 자동인식"} />
            </Paper>
          </Box>

          {/* 설명 + 성과물 */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" gutterBottom>설계·계획 설명</Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mb: 2 }}>
              {site.description || "등록된 설명이 없습니다."}
            </Typography>

            {site.external_link && (
              <Box sx={{ mb: 2 }}>
                <MuiLink href={site.external_link} target="_blank" rel="noreferrer" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  <OpenInNewIcon fontSize="small" /> 외부 자료 보기
                </MuiLink>
              </Box>
            )}

            {images.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom>설계 이미지</Typography>
                <ImageList cols={images.length === 1 ? 1 : 2} gap={8} sx={{ mb: 2 }}>
                  {images.map((img) => (
                    <ImageListItem key={img.id} sx={{ cursor: "pointer" }} onClick={() => setLightbox(img.file_url)}>
                      <img src={img.file_url} alt={img.caption || site.title} loading="lazy" style={{ borderRadius: 4 }} />
                    </ImageListItem>
                  ))}
                </ImageList>
              </>
            )}

            {(pdfs.length > 0 || otherFiles.length > 0) && (
              <>
                <Typography variant="subtitle2" gutterBottom>첨부 문서</Typography>
                <Stack spacing={0.5} sx={{ mb: 2 }}>
                  {[...pdfs, ...otherFiles].map((f) => (
                    <MuiLink key={f.id} href={f.file_url} target="_blank" rel="noreferrer" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                      <PictureAsPdfIcon fontSize="small" color="error" /> {f.caption || f.file_url.split("/").pop()}
                    </MuiLink>
                  ))}
                </Stack>
              </>
            )}
          </Box>
        </Stack>

        <Divider sx={{ my: 1.5 }} />
        <Typography variant="caption" color="text.secondary">
          등록자: {site.nickname?.nickname || site.nickname?.username || "—"} ·
          {" "}{new Date(site.created_at).toLocaleString("ko-KR")}
        </Typography>
      </Paper>

      {/* 라이트박스 */}
      {lightbox && (
        <Box
          onClick={() => setLightbox(null)}
          sx={{ position: "fixed", inset: 0, bgcolor: "rgba(0,0,0,0.8)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}
        >
          <img src={lightbox} alt="" style={{ maxWidth: "95%", maxHeight: "95%", objectFit: "contain" }} />
        </Box>
      )}
    </Box>
  );
};

const InfoRow = ({ label, value }) => (
  <Stack direction="row" spacing={1} sx={{ py: 0.25 }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 64 }}>{label}</Typography>
    <Typography variant="body2" sx={{ wordBreak: "break-all" }}>{value || "—"}</Typography>
  </Stack>
);

export default PlaceSiteDetail;
