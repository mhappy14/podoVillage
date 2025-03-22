import React, { useEffect, useState } from "react";
import axios from 'axios';
import { Box, Typography, FormGroup, FormControlLabel, Checkbox } from '@mui/material';
import { Chart as ChartJS, LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const colorMap = {
  DFF: 'crimson',
  SP500: 'darkcyan',
  CPIAUCSL: 'olive',
  UNRATE: 'mediumorchid',
  REAINTRATREARAT1YE: 'forestgreen',
};

const labelMap = {
  DFF: '연방기금금리 (Federal Funds Rate)',
  SP500: 'S&P 500 지수',
  CPIAUCSL: '소비자 물가지수 (CPI)',
  UNRATE: '실업률 (Unemployment Rate)',
  REAINTRATREARAT1YE: '실질금리 (Real Interest Rate)',
};

const Invest = ({
  monthly_series_ids = ['CPIAUCSL', 'UNRATE', 'REAINTRATREARAT1YE'],
  daily_series_ids = ['SP500', 'DFF'],
  api_key = '6335426c3b0d7423815d6ca3068b1a7f',
  file_type = 'json',
  limit = 100000,
  offset = 0,
  sort_order = 'asc',
  units = 'lin',
  aggregation_method = 'avg',
  output_type = 1,
  vintage_dates = ''
}) => {
  const [chartData, setChartData] = useState(null);
  const [originalValuesMap, setOriginalValuesMap] = useState({});
  const [visibleSeries, setVisibleSeries] = useState({});

  const allSeriesIds = [...monthly_series_ids, ...daily_series_ids];

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const originalMap = {};
        let allDates = new Set();
        const allSeries = [
          ...monthly_series_ids.map(id => ({ id, frequency: 'm' })),
          ...daily_series_ids.map(id => ({ id, frequency: 'm' }))
        ];

        const seriesDataMap = {};

        for (const { id: series_id, frequency } of allSeries) {
          const params = {
            series_id,
            api_key,
            file_type,
            limit,
            offset,
            sort_order,
            units,
            output_type,
            frequency,
            aggregation_method,
          };

          if (vintage_dates) params.vintage_dates = vintage_dates;

          const response = await axios.get('http://localhost:8000/api/fred', { params });
          const raw = response.data.observations.filter(obs => obs.value !== '.');

          const latestDate = new Date(raw[raw.length - 1].date);
          const pastDate = new Date(latestDate);
          pastDate.setFullYear(pastDate.getFullYear() - 30);

          const filtered = raw.filter(obs => {
            const d = new Date(obs.date);
            return d >= pastDate && d <= latestDate;
          });

          const labels = filtered.map(obs => obs.date);
          const values = filtered.map(obs => parseFloat(obs.value));

          const minVal = Math.min(...values);
          const maxVal = Math.max(...values);
          const normalizedValues = values.map(v => (v - minVal) / (maxVal - minVal));

          labels.forEach(date => allDates.add(date));

          originalMap[series_id] = values;

          seriesDataMap[series_id] = {
            dates: labels,
            normalized: normalizedValues,
            original: values,
          };
        }

        const sortedDates = Array.from(allDates).sort();
        const finalDatasets = [];

        for (const series_id in seriesDataMap) {
          const { dates, normalized, original } = seriesDataMap[series_id];

          const dateValueMap = new Map();
          dates.forEach((d, i) => dateValueMap.set(d, { norm: normalized[i], orig: original[i] }));

          const filledNormalized = [];
          const filledOriginal = [];

          sortedDates.forEach(date => {
            if (dateValueMap.has(date)) {
              filledNormalized.push(dateValueMap.get(date).norm);
              filledOriginal.push(dateValueMap.get(date).orig);
            } else {
              filledNormalized.push(null);
              filledOriginal.push(null);
            }
          });

          originalMap[series_id] = filledOriginal;

          finalDatasets.push({
            label: labelMap[series_id] || series_id,
            id: series_id,
            data: filledNormalized,
            borderColor: colorMap[series_id] || '#999',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            tension: 0.3,
            spanGaps: false,
          });
        }

        const initialVisible = {};
        finalDatasets.forEach(ds => { initialVisible[ds.id] = true; });

        setVisibleSeries(initialVisible);
        setOriginalValuesMap(originalMap);

        setChartData({
          labels: Array.from(allDates).sort(),
          datasets: finalDatasets,
        });
      } catch (error) {
        console.error('FRED API 호출 오류:', error);
      }
    };

    fetchAllData();
  }, [monthly_series_ids, daily_series_ids, api_key, file_type, limit, offset, sort_order, units, aggregation_method, output_type, vintage_dates]);

  if (!chartData) return <div>Loading chart...</div>;

  const handleCheckboxChange = (id) => {
    setVisibleSeries(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '1000px', margin: '2rem auto', p: 2, bgcolor: '#f9f9f9', borderRadius: 2, boxShadow: 2 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', color: '#333' }}>
        FRED Economic Indicators
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <FormGroup row>
          {chartData.datasets.map(dataset => (
            <FormControlLabel
              key={dataset.id}
              control={
                <Checkbox
                  checked={visibleSeries[dataset.id] || false}
                  onChange={() => handleCheckboxChange(dataset.id)}
                  sx={{ transform: 'scale(0.8)' }}
                />
              }
              label={<span style={{ fontSize: '0.7rem' }}>{dataset.label}</span>}
            />
          ))}
        </FormGroup>
      </Box>
      <Line
        data={{
          labels: chartData.labels,
          datasets: chartData.datasets.filter(ds => visibleSeries[ds.id]),
        }}
        options={{
          responsive: true,
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                label: function(context) {
                  const label = context.dataset.label || '';
                  const id = context.dataset.id;
                  const dataIndex = context.dataIndex;
                  const originalValues = originalValuesMap[id];
                  const originalValue = originalValues ? originalValues[dataIndex] : null;
                  return `${label}: ${originalValue !== null ? originalValue.toFixed(2) : 'N/A'}`;
                }
              }
            },
          },
          interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false,
          },
          scales: {
            x: {
              ticks: {
                color: '#666',
              },
              grid: {
                display: false,
              },
            },
            y: {
              ticks: {
                callback: () => '',
              },
              grid: {
                display: false,
              },
            },
          },
        }}
      />
    </Box>
  );
};

export default Invest;