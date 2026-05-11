// =====================================================================
// StudyWriteExamQsubject.jsx — 시험 과목 등록
// ---------------------------------------------------------------------
// 모드:
//  · 기술사: examstage 입력 X, 시험회차(Examnumber) 선택 → esn=1~4 자동 일괄 생성
//  · 비-기술사 자격증: examstage(1차/2차/3차) + 과목번호(esn) + 과목명(est)
//  · 그 외(공무원 등): 과목번호(esn) + 과목명(est)
// =====================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Form, Select, Input, Button, Typography, message, Tag, Space, Alert } from 'antd';
import AxiosInstance from './AxiosInstance';

const { Option } = Select;
const { Text, Title } = Typography;

const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

const STAGE_OPTIONS = [
  { value: '1st', label: '1차' },
  { value: '2nd', label: '2차' },
  { value: '3rd', label: '3차' },
];

// 기술사 시험은 4교시 고정 (필요 시 종목별로 다르게 조정 가능)
const ENGINEER_PERIODS = [1, 2, 3, 4];

export default function StudyWriteExamQsubject({ examList, onQsubjectAdd }) {
  const exams = useMemo(() => asArray(examList), [examList]);

  const [selectedExam, setSelectedExam] = useState('');
  const [examStage, setExamStage] = useState(null);
  const [esn, setEsn] = useState('');
  const [est, setEst] = useState('');

  // 기술사 모드 전용
  const [examnumberList, setExamnumberList] = useState([]);
  const [selectedExamnumberId, setSelectedExamnumberId] = useState(null);

  const [isDupEsn, setIsDupEsn] = useState(false);
  const [isDupEst, setIsDupEst] = useState(false);

  const [loading, setLoading] = useState(false);
  const [subjectsCache, setSubjectsCache] = useState([]); // 중복 체크용 캐시

  const selectedExamObj = useMemo(
    () => exams.find((e) => String(e?.id) === String(selectedExam)),
    [exams, selectedExam]
  );
  const isLicense = selectedExamObj?.examtype === 'License';
  const isEngineer = !!selectedExamObj && (selectedExamObj.examname || '').includes('기술사');

  // 시험이 바뀌면 해당 시험의 과목 + 회차를 fetch
  useEffect(() => {
    if (!selectedExam) {
      setSubjectsCache([]);
      setExamnumberList([]);
      setExamStage(null);
      setSelectedExamnumberId(null);
      setIsDupEsn(false);
      setIsDupEst(false);
      return;
    }
    if (!isLicense) setExamStage(null);

    let alive = true;
    (async () => {
      try {
        const [qsRes, enRes] = await Promise.all([
          AxiosInstance.get('examqsubject/'),
          AxiosInstance.get('examnumber/'),
        ]);
        const qsRows = asArray(qsRes.data).filter(
          (r) => String(typeof r.exam === 'object' ? r.exam?.id : r.exam) === String(selectedExam)
        );
        const enRows = asArray(enRes.data).filter(
          (r) => String(typeof r.exam === 'object' ? r.exam?.id : r.exam) === String(selectedExam)
        );
        if (!alive) return;
        setSubjectsCache(qsRows);
        // 회차 정렬: 최신 → 과거
        setExamnumberList(
          enRows.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.examnumber - a.examnumber;
          })
        );
      } catch (e) {
        if (!alive) return;
        setSubjectsCache([]);
        setExamnumberList([]);
      }
    })();
    return () => { alive = false; };
  }, [selectedExam, isLicense]);

  // 비-기술사: esn/est 중복 체크
  useEffect(() => {
    if (!selectedExam || isEngineer) {
      setIsDupEsn(false);
      setIsDupEst(false);
      return;
    }
    const _esn = String(esn || '').trim();
    const _est = String(est || '').trim();
    setIsDupEsn(_esn ? subjectsCache.some((s) => String(s.esn) === _esn) : false);
    setIsDupEst(_est ? subjectsCache.some((s) => String(s.est) === _est) : false);
  }, [selectedExam, esn, est, subjectsCache, isEngineer]);

  // 기술사 모드: 선택된 회차의 이미 등록된 esn 목록 (4교시 중 어떤 게 이미 있는지)
  const existingEsnInExamnumber = useMemo(() => {
    if (!isEngineer || !selectedExamnumberId) return new Set();
    return new Set(
      subjectsCache
        .filter(
          (s) => String(typeof s.examnumber === 'object' ? s.examnumber?.id : s.examnumber) ===
            String(selectedExamnumberId)
        )
        .map((s) => Number(s.esn))
    );
  }, [subjectsCache, isEngineer, selectedExamnumberId]);

  // ====== 등록 ======
  const handleSubmit = async () => {
    if (!selectedExam) return message.error('시험을 선택해 주세요.');

    // ── 기술사 분기: 회차 선택 → 1~4교시 자동 일괄 등록
    if (isEngineer) {
      if (!selectedExamnumberId) return message.error('시험회차를 선택해 주세요.');

      const toCreate = ENGINEER_PERIODS.filter((n) => !existingEsnInExamnumber.has(n));
      if (toCreate.length === 0) {
        return message.info('해당 회차의 1~4교시는 이미 모두 등록되어 있습니다.');
      }

      setLoading(true);
      let ok = 0;
      let fail = 0;
      const created = [];
      for (const n of toCreate) {
        try {
          const res = await AxiosInstance.post('examqsubject/', {
            exam: selectedExam,
            examnumber: selectedExamnumberId,
            esn: n,
            est: '',
            examstage: null,
          });
          created.push(res.data);
          ok += 1;
        } catch (e) {
          console.warn(`${n}교시 등록 실패:`, e?.response?.data || e);
          fail += 1;
        }
      }
      setLoading(false);
      message[ok > 0 ? 'success' : 'error'](
        `1~4교시 일괄 등록 — 성공 ${ok}건${fail ? ` / 실패 ${fail}건` : ''}`
      );
      if (ok > 0) {
        setSubjectsCache((prev) => [...created, ...prev]);
        created.forEach((c) => onQsubjectAdd?.(c));
      }
      return;
    }

    // ── 비-기술사: 기존 로직
    const esnStr = String(esn || '').trim();
    const estStr = String(est || '').trim();

    if (isLicense && !examStage) {
      message.error('자격증 시험은 시험단계를 선택해야 합니다.');
      return;
    }
    if (!/^[1-9]\d*$/.test(esnStr)) {
      message.error('과목번호는 1 이상의 자연수만 입력할 수 있습니다.');
      return;
    }
    if (!estStr) {
      message.error('과목명을 입력해 주세요.');
      return;
    }
    if (isDupEsn) return message.warning('이미 존재하는 과목번호입니다.');
    if (isDupEst) return message.warning('이미 존재하는 과목명입니다.');

    setLoading(true);
    try {
      const payload = {
        exam: selectedExam,
        esn: Number(esnStr),
        est: estStr,
        examstage: isLicense ? examStage : null,
      };
      const res = await AxiosInstance.post('examqsubject/', payload);
      message.success('시험 과목이 성공적으로 등록되었습니다.');
      onQsubjectAdd?.(res.data);
      setEsn('');
      setEst('');
      setExamStage(null);
      setSubjectsCache((prev) => [res.data, ...prev]);
    } catch (err) {
      const apiMsg =
        err?.response?.data?.detail ||
        (typeof err?.response?.data === 'object'
          ? JSON.stringify(err.response.data)
          : err?.response?.data) ||
        err.message;
      message.error(`등록 실패: ${apiMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <Title level={5}>Exam Subject</Title>
      <Form layout="vertical" onFinish={handleSubmit} disabled={loading}>
        <Form.Item label="시험명" required>
          <Select
            value={selectedExam}
            onChange={(v) => setSelectedExam(v)}
            placeholder="시험명을 선택하세요"
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {exams.map((exam) => (
              <Option key={exam?.id} value={exam?.id}>
                {exam?.examtype === 'Public'
                  ? `${exam?.ragent ?? ''} ${exam?.rposition ?? ''} ${exam?.examname ?? ''}`
                  : exam?.examname}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* ── 기술사 분기 UI ── */}
        {isEngineer ? (
          <>
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 12 }}
              message="기술사 시험 — 1~4교시 자동 등록됨"
              description={
                <span style={{ fontSize: 12 }}>
                  기술사 시험은 <strong>시험회차 등록 시점에 1~4교시(esn 1~4)가 자동으로
                  일괄 생성</strong>됩니다. 따라서 이 화면에서 별도로 과목을 등록할 필요가
                  없습니다.
                  <br />
                  ※ 혹시 자동 생성이 누락된 회차가 있을 경우, 아래에서 회차를 선택해 누락
                  교시만 보충할 수 있습니다.
                </span>
              }
            />
            <Form.Item label="시험회차 (확인용)">
              <Select
                value={selectedExamnumberId}
                onChange={setSelectedExamnumberId}
                placeholder={
                  examnumberList.length === 0
                    ? '등록된 회차가 없습니다 — 먼저 회차를 등록하세요'
                    : 'YYYY(nnn회) — 등록 상태 확인'
                }
                allowClear
                showSearch
                optionFilterProp="label"
                disabled={examnumberList.length === 0}
                options={examnumberList.map((en) => ({
                  value: en.id,
                  label: `${en.year}(${en.examnumber}회)`,
                }))}
              />
            </Form.Item>

            {selectedExamnumberId && (
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  현재 회차 등록 상태:{' '}
                </Text>
                {ENGINEER_PERIODS.map((n) => (
                  <Tag
                    key={n}
                    color={existingEsnInExamnumber.has(n) ? 'green' : 'red'}
                  >
                    {n}교시 {existingEsnInExamnumber.has(n) ? '✓' : '✗'}
                  </Tag>
                ))}
                {ENGINEER_PERIODS.every((n) => existingEsnInExamnumber.has(n)) ? (
                  <Text type="success" style={{ fontSize: 11, marginLeft: 4 }}>
                    — 1~4교시 모두 등록 완료 (추가 작업 불필요)
                  </Text>
                ) : (
                  <Text type="warning" style={{ fontSize: 11, marginLeft: 4 }}>
                    — 누락된 교시가 있어 아래 버튼으로 보충 가능합니다.
                  </Text>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {isLicense && (
              <Form.Item label="시험 단계" required>
                <Select
                  value={examStage}
                  onChange={setExamStage}
                  placeholder="1차 / 2차 / 3차"
                  allowClear
                >
                  {STAGE_OPTIONS.map((o) => (
                    <Option key={o.value} value={o.value}>
                      {o.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            <Form.Item label="과목번호" required>
              <Input
                placeholder={selectedExam ? '과목번호(자연수)' : '시험을 먼저 선택하세요.'}
                value={esn}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^[1-9]\d*$/.test(v) || v === '') setEsn(v);
                }}
                disabled={!selectedExam}
                inputMode="numeric"
              />
              {isDupEsn && <Text type="danger">이미 존재하는 과목번호입니다.</Text>}
            </Form.Item>

            <Form.Item label="과목명" required>
              <Input
                placeholder="과목명을 입력하세요."
                value={est}
                onChange={(e) => setEst(e.target.value)}
                disabled={!selectedExam}
                maxLength={200}
                showCount
              />
              {isDupEst && <Text type="danger">이미 존재하는 과목명입니다.</Text>}
            </Form.Item>
          </>
        )}

        <Form.Item>
          {(() => {
            // 기술사: 1~4교시 모두 등록되어 있으면 비활성, 누락 있으면 "누락 교시 보충" 라벨로 활성
            const missingEng = isEngineer && selectedExamnumberId
              ? ENGINEER_PERIODS.filter((n) => !existingEsnInExamnumber.has(n))
              : null;
            const engAllDone = isEngineer && selectedExamnumberId && missingEng && missingEng.length === 0;

            const disabled =
              !selectedExam ||
              (isEngineer && (!selectedExamnumberId || engAllDone)) ||
              (!isEngineer && (!esn || isDupEsn || !est || isDupEst || (isLicense && !examStage)));

            let label;
            if (isEngineer) {
              if (!selectedExamnumberId) label = '회차 선택 필요';
              else if (engAllDone) label = '1~4교시 모두 등록됨 (작업 불필요)';
              else label = `누락 교시 보충 등록 (${missingEng.length}건)`;
            } else {
              label = '등록';
            }

            return (
              <Button
                type="primary"
                htmlType="submit"
                block
                disabled={disabled}
                loading={loading}
              >
                {label}
              </Button>
            );
          })()}
        </Form.Item>
      </Form>
    </div>
  );
}
