import React, { useEffect, useMemo, useState } from 'react';
import { Form, Select, Input, Button, Typography, message } from 'antd';
import AxiosInstance from './AxiosInstance';

const { Option } = Select;
const { Text } = Typography;

// 배열/페이징 응답 정규화
const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

const StudyWriteQuestion = ({ examList, examNumberList, onQuestionAdd }) => {
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedExamNumber, setSelectedExamNumber] = useState('');
  const [selectedQsubject, setSelectedQsubject] = useState(''); // ExamQsubject id
  const [qnumber, setQnumber] = useState('');                    // 문항 번호
  const [qtext, setQtext] = useState('');
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [loading, setLoading] = useState(false);

  const [qsubjectsCache, setQsubjectsCache] = useState([]);      // 현재 시험의 ExamQsubject 목록

  const exams = useMemo(() => asArray(examList), [examList]);
  const examNumbers = useMemo(() => asArray(examNumberList), [examNumberList]);
  const examIdOf = (en) => (typeof en?.exam === 'object' ? en?.exam?.id : en?.exam);

  // 선택된 시험에 따라 회차 필터링
  const filteredExamNumbers = useMemo(() => {
    if (!selectedExam) return [];
    const sel = Number(selectedExam);
    return examNumbers.filter((en) => Number(examIdOf(en)) === sel);
  }, [selectedExam, examNumbers]);

  // 선택된 시험에 따라 과목(ExamQsubject) 목록 가져오기
  useEffect(() => {
    setSelectedExamNumber('');
    setSelectedQsubject('');
    setQnumber('');
    setQtext('');
    setIsDuplicate(false);

    if (!selectedExam) {
      setQsubjectsCache([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        // 서버에서 exam 필터가 지원되면 아래 params 사용
        const res = await AxiosInstance.get('examqsubject/', {
          // params: { exam: selectedExam }
        });
        const rows = asArray(res.data).filter((r) => String(r.exam) === String(selectedExam));
        if (!alive) return;
        setQsubjectsCache(rows);
      } catch (e) {
        if (!alive) return;
        setQsubjectsCache([]);
      }
    })();
    return () => { alive = false; };
  }, [selectedExam]);

  const checkDuplicate = async (examqsubjectId, nextQnumber) => {
    if (!selectedExam || !selectedExamNumber || !examqsubjectId || !nextQnumber) {
      setIsDuplicate(false);
      return;
    }
    try {
      const res = await AxiosInstance.get('question/check_question/', {
        params: {
          exam: selectedExam,
          examnumber: selectedExamNumber,
          examqsubject: examqsubjectId,
          qnumber: nextQnumber,
        },
      });
      setIsDuplicate(!!res?.data?.exists);
    } catch (error) {
      console.error('Error checking question:', error);
      setIsDuplicate(false);
    }
  };

  const handleQnumberChange = (rawValue) => {
    const v = rawValue.trim();
    if (!/^[1-9]\d*$/.test(v) && v !== '') return; // 자연수만 허용
    setQnumber(v);
    checkDuplicate(selectedQsubject, v);
  };

  const handleSubmit = async () => {
    if (!selectedExam || !selectedExamNumber || !selectedQsubject || !qnumber || !qtext.trim()) {
      message.error('모든 필드를 입력해 주세요.');
      return;
    }
    if (isDuplicate) {
      message.warning('이미 등록된 문항입니다.');
      return;
    }

    setLoading(true);
    try {
      const response = await AxiosInstance.post('question/', {
        exam: selectedExam,
        examnumber: selectedExamNumber,
        examqsubject: selectedQsubject,     // ✔ 과목은 ExamQsubject ID로 전송
        qnumber: Number(qnumber),
        qtext: qtext.trim(),
      });

      onQuestionAdd?.(response.data);
      message.success('문항이 성공적으로 등록되었습니다.');

      // 초기화
      setSelectedExam('');
      setSelectedExamNumber('');
      setSelectedQsubject('');
      setQnumber('');
      setQtext('');
      setIsDuplicate(false);
    } catch (err) {
      const apiMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        (typeof err?.response?.data === 'string' ? err.response.data : null) ||
        err.message;
      message.error(`오류: ${apiMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Typography.Title level={5}>Question</Typography.Title>
      <Form layout="vertical" onFinish={handleSubmit} disabled={loading}>

        {/* 시험명 */}
        <Form.Item label="시험명" required>
          <Select
            value={selectedExam}
            onChange={setSelectedExam}
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

        {/* 시험회차 */}
        <Form.Item label="시험회차" required>
          <Select
            value={selectedExamNumber}
            onChange={(v) => {
              setSelectedExamNumber(v);
              // 회차 변경 시 중복 상태 재검토
              checkDuplicate(selectedQsubject, qnumber);
            }}
            placeholder={selectedExam ? '시험회차 선택' : '시험명을 먼저 선택해주세요.'}
            disabled={!selectedExam}
            allowClear
          >
            {filteredExamNumbers.map((en) => (
              <Option key={en?.id} value={en?.id}>
                {en?.slug ?? `${en?.year ?? '-'}년 ${en?.examnumber ?? '-'}회`}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* 과목(ExamQsubject) / 문항 번호 */}
        <div style={{ display: 'flex', gap: 8 }}>
          {/* ✅ 과목: Select로 변경, 표시=slug, 값=id */}
          <Form.Item label="과목" required style={{ flex: 1 }}>
            <Select
              value={selectedQsubject}
              onChange={(v) => {
                setSelectedQsubject(v);
                checkDuplicate(v, qnumber);
              }}
              placeholder={selectedExamNumber ? '과목(ExamQsubject) 선택' : '시험회차를 먼저 선택하세요.'}
              disabled={!selectedExamNumber}
              showSearch
              optionFilterProp="children"
              allowClear
            >
              {qsubjectsCache.map((qs) => (
                <Option key={qs?.id} value={qs?.id}>
                  {qs?.slug || `${qs?.esn}. ${qs?.est}`}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="문항 번호" required style={{ flex: 1 }}>
            <Input
              placeholder="문항 번호(자연수)"
              value={qnumber}
              onChange={(e) => handleQnumberChange(e.target.value)}
              disabled={!selectedQsubject}
              inputMode="numeric"
            />
            {isDuplicate && <Text type="danger">이미 등록된 문항입니다.</Text>}
          </Form.Item>
        </div>

        {/* 문항 내용 */}
        <Form.Item label="문항 내용" required>
          <Input.TextArea
            placeholder="문항 내용을 입력하세요 (핵심만)"
            value={qtext}
            onChange={(e) => setQtext(e.target.value)}
            rows={4}
            maxLength={1000}
            disabled={!qnumber || isDuplicate}
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            disabled={isDuplicate || !qtext.trim()}
            loading={loading}
          >
            등록
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default StudyWriteQuestion;
