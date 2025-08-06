// Invest.jsx
import React from "react";
import InvestSchedule from "./Inv_schedule";
import InvestMarket from "./Inv_market";
import InvestIndicator from "./Inv_indicator";

export default function Invest() {
  return (
    <div>
      <InvestSchedule />
      <InvestMarket />
      <InvestIndicator />
    </div>
  );
}
