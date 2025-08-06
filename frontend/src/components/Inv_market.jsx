// Inv_market.jsx
import React, { useState, useEffect } from "react";
import { TextField, MenuItem, Card, Typography } from "@mui/material";
import { Line } from "react-chartjs-2";
import Chart from 'chart.js/auto';
import axios from "axios";

const nasdaq100 = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "ADBE", "AVGO", "PEP",
  "COST", "NFLX", "CSCO", "INTC", "TMUS", "TXN", "QCOM", "AMGN", "HON", "AMD"
  // ... 더 추가 가능 (나스닥 100 전체)
];

export default function InvestMarket() {
  const [symbol, setSymbol] = useState("AAPL");
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
  try {
    const res = await axios.get(`/api/stock/${symbol}/`);
    setChartData({
      labels: res.data.labels,
      datasets: [
        {
          label: `${symbol} - 1Y Closing Price`,
          data: res.data.prices,
          borderWidth: 2,
          fill: false,
        },
      ],
    });
  } catch (error) {
    console.error("Failed to fetch stock data:", error);
  }
};


    fetchData();
  }, [symbol]);

  return (
    <Card sx={{ p: 2, my: 2 }}>
      <Typography variant="h6">NASDAQ 100 차트 보기</Typography>
      <TextField
        select
        label="종목 선택"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        sx={{ my: 2, width: 200 }}
      >
        {nasdaq100.map((s) => (
          <MenuItem key={s} value={s}>{s}</MenuItem>
        ))}
      </TextField>
      {chartData && <Line data={chartData} />}
    </Card>
  );
}
