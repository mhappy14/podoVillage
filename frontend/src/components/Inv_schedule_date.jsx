// ✅ 1. 복붙 구간 (CPI 발표일)
const rawCpiSchedule = `
October 2024	Nov. 13, 2024	08:30 AM
November 2024	Dec. 11, 2024	08:30 AM
December 2024	Jan. 15, 2025	08:30 AM
January 2025	Feb. 12, 2025	08:30 AM
February 2025	Mar. 12, 2025	08:30 AM
March 2025	Apr. 10, 2025	08:30 AM
April 2025	May 13, 2025	08:30 AM
May 2025	Jun. 11, 2025	08:30 AM
June 2025	Jul. 15, 2025	08:30 AM
July 2025	Aug. 12, 2025	08:30 AM
August 2025	Sep. 11, 2025	08:30 AM
September 2025	Oct. 15, 2025	08:30 AM
October 2025	Nov. 13, 2025	08:30 AM
November 2025	Dec. 10, 2025	08:30 AM
`;

// ✅ 1-b. 복붙 구간 (FOMC 일정)
const rawFomcSchedule = `
January	28-29
March	18-19
May	6-7
June	17-18
July	29-30
September	16-17
November	4-5
December	16-17
`;

function parseCpiSchedule(rawText) {
  const lines = rawText.trim().split("\n");
  return lines.map(line => {
    const [month, date, time] = line.split("\t").map(v => v.trim());
    return { month, date, time };
  });
}

function parseFomcSchedule(rawText) {
  const lines = rawText.trim().split("\n");
  return lines.map(line => {
    const [monthStr, rangeStr] = line.trim().split("\t");
    const [startDay] = rangeStr.split("-");
    const currentYear = new Date().getFullYear();
    const fullDateStr = `${monthStr} ${startDay}, ${currentYear}`;
    const dateObj = new Date(`${fullDateStr} 14:00:00 UTC-5`); // 오후 2시 발표 기준
    return {
      month: `${monthStr} ${currentYear}`,
      date: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: "02:00 PM"
    };
  });
}

export const cpiSchedule = parseCpiSchedule(rawCpiSchedule);
export const fomcSchedule = parseFomcSchedule(rawFomcSchedule);