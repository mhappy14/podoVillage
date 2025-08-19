import React, { useState } from 'react';
import { Form, Input, Button, Typography, message } from 'antd';
import AxiosInstance from './AxiosInstance';

const { Title } = Typography;

const StudyWriteExam = ({ examList, onExamAdd }) => {
  const [examName, setExamName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExamSubmit = async () => {
    if (!examName.trim()) {
      message.error('시험명을 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await AxiosInstance.post('exam/', {
        examname: examName,
      });

      // 새로고침 대신 부모 상태 즉시 업데이트
      onExamAdd(response.data);

      message.success('시험명이 성공적으로 등록되었습니다.');
      setExamName('');
    } catch (err) {
      message.error(`오류: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ margin: '0 0 0 1rem' }}>
      <Title level={5}>Exam</Title>
      <Form onFinish={handleExamSubmit} layout="vertical">
        <Form.Item label="시험명" required>
          <Input
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
            placeholder="시험명을 입력하세요"
          />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
          >
            등록
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default StudyWriteExam;
