import React from "react";
import InvestMap from "./Inv_map";
import InvestSchedule from "./Inv_schedule";
import InvestIndicator from "./Inv_indicator";

export default function Invest() {
  return (
    <div>
      <InvestIndicator />
      <InvestSchedule />
      <InvestMap />
    </div>
  );
}

//AUTH/backend/app/
//AUTH/frontend/src/components/Inv_indicator.jsx


// FRED
// 미국채 10년물 금리 (예: DGS10)
// 소비자물가지수 CPI (CPIAUCSL)
// 장단기 금리차 10Y-2Y (T10Y2Y)
// M2 통화량 (M2SL)
// 하이일드 스프레드 (Bank of America Merrill Lynch series, e.g. BAMLH0A0HYM2)
// VIX 지수 (VIXCLS)
// 원자재/구리 가격(구체적 시리즈로 존재할 가능성 있음 — 확인 필요)
// 일부 주가지수(예: SP500) — ETF 비율(예: SPY/TLT) 는 FRED에 바로 있는 경우도 있고 없을 수 있음(ETF 가격은 별도 시리즈)
// 일부 금리 스프레드(예: LIBOR-OIS 관련 시리즈 중 일부는 있음 — 정확한 아이디 확인 필요)
// 비트코인 가격: FRED에 CBBTCUSD 등으로 있는 경우(확인 필요)

// 계산
// 주식/채권 상대 강도 (SPY/TLT 비율) — 두 시리즈 있으면 계산 가능(직접 제공은 아님)
// 이동평균선 정배열 및 이격도 — 원자료로는 가능, 자체 계산 필요
// 주식 대비 채권 수익률 (Equity Risk Premium) — 직접 제공되는 경우 드물고 계산 필요
// 장기 국채 수익률 곡선(정확한 Term Premium) — FRED에 관련 추정 시리즈가 있으나 여러 버전(확인 필요)
// 신고가/신저가 비율, 이동평균 기반 지표 등 — 원자료는 있고 파생 계산 필요

// 확인필요
// 펀드 플로우(EPFR) — EPFR 데이터는 상업 데이터(EPFR) 제공사 소유, FRED엔 없음
// BoA Bull & Bear Indicator — Bank of America 산출 지표로 FRED에 없음(상업지표)
// Put/Call Ratio (CBOE 등) — CBOE 제공, 일부는 FRED에 없을 가능성 높음(확인 필요)
// CNN Fear & Greed Index — CNN 소유 지표, FRED에 없음
// 신용잔고 및 고객예탁금 (브로커별/국내 증권사 데이터) — 일반적으로 FRED엔 없음(국가 통계엔 일부 유사 항목 존재 가능)
// EPFR, BoA 지표, CNN 지수 등은 상업·언론 소유 데이터여서 FRED에 제공되지 않음