import React, { useMemo, useState } from 'react';
import { Form, Select, Input, Button, Typography, Row, Col, Checkbox, message } from 'antd';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useNavigate } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';

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
}) => {
  const navigate = useNavigate();

  // 정규화된 리스트
  const exams = useMemo(() => asArray(examList), [examList]);
  const examNumbers = useMemo(() => asArray(examNumberList), [examNumberList]);
  const questions = useMemo(() => asArray(questionList), [questionList]);
  const mains = useMemo(() => asArray(mainsubjectList), [mainsubjectList]);
  const details = useMemo(() => asArray(detailsubjectList), [detailsubjectList]);
  const examIdOf = (en) => (typeof en?.exam === 'object' ? en?.exam?.id : en?.exam);
  const examnumberIdOf = (q) => (typeof q?.examnumber === 'object' ? q?.examnumber?.id : q?.examnumber);


  // 초기값
  const [selectedExam, setSelectedExam] = useState(selectedExplanation?.exam?.id || '');
  const [selectedExamNumber, setSelectedExamNumber] = useState(selectedExplanation?.examnumber?.id || '');
  const [selectedQuestion, setSelectedQuestion] = useState(selectedExplanation?.question?.id || '');
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
        navigate(`/study/view/${selectedExplanation.id}`);
      } else {
        const response = await AxiosInstance.post('explanation/', requestData);
        onSave?.(response.data);
        navigate(`/study/view/${response.data.id}`);
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
    if (q?.slug) return q.slug;
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
    <div style={{ margin: '0 1rem 0 1rem' }}>
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
          </Col>

          <Col span={8}>
            <Form.Item label="문항" required>
              <Select
                placeholder="문항 선택"
                value={selectedQuestion}
                onChange={setSelectedQuestion}
                disabled={!selectedExamNumber}
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
          <ReactQuill
            value={explanationText}
            onChange={setExplanationText}
            modules={modules}
            formats={formats}
            style={{ minHeight: 200, height: 400 }}
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            {isEdit ? '수정하기' : '저장하기'}
          </Button>
        </Form.Item>

        {errorMessage && <Text type="danger">{errorMessage}</Text>}
      </Form>
    </div>
  );
};

export default StudyWriteExplanation;
