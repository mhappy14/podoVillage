import React, { useMemo, useState } from 'react';
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

const sortByKey = (array, key) =>
  (array || []).slice().sort((a, b) => (a?.[key] || '').toString().localeCompare((b?.[key] || '').toString()));

const StudyWriteMainsubject = ({ examList, onMainsubjectAdd }) => {
  const [selectedExam, setSelectedExam] = useState('');
  const [mainnumber, setMainnumber] = useState('');
  const [mainname, setMainname] = useState('');
  const [isMainnumberDuplicate, setIsMainnumberDuplicate] = useState(false);
  const [loading, setLoading] = useState(false);

  const exams = useMemo(() => asArray(examList), [examList]);

  const handleMainnumberChange = async (value) => {
    setMainnumber(value);

    if (!selectedExam || !value) {
      setIsMainnumberDuplicate(false);
      return;
    }

    try {
      const response = await AxiosInstance.get('mainsubject/check_mainnumber/', {
        params: { exam: selectedExam, mainnumber: value },
      });
      setIsMainnumberDuplicate(!!response?.data?.exists);
    } catch (error) {
      console.error('Error checking mainnumber:', error);
      setIsMainnumberDuplicate(false); // 체크 실패 시 막지 않음
    }
  };

  const handleSubmit = async () => {
    const numStr = String(mainnumber || '').trim();
    const name = (mainname || '').trim();

    if (!selectedExam || !numStr || !name) {
      message.error('모든 필드를 입력해 주세요.');
      return;
    }
    if (!/^[1-9]\d*$/.test(numStr)) {
      message.error('주요과목번호는 1 이상의 자연수만 입력할 수 있습니다.');
      return;
    }
    if (isMainnumberDuplicate) {
      message.warning('이미 등록된 주요과목입니다.');
      return;
    }

    setLoading(true);
    try {
      const response = await AxiosInstance.post('mainsubject/', {
        exam: selectedExam,
        mainnumber: Number(numStr),
        mainname: name,
      });
      onMainsubjectAdd?.(response.data);
      message.success('주요과목이 성공적으로 등록되었습니다.');

      // 초기화
      setSelectedExam('');
      setMainnumber('');
      setMainname('');
      setIsMainnumberDuplicate(false);
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
      <Typography.Title level={5}>주요과목 등록</Typography.Title>
      <Form layout="vertical" onFinish={handleSubmit} disabled={loading}>
        <Form.Item label="시험명" required>
          <Select
            value={selectedExam}
            onChange={(v) => {
              setSelectedExam(v);
              setMainnumber('');
              setMainname('');
              setIsMainnumberDuplicate(false);
            }}
            placeholder="시험명을 선택하세요"
            allowClear
          >
            {sortByKey(exams, 'examname').map((exam) => (
              <Option key={exam?.id} value={exam?.id}>
                {exam?.examname}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="주요과목번호" required>
          <Input
            placeholder={selectedExam ? '주요과목번호(자연수만 입력 가능)' : '시험명을 먼저 선택해주세요.'}
            value={mainnumber}
            onChange={(e) => {
              const value = e.target.value.trim();
              if (/^[1-9]\d*$/.test(value) || value === '') {
                handleMainnumberChange(value);
              }
            }}
            disabled={!selectedExam}
            inputMode="numeric"
          />
          {isMainnumberDuplicate && <Text type="danger">이미 등록된 주요과목입니다.</Text>}
        </Form.Item>

        <Form.Item label="주요과목 이름" required>
          <Input
            placeholder={
              mainnumber && !isMainnumberDuplicate ? '주요과목 이름 입력' : '주요과목번호를 먼저 선택해주세요.'
            }
            value={mainname}
            onChange={(e) => setMainname(e.target.value)}
            disabled={!mainnumber || isMainnumberDuplicate}
            maxLength={200}
            allowClear
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block disabled={isMainnumberDuplicate || !mainname.trim()} loading={loading}>
            등록
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default StudyWriteMainsubject;
