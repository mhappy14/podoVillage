// AUTH/frontend/src/utils/marketDataFetchers.js
import axios from 'axios';

// CNN Fear & Greed Index
export async function fetchFearGreedIndex() {
  try {
    const res = await axios.get("https://production.dataviz.cnn.io/index/fearandgreed/graphdata");
    return {
      score: res.data.fear_and_greed.score,
      rating: res.data.fear_and_greed.rating
    };
  } catch (e) {
    console.error("Fear & Greed fetch failed:", e);
    return null;
  }
}

// Coinbase Bitcoin Price
export async function fetchBitcoinPrice() {
  try {
    const res = await axios.get("https://api.coinbase.com/v2/prices/BTC-USD/spot");
    return parseFloat(res.data.data.amount);
  } catch (e) {
    console.error("Bitcoin fetch failed:", e);
    return null;
  }
}

// CBOE Put/Call Ratio (예시 - 실제 API 필요)
export async function fetchPutCallRatio() {
  try {
    // CBOE는 공식 API가 없으므로 백엔드에서 스크래핑 필요
    const res = await axios.get("http://localhost:8000/api/cboe-putcall/");
    return res.data.ratio;
  } catch (e) {
    console.error("Put/Call fetch failed:", e);
    return null;
  }
}