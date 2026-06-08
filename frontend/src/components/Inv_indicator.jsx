import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Tooltip,
  Alert,
  Spin,
  Divider,
  Space,
  Statistic,
  Progress,
  Switch,
  Select,
  InputNumber,
} from "antd";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  InfoCircleOutlined,
  AppstoreOutlined,
  LoadingOutlined,
  WarningOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { Button, Popconfirm } from "antd";
import Column from "antd/es/table/Column";
import {
  SECTIONS,
  STOCK_INDICATORS,
  SECTOR_COLOR,
  SECTOR_ABBR,
  NDX100_FALLBACK,
} from "./inv_indicator/constants";
import {
  DEFAULT_FORMULA,
  makeEvaluator,
  validateCompiled,
} from "./inv_indicator/FormulaEngine";
import FormulaBuilder from "./inv_indicator/FormulaBuilder";
import useUserFormulas, { isLoggedIn } from "./inv_indicator/useUserFormulas";

const { Title, Text } = Typography;

// =====================================================================
// 나스닥 100 분기 방향성 예측 지표 (FRED 데이터 기반)
// ---------------------------------------------------------------------
// · 매 분기 첫달 1일 기준 QoQ / YoY 변화 산출
// · 지표별 ON/OFF 토글 + 가중치(0~100, 드래그·휠) 로 종합 시그널 가중평균
// · 헤더에서 나스닥 100 종목을 선택하면 해당 종목 라벨로 시그널 표시
//   (현재는 매크로 지표만 있어 모든 종목이 같은 시그널을 받음.
//    추후 종목별 지표(MA, P/C ratio 등) 추가되면 종목별로 차별화됨)
// · FRED 미제공 지표는 "공란" 처리
// · 데이터: 백엔드 /invest/indicator-snapshots/ 가 IndicatorSnapshot DB
//   를 읽어 1회 응답. cron(미국 자정) + management command 로 일일 갱신.
// =====================================================================

// ---------- 날짜 헬퍼 ----------
function getQuarterStart(date) {
  const m = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), m, 1);
}
function addQuarters(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n * 3, 1);
}
function addYears(date, n) {
  return new Date(date.getFullYear() + n, date.getMonth(), 1);
}
function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function quarterLabel(date) {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}년 ${q}분기 (${fmt(date)})`;
}

// 상수 정의는 ./inv_indicator/constants.js 로 분리

// ---------- 시그널 계산 ----------
function computeSignal(item, current, ref) {
  if (!current || !ref) return "neutral";
  const diff = current.value - ref.value;
  if (Math.abs(diff) < 1e-9) return "neutral";
  if (item.interpret === "lower-bullish") return diff < 0 ? "bullish" : "bearish";
  return diff > 0 ? "bullish" : "bearish";
}

const SIGNAL_META = {
  bullish: { label: "긍정", color: "green", icon: <ArrowUpOutlined /> },
  bearish: { label: "부정", color: "red", icon: <ArrowDownOutlined /> },
  neutral: { label: "중립", color: "default", icon: <MinusOutlined /> },
};

// ---------- 포맷 ----------
function formatValue(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return v.toFixed(2);
}
function formatDelta(diff) {
  if (diff === null || diff === undefined || Number.isNaN(diff)) return "—";
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(2)}`;
}
function deltaColor(diff) {
  if (diff > 0) return "#3f8600";
  if (diff < 0) return "#cf1322";
  return "rgba(0,0,0,0.45)";
}

// ---------- 가중치 게이지 (드래그 + 휠) ----------
function WeightGauge({ value, onChange, min = 0, max = 100 }) {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);

  const setFromX = useCallback(
    (clientX) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onChange(Math.round(min + pct * (max - min)));
    },
    [onChange, min, max]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => setFromX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, setFromX]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handler = (e) => {
      e.preventDefault();
      const step = e.deltaY < 0 ? 5 : -5;
      onChange(Math.min(max, Math.max(min, value + step)));
    };
    node.addEventListener("wheel", handler, { passive: false });
    return () => node.removeEventListener("wheel", handler);
  }, [value, onChange, min, max]);

  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div
      ref={ref}
      onMouseDown={(e) => { setDragging(true); setFromX(e.clientX); }}
      title="드래그하거나 마우스 휠을 굴려 가중치를 조절하세요"
      style={{
        height: 18,
        background: "#f0f2f5",
        borderRadius: 9,
        position: "relative",
        cursor: "ew-resize",
        userSelect: "none",
        marginTop: 8,
        overflow: "hidden",
        border: "1px solid #e6e8eb",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: "linear-gradient(90deg,#69b1ff,#1677ff)",
          transition: dragging ? "none" : "width 0.1s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 500,
          color: pct > 45 ? "#fff" : "rgba(0,0,0,0.65)",
          pointerEvents: "none",
        }}
      >
        가중치 {value}
      </div>
    </div>
  );
}

// ---------- 가중치 InputNumber + 마우스 휠 ----------
// React 의 onWheel 은 passive 라 preventDefault 가 안 먹어서
// 직접 addEventListener 로 등록
function WeightInput({ value, onChange, min = 0, max = 100, step = 5, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handler = (e) => {
      e.preventDefault();
      const cur = typeof value === "number" ? value : 50;
      const delta = e.deltaY < 0 ? step : -step;
      onChange(Math.min(max, Math.max(min, cur + delta)));
    };
    node.addEventListener("wheel", handler, { passive: false });
    return () => node.removeEventListener("wheel", handler);
  }, [value, onChange, min, max, step]);
  return (
    <span
      ref={ref}
      style={{ display: "inline-block" }}
      title="입력란 위에서 마우스 휠로 ±5"
    >
      <InputNumber
        size="small"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(v) => onChange(typeof v === "number" ? v : 0)}
        controls={false}
        {...rest}
      />
    </span>
  );
}

// ---------- 개별 종목 — 시그널 카드 래퍼 ----------
function StockCard({ title, subtitle, signal, note, extra, children }) {
  const meta = SIGNAL_META[signal] || SIGNAL_META.neutral;
  return (
    <Card
      size="small"
      style={{ height: "100%" }}
      styles={{ body: { padding: 12 } }}
    >
      {/* 헤더: 제목 + (ON/OFF 토글) + 시그널 태그 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
        <div>
          <Text strong style={{ fontSize: 13, display: "block", lineHeight: 1.3 }}>
            {title}
          </Text>
          {subtitle && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              {subtitle}
            </Text>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {extra}
          <Tag
            color={meta.color}
            icon={meta.icon}
            style={{ marginRight: 0, fontSize: 11 }}
          >
            {meta.label}
          </Tag>
        </div>
      </div>

      {/* 노트 한 줄 */}
      {note && (
        <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 6 }}>
          {note}
        </Text>
      )}

      <Divider style={{ margin: "6px 0" }} />

      {/* 본문 */}
      {children}
    </Card>
  );
}

// ---------- 개별 종목 — 미니 스파크라인 (SVG) ----------
function StockSparkline({ history, yKey = "close", color = "#1677ff", baseline }) {
  if (!Array.isArray(history) || history.length < 2) return null;

  const values = history.map((d) => d[yKey]).filter((v) => v != null && !Number.isNaN(v));
  if (values.length < 2) return null;

  const W = 200;
  const H = 40;
  const pad = 2;

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const toX = (i) => pad + (i / (values.length - 1)) * (W - pad * 2);
  const toY = (v) => H - pad - ((v - minV) / range) * (H - pad * 2);

  // polyline points
  const pts = values.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");

  // 채워진 영역 (area path)
  const areaD = [
    `M ${toX(0).toFixed(1)},${H - pad}`,
    ...values.map((v, i) => `L ${toX(i).toFixed(1)},${toY(v).toFixed(1)}`),
    `L ${toX(values.length - 1).toFixed(1)},${H - pad}`,
    "Z",
  ].join(" ");

  // baseline 수평선 (예: vol_ratio = 1.0)
  const baseY = baseline != null ? toY(baseline) : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      style={{ display: "block", marginTop: 8, overflow: "visible" }}
    >
      {/* 면적 */}
      <path
        d={areaD}
        fill={color}
        fillOpacity={0.08}
        stroke="none"
      />
      {/* 기준선 */}
      {baseY != null && (
        <line
          x1={pad}
          y1={baseY.toFixed(1)}
          x2={W - pad}
          y2={baseY.toFixed(1)}
          stroke="rgba(0,0,0,0.2)"
          strokeWidth={0.8}
          strokeDasharray="3 2"
        />
      )}
      {/* 라인 */}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* 마지막 점 */}
      <circle
        cx={toX(values.length - 1).toFixed(1)}
        cy={toY(values[values.length - 1]).toFixed(1)}
        r={2.5}
        fill={color}
      />
    </svg>
  );
}

// ---------- 지표 5년 스파크라인 (SVG) ----------
function IndicatorSparkline({ dates, values, unit, color = "#1677ff" }) {
  if (!Array.isArray(values) || values.length < 2) return null;

  // null 제거 후 인덱스 유지
  const filtered = values
    .map((v, i) => ({ v, d: dates?.[i] }))
    .filter((x) => x.v != null && !Number.isNaN(x.v));
  if (filtered.length < 2) return null;

  const vals = filtered.map((x) => x.v);
  const W = 260, H = 56, padX = 4, padY = 4;
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const toX = (i) => padX + (i / (filtered.length - 1)) * (W - padX * 2);
  const toY = (v) => H - padY - ((v - minV) / range) * (H - padY * 2 - 14);

  const pts = filtered.map((x, i) => `${toX(i).toFixed(1)},${toY(x.v).toFixed(1)}`).join(" ");
  const areaD = [
    `M ${toX(0).toFixed(1)},${(H - padY).toFixed(1)}`,
    ...filtered.map((x, i) => `L ${toX(i).toFixed(1)},${toY(x.v).toFixed(1)}`),
    `L ${toX(filtered.length - 1).toFixed(1)},${(H - padY).toFixed(1)}`,
    "Z",
  ].join(" ");

  const firstDate = filtered[0]?.d?.slice(0, 7) ?? "";
  const lastDate  = filtered[filtered.length - 1]?.d?.slice(0, 7) ?? "";
  const lastVal   = filtered[filtered.length - 1].v;
  const lastX     = toX(filtered.length - 1);
  const lastY     = toY(lastVal);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      style={{ display: "block", marginTop: 6, overflow: "visible" }}
    >
      {/* 면적 */}
      <path d={areaD} fill={color} fillOpacity={0.08} stroke="none" />
      {/* 라인 */}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* 마지막 점 */}
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r={2.5} fill={color} />
      {/* 최소/최대 수평 점선 */}
      <line
        x1={padX} y1={toY(maxV).toFixed(1)}
        x2={W - padX} y2={toY(maxV).toFixed(1)}
        stroke={color} strokeWidth={0.5} strokeDasharray="3 2" opacity={0.4}
      />
      {/* 날짜 레이블 (하단) */}
      <text x={padX} y={H - 1} fontSize={9} fill="rgba(0,0,0,0.35)">{firstDate}</text>
      <text x={W - padX} y={H - 1} fontSize={9} fill="rgba(0,0,0,0.35)" textAnchor="end">{lastDate}</text>
      {/* 최솟값/최댓값 레이블 */}
      <text x={padX + 2} y={toY(maxV) - 2} fontSize={9} fill={color} opacity={0.7}>
        {formatValue(maxV)}
      </text>
      <text x={padX + 2} y={Math.min(toY(minV) + 9, H - 12)} fontSize={9} fill="rgba(0,0,0,0.4)" opacity={0.7}>
        {formatValue(minV)}
      </text>
    </svg>
  );
}

// ---------- 지표 카드 ----------
function IndicatorCard({ item, current, prevQ, prevY, weight, onWeightChange, enabled, onToggle }) {
  const noData = !item.seriesId;
  // 외부 링크: FRED 시리즈가 있으면 FRED, 없고 linkUrl(Yahoo 등)이 있으면 그쪽으로
  const linkHref = item.fredId
    ? `https://fred.stlouisfed.org/series/${item.fredId}`
    : item.linkUrl || null;
  const linkTip = item.fredId
    ? `FRED에서 보기: ${item.fredId}`
    : item.linkUrl
    ? "Yahoo Finance에서 보기"
    : item.seriesId
    ? `데이터 소스: ${item.seriesId}`
    : "";
  const sigQ = computeSignal(item, current, prevQ);
  const meta = SIGNAL_META[sigQ];
  const qoq = current && prevQ ? current.value - prevQ.value : null;
  const yoy = current && prevY ? current.value - prevY.value : null;
  const effectiveOpacity = noData ? 0.55 : enabled ? 1 : 0.6;

  // ── 5년 차트 상태 ──
  const [chartOpen,    setChartOpen]    = useState(false);
  const [chartData,    setChartData]    = useState(null);   // { dates, values }
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError,   setChartError]   = useState(null);

  const handleChartToggle = useCallback(async () => {
    if (chartOpen) { setChartOpen(false); return; }
    setChartOpen(true);
    if (chartData || chartLoading) return; // 이미 fetch 했거나 진행 중
    setChartLoading(true);
    setChartError(null);
    try {
      const { data } = await axios.get("/invest/indicator-history/", {
        params: { key: item.seriesId, years: 5 },
        timeout: 30000,
      });
      if (data.dates?.length) {
        setChartData({ dates: data.dates, values: data.values });
      } else {
        setChartError("데이터 없음");
      }
    } catch (e) {
      setChartError(e?.response?.data?.error || e?.message || "로드 실패");
    } finally {
      setChartLoading(false);
    }
  }, [chartOpen, chartData, chartLoading, item.seriesId]);

  // 시그널 색상으로 차트 라인 컬러 결정
  const chartColor = sigQ === "bullish" ? "#3f8600" : sigQ === "bearish" ? "#cf1322" : "#1677ff";

  return (
    <Card
      size="small"
      style={{ height: "100%", opacity: effectiveOpacity }}
      styles={{ body: { padding: 14 } }}
    >
      {/* 상단: 이름 + 우상단 토글 스위치 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        {linkHref ? (
          <Tooltip title={linkTip}>
            <Text strong style={{ fontSize: 13, lineHeight: 1.3, flex: 1 }}>
              <a
                href={linkHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "none", borderBottom: "1px dashed #1677ff" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#1677ff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "inherit"; }}
              >
                {item.name}
              </a>
            </Text>
          </Tooltip>
        ) : (
          <Tooltip title={linkTip}>
            <Text strong style={{ fontSize: 13, lineHeight: 1.3, flex: 1 }}>
              {item.name}
            </Text>
          </Tooltip>
        )}
        {!noData && (
          <Tag color={meta.color} icon={meta.icon} style={{ marginRight: 0, fontSize: 11 }}>
            {meta.label}
          </Tag>
        )}
      </div>

      <Divider style={{ margin: "8px 0" }} />

      {noData ? (
        <div>
          <Title level={5} style={{ margin: 0, color: "rgba(0,0,0,0.35)" }}>— (공란)</Title>
          {item.note && (
            <Text type="secondary" style={{ fontSize: 11 }}>{item.note}</Text>
          )}
        </div>
      ) : (
        <div>
          <div style={{display:"flex"}}>
          <Statistic
            value={current ? formatValue(current.value) : "—"}
            suffix={<Text type="secondary" style={{ fontSize: 12 }}>{item.unit}</Text>}
            valueStyle={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}
          />
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            {current?.updated ? (
              <Tooltip title={`FRED 갱신일 · 관측일: ${current?.date || "—"}`}>
                <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                  갱신일: {current.updated}
                </Text>
              </Tooltip>
            ) : (
              <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                관측일: {current?.date || "데이터 없음"}
              </Text>
            )}
            {current?.next_release && (
              <Tooltip title="FRED 차기 예정 발표일">
                <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                  예정일: {current.next_release}
                </Text>
              </Tooltip>
            )}
          </div>
          </div>
          <div style={{ marginTop: 4, display: "flex", gap: 5, flexWrap: "wrap" }}>
            <Text style={{ color: deltaColor(qoq), fontWeight: 600, fontSize: 12, marginRight: "auto" }}>
              QoQ {formatDelta(qoq)}
              {prevQ && (
                <Text type="secondary" style={{ fontSize: 10, marginLeft: 2 }}>
                  ({formatValue(prevQ.value)})
                </Text>
              )}
            </Text>
            <Text style={{ color: deltaColor(yoy), fontWeight: 600, fontSize: 12 }}>
              YoY {formatDelta(yoy)}
              {prevY && (
                <Text type="secondary" style={{ fontSize: 10, marginLeft: 2 }}>
                  ({formatValue(prevY.value)})
                </Text>
              )}
            </Text>
            {item.note && (
              <Tooltip title={item.note}>
                <InfoCircleOutlined style={{ color: "rgba(0,0,0,0.45)", marginLeft: "auto" }} />
              </Tooltip>
            )}
          </div>

      <div style={{ display: "flex", gap: 5 }}>
        <div style={{ flex: 9 }}>
          <WeightGauge value={weight} onChange={(v) => onWeightChange(item.name, v)} />
        </div>
        <div style={{ flex: 1, height: 20, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {!noData && (
            <Tooltip title={enabled ? "종합시그널 반영 ON — 끄려면 클릭" : "종합시그널 미반영 — 켜려면 클릭"}>
              <Switch size="small" checked={enabled} onChange={(v) => onToggle(item.name, v)} />
            </Tooltip>
          )}
        </div>
      </div>

          {/* ── 5년 차트 토글 버튼 ── */}
          <div style={{ marginTop: 8 }}>
            <button
              onClick={handleChartToggle}
              style={{
                background: "none",
                border: "1px solid #d9d9d9",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 11,
                color: chartOpen ? "#1677ff" : "rgba(0,0,0,0.45)",
                padding: "2px 8px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                transition: "color 0.2s, border-color 0.2s",
              }}
            >
              <span style={{ fontSize: 12 }}>{chartOpen ? "▲" : "▼"}</span>
              {chartOpen ? "차트 닫기" : "5년 추이"}
            </button>
          </div>

          {/* ── 차트 영역 ── */}
          {chartOpen && (
            <div style={{ marginTop: 6 }}>
              {chartLoading && (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <Spin size="small" />
                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>로딩 중…</Text>
                </div>
              )}
              {chartError && !chartLoading && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  ⚠ {chartError}
                </Text>
              )}
              {chartData && !chartLoading && (
                <IndicatorSparkline
                  dates={chartData.dates}
                  values={chartData.values}
                  unit={item.unit}
                  color={chartColor}
                />
              )}
            </div>
          )}
        </div>
      )}
      {!noData && !enabled && (
        <Text type="secondary" style={{ fontSize: 10, fontStyle: "italic" }}>
          토글 OFF — 종합시그널 미반영
        </Text>
      )}
    </Card>
  );
}

// ---------- OHLCV 캔들차트 상수 ----------
const CHART_H = 320;
const CHART_PAD = { left: 8, right: 68, top: 18, bottom: 30 };
const CHART_VOL_H = 56;

// ---------- OHLCV 캔들차트 컴포넌트 ----------
function NdxChart({ selectedStock }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [chartSymbol, setChartSymbol] = useState("^NDX");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [canvasW, setCanvasW] = useState(600);
  const [offset, setOffset] = useState(0);
  const barW = 8;
  const [tooltip, setTooltip] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  const symbolOptions = useMemo(() => {
    const opts = [{ value: "^NDX", label: "나스닥 100 (NDX)" }];
    if (selectedStock) {
      opts.push({
        value: selectedStock.ticker,
        label: `${selectedStock.ticker}${selectedStock.name ? ` — ${selectedStock.name}` : ""}`,
      });
    }
    return opts;
  }, [selectedStock]);

  // selectedStock 해제 시 NDX 로 복귀
  useEffect(() => {
    if (!selectedStock && chartSymbol !== "^NDX") setChartSymbol("^NDX");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStock]);

  // 데이터 fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setData([]); setOffset(0);
    axios.get("/invest/ohlcv/", { params: { symbol: chartSymbol, years: 8 }, timeout: 30000 })
      .then(({ data: resp }) => {
        if (cancelled) return;
        setData(Array.isArray(resp) ? resp : (resp?.candles || []));
      })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.error || e?.message || "로드 실패"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [chartSymbol]);

  // 컨테이너 너비 감지
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setCanvasW(el.offsetWidth || 600);
    const obs = new ResizeObserver(([e]) => setCanvasW(e.contentRect.width || 600));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // 보이는 캔들 범위 계산
  const visibleSlice = useMemo(() => {
    if (!data.length) return null;
    const chartW = canvasW - CHART_PAD.left - CHART_PAD.right;
    const count = Math.max(10, Math.floor(chartW / barW));
    const safeOffset = Math.min(offset, Math.max(0, data.length - 20));
    const start = Math.max(0, data.length - count - safeOffset);
    const end = Math.max(start + 1, data.length - safeOffset);
    return { visible: data.slice(start, end), start, end };
  }, [data, canvasW, offset]);

  // 캔버스 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visibleSlice) return;
    const { visible } = visibleSlice;
    if (!visible.length) return;
    const W = canvasW, H = CHART_H;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const { left: PL, right: PR, top: PT, bottom: PB } = CHART_PAD;
    const priceH = H - PT - PB - CHART_VOL_H - 4;

    const maxP = Math.max(...visible.map(d => d.high));
    const minP = Math.min(...visible.map(d => d.low));
    const pRange = maxP - minP || 1;
    const toY = v => PT + (1 - (v - minP) / pRange) * priceH;
    const toX = i => PL + (i + 0.5) * barW;
    const volY0 = H - PB;
    const maxVol = Math.max(...visible.map(d => d.volume || 0)) || 1;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

    // 가격 그리드
    for (let g = 0; g <= 4; g++) {
      const y = PT + (g / 4) * priceH;
      const p = maxP - (g / 4) * pRange;
      ctx.strokeStyle = "#f0f0f0"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(W - PR, y); ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.font = "10px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(p >= 1000 ? p.toFixed(0) : p.toFixed(2), W - PR + 3, y + 4);
    }
    // 거래량 구분선
    ctx.strokeStyle = "#ebebeb"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PL, H - PB - CHART_VOL_H); ctx.lineTo(W - PR, H - PB - CHART_VOL_H); ctx.stroke();

    // 캔들 + 거래량
    visible.forEach((d, i) => {
      const x = toX(i);
      const isUp = d.close >= d.open;
      const color = isUp ? "#52c41a" : "#ff4d4f";
      const hw = Math.max(1, barW / 2 - 0.5);
      // 심지
      ctx.strokeStyle = isUp ? "#389e0d" : "#cf1322"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, toY(d.high)); ctx.lineTo(x, toY(d.low)); ctx.stroke();
      // 몸통
      const bt = Math.min(toY(d.open), toY(d.close));
      const bh = Math.max(1, Math.abs(toY(d.open) - toY(d.close)));
      ctx.fillStyle = color; ctx.fillRect(x - hw, bt, hw * 2, bh);
      // 거래량
      const vh = Math.max(1, ((d.volume || 0) / maxVol) * CHART_VOL_H);
      ctx.fillStyle = isUp ? "rgba(82,196,26,0.35)" : "rgba(255,77,79,0.35)";
      ctx.fillRect(x - hw, volY0 - vh, hw * 2, vh);
    });

    // 시간 축 레이블
    const every = Math.max(1, Math.round(80 / barW));
    ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
    visible.forEach((d, i) => {
      if (i % every === 0 && d.date) ctx.fillText(d.date.slice(0, 7), toX(i), H - PB + 14);
    });

    // 호버 십자선 + 종가 레이블
    if (hoverIdx !== null && hoverIdx < visible.length) {
      const x = toX(hoverIdx);
      ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x, PT); ctx.lineTo(x, H - PB); ctx.stroke();
      ctx.setLineDash([]);
      const d = visible[hoverIdx];
      const cy = toY(d.close);
      ctx.fillStyle = "rgba(22,119,255,0.85)"; ctx.fillRect(W - PR, cy - 7, PR - 2, 14);
      ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(d.close >= 1000 ? d.close.toFixed(0) : d.close.toFixed(2), W - PR + 3, cy + 4);
    }
  }, [visibleSlice, canvasW, hoverIdx]);

  // 스크롤 → 좌우 패닝
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const step = (e.deltaY > 0 || e.deltaX > 0) ? -5 : 5;
    setOffset(prev => Math.max(0, Math.min(Math.max(0, (data.length || 30) - 20), prev + step)));
  }, [data.length]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.addEventListener("wheel", handleWheel, { passive: false });
    return () => c.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // 마우스 이동 → 툴팁
  const handleMouseMove = useCallback((e) => {
    if (!visibleSlice || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.floor((x - CHART_PAD.left) / barW);
    const { visible } = visibleSlice;
    if (idx >= 0 && idx < visible.length) {
      setHoverIdx(idx);
      const d = visible[idx];
      setTooltip({ ...d, cx: e.clientX, cy: e.clientY });
    } else {
      setHoverIdx(null); setTooltip(null);
    }
  }, [visibleSlice]);

  const handleMouseLeave = useCallback(() => { setHoverIdx(null); setTooltip(null); }, []);

  return (
    <Card
      size="small"
      style={{ flex: 1 }}
      styles={{ body: { padding: "8px 12px" } }}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600 }}>차트</span>
          <Select
            size="small"
            value={chartSymbol}
            onChange={v => { setChartSymbol(v); setOffset(0); }}
            style={{ minWidth: 200 }}
            options={symbolOptions}
          />
          <Text type="secondary" style={{ fontSize: 10 }}>
            스크롤 ← → 이동 · 최대 8년
          </Text>
        </div>
      }
    >
      <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
        {loading && (
          <div style={{ height: CHART_H, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Spin size="small" />
            <Text type="secondary" style={{ fontSize: 11 }}>차트 로딩 중…</Text>
          </div>
        )}
        {!loading && error && (
          <div style={{ height: CHART_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>⚠ {error}</Text>
          </div>
        )}
        {!loading && !error && data.length === 0 && (
          <div style={{ height: CHART_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Text type="secondary">데이터 없음</Text>
          </div>
        )}
        {!loading && !error && data.length > 0 && (
          <canvas
            ref={canvasRef}
            style={{ display: "block", cursor: "crosshair", maxWidth: "100%" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        )}
        {tooltip && (
          <div style={{
            position: "fixed",
            left: tooltip.cx + 14,
            top: tooltip.cy - 130,
            background: "rgba(15,15,15,0.88)",
            color: "#fff",
            padding: "7px 11px",
            borderRadius: 5,
            fontSize: 11,
            lineHeight: 1.75,
            pointerEvents: "none",
            zIndex: 9999,
            whiteSpace: "nowrap",
            boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
          }}>
            <div style={{ fontWeight: 700, marginBottom: 2, color: "#e0e0e0" }}>{tooltip.date}</div>
            <div>시가 <span style={{ fontWeight: 600 }}>{tooltip.open?.toFixed(2)}</span></div>
            <div>고가 <span style={{ fontWeight: 600, color: "#73d13d" }}>{tooltip.high?.toFixed(2)}</span></div>
            <div>저가 <span style={{ fontWeight: 600, color: "#ff7875" }}>{tooltip.low?.toFixed(2)}</span></div>
            <div>종가 <span style={{ fontWeight: 600, color: (tooltip.close ?? 0) >= (tooltip.open ?? 0) ? "#73d13d" : "#ff7875" }}>
              {tooltip.close?.toFixed(2)}
            </span></div>
            <div>거래량 <span style={{ fontWeight: 600 }}>{tooltip.volume?.toLocaleString()}</span></div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------- 공식에 종목별 지표가 포함되어 있는지 확인 ----------
function formulaHasStockIndicators(formula) {
  const text = (formula?.compiled_text || "") + (formula?.display_text || "");
  return STOCK_INDICATORS.some((it) => text.includes(it.name));
}

// ---------- 메인 컴포넌트 ----------
export default function InvestIndicator() {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refDate = useMemo(() => getQuarterStart(new Date()), []);
  const prevQDate = useMemo(() => addQuarters(refDate, -1), [refDate]);
  const prevYDate = useMemo(() => addYears(refDate, -1), [refDate]);

  // 지표별 ON/OFF (기본 true)
  const [itemEnabled, setItemEnabled] = useState(() => {
    const init = {};
    SECTIONS.forEach((s) => s.items.forEach((it) => { init[it.name] = true; }));
    return init;
  });
  const setItemOn = useCallback((name, v) => {
    setItemEnabled((prev) => ({ ...prev, [name]: v }));
  }, []);

  // 지표별 가중치 (기본 50)
  const [weights, setWeights] = useState(() => {
    const init = {};
    SECTIONS.forEach((s) => s.items.forEach((it) => { init[it.name] = 50; }));
    return init;
  });
  const setWeight = useCallback((name, v) => {
    setWeights((prev) => ({ ...prev, [name]: v }));
  }, []);

  // 나스닥 100 종목 리스트 + 선택
  const [ndxList, setNdxList] = useState(NDX100_FALLBACK);
  const [ndxSource, setNdxSource] = useState("fallback"); // 'backend' | 'fallback'
  const [selectedStock, setSelectedStock] = useState(null);

  // 섹터별 공식 선택 (sector 이름 → formula id)
  const [sectorFormulaIds, setSectorFormulaIds] = useState({});
  const setSectorFormulaId = useCallback((sector, id) => {
    setSectorFormulaIds(prev => ({ ...prev, [sector]: id }));
  }, []);

  // 개별 종목 지표 (MA / 거래강도 / P/C / 고저)
  const [stockData, setStockData] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState(null);

  // 종목 지표별 ON/OFF + 가중치
  const [stockItemEnabled, setStockItemEnabled] = useState(() => {
    const init = {};
    STOCK_INDICATORS.forEach((it) => { init[it.name] = true; });
    return init;
  });
  const setStockItemOn = useCallback((name, v) => {
    setStockItemEnabled((prev) => ({ ...prev, [name]: v }));
  }, []);

  const [stockWeights, setStockWeights] = useState(() => {
    const init = {};
    STOCK_INDICATORS.forEach((it) => { init[it.name] = 50; });
    return init;
  });
  const setStockWeight = useCallback((name, v) => {
    setStockWeights((prev) => ({ ...prev, [name]: v }));
  }, []);

  // ---------- 사용자 정의 공식 (1단계) ----------
  // 로그인한 사용자는 자기만의 공식을 만들어 저장할 수 있고,
  // 기본 공식과 자유롭게 전환해 가며 종합시그널을 다르게 산출할 수 있다.
  const { formulas: userFormulas, upsertLocal, removeFormula, refetch: refetchFormulas } =
    useUserFormulas();
  const [activeFormulaId, setActiveFormulaId] = useState(DEFAULT_FORMULA.id);
  const [marketFormulaId, setMarketFormulaId] = useState(DEFAULT_FORMULA.id);
  const [stockCardFormulaId, setStockCardFormulaId] = useState(DEFAULT_FORMULA.id);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderInitial, setBuilderInitial] = useState(null);
  const loggedIn = isLoggedIn();

  // NY 자정까지 남은 시간 (1초마다 갱신) — 데이터 갱신 cron 시각
  const [ttUpdate, setTtUpdate] = useState("--:--:--");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      // NY 현재 시각 (DST 자동 반영)
      const nyParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).formatToParts(now);
      const get = (t) => nyParts.find((p) => p.type === t)?.value;
      const h = parseInt(get("hour"), 10);
      const m = parseInt(get("minute"), 10);
      const s = parseInt(get("second"), 10);
      // 자정까지 남은 초
      const elapsed = h * 3600 + m * 60 + s;
      const remaining = 86400 - elapsed;
      const rh = Math.floor(remaining / 3600);
      const rm = Math.floor((remaining % 3600) / 60);
      const rs = remaining % 60;
      setTtUpdate(
        `${String(rh).padStart(2, "0")}:${String(rm).padStart(2, "0")}:${String(rs).padStart(2, "0")}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get("/invest/ndx100/", {
          params: { quarter: fmt(refDate) },
          timeout: 8000,
        });
        // 기대 응답: [{ ticker, name, sector }, ...] 또는 { items: [...] }
        const list = Array.isArray(data) ? data : data?.items;
        if (cancelled || !Array.isArray(list) || list.length === 0) return;
        // 백엔드가 sector 미제공 시 fallback 매핑에서 보완
        const sectorByTicker = Object.fromEntries(
          NDX100_FALLBACK.map((s) => [s.ticker, s.sector])
        );
        setNdxList(
          list.map((x) => ({
            ticker: x.ticker,
            name: x.name || x.ticker,
            sector: x.sector || sectorByTicker[x.ticker] || "Other",
          }))
        );
        setNdxSource("backend");
      } catch {
        // fallback 유지
      }
    })();
    return () => { cancelled = true; };
  }, [refDate]);

  // 개별 종목 지표 fetch — selectedStock 변경 시 자동 호출
  useEffect(() => {
    if (!selectedStock) {
      setStockData(null);
      setStockError(null);
      return;
    }
    let cancelled = false;
    setStockLoading(true);
    setStockError(null);
    setStockData(null);
    (async () => {
      try {
        const { data } = await axios.get(
          `/invest/stock-indicators/${selectedStock.ticker}/`,
          { timeout: 30000 }
        );
        if (!cancelled) setStockData(data);
      } catch (e) {
        if (!cancelled)
          setStockError(e?.response?.data?.error || e?.message || "종목 데이터 로드 실패");
      } finally {
        if (!cancelled) setStockLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedStock]);

  // 백엔드 indicator-snapshots 단일 호출 (DB 캐시 → 매일 자정 업데이트)
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axios.get("/invest/indicator-snapshots/", {
          params: { quarter: fmt(refDate) },
          timeout: 30000, // cold-start 시 fetch 가 느릴 수 있음
        });
        // 응답: { indicators: { KEY: { current:{date,value,source}, prev_q:{...}, prev_y:{...} } } }
        const inds = data?.indicators || {};
        const shaped = {};
        Object.entries(inds).forEach(([key, anchors]) => {
          shaped[key] = {
            current: anchors.current && anchors.current.value !== null
              ? { date: anchors.current.date, value: anchors.current.value, updated: anchors.current.updated || null, next_release: anchors.current.next_release || null }
              : null,
            prevQ: anchors.prev_q && anchors.prev_q.value !== null
              ? { date: anchors.prev_q.date, value: anchors.prev_q.value }
              : null,
            prevY: anchors.prev_y && anchors.prev_y.value !== null
              ? { date: anchors.prev_y.date, value: anchors.prev_y.value }
              : null,
          };
        });
        if (!cancelled) setResults(shaped);
      } catch (e) {
        if (!cancelled) setError(e?.message || "데이터 로드 실패");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [refDate, prevQDate, prevYDate]);

  // 가중치 + 지표 ON/OFF 반영한 종합 시그널
  const summary = useMemo(() => {
    let bullW = 0, bearW = 0, neutW = 0, totalW = 0, count = 0;
    SECTIONS.forEach((s) =>
      s.items.forEach((item) => {
        if (!item.seriesId) return;
        if (!itemEnabled[item.name]) return;
        const w = weights[item.name] ?? 50;
        if (w === 0) return;
        const r = results[item.seriesId];
        if (!r?.current || !r?.prevQ) return;
        const sig = computeSignal(item, r.current, r.prevQ);
        totalW += w;
        count += 1;
        if (sig === "bullish") bullW += w;
        else if (sig === "bearish") bearW += w;
        else neutW += w;
      })
    );
    // 7. 개별 종목 지표 시그널 반영
    if (stockData) {
      STOCK_INDICATORS.forEach((it) => {
        if (!stockItemEnabled[it.name]) return;
        const w = stockWeights[it.name] ?? 50;
        if (w === 0) return;
        const sig = stockData[it.key]?.signal;
        if (!sig) return;
        totalW += w;
        count += 1;
        if (sig === "bullish") bullW += w;
        else if (sig === "bearish") bearW += w;
        else neutW += w;
      });
    }
    const score = totalW ? ((bullW - bearW) / totalW) * 100 : 0;
    let bias = "중립";
    let color = "default";
    if (score > 20) { bias = "긍정 (Risk-On)"; color = "green"; }
    else if (score < -20) { bias = "부정 (Risk-Off)"; color = "red"; }
    const progressPct = Math.min(100, Math.max(0, (score + 100) / 2));
    return { bullW, bearW, neutW, totalW, count, score, bias, color, progressPct };
  }, [results, weights, itemEnabled, stockData, stockWeights, stockItemEnabled]);

  // 매크로 지표만으로 계산한 종합 시그널 (종목별 지표 제외 — 전체 시장 카드용)
  const macroSummary = useMemo(() => {
    let bullW = 0, bearW = 0, neutW = 0, totalW = 0, count = 0;
    SECTIONS.forEach((s) =>
      s.items.forEach((item) => {
        if (!item.seriesId) return;
        if (!itemEnabled[item.name]) return;
        const w = weights[item.name] ?? 50;
        if (w === 0) return;
        const r = results[item.seriesId];
        if (!r?.current || !r?.prevQ) return;
        const sig = computeSignal(item, r.current, r.prevQ);
        totalW += w;
        count += 1;
        if (sig === "bullish") bullW += w;
        else if (sig === "bearish") bearW += w;
        else neutW += w;
      })
    );
    const score = totalW ? ((bullW - bearW) / totalW) * 100 : 0;
    let bias = "중립"; let color = "default";
    if (score > 20) { bias = "긍정 (Risk-On)"; color = "green"; }
    else if (score < -20) { bias = "부정 (Risk-Off)"; color = "red"; }
    return { bullW, bearW, neutW, totalW, count, score, bias, color };
  }, [results, weights, itemEnabled]);

  // ---------- 활성 공식 ----------
  const activeFormula = useMemo(() => {
    if (activeFormulaId === DEFAULT_FORMULA.id) return DEFAULT_FORMULA;
    return userFormulas.find((f) => f.id === activeFormulaId) || DEFAULT_FORMULA;
  }, [activeFormulaId, userFormulas]);

  // 활성 공식 평가 결과 (실패 시 기본 score 로 폴백)
  const formulaResult = useMemo(() => {
    // signals 맵 구성: 각 매크로 지표명 → "bullish"|"bearish"|"neutral"
    const signals = {};
    SECTIONS.forEach((sec) =>
      sec.items.forEach((it) => {
        if (!it.seriesId) return;
        const r = results[it.seriesId];
        if (!r?.current || !r?.prevQ) return;
        signals[it.name] = computeSignal(it, r.current, r.prevQ);
      })
    );
    if (stockData) {
      STOCK_INDICATORS.forEach((it) => {
        const sig = stockData[it.key]?.signal;
        if (sig) signals[it.name] = sig;
      });
    }
    // weights 맵: enabled 인 것만 살림
    const wMap = {};
    Object.keys(weights).forEach((k) => {
      if (itemEnabled[k] !== false) wMap[k] = weights[k];
    });
    Object.keys(stockWeights).forEach((k) => {
      if (stockItemEnabled[k] !== false) wMap[k] = stockWeights[k];
    });

    try {
      validateCompiled(activeFormula.compiled_text);
      const evalFn = makeEvaluator(activeFormula.compiled_text);
      const v = evalFn({
        bullW: summary.bullW,
        bearW: summary.bearW,
        neutW: summary.neutW,
        totalW: summary.totalW,
        count: summary.count,
        score: summary.score,
        weights: wMap,
        signals,
      });
      const score = Number.isFinite(v) ? v : summary.score;
      let bias = "중립";
      let color = "default";
      if (score > 20) { bias = "긍정 (Risk-On)"; color = "green"; }
      else if (score < -20) { bias = "부정 (Risk-Off)"; color = "red"; }
      return { score, bias, color, error: null };
    } catch (e) {
      return {
        score: summary.score, bias: summary.bias, color: summary.color,
        error: e?.message || "공식 평가 실패",
      };
    }
  }, [activeFormula, summary, results, weights, itemEnabled, stockData, stockWeights, stockItemEnabled]);

  // ---------- 전체 시장 카드용 공식 ----------
  const marketActiveFormula = useMemo(() => {
    if (marketFormulaId === DEFAULT_FORMULA.id) return DEFAULT_FORMULA;
    return userFormulas.find((f) => f.id === marketFormulaId) || DEFAULT_FORMULA;
  }, [marketFormulaId, userFormulas]);

  const marketFormulaResult = useMemo(() => {
    // 매크로 전용 signals (종목별 지표는 neutral로 고정)
    const signals = {};
    SECTIONS.forEach((sec) =>
      sec.items.forEach((it) => {
        if (!it.seriesId) return;
        const r = results[it.seriesId];
        if (!r?.current || !r?.prevQ) return;
        signals[it.name] = computeSignal(it, r.current, r.prevQ);
      })
    );
    STOCK_INDICATORS.forEach((it) => { signals[it.name] = "neutral"; });
    const wMap = {};
    Object.keys(weights).forEach((k) => { if (itemEnabled[k] !== false) wMap[k] = weights[k]; });
    STOCK_INDICATORS.forEach((it) => { wMap[it.name] = 0; });
    const hasStockInds = formulaHasStockIndicators(marketActiveFormula);
    try {
      validateCompiled(marketActiveFormula.compiled_text);
      const evalFn = makeEvaluator(marketActiveFormula.compiled_text);
      const v = evalFn({
        bullW: macroSummary.bullW,
        bearW: macroSummary.bearW,
        neutW: macroSummary.neutW,
        totalW: macroSummary.totalW,
        count: macroSummary.count,
        score: macroSummary.score,
        weights: wMap,
        signals,
      });
      const score = Number.isFinite(v) ? v : macroSummary.score;
      let bias = "중립"; let color = "default";
      if (score > 20) { bias = "긍정 (Risk-On)"; color = "green"; }
      else if (score < -20) { bias = "부정 (Risk-Off)"; color = "red"; }
      return { score, bias, color, error: null, hasStockInds };
    } catch (e) {
      return { score: macroSummary.score, bias: macroSummary.bias, color: macroSummary.color, error: e?.message, hasStockInds };
    }
  }, [marketActiveFormula, macroSummary, results, weights, itemEnabled]);

  // ---------- 선택 종목 카드용 공식 ----------
  const stockCardActiveFormula = useMemo(() => {
    if (stockCardFormulaId === DEFAULT_FORMULA.id) return DEFAULT_FORMULA;
    return userFormulas.find((f) => f.id === stockCardFormulaId) || DEFAULT_FORMULA;
  }, [stockCardFormulaId, userFormulas]);

  const stockCardFormulaResult = useMemo(() => {
    const signals = {};
    SECTIONS.forEach((sec) =>
      sec.items.forEach((it) => {
        if (!it.seriesId) return;
        const r = results[it.seriesId];
        if (!r?.current || !r?.prevQ) return;
        signals[it.name] = computeSignal(it, r.current, r.prevQ);
      })
    );
    if (stockData) {
      STOCK_INDICATORS.forEach((it) => {
        const sig = stockData[it.key]?.signal;
        if (sig) signals[it.name] = sig;
      });
    }
    const wMap = {};
    Object.keys(weights).forEach((k) => { if (itemEnabled[k] !== false) wMap[k] = weights[k]; });
    Object.keys(stockWeights).forEach((k) => { if (stockItemEnabled[k] !== false) wMap[k] = stockWeights[k]; });
    try {
      validateCompiled(stockCardActiveFormula.compiled_text);
      const evalFn = makeEvaluator(stockCardActiveFormula.compiled_text);
      const v = evalFn({
        bullW: summary.bullW,
        bearW: summary.bearW,
        neutW: summary.neutW,
        totalW: summary.totalW,
        count: summary.count,
        score: summary.score,
        weights: wMap,
        signals,
      });
      const score = Number.isFinite(v) ? v : summary.score;
      let bias = "중립"; let color = "default";
      if (score > 20) { bias = "긍정 (Risk-On)"; color = "green"; }
      else if (score < -20) { bias = "부정 (Risk-Off)"; color = "red"; }
      return { score, bias, color, error: null };
    } catch (e) {
      return { score: summary.score, bias: summary.bias, color: summary.color, error: e?.message };
    }
  }, [stockCardActiveFormula, summary, results, weights, itemEnabled, stockData, stockWeights, stockItemEnabled]);

  // ---------- 빌더 핸들러 ----------
  const openNewBuilder = useCallback(() => {
    setBuilderInitial(null);
    setBuilderOpen(true);
  }, []);
  const openEditBuilder = useCallback(() => {
    if (activeFormula.id === DEFAULT_FORMULA.id) return; // 기본 공식은 편집 불가
    setBuilderInitial(activeFormula);
    setBuilderOpen(true);
  }, [activeFormula]);
  const handleSaved = useCallback((saved) => {
    upsertLocal(saved);
    setActiveFormulaId(saved.id);
    setBuilderOpen(false);
  }, [upsertLocal]);
  const handleDelete = useCallback(async () => {
    if (activeFormula.id === DEFAULT_FORMULA.id) return;
    const idToDelete = activeFormula.id;
    try {
      await removeFormula(idToDelete);
      setActiveFormulaId(DEFAULT_FORMULA.id);
    } catch (e) {
      // 실패 시 별도 안내 없이 무시 (네트워크 에러는 콘솔로)
      // eslint-disable-next-line no-console
      console.warn("delete formula failed:", e);
    }
  }, [activeFormula, removeFormula]);

  const selectedLabel = selectedStock
    ? `${selectedStock.ticker}${selectedStock.name ? ` — ${selectedStock.name}` : ""}`
    : "전체 (종목 미선택)";
  const selectedSector = selectedStock?.sector || null;

  // 섹터별 종합 시그널 — 현재는 매크로 지표 기반이라 점수는 동일하지만,
  // 섹터별 종목 수/비중을 함께 노출하여 추후 종목별 지표 도입 시 자연스럽게 차별화 가능
  const sectorBreakdown = useMemo(() => {
    const map = new Map();
    ndxList.forEach((s) => {
      const sec = s.sector || "Other";
      if (!map.has(sec)) {
        map.set(sec, { sector: sec, count: 0, weight: 0 });
      }
      const entry = map.get(sec);
      entry.count += 1;
      entry.weight += Number(s.weight) || 0;
    });
    return Array.from(map.values())
      .map((e) => ({
        ...e,
        bias: summary.bias,
        score: summary.score,
        color: summary.color,
      }))
      .sort((a, b) => b.weight - a.weight || b.count - a.count);
  }, [ndxList, summary]);

  // 섹터별 공식 적용 결과 (현재는 매크로 지표 기반 동일 데이터, 추후 종목별 지표 도입 시 차별화)
  const sectorFormulaResults = useMemo(() => {
    const out = {};
    sectorBreakdown.forEach(s => {
      const fid = sectorFormulaIds[s.sector] || DEFAULT_FORMULA.id;
      const formula = fid === DEFAULT_FORMULA.id
        ? DEFAULT_FORMULA
        : (userFormulas.find(f => f.id === fid) || DEFAULT_FORMULA);
      // 시그널 맵 (매크로 전용)
      const signals = {};
      SECTIONS.forEach(sec => sec.items.forEach(it => {
        if (!it.seriesId) return;
        const r = results[it.seriesId];
        if (!r?.current || !r?.prevQ) return;
        signals[it.name] = computeSignal(it, r.current, r.prevQ);
      }));
      const wMap = {};
      Object.keys(weights).forEach(k => { if (itemEnabled[k] !== false) wMap[k] = weights[k]; });
      try {
        validateCompiled(formula.compiled_text);
        const evalFn = makeEvaluator(formula.compiled_text);
        const v = evalFn({
          bullW: macroSummary.bullW, bearW: macroSummary.bearW,
          neutW: macroSummary.neutW, totalW: macroSummary.totalW,
          count: macroSummary.count, score: macroSummary.score,
          weights: wMap, signals,
        });
        const score = Number.isFinite(v) ? v : macroSummary.score;
        let color = "default";
        if (score > 20) color = "green";
        else if (score < -20) color = "red";
        out[s.sector] = { score, color };
      } catch {
        out[s.sector] = { score: macroSummary.score, color: macroSummary.color };
      }
    });
    return out;
  }, [sectorBreakdown, sectorFormulaIds, macroSummary, results, weights, itemEnabled, userFormulas]);

  return (
    <div style={{ padding: 16 }}>
      {/* ===== 헤더: 1줄(타이틀 좌측 / 셀렉터 우측) + 2줄(메타 3등분) ===== */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Title level={4} style={{ margin: 0, flex: 1 }}>
            나스닥 100 분기 방향성 예측 지표
          </Title>
          <Select
            showSearch
            allowClear
            placeholder="종목 선택 (NDX 100)"
            style={{ flex: 1 }}
            value={selectedStock?.ticker}
            onChange={(value) => {
              if (!value) { setSelectedStock(null); return; }
              const found = ndxList.find((s) => s.ticker === value);
              setSelectedStock(found || { ticker: value, name: "" });
            }}
            optionFilterProp="label"
            options={ndxList.map((s) => {
              const abbr = SECTOR_ABBR[s.sector] || (s.sector ? "ETC" : "");
              const suffix = abbr ? ` [${abbr}]` : "";
              return {
                value: s.ticker,
                label: `${s.ticker} — ${s.name}${suffix}`,
              };
            })}
          />
        </div>

        <Row gutter={8} style={{ marginTop: 8 }}>
          <Col span={6}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              · 기준일: {quarterLabel(refDate)}
            </Text>
          </Col>
          <Col span={6}>
            <Tooltip title="다음 데이터 업데이트는 미국 동부(NY) 자정에 cron 으로 실행됩니다 (DST 자동 반영)">
              <Text type="secondary" style={{ fontSize: 11 }}>
                · Data Update: NY 00:00 ({ttUpdate})
              </Text>
            </Tooltip>
          </Col>
          <Col span={6}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              · QoQ: {quarterLabel(prevQDate)}
            </Text>
          </Col>
          <Col span={6}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              · YoY: {quarterLabel(prevYDate)}
            </Text>
          </Col>
        </Row>
        {ndxSource === "fallback" && (
          <Text type="warning" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
            · 종목 리스트: fallback (백엔드 /invest/ndx100/ 미응답)
          </Text>
        )}
      </div>

      {/* ===== [2/3, 1/3] — 좌:컴팩트 시그널+섹터 / 우:공식+가중치 ===== */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="stretch">
        {/* === 좌측 2/3: 컴팩트 시그널 (위) + 섹터 그리드 (아래) === */}
        <Col xs={24} md={14} style={{ display: "flex", flexDirection: "column" }}>
          {/* 위: 전체시장 + 종목별 (컴팩트, 1줄 / 1:1:1 분할) */}
          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            {/* ── 전체 시장 카드 ── */}
            <Col span={12}>
              <Card
                size="small"
                styles={{ body: { padding: "8px 16px" } }}
                style={{
                  borderColor:
                    summary.color === "green" ? "#52c41a"
                    : summary.color === "red" ? "#ff4d4f" : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* 1/3 — 라벨 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text type="secondary" style={{ fontSize: 10, letterSpacing: 1 }}>
                      전체 시장
                    </Text>
                  </div>
                  {/* 2/3 — 공식 선택 */}
                  <div style={{ flex: 2, minWidth: 0, display: "flex", alignItems: "center", gap: 4 }}>
                    <Select
                      size="small"
                      value={marketFormulaId}
                      onChange={(v) => setMarketFormulaId(v)}
                      style={{ flex: 1, minWidth: 0, fontSize: 10 }}
                      options={[
                        { value: DEFAULT_FORMULA.id, label: DEFAULT_FORMULA.name },
                        ...userFormulas.map((f) => ({ value: f.id, label: f.name })),
                      ]}
                    />
                    {marketFormulaResult.hasStockInds && (
                      <Tooltip title="이 공식에 종목별 지표(MA·거래강도·P/C Ratio·신고가/신저가)가 포함되어 있어, 전체 시장 카드에서는 해당 지표값을 0으로 처리합니다.">
                        <WarningOutlined style={{ color: "#faad14", fontSize: 11, flexShrink: 0 }} />
                      </Tooltip>
                    )}
                  </div>
                  {/* 3/3 — 방향성 + 점수 */}
                  <div style={{ flex: 3, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                    <Text style={{ margin: 0, fontSize: 10, whiteSpace: "nowrap" }}>
                      {marketFormulaResult.bias}
                    </Text>
                    <Tag color={marketFormulaResult.color} style={{ marginRight: 0, fontSize: 10, flexShrink: 0 }}>
                      {marketFormulaResult.score >= 0 ? "+" : ""}{marketFormulaResult.score.toFixed(0)}
                    </Tag>
                  </div>
                </div>
              </Card>
            </Col>

            {/* ── 선택 종목 카드 ── */}
            <Col span={12}>
              <Card
                size="small"
                styles={{ body: { padding: "8px 12px" } }}
              >
                {selectedStock ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* 1/3 — 티커 + 섹터 태그 (종목명은 툴팁으로) */}
                    <Tooltip title={selectedStock.name}>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap", cursor: "default" }}>
                        <Text type="secondary" style={{ fontSize: 10, letterSpacing: 1, whiteSpace: "nowrap" }}>
                          {selectedStock.ticker}
                        </Text>
                        {selectedSector && (
                          <Tag
                            color={SECTOR_COLOR[selectedSector] || "default"}
                            style={{ marginRight: 0, fontSize: 9, padding: "0 4px", lineHeight: "14px", flexShrink: 0 }}
                          >
                            {SECTOR_ABBR[selectedSector] || "ETC"}
                          </Tag>
                        )}
                      </div>
                    </Tooltip>
                    {/* 2/3 — 공식 선택 */}
                    <div style={{ flex: 2, minWidth: 0, overflow: "hidden", display: "flex", alignItems: "center" }}>
                      <Select
                        size="small"
                        value={stockCardFormulaId}
                        onChange={(v) => setStockCardFormulaId(v)}
                        style={{ width: "100%", fontSize: 10 }}
                        options={[
                          { value: DEFAULT_FORMULA.id, label: DEFAULT_FORMULA.name },
                          ...userFormulas.map((f) => ({ value: f.id, label: f.name })),
                        ]}
                      />
                    </div>
                    {/* 3/3 — 방향성 + 점수 */}
                    <div style={{ flex: 3, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <Text style={{ margin: 0, fontSize: 10, whiteSpace: "nowrap" }}>
                        {stockCardFormulaResult.bias}
                      </Text>
                      <Tag color={stockCardFormulaResult.color} style={{ marginRight: 0, fontSize: 11, flexShrink: 0 }}>
                        {stockCardFormulaResult.score >= 0 ? "+" : ""}{stockCardFormulaResult.score.toFixed(0)}
                      </Tag>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* 1/2 — 안내 제목 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text type="secondary" style={{ fontSize: 10, margin: 0, fontWeight: 400, whiteSpace: "nowrap" }}>
                        종목 미선택
                      </Text>
                    </div>
                    {/* 2/2 — 안내 문구 */}
                    <div style={{ flex: 2, minWidth: 0, overflow: "hidden" }}>
                      <Text
                        type="secondary"
                        style={{ fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}
                      >
                        상단 셀렉터에서 NDX 100 종목 선택
                      </Text>
                    </div>
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {/* 아래: OHLCV 캔들차트 (나스닥 100 / 선택 종목) */}
          <NdxChart selectedStock={selectedStock} />
        </Col>

        {/* === 우측 1/3: 공식 + 인라인 가중치 === */}
        <Col xs={24} md={10} style={{ display: "flex" }}>
          <Card
            size="small"
            style={{ flex: 1 }}
            styles={{ body: { padding: 12 } }}
            title={
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                공식{" "}
                <Text type="secondary" style={{ fontSize: 10, fontWeight: 400 }}>
                  (가중치 ↔ 게이지 동기화)
                </Text>
              </span>
            }
            extra={
              <Space size={4}>
                <Select
                  size="small"
                  value={activeFormulaId}
                  onChange={(v) => setActiveFormulaId(v)}
                  style={{ minWidth: 130 }}
                  options={[
                    { value: DEFAULT_FORMULA.id, label: `${DEFAULT_FORMULA.name}` },
                    ...userFormulas.map((f) => ({ value: f.id, label: f.name })),
                  ]}
                />
                <Tooltip title={loggedIn ? "내 공식 만들기" : "로그인 후 사용 가능"}>
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={openNewBuilder}
                    disabled={!loggedIn}
                  />
                </Tooltip>
                <Tooltip title={activeFormula.id === DEFAULT_FORMULA.id ? "기본 공식은 편집 불가" : "공식 편집"}>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={openEditBuilder}
                    disabled={activeFormula.id === DEFAULT_FORMULA.id}
                  />
                </Tooltip>
                <Popconfirm
                  title="이 공식을 삭제할까요?"
                  onConfirm={handleDelete}
                  okText="삭제"
                  cancelText="취소"
                  disabled={activeFormula.id === DEFAULT_FORMULA.id}
                >
                  <Tooltip title={activeFormula.id === DEFAULT_FORMULA.id ? "기본 공식은 삭제 불가" : "공식 삭제"}>
                    <Button
                      size="small"
                      icon={<DeleteOutlined />}
                      danger
                      disabled={activeFormula.id === DEFAULT_FORMULA.id}
                    />
                  </Tooltip>
                </Popconfirm>
              </Space>
            }
          >
            {/* 컴팩트 공식 박스 — 활성 공식 표시 */}
            <div
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                fontSize: 11,
                background: "#fafafa",
                padding: 6,
                borderRadius: 4,
                lineHeight: 1.5,
                border: "1px solid #f0f0f0",
                marginBottom: 8,
              }}
            >
              <div>
                <Text strong style={{ fontSize: 11 }}>S</Text>
                {" = "}
                <Text style={{ fontSize: 11 }}>{activeFormula.display_text}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>= </Text>
                {formulaResult.error ? (
                  <Text type="danger" style={{ fontSize: 11 }}>
                    수식 오류: {formulaResult.error}
                  </Text>
                ) : (
                  <>
                    <Text
                      strong
                      style={{
                        fontSize: 11,
                        color:
                          formulaResult.color === "green" ? "#3f8600"
                          : formulaResult.color === "red" ? "#cf1322"
                          : undefined,
                      }}
                    >
                      {formulaResult.score >= 0 ? "+" : ""}{formulaResult.score.toFixed(1)}
                    </Text>
                    {activeFormula.id !== DEFAULT_FORMULA.id && (
                      <Text type="secondary" style={{ fontSize: 10, marginLeft: 6 }}>
                        (기본 공식 {summary.score >= 0 ? "+" : ""}{summary.score.toFixed(1)})
                      </Text>
                    )}
                  </>
                )}
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>
                  {activeFormula.description || "임계: |S|>20 → 긍정/부정, 외 → 중립"}
                </Text>
              </div>
              {!loggedIn && (
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    · 로그인하면 직접 공식을 만들어 저장할 수 있습니다.
                  </Text>
                </div>
              )}
            </div>

            {/* 컴팩트 인라인 가중치 — 카테고리당 1줄 */}
            <Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
              지표별 가중치 wᵢ
            </Text>
            {SECTIONS.map((section) => {
              const sectionShort = section.title.replace(/^\d+\.\s/, "").replace(" 지표", "");
              return (
                <div
                  key={section.title}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    alignItems: "center",
                    marginBottom: 3,
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 11, minWidth: 38, fontWeight: 600 }}>
                    {sectionShort}
                  </Text>
                  {section.items.map((item) => {
                    const noData = !item.seriesId;
                    const enabled = itemEnabled[item.name] ?? true;
                    const dimmed = noData || !enabled;
                    const shortName = item.seriesId
                      ? (item.seriesId.length > 7 ? item.seriesId.slice(0, 6) + "…" : item.seriesId)
                      : (item.name.split(/[\s(]/)[0].slice(0, 6));
                    const tooltip =
                      item.name
                      + (noData ? " (FRED 미제공)" : "")
                      + (!enabled && !noData ? " (OFF)" : "");
                    return (
                      <Tooltip key={item.name} title={tooltip}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                            opacity: dimmed ? 0.4 : 1,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
                            {shortName}
                          </Text>
                          <WeightInput
                            value={weights[item.name] ?? 50}
                            onChange={(v) => setWeight(item.name, v)}
                            style={{ width: 35 }}
                          />
                        </span>
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}

            {/* 7. 개별 종목 지표 가중치 행 — 종목 선택 시 표시 */}
            {selectedStock && (
              <>
                <Divider style={{ margin: "4px 0" }} />
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    alignItems: "center",
                    marginBottom: 3,
                  }}
                >
                  <Tooltip title={`${selectedStock.ticker} 개별 종목 지표`}>
                    <Text
                      type="secondary"
                      style={{ fontSize: 11, minWidth: 38, fontWeight: 600, color: "#1677ff" }}
                    >
                      종목
                    </Text>
                  </Tooltip>
                  {STOCK_INDICATORS.map((it) => {
                    const hasData = !stockLoading && !!stockData?.[it.key];
                    const enabled = stockItemEnabled[it.name] ?? true;
                    const dimmed = !hasData || !enabled;
                    const sig = stockData?.[it.key]?.signal;
                    const sigColor =
                      sig === "bullish" ? "#3f8600"
                      : sig === "bearish" ? "#cf1322"
                      : "rgba(0,0,0,0.45)";
                    const tooltip =
                      `${it.name} (${selectedStock.ticker})`
                      + (!hasData && !stockLoading ? " — 데이터 없음" : "")
                      + (stockLoading ? " — 로딩 중" : "")
                      + (!enabled && hasData ? " (OFF)" : "")
                      + (sig ? ` · ${SIGNAL_META[sig]?.label ?? ""}` : "");
                    return (
                      <Tooltip key={it.name} title={tooltip}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 2,
                            opacity: dimmed ? 0.4 : 1,
                            cursor: hasData ? "pointer" : "default",
                          }}
                          onClick={() => hasData && setStockItemOn(it.name, !enabled)}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontFamily: "ui-monospace, monospace",
                              color: hasData && enabled ? sigColor : undefined,
                              fontWeight: hasData && enabled ? 700 : 400,
                            }}
                          >
                            {it.shortName}
                          </Text>
                          <WeightInput
                            value={stockWeights[it.name] ?? 50}
                            onChange={(v) => setStockWeight(it.name, v)}
                            style={{ width: 35 }}
                          />
                        </span>
                      </Tooltip>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      {loading && (
        <div style={{ textAlign: "center", padding: 16 }}>
          <Spin tip="FRED 데이터 로딩 중..."><div style={{ minHeight: 40 }} /></Spin>
        </div>
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          message="데이터 로드 오류"
          description={`${error} — vite.config.js 의 /fredapi 프록시 설정을 확인하세요.`}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ===== 섹터별 시그널 — 3줄 그리드 ===== */}
      {sectorBreakdown.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 6 }}>
            <Text strong style={{ fontSize: 13 }}>섹터별 시그널 </Text>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.ceil((sectorBreakdown.length + 1) / 2)}, 1fr)`,
              gap: 6,
            }}
          >
            {/* ── 전체 시장 카드 (맨 앞) ── */}
            {(() => {
              const borderTopColor =
                marketFormulaResult.color === "green" ? "#52c41a"
                : marketFormulaResult.color === "red" ? "#ff4d4f" : "#faad14";
              return (
                <div
                  key="__market__"
                  style={{
                    padding: "6px 8px",
                    border: `1px solid ${marketFormulaResult.color === "green" ? "#b7eb8f" : marketFormulaResult.color === "red" ? "#ffa39e" : "#d9d9d9"}`,
                    borderTop: `3px solid ${borderTopColor}`,
                    borderRadius: 4,
                    background: "#f0f5ff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4, marginBottom: 5 }}>
                    <Tooltip title={`전체 시장 (매크로 지표 기반)`}>
                      <Tag color="geekblue" style={{ marginRight: 0, fontSize: 10, cursor: "default" }}>
                        ALL
                      </Tag>
                    </Tooltip>
                    <Tag color={marketFormulaResult.color} style={{ marginRight: 0, fontSize: 11, fontWeight: 700 }}>
                      {marketFormulaResult.score >= 0 ? "+" : ""}{marketFormulaResult.score.toFixed(0)}
                    </Tag>
                  </div>
                  <Select
                    size="small"
                    value={marketFormulaId}
                    onChange={v => setMarketFormulaId(v)}
                    style={{ width: "100%", fontSize: 10 }}
                    options={[
                      { value: DEFAULT_FORMULA.id, label: DEFAULT_FORMULA.name },
                      ...userFormulas.map(f => ({ value: f.id, label: f.name })),
                    ]}
                  />
                </div>
              );
            })()}

            {sectorBreakdown.map((s) => {
              const fr = sectorFormulaResults[s.sector] || { score: s.score, color: s.color };
              const fid = sectorFormulaIds[s.sector] || DEFAULT_FORMULA.id;
              const borderTopColor =
                fr.color === "green" ? "#52c41a"
                : fr.color === "red" ? "#ff4d4f" : "#faad14";
              return (
                <div
                  key={s.sector}
                  style={{
                    padding: "6px 8px",
                    border: `1px solid ${fr.color === "green" ? "#b7eb8f" : fr.color === "red" ? "#ffa39e" : "#d9d9d9"}`,
                    borderTop: `3px solid ${borderTopColor}`,
                    borderRadius: 4,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4, marginBottom: 5 }}>
                    <Tooltip title={`${s.sector} (${s.count}종목)`}>
                      <Tag
                        color={SECTOR_COLOR[s.sector] || "default"}
                        style={{ marginRight: 0, fontSize: 10, cursor: "default" }}
                      >
                        {SECTOR_ABBR[s.sector] || "ETC"}
                      </Tag>
                    </Tooltip>
                    <Tag color={fr.color} style={{ marginRight: 0, fontSize: 11, fontWeight: 700 }}>
                      {fr.score >= 0 ? "+" : ""}{fr.score.toFixed(0)}
                    </Tag>
                  </div>
                  <Select
                    size="small"
                    value={fid}
                    onChange={v => setSectorFormulaId(s.sector, v)}
                    style={{ width: "100%", fontSize: 10 }}
                    options={[
                      { value: DEFAULT_FORMULA.id, label: DEFAULT_FORMULA.name },
                      ...userFormulas.map(f => ({ value: f.id, label: f.name })),
                    ]}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {SECTIONS.map((section) => (
        <Card
          key={section.title}
          size="small"
          title={<span style={{ fontWeight: 600 }}>{section.title}</span>}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={[12, 12]}>
            {section.items.map((item) => {
              const r = item.seriesId ? results[item.seriesId] : null;
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={item.name}>
                  <IndicatorCard
                    item={item}                      current={r?.current ?? null}
                    prevQ={r?.prevQ ?? null}
                    prevY={r?.prevY ?? null}
                    weight={weights[item.name] ?? 50}
                    onWeightChange={setWeight}
                    enabled={itemEnabled[item.name] ?? true}
                    onToggle={setItemOn}
                  />
                </Col>
              );
            })}
          </Row>
        </Card>
      ))}

      <Card
        size="small"
        title={
          <Space>
            <AppstoreOutlined />
            <span>7. 개별 종목 지표</span>
            {selectedStock && (
              <Tag color={SECTOR_COLOR[selectedStock.sector] || "blue"} style={{ marginLeft: 4 }}>
                {selectedStock.ticker}
              </Tag>
            )}
            {stockLoading && <LoadingOutlined style={{ color: "#1677ff" }} />}
          </Space>
        }
      >
        {/* 종목 미선택 상태 */}
        {!selectedStock && (
          <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(0,0,0,0.35)" }}>
            <AppstoreOutlined style={{ fontSize: 28, marginBottom: 8 }} />
            <div>상단 셀렉터에서 NDX 100 종목을 선택하면</div>
            <div>이동평균선 · 거래강도 · Put/Call Ratio · 신고가/신저가를 분석합니다.</div>
          </div>
        )}

        {/* 로딩 */}
        {selectedStock && stockLoading && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Spin tip={`${selectedStock.ticker} 지표 분석 중... (최초 1회 DB 수집 포함)`}>
              <div style={{ minHeight: 40 }} />
            </Spin>
          </div>
        )}

        {/* 에러 */}
        {selectedStock && !stockLoading && stockError && (
          <Alert type="error" showIcon
            message={`${selectedStock.ticker} 데이터 로드 실패`}
            description={stockError}
          />
        )}

        {/* 실데이터 카드 */}
        {selectedStock && !stockLoading && stockData && (
          <>
            {/* 종합 시그널 배너 */}
            <div style={{
              marginBottom: 12,
              padding: "8px 12px",
              borderRadius: 6,
              background: stockData.overall.signal === "bullish" ? "#f6ffed"
                : stockData.overall.signal === "bearish" ? "#fff1f0" : "#fafafa",
              border: `1px solid ${
                stockData.overall.signal === "bullish" ? "#b7eb8f"
                : stockData.overall.signal === "bearish" ? "#ffa39e" : "#e0e0e0"
              }`,
              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            }}>
              <Text strong>{selectedStock.ticker}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>종가 ${stockData.price?.close?.toFixed(2)}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>기준일: {stockData.last_date}</Text>
              <Tag color={
                stockData.overall.signal === "bullish" ? "green"
                : stockData.overall.signal === "bearish" ? "red" : "default"
              }>
                종합 {stockData.overall.signal === "bullish" ? "긍정 (Risk-On)"
                  : stockData.overall.signal === "bearish" ? "부정 (Risk-Off)" : "중립"}
              </Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>
                긍정 {stockData.overall.counts.bullish} / 부정 {stockData.overall.counts.bearish} / 중립 {stockData.overall.counts.neutral}
              </Text>
            </div>

            <Row gutter={[12, 12]}>
              {/* 1) 이동평균선 */}
              <Col xs={24} sm={12} md={6}>
                <StockCard
                  title="이동평균선"
                  subtitle="5 / 20 / 60 / 120일"
                  signal={stockItemEnabled["이동평균선"] ? stockData.ma?.signal : "neutral"}
                  note={stockData.ma?.aligned ? "✅ 완전 정배열" : "⚠ 정배열 아님"}
                  extra={
                    <Tooltip title={stockItemEnabled["이동평균선"] ? "종합시그널 반영 ON" : "종합시그널 미반영"}>
                      <Switch size="small" checked={stockItemEnabled["이동평균선"] ?? true}
                        onChange={(v) => setStockItemOn("이동평균선", v)} />
                    </Tooltip>
                  }
                >
                  {stockData.ma ? (
                    <div style={{ fontSize: 12 }}>
                      {[
                        { label: "MA5",  val: stockData.ma.ma5 },
                        { label: "MA20", val: stockData.ma.ma20 },
                        { label: "MA60", val: stockData.ma.ma60 },
                        { label: "MA120",val: stockData.ma.ma120 },
                      ].map(({ label, val }) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>{label}</Text>
                          <Text style={{ fontSize: 11, fontWeight: 600 }}>${val?.toFixed(2)}</Text>
                        </div>
                      ))}
                      <Divider style={{ margin: "6px 0" }} />
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>MA20 이격도</Text>
                        <Text style={{
                          fontSize: 11, fontWeight: 600,
                          color: stockData.ma.pct_from_ma20 > 0 ? "#3f8600" : "#cf1322",
                        }}>
                          {stockData.ma.pct_from_ma20 > 0 ? "+" : ""}{stockData.ma.pct_from_ma20?.toFixed(2)}%
                        </Text>
                      </div>
                      <StockSparkline
                        history={stockData.ma.history}
                        yKey="close"
                        color="#1677ff"
                      />
                    </div>
                  ) : <Text type="secondary" style={{ fontSize: 11 }}>데이터 없음</Text>}
                </StockCard>
              </Col>

              {/* 2) 거래강도 */}
              <Col xs={24} sm={12} md={6}>
                <StockCard
                  title="거래강도"
                  subtitle="거래량 회전율 / OBV"
                  signal={stockItemEnabled["거래강도"] ? stockData.volume?.signal : "neutral"}
                  note={`거래량 비율 ${stockData.volume?.vol_ratio?.toFixed(2)}x`}
                  extra={
                    <Tooltip title={stockItemEnabled["거래강도"] ? "종합시그널 반영 ON" : "종합시그널 미반영"}>
                      <Switch size="small" checked={stockItemEnabled["거래강도"] ?? true}
                        onChange={(v) => setStockItemOn("거래강도", v)} />
                    </Tooltip>
                  }
                >
                  {stockData.volume ? (
                    <div style={{ fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>당일 거래량</Text>
                        <Text style={{ fontSize: 11, fontWeight: 600 }}>
                          {(stockData.volume.current_vol / 1e6).toFixed(1)}M
                        </Text>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>20일 평균</Text>
                        <Text style={{ fontSize: 11, fontWeight: 600 }}>
                          {(stockData.volume.avg_vol_20 / 1e6).toFixed(1)}M
                        </Text>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>거래량 비율</Text>
                        <Text style={{
                          fontSize: 11, fontWeight: 600,
                          color: stockData.volume.vol_ratio >= 1.2 ? "#3f8600" : "rgba(0,0,0,0.65)",
                        }}>
                          {stockData.volume.vol_ratio?.toFixed(2)}x
                        </Text>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>OBV 5일 기울기</Text>
                        <Text style={{
                          fontSize: 11, fontWeight: 600,
                          color: stockData.volume.obv_slope_5d > 0 ? "#3f8600" : "#cf1322",
                        }}>
                          {stockData.volume.obv_slope_5d > 0 ? "↑" : "↓"}
                        </Text>
                      </div>
                      <Progress
                        percent={Math.min(100, (stockData.volume.vol_ratio || 0) * 50)}
                        size="small"
                        strokeColor={stockData.volume.vol_ratio >= 1.2 ? "#52c41a" : "#1677ff"}
                        showInfo={false}
                        style={{ marginTop: 8 }}
                      />
                      
                      <StockSparkline
                        history={stockData.volume.history}
                        yKey="vol_ratio"
                        color="#722ed1"
                        baseline={1}
                      />
                    </div>
                  ) : <Text type="secondary" style={{ fontSize: 11 }}>데이터 없음</Text>}
                </StockCard>
              </Col>

              {/* 3) Put/Call Ratio */}
              <Col xs={24} sm={12} md={6}>
                <StockCard
                  title="Put/Call Ratio"
                  subtitle="CBOE 옵션 거래 비율"
                  signal={stockItemEnabled["P/C Ratio"] ? stockData.put_call?.signal : "neutral"}
                  note={stockData.put_call?.note}
                  extra={
                    <Tooltip title={stockItemEnabled["P/C Ratio"] ? "종합시그널 반영 ON" : "종합시그널 미반영"}>
                      <Switch size="small" checked={stockItemEnabled["P/C Ratio"] ?? true}
                        onChange={(v) => setStockItemOn("P/C Ratio", v)} />
                    </Tooltip>
                  }
                >
                  {stockData.put_call?.ratio != null ? (
                    <div>
                      <Statistic
                        value={stockData.put_call.ratio.toFixed(3)}
                        valueStyle={{
                          fontSize: 22, fontWeight: 700,
                          color: stockData.put_call.ratio < 0.7 ? "#3f8600"
                            : stockData.put_call.ratio > 1.0 ? "#cf1322" : "rgba(0,0,0,0.65)",
                        }}
                      />
                      <div style={{ marginTop: 4, fontSize: 11 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>Call 총 거래량</Text>
                          <Text style={{ fontSize: 11, fontWeight: 600 }}>
                            {(stockData.put_call.total_calls / 1e3).toFixed(1)}K
                          </Text>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>Put 총 거래량</Text>
                          <Text style={{ fontSize: 11, fontWeight: 600 }}>
                            {(stockData.put_call.total_puts / 1e3).toFixed(1)}K
                          </Text>
                        </div>
                      </div>
                      <Divider style={{ margin: "8px 0" }} />
                      <div style={{ fontSize: 10, color: "rgba(0,0,0,0.45)" }}>
                        <div>· P/C &lt; 0.7 → Call 우세 → 긍정</div>
                        <div>· P/C &gt; 1.0 → Put 우세 → 부정</div>
                      </div>
                      <Progress
                        percent={Math.min(100, (stockData.put_call.ratio || 0) * 60)}
                        size="small"
                        strokeColor={
                          stockData.put_call.ratio < 0.7 ? "#52c41a"
                          : stockData.put_call.ratio > 1.0 ? "#ff4d4f" : "#faad14"
                        }
                        showInfo={false}
                        style={{ marginTop: 8 }}
                      />
                    </div>
                  ) : (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {stockData.put_call?.note || "옵션 데이터 없음"}
                      </Text>
                    </div>
                  )}
                </StockCard>
              </Col>

              {/* 4) 신고가/신저가 비율 */}
              <Col xs={24} sm={12} md={6}>
                <StockCard
                  title="신고가/신저가 위치"
                  subtitle="52주 고저 상대 위치"
                  signal={stockData.high_low?.signal}
                  note={`52W 레인지 내 ${stockData.high_low?.position_pct?.toFixed(1)}% 위치`}
                >
                  {stockData.high_low ? (
                    <div style={{ fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>52W 최고</Text>
                        <Text style={{ fontSize: 11, fontWeight: 600, color: "#3f8600" }}>
                          ${stockData.high_low.week52_high?.toFixed(2)}
                        </Text>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>현재가</Text>
                        <Text style={{ fontSize: 11, fontWeight: 700 }}>
                          ${stockData.high_low.close?.toFixed(2)}
                        </Text>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>52W 최저</Text>
                        <Text style={{ fontSize: 11, fontWeight: 600, color: "#cf1322" }}>
                          ${stockData.high_low.week52_low?.toFixed(2)}
                        </Text>
                      </div>
                      <Progress
                        percent={stockData.high_low.position_pct}
                        size="small"
                        strokeColor={
                          stockData.high_low.position_pct >= 70 ? "#52c41a"
                          : stockData.high_low.position_pct <= 30 ? "#ff4d4f" : "#faad14"
                        }
                        showInfo={false}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 10 }}>저가 기준 +{stockData.high_low.pct_from_low?.toFixed(1)}%</Text>
                        <Text type="secondary" style={{ fontSize: 10 }}>고가 기준 {stockData.high_low.pct_from_high?.toFixed(1)}%</Text>
                      </div>
                      <Divider style={{ margin: "6px 0" }} />
                      <div style={{ fontSize: 10, color: "rgba(0,0,0,0.45)" }}>
                        <div>· 70% 이상 → 강세 구간 → 긍정</div>
                        <div>· 30% 이하 → 약세 구간 → 부정</div>
                      </div>
                    </div>
                  ) : <Text type="secondary" style={{ fontSize: 11 }}>데이터 없음</Text>}
                </StockCard>
              </Col>
            </Row>
          </>
        )}
      </Card>

      {/* ===== 사용자 정의 공식 빌더 모달 (1단계) ===== */}
      <FormulaBuilder
        open={builderOpen}
        initial={builderInitial}
        onCancel={() => setBuilderOpen(false)}
        onSaved={handleSaved}
        summary={summary}
        scope={{
          weights: { ...weights, ...stockWeights },
          signals: (() => {
            const sigs = {};
            SECTIONS.forEach((sec) =>
              sec.items.forEach((it) => {
                if (!it.seriesId) return;
                const r = results[it.seriesId];
                if (!r?.current || !r?.prevQ) return;
                sigs[it.name] = computeSignal(it, r.current, r.prevQ);
              })
            );
            if (stockData) {
              STOCK_INDICATORS.forEach((it) => {
                const sig = stockData[it.key]?.signal;
                if (sig) sigs[it.name] = sig;
              });
            }
            return sigs;
          })(),
        }}
      />
    </div>
  );
}
