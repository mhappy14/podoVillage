import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import pLimit from "p-limit";
import {
  Card,
  Tabs,
  Row,
  Col,
  Statistic,
  Progress,
  Tag,
  Spin,
  Alert,
} from "antd";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
// date adapter: 'time' 스케일을 쓰려면 반드시 import 해서 Chart.js에 등록돼야 함
import "chartjs-adapter-date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
);

const SERIES = [
  { id: "DGS10", label: "미국채 10년 (DGS10)" },
  { id: "CPIAUCSL", label: "CPI (CPIAUCSL)" },
  { id: "T10Y2Y", label: "10Y-2Y (T10Y2Y)" },
  { id: "M2SL", label: "M2 (M2SL)" },
  { id: "BAMLH0A0HYM2", label: "하이일드 스프레드 (BAMLH0A0HYM2)" },
  { id: "VIXCLS", label: "VIX (VIXCLS)" },
  { id: "PCOPPUSDM", label: "구리 가격 (proxy PCOPPUSDM)" },
  { id: "SP500", label: "S&P 500 (SP500)" },
  { id: "CBBTCUSD", label: "Bitcoin (CBBTCUSD)" },
];

function normalizeData(arr) {
  if (!arr || arr.length === 0) return [];
  const vals = arr.filter((v) => typeof v === "number" && !isNaN(v));
  if (vals.length === 0) return arr.map(() => null);
  const min = Math.min(...vals),
    max = Math.max(...vals);
  return max === min
    ? arr.map((v) => (typeof v === "number" && !isNaN(v) ? 50 : null))
    : arr.map((v) =>
        typeof v === "number" && !isNaN(v)
          ? ((v - min) / (max - min)) * 100
          : null
      );
}

// dates(string[])와 values(number|null[])를 Chart.js의 {x,y} 포인트 배열로 변환.
// null 값은 데이터 공백으로 처리(Chart.js는 알아서 선을 끊음).
function toPoints(dates, values) {
  if (!dates || !values) return [];
  const n = Math.min(dates.length, values.length);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v === null || v === undefined || (typeof v === "number" && isNaN(v))) continue;
    pts.push({ x: dates[i], y: v });
  }
  return pts;
}

function calcChangePct(history) {
  if (!history || history.length < 2) return 0;
  // 마지막 두 개 중 null이 섞여 있을 수 있으니 뒤에서부터 유효값 두 개를 집어옴
  const valid = history.filter(
    (v) => typeof v === "number" && !isNaN(v)
  );
  if (valid.length < 2) return 0;
  const prev = valid[valid.length - 2];
  const last = valid[valid.length - 1];
  return prev ? ((last - prev) / Math.abs(prev)) * 100 : 0;
}

function latestValue(history) {
  if (!history) return "N/A";
  for (let i = history.length - 1; i >= 0; i--) {
    const v = history[i];
    if (typeof v === "number" && !isNaN(v)) return v;
  }
  return "N/A";
}

function MiniStat({
  label,
  value,
  change,
  statusText,
  statusType,
  history,
  dateHistory,
  color,
}) {
  // 카드 안 스파크라인용 데이터: 최근 180개 유효 포인트
  const points = toPoints(dateHistory || [], history || []).slice(-180);
  const hasChart = points.length >= 2;

  const chartData = {
    datasets: [
      {
        data: points,
        borderColor: color || "#1677ff",
        backgroundColor: "rgba(22,119,255,0.08)",
        fill: true,
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 1.5,
        spanGaps: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      zoom: { zoom: { wheel: { enabled: false }, pinch: { enabled: false } } },
    },
    scales: {
      x: { type: "time", display: false },
      y: { display: false },
    },
    elements: { point: { radius: 0 } },
  };

  const numericValue =
    typeof value === "number" && !isNaN(value) ? value : null;

  return (
    <Card size="small" style={{ marginBottom: 8 }}>
      <Statistic
        title={label}
        value={numericValue ?? "N/A"}
        precision={numericValue !== null ? 2 : undefined}
        valueStyle={{
          color:
            statusType === "good"
              ? "#3f8600"
              : statusType === "bad"
              ? "#cf1322"
              : "#faad14",
          fontSize: 18,
        }}
        prefix={change > 0 ? <ArrowUpOutlined /> : change < 0 ? <ArrowDownOutlined /> : null}
        suffix={
          <Tag color={statusType === "good" ? "success" : statusType === "bad" ? "error" : "default"}>
            {statusText}
          </Tag>
        }
      />
      <div style={{ height: 50, marginTop: 6 }}>
        {hasChart ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <div style={{ color: "#bbb", fontSize: 12 }}>No chart data</div>
        )}
      </div>
      <Progress
        percent={Math.min(100, Math.abs(change))}
        showInfo={false}
        size="small"
        style={{ marginTop: 4 }}
      />
    </Card>
  );
}

export default function InvestIndicator() {
  const [data, setData] = useState({});
  const [dates, setDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const releaseId = 52; // 필요하다면 변경

  async function fetchSeries(seriesId) {
    const res = await axios.get("/invest/fred-series/", {
      params: { release_id: releaseId, series_id: seriesId },
      timeout: 15000,
    });
    const values = Array.isArray(res.data.values) ? res.data.values : [];
    const dates = Array.isArray(res.data.dates) ? res.data.dates : [];
    return { values, dates };
  }

  async function fetchAll() {
    setLoading(true);
    setErrorMsg(null);
    const limit = pLimit(6);
    const results = {};
    const dateMap = {};
    try {
      await Promise.all(
        SERIES.map((s) =>
          limit(async () => {
            const { values, dates } = await fetchSeries(s.id);
            results[s.id] = values;
            dateMap[s.id] = dates;
          })
        )
      );
      setData(results);
      setDates(dateMap);
    } catch (e) {
      console.error(e);
      setErrorMsg("데이터 로드 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const seriesMeta = useMemo(() => {
    return SERIES.reduce((acc, s, i) => {
      acc[s.id] = { label: s.label, color: `hsl(${(i * 60) % 360},70%,40%)` };
      return acc;
    }, {});
  }, []);

  if (loading) return <Spin size="large" style={{ margin: 24 }} />;
  if (errorMsg) return <Alert type="error" message={errorMsg} style={{ margin: 24 }} />;

  const tabKeys = ["all", ...SERIES.map((s) => s.id)];
  const items = tabKeys.map((tabKey) => {
    const label = tabKey === "all" ? "All (Normalized 비교)" : seriesMeta[tabKey].label;
    return {
      key: tabKey,
      label,
      children: (
        <Row gutter={16}>
          <Col xs={24} lg={8}>
            <Card title="Latest Values">
              {tabKey === "all" ? (
                SERIES.map((s) => {
                  const hist = data[s.id] || [];
                  const latest = latestValue(hist);
                  return (
                    <div key={s.id} style={{ marginBottom: 8 }}>
                      <strong>{s.label}:</strong> {latest}
                    </div>
                  );
                })
              ) : (
                (() => {
                  const hist = data[tabKey] || [];
                  if (!hist.length) return <div>No data</div>;
                  const latest = latestValue(hist);
                  const change = calcChangePct(hist);
                  return (
                    <>
                      <div style={{ marginBottom: 8 }}>
                        <strong>Latest:</strong> {latest}
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <strong>Change (최근):</strong> {change.toFixed(2)}%
                      </div>
                      <Progress
                        percent={Math.min(100, Math.abs(change))}
                        status={change < 0 ? "exception" : "normal"}
                      />
                    </>
                  );
                })()
              )}
            </Card>
          </Col>
          <Col xs={24} lg={16}>
            <Card title={label + (tabKey === "all" ? "" : " 추세")}>
              <div style={{ height: 420 }}>
                <Line
                  data={{
                    datasets:
                      tabKey === "all"
                        ? SERIES.filter((s) => data[s.id]?.length).map((s) => {
                            const ds = (dates[s.id] || []).slice(-365);
                            const vs = (data[s.id] || []).slice(-365);
                            const nv = normalizeData(vs);
                            return {
                              label: seriesMeta[s.id].label,
                              data: toPoints(ds, nv),
                              borderColor: seriesMeta[s.id].color,
                              backgroundColor: "transparent",
                              tension: 0.2,
                              pointRadius: 0,
                              spanGaps: true,
                            };
                          })
                        : [
                            {
                              label: seriesMeta[tabKey].label,
                              data: toPoints(
                                dates[tabKey] || [],
                                data[tabKey] || []
                              ),
                              borderColor: seriesMeta[tabKey].color,
                              backgroundColor: "transparent",
                              tension: 0.2,
                              pointRadius: 0,
                              spanGaps: true,
                            },
                          ],
                  }}
                  options={{
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: "top" },
                      zoom: {
                        pan: { enabled: true, mode: "x" },
                        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" },
                      },
                    },
                    scales: {
                      y: {
                        title: {
                          display: true,
                          text: tabKey === "all" ? "Normalized (0-100)" : "",
                        },
                      },
                      x: {
                        type: 'time',
                        time: {
                          unit: 'month',
                          tooltipFormat: 'yyyy-MM-dd',
                          displayFormats: {
                            day: 'yyyy-MM-dd',
                            month: 'yyyy-MM',
                          },
                        },
                        ticks: {
                          maxTicksLimit: 12,
                          autoSkip: true,
                        },
                      },
                    },
                  }}
                />
              </div>
            </Card>
          </Col>
        </Row>
      ),
    };
  });

  return (
    <div style={{ padding: 16 }}>
      <Card title="Market Dashboard (FRED 기반)" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          {SERIES.map((s) => {
            const hist = data[s.id] || [];
            const dhist = dates[s.id] || [];
            const latest = latestValue(hist);
            const change = calcChangePct(hist);
            const statusType = change < -2 ? "bad" : change > 2 ? "good" : "neutral";
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={s.id}>
                <MiniStat
                  label={s.label}
                  value={latest}
                  change={change}
                  statusText={statusType}
                  statusType={statusType}
                  history={hist}
                  dateHistory={dhist}
                  color={seriesMeta[s.id]?.color}
                />
              </Col>
            );
          })}
        </Row>
      </Card>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
    </div>
  );
}