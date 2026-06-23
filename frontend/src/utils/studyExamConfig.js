// =====================================================================
// studyExamConfig.js — 기술사 분야/종목 정의 + 연도·회차 변환 유틸
// ---------------------------------------------------------------------
// StudyTable(연표) 과 StudyPdfImport(PDF 자동 등록) 가 공유한다.
//   · FIELDS         : 기술사 분야/종목 정의
//   · roundFor       : (연도, 회차슬롯 1~3) → 회차 번호
//   · yearForRound   : 회차 번호 → 연도 (공식 기반, roundFor 의 역함수)
//   · slotForRound   : 회차 번호 → 해당 연도의 몇 번째(1~3) 시행인지
//   · deriveYearFromRound : 회차 번호 → 연도. 이미 등록된 데이터를 우선
//     참조하고, 없으면 공식으로 계산한다.
// =====================================================================

// ===== 기술사 분야 / 종목 정의 =====
// 끝 단어가 "분야"인 항목은 분류명, 그 아래가 해당 분야의 기술사 종목.
export const FIELDS = [
  { field: "생산관리", items: ["공장관리", "품질관리", "포장"] },
  { field: "디자인", items: ["제품디자인"] },
  { field: "건축", items: ["건축구조", "건축기계설비", "건축시공", "건축품질시험"] },
  {
    field: "토목",
    items: [
      "토질및기초", "토목구조", "항만및해안", "도로및공항", "철도",
      "수자원개발", "상하수도", "농어업토목", "토목시공", "토목품질시험",
      "측량및지형공간정보", "지적", "해양", "지질및지반",
    ],
  },
  { field: "조경", items: ["조경"] },
  { field: "도시.교통", items: ["도시계획", "교통"] },
  { field: "채광", items: ["자원관리", "화약류관리"] },
  { field: "광해방지", items: ["광해방지"] },
  { field: "기계제작", items: ["기계"] },
  { field: "기계장비설비.설치", items: ["산업기계설비", "공조냉동기계", "건설기계"] },
  { field: "철도", items: ["철도차량"] },
  { field: "조선", items: ["조선"] },
  { field: "항공", items: ["항공기체", "항공기관"] },
  { field: "자동차", items: ["차량"] },
  { field: "금형.공작기계", items: ["금형"] },
  { field: "금속.재료", items: ["금속제련", "금속재료", "금속가공", "세라믹"] },
  { field: "용접", items: ["용접"] },
  { field: "도장.도금", items: ["표면처리"] },
  { field: "화공", items: ["화공"] },
  { field: "섬유", items: ["섬유", "의류"] },
  { field: "전기", items: ["발송배전", "전기응용", "철도신호", "전기철도", "건축전기설비"] },
  { field: "전자", items: ["산업계측제어", "전자응용"] },
  { field: "정보기술", items: ["정보관리", "컴퓨터시스템응용"] },
  { field: "통신", items: ["정보통신"] },
  { field: "식품", items: ["식품", "수산제조"] },
  { field: "농업", items: ["종자", "시설원예", "농화학"] },
  { field: "축산", items: ["축산"] },
  { field: "임업", items: ["산림"] },
  { field: "어업", items: ["수산양식", "어업"] },
  {
    field: "안전관리",
    items: ["기계안전", "화공안전", "전기안전", "건설안전", "소방", "산업위생관리", "가스", "인간공학"],
  },
  { field: "비파괴검사", items: ["비파괴검사"] },
  { field: "환경", items: ["대기관리", "수질관리", "자연환경관리", "소음진동", "토양환경", "폐기물처리"] },
  { field: "에너지.기상", items: ["원자력발전", "기상예보", "방사선관리"] },
];

// ===== 연도 / 회차 구성 =====
// 기술사는 1년에 3회 시행. 회차는 연속 번호.
// 2023년 = 129·130·131회 기준 → round = 129 + (year-2023)*3 + (r-1)
export const BASE_YEAR = 2023;
export const BASE_ROUND = 129;
export const START_YEAR = 2015; // 표 시작 연도 (필요시 조정)

// (연도, 회차슬롯 1~3) → 회차 번호
export const roundFor = (year, r) => BASE_ROUND + (year - BASE_YEAR) * 3 + (r - 1);

// 회차 번호 → 연도 (roundFor 의 역함수). 음수 오프셋도 floor 로 안전 처리.
export const yearForRound = (round) => {
  const n = Number(round);
  if (!Number.isFinite(n)) return null;
  return BASE_YEAR + Math.floor((n - BASE_ROUND) / 3);
};

// 회차 번호 → 해당 연도의 몇 번째 시행인지 (1, 2, 3)
export const slotForRound = (round) => {
  const n = Number(round);
  if (!Number.isFinite(n)) return null;
  return ((((n - BASE_ROUND) % 3) + 3) % 3) + 1;
};

// 회차 번호 → 연도.
// 1) 이미 등록된 examnumber 데이터에서 같은 회차의 연도를 우선 사용
//    (모든 기술사 종목이 동일한 시행 일정을 공유하므로 종목 무관)
// 2) 없으면 회차→연도 공식으로 계산
export const deriveYearFromRound = (round, examnumbers = []) => {
  const n = Number(round);
  if (!Number.isFinite(n)) return null;
  for (const en of examnumbers) {
    if (Number(en?.examnumber) === n && en?.year != null) {
      return Number(en.year);
    }
  }
  return yearForRound(n);
};
