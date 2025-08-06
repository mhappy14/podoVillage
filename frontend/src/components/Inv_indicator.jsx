// Invest_indicator.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import pLimit from "p-limit";
import { Card, Select, Space, Tag, Typography } from "antd";
import { Line } from "react-chartjs-2";

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
);

const { Title: AntTitle } = Typography;

const colorMap = {
  DFF: "crimson",
  SP500: "darkcyan",
  CPIAUCSL: "olive",
  UNRATE: "mediumorchid",
  REAINTRATREARAT1YE: "forestgreen"
};

const labelMap = {
  DFF: "연방기금금리 (Federal Funds Rate)",
  SP500: "S&P 500 지수",
  CPIAUCSL: "소비자 물가지수 (CPI)",
  UNRATE: "실업률 (Unemployment Rate)",
  REAINTRATREARAT1YE: "실질금리 (Real Interest Rate)"
};

async function fetchFredData({ api_key, monthlyIds, dailyIds, vintage_dates }) {
  const defs = [
    ...monthlyIds.map(id => ({ id, freq: "m" })),
    ...dailyIds.map(id => ({ id, freq: "m" }))
  ];
  const limitRequests = pLimit(10);
  const rawMap = {};
  const allDates = new Set();

  await Promise.all(defs.map(def =>
    limitRequests(async () => {
      const { id, freq } = def;
      const { data } = await axios.get("http://localhost:8000/api/fred", {
        params: {
          series_id: id,
          api_key,
          frequency: freq,
          vintage_dates,
          file_type: "json",
          limit: 100000,
          offset: 0,
          sort_order: "asc",
          units: "lin",
          output_type: 1,
          aggregation_method: "avg"
        }
      });
      const obs = data.observations.filter(o => o.value !== ".");
      const latestDate = new Date(obs.at(-1).date);
      const pastDate = new Date(latestDate);
      pastDate.setFullYear(pastDate.getFullYear() - 30);
      const filtered = obs.filter(o => {
        const d = new Date(o.date);
        return d >= pastDate && d <= latestDate;
      });
      const vals = filtered.map(o => +o.value);
      const min = Math.min(...vals), max = Math.max(...vals);
      const norm = vals.map(v => (v - min) / (max - min));
      filtered.forEach(o => allDates.add(o.date));
      rawMap[id] = {
        dates: filtered.map(o => o.date),
        norm,
        orig: vals
      };
    })
  ));

  const labels = Array.from(allDates).sort();
  const datasets = Object.entries(rawMap).map(([id, { dates, norm }]) => {
    const m = new Map(dates.map((d, i) => [d, norm[i]]));
    return {
      id,
      label: labelMap[id],
      data: labels.map(d => m.get(d) ?? null),
      borderColor: colorMap[id],
      backgroundColor: "transparent",
      pointRadius: 0,
      tension: 0.3,
      spanGaps: false
    };
  });
  const originals = Object.fromEntries(
    Object.entries(rawMap).map(([id, { dates, orig }]) => {
      const m = new Map(dates.map((d, i) => [d, orig[i]]));
      return [id, labels.map(d => m.get(d) ?? null)];
    })
  );

  return { labels, datasets, originals };
}

function SeriesSelector({ datasets, visible, onChange }) {
  const opts = datasets.map(ds => ({ label: ds.label, value: ds.id }));
  const selected = opts.filter(o => visible[o.value]).map(o => o.value);
  return (
    <Select
      mode="multiple"
      allowClear
      placeholder="데이터 시리즈를 선택하세요"
      value={selected}
      onChange={onChange}
      options={opts}
      tagRender={({ value, closable, onClose }) => (
        <Tag closable={closable} onClose={onClose} style={{ marginRight: 3 }}>
          {value}
        </Tag>
      )}
      style={{ width: "100%" }}
    />
  );
}

function FredChart({ labels, datasets, visible, originals }) {
  return (
    <Line
      data={{ labels, datasets: datasets.filter(ds => visible[ds.id]) }}
      options={{
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: ctx => {
                const val = originals[ctx.dataset.id]?.[ctx.dataIndex];
                return `${ctx.dataset.label}: ${val != null ? val.toFixed(2) : "N/A"}`;
              }
            }
          },
          zoom: {
            pan: { enabled: true, mode: "x" },
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: "x"
            }
          }
        },
        interaction: { mode: "nearest", axis: "x", intersect: false },
        scales: {
          x: {
            ticks: {
              color: "#666",
              callback: (value, index) => {
                const dateStr = labels[index];
                if (typeof dateStr === "string") {
                  const [yyyy, mm] = dateStr.split("-");
                  return `${yyyy}-${mm}`;
                }
                return dateStr;
              }
            },
            grid: { display: false }
          },
          y: { ticks: { callback: () => "" }, grid: { display: false } }
        }
      }}
    />
  );
}

export default function InvestIndicator({
  monthly_series_ids = ["CPIAUCSL", "UNRATE", "REAINTRATREARAT1YE"],
  daily_series_ids   = ["SP500", "DFF"],
  api_key            = "6335426c3b0d7423815d6ca3068b1a7f",
  vintage_dates      = ""
}) {
  const [data, setData] = useState(null);
  const [visible, setVisible] = useState({});

  useEffect(() => {
    fetchFredData({
      api_key,
      monthlyIds: monthly_series_ids,
      dailyIds: daily_series_ids,
      vintage_dates
    }).then(({ labels, datasets, originals }) => {
      setVisible(Object.fromEntries(datasets.map(ds => [ds.id, true])));
      setData({ labels, datasets, originals });
    });
  }, [api_key, vintage_dates]);

  const onSelectChange = ids => {
    setVisible(prev => {
      const next = {};
      Object.keys(prev).forEach(id => {
        next[id] = ids.includes(id);
      });
      return next;
    });
  };

  if (!data) return <div>Loading chart...</div>;

  return (
    <Card style={{ margin: "1rem", background: "#f9f9f9" }}>
      <AntTitle level={4} style={{ margin: 0, marginBottom: 16 }}>
        Economic Indicators by FRED
      </AntTitle>
      <Space direction="vertical" style={{ width: "100%", marginBottom: 24 }}>
        <SeriesSelector
          datasets={data.datasets}
          visible={visible}
          onChange={onSelectChange}
        />
      </Space>
      <div style={{ width: "100%", height: 400 }}>
        <FredChart
          labels={data.labels}
          datasets={data.datasets}
          visible={visible}
          originals={data.originals}
        />
      </div>
    </Card>
  );
}
