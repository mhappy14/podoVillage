// FormulaEngine — 사용자 정의 종합시그널 공식 컴파일/평가기

export const ALLOWED_IDENTIFIERS = new Set([
  "bullW", "bearW", "neutW", "totalW", "count", "score",
  "Math", "abs", "sqrt", "min", "max", "pow", "log", "log10", "exp",
  "PI", "E",
  "w", "s",
  "true", "false", "null",
]);

const FORBIDDEN_KEYWORDS = [
  "__", "constructor", "prototype", "eval", "Function", "window",
  "globalThis", "this", "import", "require", "process",
];

const ALLOWED_CHAR_RE = /^[\s\d.+\-*/()<>=!&|?:,_"'\p{L}\p{N}]+$/u;

export const DEFAULT_FORMULA = Object.freeze({
  id: "__default__",
  name: "기본 공식",
  description: "긍정/부정 가중치 차이를 정규화하여 -100 ~ +100 점수로 환산",
  display_text: "(Σ긍정 − Σ부정) / Σw × 100",
  compiled_text: "totalW > 0 ? (bullW - bearW) / totalW * 100 : 0",
  is_default: true,
});

const DISPLAY_TO_COMPILED = [
  [/Σ긍정/g, "bullW"],
  [/Σ부정/g, "bearW"],
  [/Σ중립/g, "neutW"],
  [/Σw/g,    "totalW"],
  [/π/g,     "Math.PI"],
  [/×/g, "*"],
  [/÷/g, "/"],
  [/−/g, "-"],
  [/\^/g, "**"],
  [/²/g, "**2"],
  [/³/g, "**3"],
  [/√/g, "Math.sqrt"],
];

function transformAbs(input) {
  let out = "";
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "|") {
      if (depth === 0) { out += "abs("; depth = 1; }
      else { out += ")"; depth = 0; }
    } else { out += ch; }
  }
  return out;
}

export function compileDisplay(display) {
  let s = String(display ?? "");
  for (const [re, rep] of DISPLAY_TO_COMPILED) s = s.replace(re, rep);
  s = transformAbs(s);
  return s.trim();
}

export function validateCompiled(compiled) {
  const s = String(compiled ?? "").trim();
  if (!s) throw new Error("평가식이 비어 있습니다.");
  if (s.length > 1000) throw new Error("평가식이 너무 깁니다 (최대 1000자).");
  if (!ALLOWED_CHAR_RE.test(s)) throw new Error("허용되지 않은 문자가 포함되어 있습니다.");
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (s.includes(kw)) throw new Error("금지된 키워드: " + kw);
  }
  const codeOnly = s.replace(/"[^"]*"|'[^']*'/g, '""');
  const idents = codeOnly.match(/[A-Za-z_][A-Za-z_0-9]*/g) || [];
  for (const ident of idents) {
    if (!ALLOWED_IDENTIFIERS.has(ident)) {
      throw new Error("허용되지 않은 식별자: " + ident);
    }
  }
  let bal = 0;
  for (const ch of s) {
    if (ch === "(") bal++;
    else if (ch === ")") bal--;
    if (bal < 0) throw new Error("괄호 짝이 맞지 않습니다.");
  }
  if (bal !== 0) throw new Error("괄호 짝이 맞지 않습니다.");
  return s;
}

export function makeEvaluator(compiled) {
  const safe = validateCompiled(compiled);
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    "bullW", "bearW", "neutW", "totalW", "count", "score",
    "w", "s",
    "abs", "sqrt", "min", "max", "pow", "log", "log10", "exp",
    "PI", "E", "Math",
    '"use strict"; return (' + safe + ');'
  );
  return (scope) => {
    const weights = scope.weights || {};
    const signals = scope.signals || {};
    const w = (name) => {
      const v = weights[name];
      return typeof v === "number" ? v : 0;
    };
    const s = (name) => {
      const sig = signals[name];
      if (sig === "bullish") return 1;
      if (sig === "bearish") return -1;
      return 0;
    };
    const result = fn(
      scope.bullW ?? 0, scope.bearW ?? 0, scope.neutW ?? 0,
      scope.totalW ?? 0, scope.count ?? 0, scope.score ?? 0,
      w, s,
      Math.abs, Math.sqrt, Math.min, Math.max, Math.pow,
      Math.log, Math.log10, Math.exp,
      Math.PI, Math.E, Math,
    );
    if (typeof result !== "number" || !isFinite(result)) return 0;
    return result;
  };
}

export function compileAndEvaluate(display) {
  const compiled = compileDisplay(display);
  const evaluate = makeEvaluator(compiled);
  return { compiled, evaluate };
}

export const SYMBOL_PALETTE = [
  { group: "변수", tokens: [
    { label: "Σ긍정", insert: "Σ긍정", desc: "긍정 가중치 합" },
    { label: "Σ부정", insert: "Σ부정", desc: "부정 가중치 합" },
    { label: "Σ중립", insert: "Σ중립", desc: "중립 가중치 합" },
    { label: "Σw",   insert: "Σw",   desc: "전체 가중치 합" },
    { label: "count", insert: "count", desc: "참여 지표 수" },
  ]},
  { group: "연산", tokens: [
    { label: "+", insert: " + " },
    { label: "−", insert: " − " },
    { label: "×", insert: " × " },
    { label: "÷", insert: " ÷ " },
    { label: "(", insert: "(" },
    { label: ")", insert: ")" },
  ]},
  { group: "함수", tokens: [
    { label: "x²",  insert: "²",  desc: "제곱" },
    { label: "x³",  insert: "³",  desc: "세제곱" },
    { label: "x^y", insert: "^",  desc: "거듭제곱" },
    { label: "√",   insert: "√(", desc: "제곱근" },
    { label: "|x|", insert: "|",  desc: "절댓값" },
    { label: "abs", insert: "abs(", desc: "절댓값" },
    { label: "min", insert: "min(", desc: "최솟값" },
    { label: "max", insert: "max(", desc: "최댓값" },
  ]},
  { group: "상수", tokens: [
    { label: "π",   insert: "π" },
    { label: "100", insert: "100" },
    { label: "20",  insert: "20" },
  ]},
];
