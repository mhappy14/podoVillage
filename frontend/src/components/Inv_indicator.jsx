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
} from "antd";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  InfoCircleOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import Column from "antd/es/table/Column";

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
// · CORS: vite.config.js 의 `/fredapi` 프록시 경유
// =====================================================================

const FRED_API_KEY = "6335426c3b0d7423815d6ca3068b1a7f";
const FRED_BASE = "/fredapi/fred";

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

// ---------- 지표 정의 ----------
const SECTIONS = [
  {
    title: "1. 금리 지표",
    items: [
      { name: "연준 기준금리 (Fed Funds Upper)", seriesId: "DFEDTARU", unit: "%", interpret: "lower-bullish" },
      { name: "미 국채 10년물 금리", seriesId: "DGS10", unit: "%", interpret: "lower-bullish" },
      { name: "장단기 금리차 (10Y-2Y)", seriesId: "T10Y2Y", unit: "%p", interpret: "higher-bullish" },
      { name: "실질금리 (10Y TIPS)", seriesId: "DFII10", unit: "%", interpret: "lower-bullish" },
    ],
  },
  {
    title: "2. 시장 지표",
    items: [
      { name: "SIFMA 채권 발행 통계", seriesId: null, unit: "$B", interpret: "higher-bullish",
        note: "SIFMA 자체 발표 — FRED 미제공" },
      { name: "TIC 데이터 (해외 자금흐름)", seriesId: null, unit: "$B", interpret: "higher-bullish",
        note: "美 재무부 TIC — FRED 미제공" },
      { name: "MOVE 지수 (채권 변동성)", seriesId: null, unit: "index", interpret: "lower-bullish",
        note: "ICE BofA MOVE — 라이선스 데이터, FRED 미제공" },
      { name: "COT 리포트 (포지셔닝)", seriesId: null, unit: "계약", interpret: "higher-bullish",
        note: "CFTC 발표 — FRED 미제공" },
    ],
  },
  {
    title: "3. 유동성 지표",
    items: [
      { name: "M2 통화량", seriesId: "M2SL", unit: "$B", interpret: "higher-bullish" },
      { name: "연준 순유동성 (Net Liquidity)", seriesId: null, unit: "$B", interpret: "higher-bullish",
        note: "WALCL − WTREGEN − RRPONTSYD 직접 계산 필요" },
      { name: "SOFR 금리", seriesId: "SOFR", unit: "%", interpret: "lower-bullish" },
      { name: "달러 인덱스 (Broad USD)", seriesId: "DTWEXBGS", unit: "index", interpret: "lower-bullish",
        note: "정통 DXY는 ICE 라이선스 — FRED는 광역지수만" },
    ],
  },
  {
    title: "4. 경기 지표",
    items: [
      { name: "소비자물가지수 (CPI)", seriesId: "CPIAUCSL", unit: "index", interpret: "lower-bullish" },
      { name: "ISM 제조업 PMI", seriesId: null, unit: "index", interpret: "higher-bullish",
        note: "ISM 라이선스 — FRED 미제공" },
      { name: "ISM 서비스업 PMI", seriesId: null, unit: "index", interpret: "higher-bullish",
        note: "ISM 라이선스 — FRED 미제공" },
      { name: "금 가격 (London PM Fix)", seriesId: "GOLDAMGBD228NLBM", unit: "$/oz", interpret: "higher-bullish" },
      { name: "구리 가격 (Dr. Copper)", seriesId: "PCOPPUSDM", unit: "$/MT", interpret: "higher-bullish" },
      { name: "반도체 사이클 (SOX)", seriesId: null, unit: "index", interpret: "higher-bullish",
        note: "Philadelphia SOX — Nasdaq 데이터, FRED 미제공" },
    ],
  },
  {
    title: "5. 신용 지표",
    items: [
      { name: "하이일드 스프레드 (BofA)", seriesId: "BAMLH0A0HYM2", unit: "%", interpret: "lower-bullish" },
      { name: "SLOOS 대출 태도 (C&I)", seriesId: "DRTSCILM", unit: "%", interpret: "lower-bullish",
        note: "값 낮을수록 대출 완화 → 호재" },
    ],
  },
  {
    title: "6. 심리 지표",
    items: [
      { name: "VIX 지수 (공포 지수)", seriesId: "VIXCLS", unit: "index", interpret: "lower-bullish" },
      { name: "주식/채권 상대강도 (SPY/TLT)", seriesId: null, unit: "ratio", interpret: "higher-bullish",
        note: "ETF 가격 — FRED 미제공" },
      { name: "EPFR / ICI 펀드 플로우", seriesId: null, unit: "$B", interpret: "higher-bullish",
        note: "상업/협회 데이터 — FRED 미제공" },
    ],
  },
];

const STOCK_LEVEL_PLACEHOLDERS = [
  { name: "이동평균선 (5/20/60/120일)", note: "정배열·이격도" },
  { name: "거래강도 (Volume Strength)", note: "거래량 회전율 / OBV" },
  { name: "Put/Call Ratio", note: "CBOE 옵션 거래 비율" },
  { name: "신고가/신저가 비율", note: "52W High vs Low Ratio" },
];

// 백엔드 미구현 시 사용할 fallback. 운영 시 /invest/ndx100/ 엔드포인트가 우선.
// 섹터는 GICS 분류 (TradingView 히트맵 grouping:"sector" 와 동일 체계)
const SECTOR_COLOR = {
  "Information Technology": "blue",
  "Communication Services": "geekblue",
  "Consumer Discretionary": "purple",
  "Consumer Staples": "magenta",
  "Health Care": "cyan",
  "Industrials": "gold",
  "Utilities": "lime",
  "Energy": "orange",
  "Materials": "volcano",
  "Financials": "green",
};
// 셀렉터 옵션 앞에 표시할 영어 약자 (가독성용)
const SECTOR_ABBR = {
  "Information Technology": "IT",
  "Communication Services": "COMM",
  "Consumer Discretionary": "DISC",
  "Consumer Staples": "STAP",
  "Health Care": "HC",
  "Industrials": "IND",
  "Utilities": "UTIL",
  "Energy": "ENGY",
  "Materials": "MAT",
  "Financials": "FIN",
};
const NDX100_FALLBACK = [
  ["AAPL", "Apple", "Information Technology"], ["MSFT", "Microsoft", "Information Technology"],
  ["NVDA", "Nvidia", "Information Technology"], ["AMZN", "Amazon", "Consumer Discretionary"],
  ["GOOGL", "Alphabet A", "Communication Services"], ["GOOG", "Alphabet C", "Communication Services"],
  ["META", "Meta Platforms", "Communication Services"], ["AVGO", "Broadcom", "Information Technology"],
  ["TSLA", "Tesla", "Consumer Discretionary"], ["COST", "Costco", "Consumer Staples"],
  ["NFLX", "Netflix", "Communication Services"], ["ADBE", "Adobe", "Information Technology"],
  ["AMD", "Advanced Micro Devices", "Information Technology"], ["CSCO", "Cisco", "Information Technology"],
  ["PEP", "PepsiCo", "Consumer Staples"], ["TMUS", "T-Mobile", "Communication Services"],
  ["INTU", "Intuit", "Information Technology"], ["AMGN", "Amgen", "Health Care"],
  ["TXN", "Texas Instruments", "Information Technology"], ["QCOM", "Qualcomm", "Information Technology"],
  ["ISRG", "Intuitive Surgical", "Health Care"], ["AMAT", "Applied Materials", "Information Technology"],
  ["BKNG", "Booking Holdings", "Consumer Discretionary"], ["HON", "Honeywell", "Industrials"],
  ["CMCSA", "Comcast", "Communication Services"], ["VRTX", "Vertex Pharmaceuticals", "Health Care"],
  ["SBUX", "Starbucks", "Consumer Discretionary"], ["GILD", "Gilead Sciences", "Health Care"],
  ["MU", "Micron", "Information Technology"], ["LRCX", "Lam Research", "Information Technology"],
  ["ADI", "Analog Devices", "Information Technology"], ["MDLZ", "Mondelez", "Consumer Staples"],
  ["INTC", "Intel", "Information Technology"], ["REGN", "Regeneron", "Health Care"],
  ["ADP", "ADP", "Industrials"], ["KLAC", "KLA", "Information Technology"],
  ["PANW", "Palo Alto Networks", "Information Technology"], ["SNPS", "Synopsys", "Information Technology"],
  ["CDNS", "Cadence", "Information Technology"], ["ABNB", "Airbnb", "Consumer Discretionary"],
  ["CRWD", "CrowdStrike", "Information Technology"], ["MELI", "MercadoLibre", "Consumer Discretionary"],
  ["MAR", "Marriott", "Consumer Discretionary"], ["FTNT", "Fortinet", "Information Technology"],
  ["ORLY", "O'Reilly Automotive", "Consumer Discretionary"], ["ASML", "ASML", "Information Technology"],
  ["ROP", "Roper", "Industrials"], ["MRVL", "Marvell", "Information Technology"],
  ["DASH", "DoorDash", "Consumer Discretionary"], ["NXPI", "NXP", "Information Technology"],
  ["PCAR", "PACCAR", "Industrials"], ["CTAS", "Cintas", "Industrials"],
  ["ADSK", "Autodesk", "Information Technology"], ["MNST", "Monster Beverage", "Consumer Staples"],
  ["AEP", "American Electric Power", "Utilities"], ["CHTR", "Charter", "Communication Services"],
  ["MCHP", "Microchip", "Information Technology"], ["WDAY", "Workday", "Information Technology"],
  ["AZN", "AstraZeneca", "Health Care"], ["PYPL", "PayPal", "Financials"],
  ["KDP", "Keurig Dr Pepper", "Consumer Staples"], ["CPRT", "Copart", "Industrials"],
  ["EXC", "Exelon", "Utilities"], ["IDXX", "IDEXX", "Health Care"],
  ["DDOG", "Datadog", "Information Technology"], ["CSGP", "CoStar Group", "Industrials"],
  ["ROST", "Ross Stores", "Consumer Discretionary"], ["FANG", "Diamondback Energy", "Energy"],
  ["FAST", "Fastenal", "Industrials"], ["GEHC", "GE HealthCare", "Health Care"],
  ["KHC", "Kraft Heinz", "Consumer Staples"], ["BKR", "Baker Hughes", "Energy"],
  ["CCEP", "Coca-Cola Europacific", "Consumer Staples"], ["ODFL", "Old Dominion", "Industrials"],
  ["ON", "ON Semiconductor", "Information Technology"], ["PAYX", "Paychex", "Industrials"],
  ["EA", "Electronic Arts", "Communication Services"], ["VRSK", "Verisk", "Industrials"],
  ["BIIB", "Biogen", "Health Care"], ["XEL", "Xcel Energy", "Utilities"],
  ["ZS", "Zscaler", "Information Technology"], ["ANSS", "Ansys", "Information Technology"],
  ["CTSH", "Cognizant", "Information Technology"], ["CDW", "CDW", "Information Technology"],
  ["TTD", "The Trade Desk", "Information Technology"], ["LULU", "Lululemon", "Consumer Discretionary"],
  ["GFS", "GlobalFoundries", "Information Technology"], ["DXCM", "DexCom", "Health Care"],
  ["MDB", "MongoDB", "Information Technology"], ["ARM", "Arm Holdings", "Information Technology"],
  ["WBD", "Warner Bros Discovery", "Communication Services"], ["TEAM", "Atlassian", "Information Technology"],
  ["DLTR", "Dollar Tree", "Consumer Discretionary"], ["LIN", "Linde", "Materials"],
  ["PDD", "PDD Holdings", "Consumer Discretionary"], ["PLTR", "Palantir", "Information Technology"],
  ["APP", "AppLovin", "Information Technology"], ["MSTR", "MicroStrategy", "Information Technology"],
  ["CEG", "Constellation Energy", "Utilities"], ["TTWO", "Take-Two", "Communication Services"],
  ["CSX", "CSX", "Industrials"], ["ALGN", "Align Technology", "Health Care"],
].map(([ticker, name, sector]) => ({ ticker, name, sector }));

// ---------- FRED 호출 ----------
async function fetchFredAt(seriesId, endDate) {
  try {
    const { data } = await axios.get(`${FRED_BASE}/series/observations`, {
      params: {
        series_id: seriesId,
        api_key: FRED_API_KEY,
        file_type: "json",
        sort_order: "desc",
        observation_end: fmt(endDate),
        limit: 60,
      },
      timeout: 15000,
    });
    const obs = (data?.observations || []).find((o) => o.value && o.value !== ".");
    return obs ? { date: obs.date, value: parseFloat(obs.value) } : null;
  } catch (e) {
    console.warn(`[FRED] ${seriesId} @ ${fmt(endDate)} 실패:`, e?.message);
    return null;
  }
}

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
        height: 20,
        background: "#f0f2f5",
        borderRadius: 10,
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
          fontSize: 11,
          fontWeight: 600,
          color: pct > 45 ? "#fff" : "rgba(0,0,0,0.65)",
          pointerEvents: "none",
        }}
      >
        가중치 {value}
      </div>
    </div>
  );
}

// ---------- 지표 카드 ----------
function IndicatorCard({ item, current, prevQ, prevY, weight, onWeightChange, enabled, onToggle }) {
  const noData = !item.seriesId;
  const sigQ = computeSignal(item, current, prevQ);
  const meta = SIGNAL_META[sigQ];
  const qoq = current && prevQ ? current.value - prevQ.value : null;
  const yoy = current && prevY ? current.value - prevY.value : null;
  const effectiveOpacity = noData ? 0.55 : enabled ? 1 : 0.6;

  return (
    <Card
      size="small"
      style={{ height: "100%", opacity: effectiveOpacity }}
      styles={{ body: { padding: 14 } }}
    >
      {/* 상단: 이름 + 우상단 토글 스위치 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <Text strong style={{ fontSize: 13, lineHeight: 1.3, flex: 1 }}>
          {item.name}
        </Text>
        {!noData && (
          <Tooltip title={enabled ? "종합시그널 반영 ON — 끄려면 클릭" : "종합시그널 미반영 — 켜려면 클릭"}>
            <Switch size="small" checked={enabled} onChange={(v) => onToggle(item.name, v)} />
          </Tooltip>
        )}
      </div>

      {/* 두 번째 줄: FRED 코드 (좌) + 시그널 Tag (우) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, minHeight: 20 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {item.seriesId ? `FRED: ${item.seriesId}` : ""}
        </Text>
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
          <Statistic
            value={current ? formatValue(current.value) : "—"}
            suffix={<Text type="secondary" style={{ fontSize: 12 }}>{item.unit}</Text>}
            valueStyle={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            관측일: {current?.date || "데이터 없음"}
          </Text>
          <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Text style={{ color: deltaColor(qoq), fontWeight: 600, fontSize: 12 }}>
              QoQ {formatDelta(qoq)}
              {prevQ && (
                <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>
                  ({formatValue(prevQ.value)})
                </Text>
              )}
            </Text>
            <Text style={{ color: deltaColor(yoy), fontWeight: 600, fontSize: 12 }}>
              YoY {formatDelta(yoy)}
              {prevY && (
                <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>
                  ({formatValue(prevY.value)})
                </Text>
              )}
            </Text>
            {item.note && (
              <Tooltip title={item.note}>
                <InfoCircleOutlined style={{ color: "rgba(0,0,0,0.45)" }} />
              </Tooltip>
            )}
          </div>
        </div>
      )}

      <WeightGauge value={weight} onChange={(v) => onWeightChange(item.name, v)} />
      {!noData && !enabled && (
        <Text type="secondary" style={{ fontSize: 10, fontStyle: "italic" }}>
          토글 OFF — 종합시그널 미반영
        </Text>
      )}
    </Card>
  );
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

  // FRED 데이터 호출 (현재 / 전 분기 / 전년 동분기)
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      const items = SECTIONS.flatMap((s) => s.items).filter((i) => i.seriesId);
      try {
        const entries = await Promise.all(
          items.map(async (item) => {
            const [cur, pq, py] = await Promise.all([
              fetchFredAt(item.seriesId, refDate),
              fetchFredAt(item.seriesId, prevQDate),
              fetchFredAt(item.seriesId, prevYDate),
            ]);
            return [item.seriesId, { current: cur, prevQ: pq, prevY: py }];
          })
        );
        if (!cancelled) setResults(Object.fromEntries(entries));
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
    const score = totalW ? ((bullW - bearW) / totalW) * 100 : 0;
    let bias = "중립";
    let color = "default";
    if (score > 20) { bias = "긍정 (Risk-On)"; color = "green"; }
    else if (score < -20) { bias = "부정 (Risk-Off)"; color = "red"; }
    const progressPct = Math.min(100, Math.max(0, (score + 100) / 2));
    return { bullW, bearW, neutW, totalW, count, score, bias, color, progressPct };
  }, [results, weights, itemEnabled]);

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
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              · 기준일: {quarterLabel(refDate)}
            </Text>
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              · QoQ: {quarterLabel(prevQDate)}
            </Text>
          </Col>
          <Col span={8}>
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

      {/* ===== 종합 시그널 — 가로 전체, 좌(전체 시장) / 우(선택 종목) ===== */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          borderColor:
            summary.color === "green" ? "#52c41a"
            : summary.color === "red" ? "#ff4d4f" : undefined,
        }}
        styles={{ body: { padding: 16 } }}
      >
        <Row gutter={[24, 16]}>
          {/* 좌측: 전체 시장 */}
          <Col xs={24} md={12} style={{ borderRight: "1px solid #f0f0f0" }}>
            <Text type="secondary" style={{ fontSize: 11, letterSpacing: 1 }}>
              전체 시장 종합 시그널 (가중평균)
            </Text>
            <Space align="center" style={{ marginTop: 6 }}>
              <Title level={2} style={{ margin: 0 }}>{summary.bias}</Title>
              <Tag color={summary.color} style={{ fontSize: 14, padding: "2px 8px" }}>
                {summary.score >= 0 ? "+" : ""}{summary.score.toFixed(0)}점
              </Tag>
            </Space>
            <Progress
              percent={summary.progressPct}
              showInfo={false}
              strokeColor={
                summary.color === "green" ? "#52c41a"
                : summary.color === "red" ? "#ff4d4f" : "#faad14"
              }
              style={{ marginTop: 6 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              집계 {summary.count}개 · 총 가중치 {summary.totalW}
              {" · "}긍정W {summary.bullW} / 부정W {summary.bearW} / 중립W {summary.neutW}
            </Text>
          </Col>

          {/* 우측: 선택 종목 */}
          <Col xs={24} md={12}>
            {selectedStock ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text type="secondary" style={{ fontSize: 11, letterSpacing: 1 }}>
                    {selectedLabel}
                  </Text>
                  {selectedSector && (
                    <Tag color={SECTOR_COLOR[selectedSector] || "default"} style={{ marginRight: 0 }}>
                      [{SECTOR_ABBR[selectedSector] || "ETC"}] {selectedSector}
                    </Tag>
                  )}
                </div>
                <Space align="center" style={{ marginTop: 6 }}>
                  <Title level={2} style={{ margin: 0 }}>{summary.bias}</Title>
                  <Tag color={summary.color} style={{ fontSize: 14, padding: "2px 8px" }}>
                    {summary.score >= 0 ? "+" : ""}{summary.score.toFixed(0)}점
                  </Tag>
                </Space>
                <Progress
                  percent={summary.progressPct}
                  showInfo={false}
                  strokeColor={
                    summary.color === "green" ? "#52c41a"
                    : summary.color === "red" ? "#ff4d4f" : "#faad14"
                  }
                  style={{ marginTop: 6 }}
                />
                <Text type="secondary" style={{ fontSize: 10 }}>
                  ※ 현재는 매크로 지표 기반 — 종목별 지표(MA, P/C 등) 추가 시 종목별 차별화
                </Text>
              </>
            ) : (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <Text type="secondary" style={{ fontSize: 11, letterSpacing: 1 }}>
                  선택 종목 시그널
                </Text>
                <Title level={3} type="secondary" style={{ margin: "6px 0 0 0", fontWeight: 400 }}>
                  종목 미선택
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  상단 셀렉터에서 NDX 100 종목을 선택하면 해당 종목 시그널이 여기에 표시됩니다.
                </Text>
              </div>
            )}
          </Col>
        </Row>
      </Card>

      {/* ===== 섹터별 시그널 — 한 줄(자동 wrap) ===== */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title={
          <span style={{ fontWeight: 600 }}>
            섹터별 시그널{" "}
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>
              (NDX 100 구성종목 기반 · {sectorBreakdown.length}개 섹터)
            </Text>
          </span>
        }
        styles={{ body: { padding: 12 } }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {sectorBreakdown.map((s) => (
            <div
              key={s.sector}
              style={{
                flex: "1 1 150px",
                minWidth: 140,
                maxWidth: 220,
                padding: "8px 10px",
                border: "1px solid #f0f0f0",
                borderLeft: `3px solid ${
                  s.color === "green" ? "#52c41a"
                  : s.color === "red" ? "#ff4d4f" : "#faad14"
                }`,
                borderRadius: 4,
                background: "#fafafa",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                <Tag color={SECTOR_COLOR[s.sector] || "default"} style={{ marginRight: 0, fontSize: 10 }}>
                  {SECTOR_ABBR[s.sector] || "ETC"}
                </Tag>
                <Tag color={s.color} style={{ marginRight: 0, fontSize: 11, fontWeight: 600 }}>
                  {s.score >= 0 ? "+" : ""}{s.score.toFixed(0)}
                </Tag>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.3 }}>
                <Text strong style={{ fontSize: 12 }}>{s.sector}</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 10 }}>
                {s.count}종목 · 비중 {s.weight.toFixed(1)}%
              </Text>
            </div>
          ))}
        </div>
      </Card>

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
                    item={item}                     current={r?.current ?? null}
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
            <span>7. 개별 종목 지표 (추후 작업 예정)</span>
          </Space>
        }
      >
        <Row gutter={[12, 12]}>
          {STOCK_LEVEL_PLACEHOLDERS.map(({ name, note }) => (
            <Col xs={24} sm={12} md={6} key={name}>
              <Card
                size="small"
                style={{ opacity: 0.6, height: "100%" }}
                styles={{ body: { padding: 14 } }}
              >
                <Text strong style={{ fontSize: 13 }}>{name}</Text>
                <Divider style={{ margin: "8px 0" }} />
                <Title level={5} style={{ margin: 0, color: "rgba(0,0,0,0.35)" }}>— (공란)</Title>
                <Text type="secondary" style={{ fontSize: 11 }}>{note}</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
