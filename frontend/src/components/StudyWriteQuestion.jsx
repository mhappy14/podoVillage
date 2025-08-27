import React, { useEffect, useMemo, useState } from 'react';
import { Form, Select, Input, Button, Typography, message, Switch, Radio, Checkbox } from 'antd';
import AxiosInstance from './AxiosInstance';
import DOMPurify from 'dompurify';
import parseWikiSyntax from './WikiParser';

const { Option } = Select;
const { Text } = Typography;

// 배열/페이징 응답 정규화
const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

const K_NUMS = ['①', '②', '③', '④', '⑤'];

const StudyWriteQuestion = ({ examList, examNumberList, onQuestionAdd }) => {
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedExamNumber, setSelectedExamNumber] = useState('');
  const [selectedQsubject, setSelectedQsubject] = useState(''); // ExamQsubject id
  const [qnumber, setQnumber] = useState('');                    // 문항 번호
  const [qtext, setQtext] = useState('');
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ 지문(본문) 유무 + 지문 내용
  const [hasPassage, setHasPassage] = useState(false);
  const [passageText, setPassageText] = useState('');

  // ✅ 객관식 보기(choices)
  const [useChoices, setUseChoices] = useState(false);   // 객관식(보기) 사용 ON/OFF
  const [choiceCount, setChoiceCount] = useState(4);     // 4 or 5
  const [allowMulti, setAllowMulti] = useState(false);   // 복수정답 허용
  const [choices, setChoices] = useState(() =>
    Array.from({ length: 5 }, () => ({ text: '', correct: false }))
  );

  const [qsubjectsCache, setQsubjectsCache] = useState([]); // 현재 시험의 ExamQsubject 목록

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

    // ✅ 시험 바뀌면 지문/보기 입력도 리셋
    setHasPassage(false);
    setPassageText('');
    setUseChoices(false);
    setChoiceCount(4);
    setAllowMulti(false);
    setChoices(Array.from({ length: 5 }, () => ({ text: '', correct: false })));

    if (!selectedExam) {
      setQsubjectsCache([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await AxiosInstance.get('examqsubject/', {
          // params: { exam: selectedExam } // 서버 필터 지원 시 사용
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

  // ✅ 보기 텍스트 변경
  const setChoiceText = (idx, text) => {
    setChoices((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], text };
      return next;
    });
  };

  // ✅ 정답 체크 토글 (복수정답 off면 단일 선택만 허용)
  const toggleCorrect = (idx, checked) => {
    setChoices((prev) => {
      if (allowMulti) {
        const next = [...prev];
        next[idx] = { ...next[idx], correct: checked };
        return next;
      }
      // 단일 정답 모드: 해당 idx만 true
      return prev.map((c, i) => ({ ...c, correct: i === idx ? checked : false }));
    });
  };

  // 복수정답 스위치가 off로 바뀌면 첫 번째 true만 남기고 나머지 off
  const onChangeAllowMulti = (v) => {
    setAllowMulti(v);
    if (!v) {
      setChoices((prev) => {
        const firstTrue = prev.findIndex((c) => c.correct);
        return prev.map((c, i) => ({ ...c, correct: i === firstTrue && firstTrue !== -1 }));
      });
    }
  };

  // 객관식(보기) ON/OFF
  const onToggleUseChoices = (on) => {
    setUseChoices(on);
    if (!on) {
      // OFF로 전환되면 보기/정답/복수정답 깔끔히 초기화
      setAllowMulti(false);
      setChoiceCount(4);
      setChoices(Array.from({ length: 5 }, () => ({ text: '', correct: false })));
    }
  };

  // (현재는 미리보기 안 쓰지만 나중 확장 대비)
  const previewHtml = useMemo(() => {
    const raw = parseWikiSyntax(qtext || '');
    return DOMPurify.sanitize(raw);
  }, [qtext]);

  const handleSubmit = async () => {
    if (!selectedExam || !selectedExamNumber || !selectedQsubject || !qnumber || !qtext.trim()) {
      message.error('모든 필드를 입력해 주세요.');
      return;
    }
    if (isDuplicate) {
      message.warning('이미 등록된 문항입니다.');
      return;
    }

    // ✅ 보기 유효성 (입력된 보기 있는 경우만 객관식으로 처리)
    const usedChoices = choices.slice(0, choiceCount);
    const filledChoices = usedChoices.filter((c) => c.text.trim() !== '');
    const anyChoices = useChoices && filledChoices.length > 0;

    let optionsPayload = undefined;
    let qtype = undefined;

    if (useChoices) {
      // 최소 2개 이상 입력 및 정답 체크
      if (filledChoices.length < 2) {
        message.error('보기는 최소 2개 이상 입력해야 합니다.');
        return;
      }
      const correctCount = usedChoices.filter((c) => c.correct).length;
      if (correctCount < 1) {
        message.error('정답을 1개 이상 선택해 주세요.');
        return;
      }
      if (!allowMulti && correctCount !== 1) {
        message.error('복수정답이 꺼져 있을 때는 정답을 정확히 1개만 선택해야 합니다.');
        return;
      }

      optionsPayload = usedChoices.map((c, i) => ({
        order: i + 1,
        text: c.text.trim(),
        is_correct: !!c.correct,
        is_active: true,
      }));
      qtype = 'Oj';
    }

    setLoading(true);
    try {
      const payload = {
        exam: selectedExam,
        examnumber: selectedExamNumber,
        examqsubject_id: selectedQsubject,
        qnumber: Number(qnumber),
        qtext: qtext.trim(),
        ...(hasPassage ? { qscript: passageText.trim() } : { qscript: '' }),
        ...(useChoices && qtype ? { qtype } : {}),                // 객관식일 때만 qtype 지정
        ...(useChoices && optionsPayload ? { options: optionsPayload } : {}), // 옵션 전달
      };

      const response = await AxiosInstance.post('question/', payload);

      onQuestionAdd?.(response.data);
      message.success('문항이 성공적으로 등록되었습니다.');

      // 초기화
      setSelectedExam('');
      setSelectedExamNumber('');
      setSelectedQsubject('');
      setQnumber('');
      setQtext('');
      setIsDuplicate(false);

      setHasPassage(false);
      setPassageText('');
      setUseChoices(false);
      setChoiceCount(4);
      setAllowMulti(false);
      setChoices(Array.from({ length: 5 }, () => ({ text: '', correct: false })));
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
      <Typography.Title level={5} style={{ margin: '0 0 0.5rem 0' }}>Question</Typography.Title>
      <Form layout="vertical" onFinish={handleSubmit} disabled={loading}>

        {/* 시험명 */}
        <Form.Item label="시험명" required style={{ marginBottom: '0.5rem' }}>
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
        <Form.Item label="시험회차" required style={{ marginBottom: '0.5rem' }}>
          <Select
            value={selectedExamNumber}
            onChange={(v) => {
              setSelectedExamNumber(v);
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
          <Form.Item label="과목" required style={{ flex: 1, marginBottom: '0.5rem' }}>
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

          <Form.Item label="문항 번호" required style={{ flex: 1, marginBottom: '0.5rem' }}>
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

        {/* 문항 내용 + (지문/보기 제어들) */}
        <Form.Item
          required
          style={{ margin: '0.8rem 0 1rem 0' }}
          label={
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span>문항 내용</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {/* 지문 입력 ON/OFF */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#64748b' }}>지문 입력</span>
                  <Switch checked={hasPassage} onChange={setHasPassage} />
                </label>

                {/* 객관식(보기) ON/OFF */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#64748b' }}>객관식</span>
                  <Switch checked={useChoices} onChange={onToggleUseChoices} />
                </label>

                {/* 4/5지선다 선택 */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#64748b' }}>지선다</span>
                  <Radio.Group
                    value={choiceCount}
                    onChange={(e) => setChoiceCount(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                    disabled={!useChoices}
                  >
                    <Radio.Button value={4}>4지</Radio.Button>
                    <Radio.Button value={5}>5지</Radio.Button>
                  </Radio.Group>
                </label>

                {/* 복수정답 여부 */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#64748b' }}>복수정답</span>
                  <Switch checked={allowMulti} onChange={onChangeAllowMulti} disabled={!useChoices} />
                </label>
              </div>
            </div>
          }
        >
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <textarea
              value={qtext}
              onChange={(e) => setQtext(e.target.value)}
              disabled={!qnumber || isDuplicate}
              placeholder="문항 내용을 입력하세요. 예) 본문... * 목록 등"
              style={{
                width: '100%',
                minHeight: 60,
                padding: 12,
                border: 'none',
                outline: 'none',
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                lineHeight: 1.6,
                resize: 'vertical',
              }}
            />
          </div>
        </Form.Item>

        {/* 지문 입력칸 (ON일 때만) */}
        {hasPassage && (
          <Form.Item label="지문">
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <textarea
                value={passageText}
                onChange={(e) => setPassageText(e.target.value)}
                disabled={!qnumber || isDuplicate}
                placeholder="지문 내용을 입력하세요."
                style={{
                  width: '100%',
                  minHeight: 60,
                  padding: 12,
                  border: 'none',
                  outline: 'none',
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  lineHeight: 1.6,
                  resize: 'vertical',
                }}
              />
            </div>
          </Form.Item>
        )}

        {/* ✅ 보기 입력 (choiceCount 만큼 입력칸 + 정답 체크박스) */}
        {useChoices && ( <Form.Item label={<div style={{display: 'flex', gap: '2rem'}}><div>보기 입력</div><div style={{ marginTop: 6, color: '#94a3b8', fontSize: 12 }}>
            {allowMulti
              ? '복수정답 모드: 여러 개의 정답을 체크할 수 있습니다.'
              : '단일정답 모드: 하나의 정답만 체크할 수 있습니다.'}
          </div></div>}>
          <div style={{ display: 'grid', gap: 10 }}>
            {Array.from({ length: choiceCount }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, textAlign: 'center', color: '#64748b' }}>{K_NUMS[i] || i + 1}</div>
                <Input.TextArea
                  value={choices[i].text}
                  onChange={(e) => setChoiceText(i, e.target.value)}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  placeholder={`보기 ${i + 1} 내용을 입력`}
                />
                <Checkbox
                  checked={choices[i].correct}
                  onChange={(e) => toggleCorrect(i, e.target.checked)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  정답
                </Checkbox>
              </div>
            ))}
          </div>
          
        </Form.Item>)}

        <Form.Item style={{ margin: 0 }}>
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
