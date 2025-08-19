import React, { useState, useEffect } from 'react';
import { Form, Select, Input, Button, Typography, message } from 'antd';
import AxiosInstance from './AxiosInstance';

const { Option } = Select;
const { Text } = Typography;

const StudyWriteQuestion = ({ examList, examNumberList, onQuestionAdd }) => {
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedExamNumber, setSelectedExamNumber] = useState('');
  const [questionNumber1, setQuestionNumber1] = useState('');
  const [questionNumber2, setQuestionNumber2] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [filteredExamNumbers, setFilteredExamNumbers] = useState([]);

  useEffect(() => {
    const filteredNumbers = examNumberList.filter(
      (examNumber) => examNumber.exam?.id === parseInt(selectedExam)
    );
    setFilteredExamNumbers(filteredNumbers);
    setSelectedExamNumber('');
  }, [selectedExam, examNumberList]);

  const handleQuestionNumberChange = async (key, value) => {
    // 상태 업데이트
    if (key === 'questionNumber1') setQuestionNumber1(value);
    if (key === 'questionNumber2') setQuestionNumber2(value);

    // 값이 없으면 중단
    const q1 = key === 'questionNumber1' ? value : questionNumber1;
    const q2 = key === 'questionNumber2' ? value : questionNumber2;
    if (!selectedExam || !selectedExamNumber || !q1 || !q2) {
      setIsDuplicate(false);
      return;
    }

    try {
      const response = await AxiosInstance.get('question/check_question/', {
        params: {
          exam: selectedExam,
          examnumber: selectedExamNumber, // key 이름을 Django와 일치
          questionnumber1: q1,
          questionnumber2: q2,
        },
      });

      setIsDuplicate(response.data.exists);
    } catch (error) {
      console.error('Error checking question:', error);
      setIsDuplicate(false);
    }
  };

  const handleQuestionSubmit = async () => {
    if (!selectedExam || !selectedExamNumber || !questionNumber1 || !questionNumber2 || !questionText) {
      message.error('모든 필드를 입력해 주세요.');
      return;
    }

    try {
      const response = await AxiosInstance.post('question/', {
        exam: selectedExam,
        examnumber: selectedExamNumber,
        questionnumber1: questionNumber1, // state에서 가져오기
        questionnumber2: questionNumber2,
        questiontext: questionText,
      });

      onQuestionAdd(response.data);
      message.success('질문이 성공적으로 등록되었습니다.');
      setSelectedExam('');
      setSelectedExamNumber('');
      setQuestionNumber1('');
      setQuestionNumber2('');
      setQuestionText('');
      setIsDuplicate(false);
    } catch (err) {
      message.error(`오류: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <Typography.Title level={5}>Question</Typography.Title>
      <Form layout="vertical" onFinish={handleQuestionSubmit}>
        <Form.Item label="시험명" required>
          <Select
            value={selectedExam}
            onChange={setSelectedExam}
            placeholder="시험명을 선택하세요"
          >
            {examList.map((exam) => (
              <Option key={exam.id} value={exam.id}>
                {exam.examname}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="시험회차" required>
          <Select
            value={selectedExamNumber}
            onChange={setSelectedExamNumber}
            placeholder={selectedExam ? "시험회차 선택" : "시험명을 먼저 선택해주세요."}
            disabled={!selectedExam}
          >
            {filteredExamNumbers.map((examNumber) => (
              <Option key={examNumber.id} value={examNumber.id}>
                {examNumber.slug}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="과목 번호 / 문항 번호" required>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input
              placeholder="과목 번호"
              value={questionNumber1}
              onChange={(e) => handleQuestionNumberChange('questionNumber1', e.target.value)}
              disabled={!selectedExamNumber}
            />
            <Input
              placeholder="문항 번호"
              value={questionNumber2}
              onChange={(e) => handleQuestionNumberChange('questionNumber2', e.target.value)}
              disabled={!questionNumber1}
            />
          </div>
          {isDuplicate && <Text type="danger">이미 등록된 문항입니다.</Text>}
        </Form.Item>

        <Form.Item label="문항 내용" required>
          <Input.TextArea
            placeholder="문항 내용을 입력하세요 (핵심만)"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            rows={4}
            disabled={!questionNumber2 || isDuplicate}
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            disabled={isDuplicate || !questionText}
          >
            등록
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default StudyWriteQuestion;
