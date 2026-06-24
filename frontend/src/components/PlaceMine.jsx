import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Button, Chip, Stack, Card, CardContent, CardMedia,
  CardActionArea, Grid, Alert, CircularProgress,
} from "@mui/material";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import { CATEGORY_COLORS, formatArea } from "./place/placeMap";
import { fetchMySites, isLoggedIn } from "./place/placeApi";

const PlaceMine = () => {
  const navigate = useNavigate();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { navigate("/login"); return; }
    let cancelled = false;
    fetchMySites()
      .then((data) => { if (!cancelled) setSites(data.results || data); })
      .catch(() => { if (!cancelled) setError("목록을 불러오지 못했습니다."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <Box sx={{ p: 1, maxWidth: 1100, mx: "auto" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>내 성과물</Typography>
        <Button variant="contained" size="small" startIcon={<AddLocationAltIcon />} onClick={() => navigate("/place/new")}>
          새 성과물 등록
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress /></Box>
      ) : sites.length === 0 ? (
        <Typography color="text.secondary">아직 등록한 성과물이 없습니다. 지도에서 대상지를 선택해 첫 성과물을 등록해 보세요.</Typography>
      ) : (
        <Grid container spacing={2}>
          {sites.map((s) => (
            <Grid item xs={12} sm={6} md={4} key={s.id}>
              <Card sx={{ borderTop: `4px solid ${CATEGORY_COLORS[s.category] || "#888"}` }}>
                <CardActionArea onClick={() => navigate(`/place/site/${s.id}`)}>
                  {s.thumbnail && (
                    <CardMedia component="img" height="140" image={s.thumbnail} alt={s.title} />
                  )}
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>{s.title}</Typography>
                    <Stack direction="row" spacing={0.5} sx={{ my: 0.5 }}>
                      <Chip size="small" label={s.category_label} />
                      <Chip size="small" variant="outlined" label={s.site_type_label} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" noWrap>{s.summary || s.jibun || "—"}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatArea(s.area_sqm)}</Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default PlaceMine;
