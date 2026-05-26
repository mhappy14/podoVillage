import React, { useMemo, useState, useEffect } from 'react';
import { Form, Select, Input, Button, Typography, Row, Col, Checkbox, message } from 'antd';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

const sortByKey = (array, key) =>
  (array || []).slice().sort((a, b) => {
    const va = (a?.[key] ?? '').toString();
    const vb = (b?.[key] ?? '').toString();
    return va.localeCompare(vb);
  });

const StudyWriteExplanation = ({
  examList,
  examNumberList,
  questionList,
  mainsubjectList,
  detailsubjectList,
  selectedExplanation = null,
  onSave,
  isEdit = false,
  // 인라인 모드: StudyView 내 ExplanationCarousel 자리에서 바로 해설 작성
  inlineMode = false,
  initialExamId = null,
  initialExamnumberId = null,
  initialQuestionId = null,
  onCancel = null,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 정규화된 리스트
  const exams = useMemo(() => asArray(examList), [examList]);
  const examNumbers = useMemo(() => asArray(examNumberList), [examNumberList]);
  const questions = useMemo(() => asArray(questionList), [questionList]);
  const mains = useMemo(() => asArray(mainsubjectList), [mainsubjectList]);
  const details = useMemo(() => asArray(detailsubjectList), [detailsubjectList]);
  const examIdOf = (en) => (typeof en?.exam === 'object' ? en?.exam?.id : en?.exam);
  const examnumberIdOf = (q) => (typeof q?.examnumber === 'object' ? q?.examnumber?.id : q?.examnumber);


  // 초기값
  const [selectedExam, setSelectedExam] = useState(
    initialExamId || selectedExplanation?.exam?.id || ''
  );
  const [selectedExamNumber, setSelectedExamNumber] = useState(
    initialExamnumberId || selectedExplanation?.examnumber?.id || ''
  );
  const [selectedQuestion, setSelectedQuestion] = useState(
    initialQuestionId || selectedExplanation?.question?.id || ''
  );

  // URL ?question=:id 가 있으면 해당 question 으로부터 exam/examnumber/question 자동 선택
  useEffect(() => {
    // 인라인 모드는 initialXxx props 로 초기화하므로 URL 파라미터 처리 skip
    if (inlineMode || initialQuestionId) return;
    const qIdParam = searchParams.get('question');
    if (!qIdParam || isEdit) return;
    const qId = Number(qIdParam);
    if (Number.isNaN(qId) || questions.length === 0) return;
    const matched = questions.find((q) => Number(q.id) === qId);
    if (!matched) return;
    const eId = typeof matched.exam === 'object' ? matched.exam?.id : matched.exam;
    const enId = typeof matched.examnumber === 'object' ? matched.examnumber?.id : matched.examnumber;
    if (eId) setSelectedExam(eId);
    if (enId) setSelectedExamNumber(enId);
    setSelectedQuestion(qId);
  }, [searchParams, questions, isEdit, inlineMode, initialQuestionId]);
  const [selectedMainsubjects, setSelectedMainsubjects] = useState(
    (selectedExplanation?.mainsubject || []).map((ms) => ms.id)
  );
  const [selectedDetailsubjects, setSelectedDetailsubjects] = useState(
    (selectedExplanation?.detailsubject || []).map((ds) => ds.id)
  );
  const [explanationText, setExplanationText] = useState(selectedExplanation?.explanation || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // 종속 필터
  const filteredExamNumbers = useMemo(() => {
    if (!selectedExam) return [];
    const sel = Number(selectedExam);
    return examNumbers.filter((en) => Number(examIdOf(en)) === sel);
  }, [selectedExam, examNumbers]);

  const filteredQuestionList = useMemo(() => {
    if (!selectedExamNumber) return [];
    const sel = Number(selectedExamNumber);
    return questions.filter((q) => Number(examnumberIdOf(q)) === sel);
  }, [selectedExamNumber, questions]);

  const filteredMainsubjects = useMemo(() => {
    if (!selectedExam) return [];
    return mains.filter((ms) => ms?.exam?.id === Number(selectedExam));
  }, [selectedExam, mains]);

  const filteredDetailsubjects = useMemo(() => {
    // 선택한 주요과목이 있으면 그 하위만, 없으면 선택한 시험 기준으로 필터
    if (selectedMainsubjects.length > 0) {
      return details.filter((ds) => selectedMainsubjects.includes(ds?.mainslug?.id));
    }
    if (selectedExam) {
      return details.filter((ds) => ds?.exam?.id === Number(selectedExam));
    }
    return [];
  }, [selectedMainsubjects, selectedExam, details]);

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['clean'],
    ],
  };
  const formats = ['header', 'bold', 'italic', 'underline', 'list', 'bullet', 'link', 'image'];

  const handleSave = async () => {
    setErrorMessage('');
    if (!selectedExam || !selectedExamNumber || !selectedQuestion || !explanationText.trim()) {
      message.error('모든 필드를 입력해 주세요.');
      return;
    }

    const requestData = {
      exam: selectedExam,
      examnumber: selectedExamNumber,
      question: selectedQuestion,
      mainsubject: selectedMainsubjects,
      detailsubject: selectedDetailsubjects,
      explanation: explanationText,
    };

    setLoading(true);
    try {
      if (isEdit && selectedExplanation?.id) {
        const response = await AxiosInstance.patch(`explanation/${selectedExplanation.id}/`, requestData);
        onSave?.(response.data);
        // onSave 가 있으면 부모(StudyEdit)가 navigate 를 담당하므로 여기선 skip.
        // onSave 없이 단독으로 쓰일 때만 직접 navigate → examnumber ID 기준 URL
        if (!inlineMode && !onSave) {
          const enId =
            response.data?.examnumber?.id ??
            response.data?.examnumber ??
            selectedExplanation?.examnumber?.id ??
            selectedExplanation?.examnumber;
          navigate(`/study/view/${enId}`);
        }
      } else {
        const response = await AxiosInstance.post('explanation/', requestData);
        onSave?.(response.data);
        if (!inlineMode) {
          // 신규 저장 후: 해설이 속한 examnumber 의 StudyView 로 이동
          const enId =
            response.data?.examnumber?.id ??
            response.data?.examnumber;
          navigate(`/study/view/${enId}`);
        } else {
          message.success('해설이 저장되었습니다.');
        }
      }
    } catch (err) {
      const apiMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        (typeof err?.response?.data === 'string' ? err.response.data : null) ||
        '저장 중 오류가 발생했습니다.';
      setErrorMessage(apiMsg);
    } finally {
      setLoading(false);
    }
  };

  // 시험명 렌더링(공무원일 때 가독성)
  const renderExamLabel = (exam) =>
    exam?.examtype === 'Public'
      ? `${exam?.ragent ?? ''} ${exam?.rposition ?? ''} ${exam?.examname ?? ''}`
      : exam?.examname;

  // 문항 표시: slug(있으면) / 없으면 "n회 [과목slug]. qnumber. text"
  const renderQuestionLabel = (q) => {
    if (q?.slug1) return `${q.slug1} ${q.qtext ?? ''}`;
    const n = q?.examnumber?.examnumber ?? '-';
    const subj =
      q?.examqsubject?.slug ??
      (q?.examqsubject
        ? `${q?.examqsubject?.esn ?? ''}. ${q?.examqsubject?.est ?? ''}`
        : '-');
    const num = q?.qnumber ?? '-';
    const text = q?.qtext ?? '';
    return `${n}회 ${subj} ${num}. ${text}`;
  };

  return (
    <div style={{ margin: '0' }}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        {isEdit ? 'Edit Explanation' : 'Write Explanation'}
      </Typography.Title>

      <Form layout="vertical" onFinish={handleSave} disabled={loading}>
        {/* 시험명 / 시험회차 / 문항 */}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="시험명" required>
              <Select
                placeholder="시험명을 선택하세요"
                value={selectedExam}
                onChange={(value) => {
                  setSelectedExam(value);
                  setSelectedExamNumber('');
                  setSelectedQuestion('');
                  setSelectedMainsubjects([]);
                  setSelectedDetailsubjects([]);
                }}
                allowClear
                disabled={inlineMode}
              >
                {exams.map((exam) => (
                  <Option key={exam?.id} value={exam?.id}>
                    {renderExamLabel(exam)}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={8}>
            <Form.Item label="시험회차" required>
              <Select
                placeholder="시험회차 선택"
                value={selectedExamNumber}
                onChange={(value) => {
                  setSelectedExamNumber(value);
                  setSelectedQuestion('');
                }}
                disabled={!selectedExam || inlineMode}
                allowClear
              >
                {filteredExamNumbers.map((en) => (
                  <Option key={en?.id} value={en?.id}>
                    {en?.slug ?? `${en?.year ?? '-'}년 ${en?.examnumber ?? '-'}회`}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={8}>
            <Form.Item label="문항" required>
              <Select
                placeholder="문항 선택"
                value={selectedQuestion}
                onChange={setSelectedQuestion}
                disabled={!selectedExamNumber || inlineMode}
                allowClear
                showSearch
                optionFilterProp="children"
              >
                {filteredQuestionList.map((q) => (
                  <Option key={q?.id} value={q?.id}>
                    {renderQuestionLabel(q)}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* 주요과목 / 세부과목 */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="주요과목">
              <Select
                mode="multiple"
                placeholder="주요과목 선택"
                value={selectedMainsubjects}
                onChange={setSelectedMainsubjects}
                disabled={!selectedExam}
                optionLabelProp="label"
                allowClear
              >
                {sortByKey(filteredMainsubjects, 'mainslug').map((ms) => (
                  <Option key={ms?.id} value={ms?.id} label={ms?.mainslug}>
                    <Checkbox checked={selectedMainsubjects.includes(ms?.id)}>{ms?.mainslug}</Checkbox>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="세부과목">
              <Select
                mode="multiple"
                placeholder="세부과목 선택"
                value={selectedDetailsubjects}
                onChange={setSelectedDetailsubjects}
                optionLabelProp="label"
                allowClear
              >
                {sortByKey(filteredDetailsubjects, 'detailslug').map((ds) => (
                  <Option key={ds?.id} value={ds?.id} label={ds?.detailslug}>
                    <Checkbox checked={selectedDetailsubjects.includes(ds?.id)}>{ds?.detailslug}</Checkbox>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* 설명 내용 */}
        <Form.Item label="설명 내용" required>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <textarea
              value={explanationText}
              onChange={(e) => setExplanationText(e.target.value)}
              placeholder="예) == 제목 ==, [[링크]], * 목록 등"
              style={{
                width: '100%',
                minHeight: 220,
                padding: 12,
                border: 'none',
                outline: 'none',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                lineHeight: 1.6,
                resize: 'vertical'
              }}
            />
          </div>
        </Form.Item>

        <Form.Item style={{ margin: 0 }}>
          <Button type="primary" htmlType="submit" block loading={loading}>
            {isEdit ? '수정하기' : '저장하기'}
          </Button>
          {inlineMode && onCancel && (
            <Button onClick={onCancel} block style={{ marginTop: 8 }} disabled={loading}>
              취소
            </Button>
          )}
        </Form.Item>

        {errorMessage && <Text type="danger">{errorMessage}</Text>}
      </Form>
    </div>
  );
};

export default StudyWriteExplanation;
