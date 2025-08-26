import React, { useEffect, useMemo, useState } from 'react';
import { Form, Select, Input, Button, Typography, message } from 'antd';
import AxiosInstance from './AxiosInstance';

const { Option } = Select;
const { Text, Title } = Typography;

// 배열 정규화 헬퍼
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

export default function StudyWriteExamQsubject({ examList, onQsubjectAdd }) {
  const exams = useMemo(() => asArray(examList), [examList]);

  const [selectedExam, setSelectedExam] = useState('');
  const [examStage, setExamStage] = useState(null); // License일 때만 사용
  const [esn, setEsn] = useState('');               // 과목번호(문자열로 받아 검증)
  const [est, setEst] = useState('');               // 과목명

  const [isDupEsn, setIsDupEsn] = useState(false);
  const [isDupEst, setIsDupEst] = useState(false);

  const [loading, setLoading] = useState(false);
  const [subjectsCache, setSubjectsCache] = useState([]); // 간단한 중복 체크용 로컬 캐시

  const selectedExamObj = useMemo(
    () => exams.find((e) => String(e?.id) === String(selectedExam)),
    [exams, selectedExam]
  );
  const isLicense = selectedExamObj?.examtype === 'License';

  // ✅ "기술사" 단어 포함 여부
  const skipEst = selectedExamObj?.examname?.includes('기술사');

  // 시험이 바뀌면 해당 시험의 과목 목록을 한 번 가져와서(페이지네이션 미설정 시 일부만 올 수 있음) 중복체크에 사용
  useEffect(() => {
    if (!selectedExam) {
      setSubjectsCache([]);
      setExamStage(null);
      setIsDupEsn(false);
      setIsDupEst(false);
      return;
    }
    // License가 아니면 단계값은 비움
    if (!isLicense) setExamStage(null);

    let alive = true;
    (async () => {
      try {
        // ⚠️ 서버에서 exam 파라미터 필터가 없다면 전량을 받아 클라에서 필터합니다.
        const res = await AxiosInstance.get('examqsubject/', {
          // params: { exam: selectedExam }  // 서버에서 지원하면 주석 해제
        });
        const rows = asArray(res.data).filter((r) => String(r.exam) === String(selectedExam));
        if (!alive) return;
        setSubjectsCache(rows);
      } catch (e) {
        // 목록 실패해도 최종 POST에서 유니크 제약이 막아줍니다.
        if (!alive) return;
        setSubjectsCache([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedExam, isLicense]);

  // esn / est 변경 시 간단 중복 체크
  useEffect(() => {
    if (!selectedExam) {
      setIsDupEsn(false);
      setIsDupEst(false);
      return;
    }
    const _esn = String(esn || '').trim();
    const _est = String(est || '').trim();
    setIsDupEsn(_esn ? subjectsCache.some((s) => String(s.esn) === _esn) : false);
    setIsDupEst(_est ? subjectsCache.some((s) => String(s.est) === _est) : false);
  }, [selectedExam, esn, est, subjectsCache]);

  const handleSubmit = async () => {
    const examId = selectedExam;
    const esnStr = String(esn || '').trim();
    const estStr = String(est || '').trim();

    if (!examId) {
      message.error('시험을 선택해 주세요.');
      return;
    }
    if (isLicense && !examStage) {
      message.error('자격증 시험은 시험단계를 선택해야 합니다.');
      return;
    }
    if (!/^[1-9]\d*$/.test(esnStr)) {
      message.error('과목번호는 1 이상의 자연수만 입력할 수 있습니다.');
      return;
    }
    if (!skipEst && !estStr) {
      message.error('과목명을 입력해 주세요.');
      return;
    }
    if (isDupEsn) {
      message.warning('이미 존재하는 과목번호입니다.');
      return;
    }
    if (!skipEst && isDupEst) {
      message.warning('이미 존재하는 과목명입니다.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        exam: examId,
        esn: Number(esnStr),
        est: skipEst ? '' : estStr,
        // License가 아니면 null로 보냄(모델 clean에서 자동 None 처리)
        examstage: isLicense ? examStage : null,
      };
      const res = await AxiosInstance.post('examqsubject/', payload);
      message.success('시험 과목이 성공적으로 등록되었습니다.');
      onQsubjectAdd?.(res.data);

      // 초기화
      setEsn('');
      setEst('');
      setExamStage(isLicense ? null : null);
      // 캐시 갱신하여 다음 입력 시 즉시 중복 체크 반영
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

        {!skipEst && (
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
        )}

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            disabled={
              !selectedExam ||
              !esn ||
              isDupEsn ||
              (!skipEst && (!est || isDupEst)) ||
              (isLicense && !examStage)
            }
            loading={loading}
          >
            등록
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
