import React, { useState } from 'react';
import { Form, Select, Input, Button, Typography, message } from 'antd';
import AxiosInstance from './AxiosInstance';

const { Option } = Select;
const { Text } = Typography;

const StudyWriteMainsubject = ({ examList, onMainsubjectAdd }) => {
  const [selectedExam, setSelectedExam] = useState('');
  const [mainnumber, setMainnumber] = useState('');
  const [mainname, setMainname] = useState('');
  const [isMainnumberDuplicate, setIsMainnumberDuplicate] = useState(false);

  const handleMainnumberChange = async (value) => {
    setMainnumber(value);

    if (!selectedExam || !value) {
      setIsMainnumberDuplicate(false);
      return;
    }

    try {
      const response = await AxiosInstance.get(`mainsubject/check_mainnumber/`, {
        params: { exam: selectedExam, mainnumber: value },
      });
      setIsMainnumberDuplicate(response.data.exists);
    } catch (error) {
      console.error('Error checking mainnumber:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedExam || !mainnumber || !mainname) {
      message.error('모든 필드를 입력해 주세요.');
      return;
    }

    try {
      const response = await AxiosInstance.post('mainsubject/', {
        exam: selectedExam,
        mainnumber,
        mainname,
      });
      onMainsubjectAdd(response.data);
      message.success('주요과목이 성공적으로 등록되었습니다.');
      setSelectedExam('');
      setMainnumber('');
      setMainname('');
      setIsMainnumberDuplicate(false);
    } catch (err) {
      message.error(`오류: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <div>
      <Typography.Title level={5}>주요과목 등록</Typography.Title>
      <Form layout="vertical" onFinish={handleSubmit}>
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

        <Form.Item label="주요과목번호" required>
          <Input
            placeholder={selectedExam ? "주요과목번호(자연수만 입력 가능)" : "시험명을 먼저 선택해주세요."}
            value={mainnumber}
            onChange={(e) => {
              const value = e.target.value;
              if (/^[1-9]\d*$/.test(value) || value === '') {
                handleMainnumberChange(value);
              }
            }}
            disabled={!selectedExam}
          />
          {isMainnumberDuplicate && <Text type="danger">이미 등록된 주요과목입니다.</Text>}
        </Form.Item>

        <Form.Item label="주요과목 이름" required>
          <Input
            placeholder={
              mainnumber && !isMainnumberDuplicate
                ? "주요과목 이름 입력"
                : "주요과목번호를 먼저 선택해주세요."
            }
            value={mainname}
            onChange={(e) => setMainname(e.target.value)}
            disabled={!mainnumber || isMainnumberDuplicate}
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            disabled={isMainnumberDuplicate}
          >
            등록
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default StudyWriteMainsubject;
