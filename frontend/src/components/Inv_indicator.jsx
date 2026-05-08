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
} from "@ant-design/icons";
import Column from "antd/es/table/Column";
import {
  SECTIONS,
  STOCK_LEVEL_PLACEHOLDERS,
  SECTOR_COLOR,
  SECTOR_ABBR,
  NDX100_FALLBACK,
} from "./inv_indicator/constants";

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
              ? { date: anchors.current.date, value: anchors.current.value }
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
        <Col xs={24} md={16} style={{ display: "flex", flexDirection: "column" }}>
          {/* 위: 전체시장 + 종목별 (컴팩트, 1줄) */}
          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Card
                size="small"
                styles={{ body: { padding: "8px 12px" } }}
                style={{
                  borderColor:
                    summary.color === "green" ? "#52c41a"
                    : summary.color === "red" ? "#ff4d4f" : undefined,
                }}
              >
                <Text type="secondary" style={{ fontSize: 10, letterSpacing: 1 }}>
                  전체 시장
                </Text>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Title level={5} style={{ margin: 0 }}>{summary.bias}</Title>
                  <Tag color={summary.color} style={{ marginRight: 0, fontSize: 11 }}>
                    {summary.score >= 0 ? "+" : ""}{summary.score.toFixed(0)}
                  </Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 10, display: "block", marginTop: 2 }}>
                  {summary.count}개 · 긍{summary.bullW} 부{summary.bearW} 중{summary.neutW}
                </Text>
              </Card>
            </Col>
            <Col span={12}>
              <Card
                size="small"
                styles={{ body: { padding: "8px 12px" } }}
              >
                {selectedStock ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                      <Text type="secondary" style={{ fontSize: 10, letterSpacing: 1 }}>
                        {selectedStock.ticker}
                      </Text>
                      {selectedSector && (
                        <Tag color={SECTOR_COLOR[selectedSector] || "default"} style={{ marginRight: 0, fontSize: 9, padding: "0 4px", lineHeight: "14px" }}>
                          {SECTOR_ABBR[selectedSector] || "ETC"}
                        </Tag>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <Title level={5} style={{ margin: 0 }}>{summary.bias}</Title>
                      <Tag color={summary.color} style={{ marginRight: 0, fontSize: 11 }}>
                        {summary.score >= 0 ? "+" : ""}{summary.score.toFixed(0)}
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 10, display: "block", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {selectedStock.name}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text type="secondary" style={{ fontSize: 10, letterSpacing: 1 }}>
                      선택 종목
                    </Text>
                    <div style={{ marginTop: 2 }}>
                      <Title level={5} type="secondary" style={{ margin: 0, fontWeight: 400 }}>
                        종목 미선택
                      </Title>
                    </div>
                    <Text type="secondary" style={{ fontSize: 10, display: "block", marginTop: 2 }}>
                      상단 셀렉터에서 NDX 100 종목 선택
                    </Text>
                  </>
                )}
              </Card>
            </Col>
          </Row>

          {/* 아래: 섹터별 시그널 (다중 줄 wrap, 풀 라벨) */}
          <Card
            size="small"
            style={{ flex: 1 }}
            styles={{ body: { padding: 12 } }}
            title={
              <span style={{ fontWeight: 600 }}>
                섹터별 시그널{" "}
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>
                  (NDX 100 구성종목 기반 · {sectorBreakdown.length}개)
                </Text>
              </span>
            }
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {sectorBreakdown.map((s) => (
                <div
                  key={s.sector}
                  style={{
                    flex: "1 1 calc(20% - 8px)",
                    minWidth: 130,
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
                    <Tag
                      color={SECTOR_COLOR[s.sector] || "default"}
                      style={{ marginRight: 0, fontSize: 10 }}
                    >
                      {SECTOR_ABBR[s.sector] || "ETC"}
                    </Tag>
                    <Tag color={s.color} style={{ marginRight: 0, fontSize: 11, fontWeight: 600 }}>
                      {s.score >= 0 ? "+" : ""}{s.score.toFixed(0)}
                    </Tag>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.3 }}>
                    <Text strong style={{ fontSize: 11 }}>{s.sector}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    {s.count}종목 · 비중 {s.weight.toFixed(1)}%
                  </Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* === 우측 1/3: 공식 + 인라인 가중치 === */}
        <Col xs={24} md={8} style={{ display: "flex" }}>
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
          >
            {/* 컴팩트 공식 박스 */}
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
                {" = ("}
                <Text style={{ color: "#3f8600", fontSize: 11 }}>Σ긍정ᵢwᵢ</Text>
                {" − "}
                <Text style={{ color: "#cf1322", fontSize: 11 }}>Σ부정ᵢwᵢ</Text>
                {") / Σwᵢ × 100"}
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>= </Text>
                ({summary.bullW}−{summary.bearW})/{summary.totalW}×100 ={" "}
                <Text
                  strong
                  style={{
                    fontSize: 11,
                    color:
                      summary.color === "green" ? "#3f8600"
                      : summary.color === "red" ? "#cf1322"
                      : undefined,
                  }}
                >
                  {summary.score >= 0 ? "+" : ""}{summary.score.toFixed(1)}
                </Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 10 }}>
                  임계: |S|&gt;20 → 긍정/부정, 외 → 중립
                </Text>
              </div>
            </div>

            {/* 컴팩트 인라인 가중치 — 카테고리당 1줄 */}
            <Text strong style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
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
                  <Text type="secondary" style={{ fontSize: 10, minWidth: 38, fontWeight: 600 }}>
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
                            style={{ width: 46 }}
                          />
                        </span>
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
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
