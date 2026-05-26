// =====================================================================
// FormulaBuilder — 사용자 정의 공식 빌더 모달 (1단계)
// ---------------------------------------------------------------------
// · 수학기호 버튼 팔레트 + 자유 텍스트 입력으로 공식을 작성
// · 현재 summary 값으로 즉시 미리보기 (S = ...) 계산
// · 저장 시 백엔드 /invest/formulas/ 로 POST/PUT
// · 검증 실패 / 빈 입력 / 위험 키워드는 저장 차단
// =====================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Input,
  Button,
  Typography,
  Tooltip,
  Tag,
  Alert,
  Divider,
  message,
} from "antd";
import AxiosInstance from "../AxiosInstance";
import {
  SYMBOL_PALETTE,
  compileDisplay,
  validateCompiled,
  makeEvaluator,
  ALLOWED_IDENTIFIERS,
} from "./FormulaEngine";
import { SECTIONS, STOCK_INDICATORS } from "./constants";

const { Text } = Typography;

// ---------- 지표 짧은 라벨 ----------
const SHORT_LABEL_MAP = {
  "연준 기준금리 (Fed Funds Upper)": "연준금리",
  "미 국채 10년물 금리": "10Y금리",
  "장단기 금리차 (10Y-2Y)": "장단기차",
  "실질금리 (10Y TIPS)": "실질금리",
  "SIFMA 채권 발행 통계": "SIFMA",
  "TIC 데이터 (해외 자금흐름)": "TIC",
  "MOVE 지수 (채권 변동성)": "MOVE",
  "COT 리포트 (포지셔닝)": "COT",
  "M2 통화량": "M2",
  "연준 순유동성 (Net Liquidity)": "순유동성",
  "SOFR 금리": "SOFR",
  "달러 인덱스 (Broad USD)": "달러지수",
  "소비자물가지수 (CPI)": "CPI",
  "ISM 제조업 PMI (Philly Fed Proxy)": "제조PMI",
  "ISM 서비스업 PMI": "서비스PMI",
  "금 가격 (London PM Fix)": "금가격",
  "구리 가격 (Dr. Copper)": "구리",
  "반도체 사이클 (SOX)": "SOX",
  "하이일드 스프레드 (BofA)": "하이일드",
  "SLOOS 대출 태도 (C&I)": "SLOOS",
  "VIX 지수 (공포 지수)": "VIX",
  "주식/채권 상대강도 (SPY/TLT)": "SPY/TLT",
  "EPFR / ICI 펀드 플로우": "EPFR",
  "이동평균선": "MA",
  "거래강도": "Vol",
  "P/C Ratio": "P/C",
  "신고가저가": "HiLo",
};

// 섹터별 지표 팔레트 구성 (SECTIONS + 종목)
function buildIndicatorPalette() {
  const rows = SECTIONS.map((section) => {
    const groupName = section.title.replace(/^\d+\.\s/, "").replace(" 지표", "");
    const indicators = section.items.map((item) => ({
      label: SHORT_LABEL_MAP[item.name] || item.name.slice(0, 5),
      fullName: item.name,
      desc: item.name,
    }));
    const sums = indicators.map((i) => `s("${i.fullName}")`);
    const sumInsert = `(${sums.join(" + ")})`;
    const avgInsert = `((${sums.join(" + ")}) / ${indicators.length})`;
    return { group: groupName, indicators, sumInsert, avgInsert };
  });

  // 7번째 줄: 종목 지표
  const stockIndicators = STOCK_INDICATORS.map((it) => ({
    label: it.shortName,
    fullName: it.name,
    desc: it.name,
  }));
  const stockSums = stockIndicators.map((i) => `s("${i.fullName}")`);
  rows.push({
    group: "종목",
    indicators: stockIndicators,
    sumInsert: `(${stockSums.join(" + ")})`,
    avgInsert: `((${stockSums.join(" + ")}) / ${stockIndicators.length})`,
  });

  return rows;
}

const INDICATOR_PALETTE = buildIndicatorPalette();

// ---------- 유틸 ----------
// compiled 식 → 사용한 식별자 메타데이터 (저장용)
function extractVariables(compiled) {
  const idents = compiled.match(/[A-Za-z_][A-Za-z_0-9]*/g) || [];
  const used = Array.from(new Set(idents)).filter((id) => ALLOWED_IDENTIFIERS.has(id));
  return used;
}

// ---------- 본 컴포넌트 ----------
export default function FormulaBuilder({
  open,
  initial,          // 편집 모드일 때 기존 공식 객체 (id 포함)
  onCancel,
  onSaved,          // 저장 성공 시 (formula) => void
  summary,          // 미리보기에 사용할 현재 summary {bullW,bearW,neutW,totalW,count,score}
  scope,            // {weights, signals} — w("name"), s("name") 평가용
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef(null);

  // open / initial 바뀔 때 초기화
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setDisplayText(initial?.display_text ?? "(Σ긍정 − Σ부정) ÷ Σw × 100");
  }, [open, initial]);

  // ---------- 토큰 삽입 ----------
  const insertToken = useCallback((token) => {
    const el = inputRef.current?.resizableTextArea?.textArea
            ?? inputRef.current?.input
            ?? null;
    setDisplayText((prev) => {
      // textarea 의 커서 위치를 가져와 그 자리에 삽입
      if (el && typeof el.selectionStart === "number") {
        const start = el.selectionStart;
        const end   = el.selectionEnd;
        const next = prev.slice(0, start) + token + prev.slice(end);
        // 커서 이동
        requestAnimationFrame(() => {
          el.focus();
          const pos = start + token.length;
          try { el.setSelectionRange(pos, pos); } catch { /* noop */ }
        });
        return next;
      }
      return prev + token;
    });
  }, []);

  // ---------- compile + preview ----------
  const compiledInfo = useMemo(() => {
    const compiled = compileDisplay(displayText);
    let error = null;
    let evaluator = null;
    try {
      validateCompiled(compiled);
      evaluator = makeEvaluator(compiled);
    } catch (e) {
      error = e?.message || "검증 실패";
    }
    return { compiled, error, evaluator };
  }, [displayText]);

  const previewValue = useMemo(() => {
    if (!compiledInfo.evaluator || !summary) return null;
    try {
      const v = compiledInfo.evaluator({
        bullW: summary.bullW,
        bearW: summary.bearW,
        neutW: summary.neutW,
        totalW: summary.totalW,
        count: summary.count,
        score: summary.score,
        weights: scope?.weights,
        signals: scope?.signals,
      });
      return v;
    } catch (e) {
      return null;
    }
  }, [compiledInfo, summary, scope]);

  // ---------- 저장 ----------
  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      message.warning("공식 이름을 입력해주세요.");
      return;
    }
    if (compiledInfo.error) {
      message.error(`수식 오류: ${compiledInfo.error}`);
      return;
    }
    if (!localStorage.getItem("Token")) {
      message.error("로그인이 필요합니다.");
      return;
    }
    const payload = {
      name: trimmedName,
      description: description.trim(),
      display_text: displayText.trim(),
      compiled_text: compiledInfo.compiled,
      variables: extractVariables(compiledInfo.compiled),
    };
    setSubmitting(true);
    try {
      let res;
      if (initial?.id) {
        res = await AxiosInstance.put(`/invest/formulas/${initial.id}/`, payload);
      } else {
        res = await AxiosInstance.post(`/invest/formulas/`, payload);
      }
      message.success("공식이 저장되었습니다.");
      onSaved?.(res.data);
    } catch (e) {
      const detail =
        e?.response?.data?.detail
        || (typeof e?.response?.data === "object"
              ? JSON.stringify(e.response.data)
              : null)
        || e?.message
        || "저장 실패";
      message.error(`저장 실패: ${detail}`);
    } finally {
      setSubmitting(false);
    }
  }, [name, description, displayText, compiledInfo, initial, onSaved]);

  return (
    <Modal
      open={open}
      title={initial?.id ? "공식 편집" : "새 공식 만들기"}
      onCancel={onCancel}
      width={720}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={submitting}>
          취소
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={submitting}
          disabled={!!compiledInfo.error || !name.trim()}
          onClick={handleSave}
        >
          저장
        </Button>,
      ]}
      destroyOnClose
    >
      {/* 이름 + 설명 — 한 줄 (라벨을 addonBefore로 인라인 표기) */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Input
          addonBefore={<span style={{ fontSize: 11, whiteSpace: "nowrap" }}>이름</span>}
          placeholder="예: 변동성 가중 공식"
          value={name}
          maxLength={100}
          style={{ flex: "0 0 240px" }}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          addonBefore={<span style={{ fontSize: 11, whiteSpace: "nowrap" }}>설명</span>}
          placeholder="짧은 설명 (선택)"
          value={description}
          maxLength={255}
          style={{ flex: 1 }}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <Divider style={{ margin: "12px 0" }} />

      {/* ── 지표 + 변수 팔레트 ── */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
          <Text strong style={{ fontSize: 12 }}>지표 삽입</Text>
          <Text type="secondary" style={{ fontSize: 10 }}>
            (섹터→합산 · 개별→단일 · 평균→평균값)
          </Text>
        </div>

        {/* 변수 행 — 최상단 */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 6, paddingBottom: 6, borderBottom: "1px dashed #e8e8e8" }}>
          <Tag style={{ margin: 0, fontSize: 10, lineHeight: "18px", flexShrink: 0 }}>변수</Tag>
          {[
            {
              label: "Σ긍정", insert: "Σ긍정",
              desc: "긍정(bullish) 시그널을 보낸 지표들의 가중치 합산\n→ 강세로 판단된 지표들의 weight 총합",
            },
            {
              label: "Σ부정", insert: "Σ부정",
              desc: "부정(bearish) 시그널을 보낸 지표들의 가중치 합산\n→ 약세로 판단된 지표들의 weight 총합",
            },
            {
              label: "Σ중립", insert: "Σ중립",
              desc: "중립(neutral) 시그널을 보낸 지표들의 가중치 합산\n→ 방향성 없는 지표들의 weight 총합",
            },
            {
              label: "Σw", insert: "Σw",
              desc: "전체 지표 가중치의 합산 (= Σ긍정 + Σ부정 + Σ중립)\n→ 정규화 분모로 주로 사용",
            },
            {
              label: "count", insert: "count",
              desc: "현재 평가에 참여한 지표의 총 개수\n→ 활성 지표 수 기반 평균 계산에 유용",
            },
          ].map((v) => (
            <Tooltip
              key={v.label}
              title={<span style={{ whiteSpace: "pre-line", fontSize: 11 }}>{v.desc}</span>}
              overlayStyle={{ maxWidth: 360 }}
            >
              <Button
                size="small"
                style={{ fontSize: 11, padding: "0 6px", height: 22, fontFamily: "ui-monospace, monospace", fontWeight: 600 }}
                onClick={() => insertToken(v.insert)}
              >
                {v.label}
              </Button>
            </Tooltip>
          ))}
        </div>

        {/* 지표 팔레트 — 2열 × 4행 */}
        <div style={{ display: "flex", gap: 0 }}>
          {/* 왼쪽 열: 0~3번째 섹터 */}
          <div style={{ flex: 1, paddingRight: 8 }}>
            {INDICATOR_PALETTE.slice(0, 4).map((row) => (
              <div key={row.group} style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap", marginBottom: 5 }}>
                <Tooltip title={`${row.group} 합산: ${row.sumInsert}`}>
                  <Button size="small" type="primary" ghost
                    style={{ fontSize: 10, minWidth: 40, padding: "0 5px", height: 22, fontWeight: 700, flexShrink: 0 }}
                    onClick={() => insertToken(row.sumInsert)}
                  >
                    {row.group}
                  </Button>
                </Tooltip>
                {row.indicators.map((ind) => (
                  <Tooltip key={ind.fullName} title={ind.desc}>
                    <Button size="small"
                      style={{ fontSize: 10, padding: "0 4px", height: 22, fontFamily: "ui-monospace, monospace" }}
                      onClick={() => insertToken(`s("${ind.fullName}")`)}
                    >
                      {ind.label}
                    </Button>
                  </Tooltip>
                ))}
                <Tooltip title={`${row.group} 평균: ${row.avgInsert}`}>
                  <Button size="small"
                    style={{ fontSize: 10, padding: "0 5px", height: 22, color: "#722ed1", borderColor: "#722ed1", flexShrink: 0 }}
                    onClick={() => insertToken(row.avgInsert)}
                  >
                    평균
                  </Button>
                </Tooltip>
              </div>
            ))}
          </div>

          {/* 오른쪽 열: 4~7번째 섹터 */}
          <div style={{ flex: 1, paddingLeft: 8, borderLeft: "1px solid #f0f0f0" }}>
            {INDICATOR_PALETTE.slice(4).map((row) => (
              <div key={row.group} style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap", marginBottom: 5 }}>
                <Tooltip title={`${row.group} 합산: ${row.sumInsert}`}>
                  <Button size="small" type="primary" ghost
                    style={{ fontSize: 10, minWidth: 40, padding: "0 5px", height: 22, fontWeight: 700, flexShrink: 0 }}
                    onClick={() => insertToken(row.sumInsert)}
                  >
                    {row.group}
                  </Button>
                </Tooltip>
                {row.indicators.map((ind) => (
                  <Tooltip key={ind.fullName} title={ind.desc}>
                    <Button size="small"
                      style={{ fontSize: 10, padding: "0 4px", height: 22, fontFamily: "ui-monospace, monospace" }}
                      onClick={() => insertToken(`s("${ind.fullName}")`)}
                    >
                      {ind.label}
                    </Button>
                  </Tooltip>
                ))}
                <Tooltip title={`${row.group} 평균: ${row.avgInsert}`}>
                  <Button size="small"
                    style={{ fontSize: 10, padding: "0 5px", height: 22, color: "#722ed1", borderColor: "#722ed1", flexShrink: 0 }}
                    onClick={() => insertToken(row.avgInsert)}
                  >
                    평균
                  </Button>
                </Tooltip>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 수학 기호 1줄 ── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 6, paddingTop: 6, borderTop: "1px solid #f0f0f0" }}>
        <Text strong style={{ fontSize: 11, marginRight: 2, flexShrink: 0 }}>기호</Text>
        {SYMBOL_PALETTE.filter((g) => g.group !== "변수").map((g, gi, arr) => (
          <React.Fragment key={g.group}>
            {gi > 0 && <span style={{ color: "#d9d9d9", fontSize: 13, lineHeight: "22px" }}>│</span>}
            {g.tokens.map((t) => (
              <Tooltip key={t.label} title={t.desc || t.insert.trim()}>
                <Button
                  size="small"
                  style={{ fontSize: 11, padding: "0 3px", height: 22, fontFamily: "ui-monospace, monospace", minWidth: 24 }}
                  onClick={() => insertToken(t.insert)}
                >
                  {t.label}
                </Button>
              </Tooltip>
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* 입력 */}
      <Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
        공식 (수학기호 그대로 사용 가능)
      </Text>
      <Input.TextArea
        ref={inputRef}
        rows={3}
        value={displayText}
        onChange={(e) => setDisplayText(e.target.value)}
        placeholder="예: (Σ긍정 − Σ부정) ÷ Σw × 100"
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
          fontSize: 13,
        }}
      />

      {/* 컴파일 미리보기 */}
      <div
        style={{
          marginTop: 8,
          padding: 8,
          background: "#fafafa",
          border: "1px solid #f0f0f0",
          borderRadius: 4,
          fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>JS 호환식:</Text>{" "}
          <Text code style={{ fontSize: 11 }}>{compiledInfo.compiled || "—"}</Text>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>현재 값 미리보기:</Text>{" "}
          {compiledInfo.error ? (
            <Text type="danger" style={{ fontSize: 11 }}>{compiledInfo.error}</Text>
          ) : previewValue == null ? (
            <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
          ) : (
            <Text strong style={{ fontSize: 11 }}>
              {previewValue >= 0 ? "+" : ""}{Number(previewValue).toFixed(2)}
            </Text>
          )}
        </div>
        {summary && (
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 10 }}>
              현재 summary — bullW={summary.bullW}, bearW={summary.bearW},
              neutW={summary.neutW}, totalW={summary.totalW}, count={summary.count}
            </Text>
          </div>
        )}
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginTop: 10 }}
        message={
          <Text style={{ fontSize: 11 }}>
            사용 가능한 변수: <Text code>Σ긍정 (bullW)</Text>, <Text code>Σ부정 (bearW)</Text>,
            <Text code>Σ중립 (neutW)</Text>, <Text code>Σw (totalW)</Text>,
            <Text code>count</Text>, <Text code>score</Text>.
            함수: <Text code>abs(x), sqrt(x), min(a,b), max(a,b), pow(a,b)</Text>,
            <Text code>w("지표명"), s("지표명")</Text>
          </Text>
        }
      />
    </Modal>
  );
}
