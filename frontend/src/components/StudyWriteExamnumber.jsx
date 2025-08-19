import React, { useState } from 'react';
import { Form, Select, Input, Button, Typography, DatePicker, message } from 'antd';
import dayjs from 'dayjs';
import AxiosInstance from './AxiosInstance';

const { Option } = Select;
const { Text } = Typography;

const StudyWriteExamnumber = ({ examList, onExamNumberAdd }) => {
  const currentYear = new Date().getFullYear();
  const [selectedExam, setSelectedExam] = useState('');
  const [examNumber, setExamNumber] = useState('');
  const [date, setDate] = useState(dayjs(`${currentYear}-01`));
  const [isDuplicate, setIsDuplicate] = useState(false);

  const handleExamNumberChange = async (value) => {
    setExamNumber(value);

    if (!selectedExam || !value) {
      setIsDuplicate(false);
      return;
    }

    try {
      const response = await AxiosInstance.get('examnumber/check_examnumber/', {
        params: { exam: selectedExam, examnumber: value },
      });
      setIsDuplicate(response.data.exists);
    } catch (err) {
      console.error('Error checking examnumber:', err);
    }
  };

  const handleExamNumberSubmit = async () => {
    if (!selectedExam || !examNumber || !date) {
      message.error('모든 필드를 입력해 주세요.');
      return;
    }

    const year = date.year();

    try {
      const response = await AxiosInstance.post('examnumber/', {
        exam: selectedExam,
        examnumber: examNumber,
        year: year,
      });
      message.success('시험회차가 성공적으로 등록되었습니다.');
      onExamNumberAdd(response.data);
      setSelectedExam('');
      setExamNumber('');
      setDate(dayjs(`${year}-01`));
    } catch (err) {
      message.error(`오류: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 500 }}>
      <Typography.Title level={5}>Exam Number</Typography.Title>
      <Form layout="vertical" onFinish={handleExamNumberSubmit}>
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

        <Form.Item label="시험 회차 번호" required>
          <Input
            placeholder={selectedExam ? "시험 회차 번호(자연수만 입력 가능)" : "시험명을 먼저 선택해주세요."}
            value={examNumber}
            onChange={(e) => {
              const value = e.target.value;
              if (/^[1-9]\d*$/.test(value) || value === '') {
                handleExamNumberChange(value);
              }
            }}
            disabled={!selectedExam}
          />
          {isDuplicate && (
            <Text type="danger">이미 입력된 시험회차입니다.</Text>
          )}
        </Form.Item>

        <Form.Item label="시행 연도" required>
          <DatePicker
            picker="year"
            value={date}
            onChange={(newValue) => setDate(newValue)}
            disabled={!examNumber || isDuplicate}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            disabled={isDuplicate || !examNumber}
          >
            등록
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default StudyWriteExamnumber;
