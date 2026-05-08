// =====================================================================
// Inv_indicator 의 상수 정의 — 데이터 모델 / GICS 섹터 / NDX 100 fallback
// =====================================================================
//
// SECTIONS: 6개 카테고리에 대한 지표 정의. seriesId 는 백엔드
// /invest/indicator-snapshots/ 응답의 indicators[KEY] 와 매칭되는 키.
// seriesId === null 이면 백엔드/외부 소스 모두에서 데이터를 못 받는 항목.
//
// interpret:
//   "lower-bullish"  → 값이 낮아질수록 주식에 호재
//   "higher-bullish" → 값이 높아질수록 주식에 호재
// =====================================================================

export const SECTIONS = [
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
      { name: "MOVE 지수 (채권 변동성)", seriesId: "MOVE", unit: "index", interpret: "lower-bullish",
        note: "yfinance ^MOVE — 데이터 없을 시 공란" },
      { name: "COT 리포트 (포지셔닝)", seriesId: null, unit: "계약", interpret: "higher-bullish",
        note: "CFTC 발표 — FRED 미제공" },
    ],
  },
  {
    title: "3. 유동성 지표",
    items: [
      { name: "M2 통화량", seriesId: "M2SL", unit: "$B", interpret: "higher-bullish" },
      { name: "연준 순유동성 (Net Liquidity)", seriesId: "NETLIQ", unit: "$B", interpret: "higher-bullish",
        note: "백엔드 합성: WALCL − WTREGEN − RRPONTSYD" },
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
      { name: "금 가격 (London PM Fix)", seriesId: "GOLD", unit: "$/oz", interpret: "higher-bullish" },
      { name: "구리 가격 (Dr. Copper)", seriesId: "COPPER", unit: "$/MT", interpret: "higher-bullish" },
      { name: "반도체 사이클 (SOX)", seriesId: "SOX", unit: "index", interpret: "higher-bullish",
        note: "yfinance ^SOX (Philadelphia Semiconductor)" },
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
      { name: "주식/채권 상대강도 (SPY/TLT)", seriesId: "SPY_TLT", unit: "ratio", interpret: "higher-bullish",
        note: "백엔드 합성: yfinance SPY / TLT" },
      { name: "EPFR / ICI 펀드 플로우", seriesId: null, unit: "$B", interpret: "higher-bullish",
        note: "상업/협회 데이터 — FRED 미제공" },
    ],
  },
];

export const STOCK_LEVEL_PLACEHOLDERS = [
  { name: "이동평균선 (5/20/60/120일)", note: "정배열·이격도" },
  { name: "거래강도 (Volume Strength)", note: "거래량 회전율 / OBV" },
  { name: "Put/Call Ratio", note: "CBOE 옵션 거래 비율" },
  { name: "신고가/신저가 비율", note: "52W High vs Low Ratio" },
];

// GICS 분류 (TradingView 히트맵 grouping:"sector" 와 동일 체계)
export const SECTOR_COLOR = {
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
export const SECTOR_ABBR = {
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

// 백엔드 /invest/ndx100/ 미응답 시 사용할 fallback 리스트
export const NDX100_FALLBACK = [
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
