import React, { useEffect, useMemo, useState } from "react";
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
} from "antd";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  InfoCircleOutlined,
  BankOutlined,
  LineChartOutlined,
  GlobalOutlined,
  WarningOutlined,
  SmileOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

// =====================================================================
// 나스닥 100 분기 방향성 예측 지표 (FRED 데이터 기반)
// ---------------------------------------------------------------------
// · 매 분기 첫달 1일을 기준일로, 직전 분기 첫달 1일과 비교하여
//   각 지표의 변화 방향을 평가하고 종합 시그널을 산출
// · FRED 미제공 지표는 "공란"으로 표시
//   (ISM PMI, SOX, ETF 비율, EPFR 등은 라이선스/상업 데이터)
// · 개별 종목 지표 (이동평균선, 거래강도, P/C ratio, 신고가/신저가 비율)
//   는 추후 작업 예정이므로 placeholder 만 표시
//
// CORS 주의: FRED는 브라우저 직접 호출을 허용하지 않아
// vite.config.js 의 `/fredapi` 프록시를 경유함
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
// interpret:
//   "lower-bullish"  → 값이 낮아질수록 주식에 호재
//   "higher-bullish" → 값이 높아질수록 주식에 호재
const SECTIONS = [
  {
    title: "1. 금리 / 채권시장 지표",
    icon: <BankOutlined />,
    items: [
      { name: "미 국채 10년물 금리", seriesId: "DGS10", unit: "%", interpret: "lower-bullish" },
      { name: "장단기 금리차 (10Y-2Y)", seriesId: "T10Y2Y", unit: "%p", interpret: "higher-bullish" },
      { name: "실질금리 (10Y TIPS)", seriesId: "DFII10", unit: "%", interpret: "lower-bullish" },
      {
        name: "주식 대비 채권 수익률 (ERP)",
        seriesId: null,
        unit: "%",
        interpret: "higher-bullish",
        note: "FRED 미제공 — S&P 500 EY − 10Y TY 수동 계산 필요",
      },
    ],
  },
  {
    title: "2. 유동성 / 통화정책 지표",
    icon: <LineChartOutlined />,
    items: [
      { name: "M2 통화량", seriesId: "M2SL", unit: "$B", interpret: "higher-bullish" },
      {
        name: "연준 순유동성 (Net Liquidity)",
        seriesId: null,
        unit: "$B",
        interpret: "higher-bullish",
        note: "FRED 단일시리즈 없음 — WALCL − WTREGEN − RRPONTSYD 직접 계산 필요",
      },
      {
        name: "SOFR 금리",
        seriesId: "SOFR",
        unit: "%",
        interpret: "lower-bullish",
        note: "정확한 SOFR 스프레드(SOFR − IORB)는 별도 계산 필요",
      },
      {
        name: "달러 인덱스 (Broad USD)",
        seriesId: "DTWEXBGS",
        unit: "index",
        interpret: "lower-bullish",
        note: "정통 DXY는 ICE 데이터 — FRED는 광역 달러지수만 제공",
      },
    ],
  },
  {
    title: "3. 거시경제 / 실물경기 지표",
    icon: <GlobalOutlined />,
    items: [
      { name: "소비자물가지수 (CPI)", seriesId: "CPIAUCSL", unit: "index", interpret: "lower-bullish" },
      {
        name: "ISM 제조업 PMI",
        seriesId: null,
        unit: "index",
        interpret: "higher-bullish",
        note: "ISM 라이선스 데이터 — FRED 미제공",
      },
      {
        name: "ISM 서비스업 PMI",
        seriesId: null,
        unit: "index",
        interpret: "higher-bullish",
        note: "ISM 라이선스 데이터 — FRED 미제공",
      },
      { name: "구리 가격 (Dr. Copper)", seriesId: "PCOPPUSDM", unit: "$/MT", interpret: "higher-bullish" },
      {
        name: "반도체 사이클 (SOX)",
        seriesId: null,
        unit: "index",
        interpret: "higher-bullish",
        note: "Philadelphia SOX 지수 — FRED 미제공 (Nasdaq 데이터)",
      },
    ],
  },
  {
    title: "4. 신용 / 금융시스템 리스크 지표",
    icon: <WarningOutlined />,
    items: [
      { name: "하이일드 스프레드 (BofA)", seriesId: "BAMLH0A0HYM2", unit: "%", interpret: "lower-bullish" },
      {
        name: "SLOOS 대출 태도 (C&I, Large/Mid)",
        seriesId: "DRTSCILM",
        unit: "%",
        interpret: "lower-bullish",
        note: "값이 낮을수록 대출 완화 → 호재",
      },
    ],
  },
  {
    title: "5. 시장 심리 / 리스크 선호도 지표",
    icon: <SmileOutlined />,
    items: [
      { name: "VIX 지수 (공포 지수)", seriesId: "VIXCLS", unit: "index", interpret: "lower-bullish" },
      {
        name: "주식/채권 상대강도 (SPY/TLT)",
        seriesId: null,
        unit: "ratio",
        interpret: "higher-bullish",
        note: "ETF 가격 — FRED 미제공",
      },
      {
        name: "EPFR / ICI 펀드 플로우",
        seriesId: null,
        unit: "$B",
        interpret: "higher-bullish",
        note: "상업/협회 데이터 — FRED 미제공",
      },
    ],
  },
];

const STOCK_LEVEL_PLACEHOLDERS = [
  { name: "이동평균선 (5/20/60/120일)", note: "정배열·이격도" },
  { name: "거래강도 (Volume Strength)", note: "거래량 회전율 / OBV" },
  { name: "Put/Call Ratio", note: "CBOE 옵션 거래 비율" },
  { name: "신고가/신저가 비율", note: "52W High vs Low Ratio" },
];

// ---------- FRED 호출 ----------
async function fetchFredLatest(seriesId, endDate) {
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
    const obs = (data?.observations || []).find(
      (o) => o.value && o.value !== "."
    );
    return obs ? { date: obs.date, value: parseFloat(obs.value) } : null;
  } catch (e) {
    console.warn(`[FRED] ${seriesId} 호출 실패:`, e?.message);
    return null;
  }
}

// ---------- 시그널 계산 ----------
function computeSignal(item, current, previous) {
  if (!current || !previous) return "neutral";
  const diff = current.value - previous.value;
  if (Math.abs(diff) < 1e-9) return "neutral";
  if (item.interpret === "lower-bullish") {
    return diff < 0 ? "bullish" : "bearish";
  }
  return diff > 0 ? "bullish" : "bearish";
}

const SIGNAL_META = {
  bullish: { label: "긍정", color: "green", icon: <ArrowUpOutlined /> },
  bearish: { label: "부정", color: "red", icon: <ArrowDownOutlined /> },
  neutral: { label: "중립", color: "default", icon: <MinusOutlined /> },
};

// ---------- 단위 포맷 ----------
function formatValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value.toFixed(2);
}

function formatDelta(diff) {
  if (diff === null || diff === undefined || Number.isNaN(diff)) return "—";
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(2)}`;
}

// ---------- 지표 카드 ----------
function IndicatorCard({ item, current, previous }) {
  const noData = !item.seriesId;
  const signal = computeSignal(item, current, previous);
  const meta = SIGNAL_META[signal];
  const diff = current && previous ? current.value - previous.value : null;
  const deltaColor =
    diff > 0 ? "#3f8600" : diff < 0 ? "#cf1322" : "rgba(0,0,0,0.45)";

  return (
    <Card
      size="small"
      style={{ height: "100%", opacity: noData ? 0.6 : 1 }}
      styles={{ body: { padding: 14 } }}
    >
      <Space style={{ width: "100%", justifyContent: "space-between" }} align="start">
        <Text strong style={{ fontSize: 13, lineHeight: 1.3 }}>
          {item.name}
        </Text>
        {!noData && (
          <Tag color={meta.color} icon={meta.icon} style={{ marginRight: 0 }}>
            {meta.label}
          </Tag>
        )}
      </Space>
      {item.seriesId && (
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            FRED: {item.seriesId}
          </Text>
        </div>
      )}
      <Divider style={{ margin: "8px 0" }} />
      {noData ? (
        <div>
          <Title level={5} style={{ margin: 0, color: "rgba(0,0,0,0.35)" }}>
            — (공란)
          </Title>
          {item.note && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {item.note}
            </Text>
          )}
        </div>
      ) : (
        <div>
          <Statistic
            value={current ? formatValue(current.value) : "—"}
            suffix={
              <Text type="secondary" style={{ fontSize: 12 }}>
                {item.unit}
              </Text>
            }
            valueStyle={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            관측일: {current?.date || "데이터 없음"}
          </Text>
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={{ color: deltaColor, fontWeight: 600, fontSize: 13 }}>
              QoQ Δ {formatDelta(diff)}
            </Text>
            {previous && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                (전 분기 {formatValue(previous.value)})
              </Text>
            )}
            {item.note && (
              <Tooltip title={item.note}>
                <InfoCircleOutlined style={{ color: "rgba(0,0,0,0.45)" }} />
              </Tooltip>
            )}
          </div>
        </div>
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
  const prevDate = useMemo(() => addQuarters(refDate, -1), [refDate]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      const items = SECTIONS.flatMap((s) => s.items).filter((i) => i.seriesId);
      try {
        const entries = await Promise.all(
          items.map(async (item) => {
            const [cur, prv] = await Promise.all([
              fetchFredLatest(item.seriesId, refDate),
              fetchFredLatest(item.seriesId, prevDate),
            ]);
            return [item.seriesId, { current: cur, previous: prv }];
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
  }, [refDate, prevDate]);

  const summary = useMemo(() => {
    let bull = 0, bear = 0, neut = 0, total = 0;
    SECTIONS.forEach((s) =>
      s.items.forEach((item) => {
        if (!item.seriesId) return;
        const r = results[item.seriesId];
        if (!r || !r.current || !r.previous) return;
        total++;
        const sig = computeSignal(item, r.current, r.previous);
        if (sig === "bullish") bull++;
        else if (sig === "bearish") bear++;
        else neut++;
      })
    );
    const score = total ? ((bull - bear) / total) * 100 : 0;
    let bias = "중립";
    let color = "default";
    if (score > 20) { bias = "긍정 (Risk-On)"; color = "green"; }
    else if (score < -20) { bias = "부정 (Risk-Off)"; color = "red"; }
    const progressPct = Math.min(100, Math.max(0, (score + 100) / 2));
    return { bull, bear, neut, total, score, bias, color, progressPct };
  }, [results]);

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="middle">
        <Col xs={24} md={14}>
          <Title level={3} style={{ margin: 0 }}>
            나스닥 100 분기 방향성 예측 지표
          </Title>
          <Text type="secondary">
            기준일: {quarterLabel(refDate)} · 비교: {quarterLabel(prevDate)}
          </Text>
        </Col>
        <Col xs={24} md={10}>
          <Card
            size="small"
            styles={{ body: { padding: 14 } }}
            style={{
              borderColor:
                summary.color === "green" ? "#52c41a"
                : summary.color === "red" ? "#ff4d4f"
                : undefined,
            }}
          >
            <Text type="secondary" style={{ fontSize: 11, letterSpacing: 1 }}>
              종합 시그널 (FRED 가용 지표 기반)
            </Text>
            <Space align="center" style={{ marginTop: 4 }}>
              <Title level={3} style={{ margin: 0 }}>{summary.bias}</Title>
              <Tag color={summary.color}>
                {summary.score >= 0 ? "+" : ""}{summary.score.toFixed(0)}점
              </Tag>
            </Space>
            <Progress
              percent={summary.progressPct}
              showInfo={false}
              strokeColor={
                summary.color === "green" ? "#52c41a"
                : summary.color === "red" ? "#ff4d4f"
                : "#faad14"
              }
              style={{ marginTop: 4 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              긍정 {summary.bull} · 부정 {summary.bear} · 중립 {summary.neut} (집계 {summary.total})
            </Text>
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

      {SECTIONS.map((section) => (
        <Card
          key={section.title}
          size="small"
          title={<Space>{section.icon}<span>{section.title}</span></Space>}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={[12, 12]}>
            {section.items.map((item) => {
              const r = item.seriesId ? results[item.seriesId] : null;
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={item.name}>
                  <IndicatorCard
                    item={item}
                    current={r?.current ?? null}
                    previous={r?.previous ?? null}
                  />
                </Col>
              );
            })}
          </Row>
        </Card>
      ))}

      <Card
        size="small"
        title={<Space><AppstoreOutlined /><span>6. 개별 종목 지표 (추후 작업 예정)</span></Space>}
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
                <Title level={5} style={{ margin: 0, color: "rgba(0,0,0,0.35)" }}>
                  — (공란)
                </Title>
                <Text type="secondary" style={{ fontSize: 11 }}>{note}</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
