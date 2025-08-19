import React, { useState } from 'react';
import { Form, Select, Input, Button, Typography, message } from 'antd';
import AxiosInstance from './AxiosInstance';

const { Option } = Select;
const { Text } = Typography;

const StudyWriteDetailsubject = ({ examList, mainsubjectList, onDetailsubjectAdd }) => {
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedMainsubject, setSelectedMainsubject] = useState('');
  const [detailnumber, setDetailnumber] = useState('');
  const [detailtitle, setDetailtitle] = useState('');
  const [isDetailnumberDuplicate, setIsDetailnumberDuplicate] = useState(false);
  const [filteredMainsubjects, setFilteredMainsubjects] = useState(mainsubjectList);

  const handleDetailnumberChange = async (value) => {
    setDetailnumber(value);

    if (!selectedMainsubject || !value) {
      setIsDetailnumberDuplicate(false);
      return;
    }

    try {
      const response = await AxiosInstance.get(`detailsubject/check_detailnumber/`, {
        params: { mainslug: selectedMainsubject, detailnumber: value },
      });
      setIsDetailnumberDuplicate(response.data.exists);
    } catch (error) {
      console.error('Error checking detailnumber:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedExam || !selectedMainsubject || !detailnumber || !detailtitle) {
      message.error('모든 필드를 입력해 주세요.');
      return;
    }

    try {
      const response = await AxiosInstance.post('detailsubject/', {
        exam: selectedExam,
        mainslug: selectedMainsubject,
        detailnumber,
        detailtitle,
      });
      onDetailsubjectAdd(response.data);
      message.success('세부과목이 성공적으로 등록되었습니다.');
      setSelectedExam('');
      setSelectedMainsubject('');
      setDetailnumber('');
      setDetailtitle('');
      setIsDetailnumberDuplicate(false);
    } catch (err) {
      message.error(`오류: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleExamChange = (value) => {
    setSelectedExam(value);
    setSelectedMainsubject('');
    const filtered = mainsubjectList.filter((main) => main.exam?.id === value);
    setFilteredMainsubjects(filtered);
  };

  const sortByKey = (array, key) =>
    array.slice().sort((a, b) => (a[key] || '').localeCompare(b[key] || ''));

  return (
    <div>
      <Typography.Title level={5}>세부과목 등록</Typography.Title>
      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="시험명" required>
          <Select
            placeholder="시험명을 선택하세요"
            value={selectedExam}
            onChange={handleExamChange}
          >
            {sortByKey(examList, 'examname').map((exam) => (
              <Option key={exam.id} value={exam.id}>
                {exam.examname}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="주요과목" required>
          <Select
            placeholder={selectedExam ? '주요과목 선택' : '시험명을 먼저 선택해주세요'}
            value={selectedMainsubject}
            onChange={setSelectedMainsubject}
            disabled={!selectedExam}
          >
            {sortByKey(filteredMainsubjects, 'mainslug').map((main) => (
              <Option key={main.id} value={main.id}>
                {main.mainslug}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="세부과목번호" required>
          <Input
            placeholder={
              selectedMainsubject
                ? '세부과목번호(자연수만 입력 가능)'
                : '주요과목을 먼저 선택해주세요'
            }
            value={detailnumber}
            onChange={(e) => {
              const value = e.target.value;
              if (/^[1-9]\d*$/.test(value) || value === '') {
                handleDetailnumberChange(value);
              }
            }}
            disabled={!selectedMainsubject}
          />
          {isDetailnumberDuplicate && <Text type="danger">이미 등록된 세부과목입니다.</Text>}
        </Form.Item>

        <Form.Item label="세부과목 이름" required>
          <Input
            placeholder={
              selectedMainsubject && !isDetailnumberDuplicate
                ? '세부과목 이름 입력'
                : '세부과목번호를 먼저 선택해주세요'
            }
            value={detailtitle}
            onChange={(e) => setDetailtitle(e.target.value)}
            disabled={!selectedMainsubject || isDetailnumberDuplicate}
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            disabled={isDetailnumberDuplicate || !detailtitle}
          >
            등록
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default StudyWriteDetailsubject;
