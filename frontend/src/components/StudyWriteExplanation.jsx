import React, { useState } from 'react';
import { Form, Select, Input, Button, Typography, Row, Col, Checkbox, message } from 'antd';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useNavigate } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';

const { Option } = Select;
const { Text } = Typography;

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
  const [selectedExam, setSelectedExam] = useState(selectedExplanation?.exam?.id || '');
  const [selectedExamNumber, setSelectedExamNumber] = useState(selectedExplanation?.examnumber?.id || '');
  const [selectedQuestion, setSelectedQuestion] = useState(selectedExplanation?.question?.id || '');
  const [selectedMainsubjects, setSelectedMainsubjects] = useState(
    selectedExplanation?.mainsubject?.map((ms) => ms.id) || []
  );
  const [selectedDetailsubjects, setSelectedDetailsubjects] = useState(
    selectedExplanation?.detailsubject?.map((ds) => ds.id) || []
  );
  const [explanationText, setExplanationText] = useState(selectedExplanation?.explanation || '');
  const [errorMessage, setErrorMessage] = useState('');

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

  // 필터링된 데이터
  const filteredExamNumbers = selectedExam
    ? examNumberList.filter((examNumber) => examNumber.exam?.id === selectedExam)
    : examNumberList;

  const filteredQuestionList = selectedExamNumber
    ? questionList.filter((q) => q.examnumber?.id === selectedExamNumber)
    : questionList;

  const filteredMainsubjects = selectedExam
    ? mainsubjectList.filter((ms) => ms.exam?.id === selectedExam)
    : [];

  const filteredDetailsubjects =
    selectedMainsubjects.length > 0
      ? detailsubjectList.filter((ds) => selectedMainsubjects.includes(ds.mainslug?.id))
      : detailsubjectList;

  const sortByKey = (array, key, referenceArray = null) =>
    array
      .slice()
      .sort((a, b) => {
        const valueA = referenceArray ? referenceArray.find((item) => item.id === a)?.[key] : a[key];
        const valueB = referenceArray ? referenceArray.find((item) => item.id === b)?.[key] : b[key];
        if (!valueA || !valueB) return 0;
        return valueA.localeCompare(valueB);
      });

  const handleSave = async () => {
    setErrorMessage('');
    if (!selectedExam || !selectedExamNumber || !selectedQuestion || !explanationText) {
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

    try {
      if (isEdit && selectedExplanation?.id) {
        const response = await AxiosInstance.patch(`/explanation/${selectedExplanation.id}/`, requestData);
        if (onSave) onSave(response.data);
        navigate(`/study/view/${selectedExplanation.id}`);
      } else {
        const response = await AxiosInstance.post('/explanation/', requestData);
        if (onSave) onSave(response.data);
        navigate(`/study/view/${response.data.id}`);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || '저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <div style={{ margin: '0 1rem 0 1rem' }}>
      <Typography.Title level={5} style={{ margin: '0' }}>{isEdit ? 'Edit Explanation' : 'Write Explanation'}</Typography.Title>
      <Form layout="vertical" onFinish={handleSave}>
        {/* 시험명, 시험회차, 문항 한 줄 */}
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
              >
                {examList.map((exam) => (
                  <Option key={exam.id} value={exam.id}>{exam.examname}</Option>
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
              >
                {filteredExamNumbers.map((examNumber) => (
                  <Option key={examNumber.id} value={examNumber.id}>{examNumber.slug}</Option>
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
              >
                {filteredQuestionList.map((q) => (
                  <Option key={q.id} value={q.id}>{q.slug}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* 주요과목, 세부과목 한 줄 */}
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
              >
                {sortByKey(filteredMainsubjects, 'mainslug').map((ms) => (
                  <Option key={ms.id} value={ms.id} label={ms.mainslug}>
                    <Checkbox checked={selectedMainsubjects.includes(ms.id)}>{ms.mainslug}</Checkbox>
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
              >
                {sortByKey(filteredDetailsubjects, 'detailslug').map((ds) => (
                  <Option key={ds.id} value={ds.id} label={ds.detailslug}>
                    <Checkbox checked={selectedDetailsubjects.includes(ds.id)}>{ds.detailslug}</Checkbox>
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
            style={{ minHeight: '200px', height: '400px' }}
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            {isEdit ? '수정하기' : '저장하기'}
          </Button>
        </Form.Item>

        {errorMessage && <Text type="danger">{errorMessage}</Text>}
      </Form>
    </div>
  );
};

export default StudyWriteExplanation;
