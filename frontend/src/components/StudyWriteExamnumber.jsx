import React, { useMemo, useState } from 'react';
import { Form, Select, Input, Button, Typography, DatePicker, message } from 'antd';
import dayjs from 'dayjs';
import AxiosInstance from './AxiosInstance';

const { Option } = Select;
const { Text } = Typography;

// 배열 정규화 헬퍼
const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

const StudyWriteExamnumber = ({ examList, onExamNumberAdd }) => {
  const currentYear = new Date().getFullYear();
  const [selectedExam, setSelectedExam] = useState('');
  const [examNumber, setExamNumber] = useState(''); // 문자열로 입력받아 검증
  const [date, setDate] = useState(dayjs(`${currentYear}-01-01`));
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [loading, setLoading] = useState(false);

  const exams = useMemo(() => asArray(examList), [examList]);

  const handleExamNumberChange = async (value) => {
    setExamNumber(value);

    // 선택 미완료면 중복체크 off
    if (!selectedExam || !value) {
      setIsDuplicate(false);
      return;
    }

    try {
      const response = await AxiosInstance.get('examnumber/check_examnumber/', {
        params: { exam: selectedExam, examnumber: value },
      });
      setIsDuplicate(!!response?.data?.exists);
    } catch (err) {
      console.error('Error checking examnumber:', err);
      // 체크 실패 시에는 막지 않음
      setIsDuplicate(false);
    }
  };

  const handleExamNumberSubmit = async () => {
    const examId = selectedExam;
    const numStr = String(examNumber || '').trim();
    const yr = date?.year?.() ?? null;

    if (!examId || !numStr || !yr) {
      message.error('모든 필드를 입력해 주세요.');
      return;
    }
    if (!/^[1-9]\d*$/.test(numStr)) {
      message.error('회차는 1 이상의 자연수만 입력할 수 있습니다.');
      return;
    }
    if (isDuplicate) {
      message.warning('이미 입력된 시험회차입니다.');
      return;
    }

    setLoading(true);
    try {
      const response = await AxiosInstance.post('examnumber/', {
        exam: examId,
        examnumber: Number(numStr),
        year: yr,
      });
      message.success('시험회차가 성공적으로 등록되었습니다.');
      onExamNumberAdd?.(response.data);

      // 초기화
      setSelectedExam('');
      setExamNumber('');
      setDate(dayjs(`${yr}-01-01`));
      setIsDuplicate(false);
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
    <div style={{ maxWidth: 500 }}>
      <Typography.Title level={5}>Exam Number</Typography.Title>
      <Form layout="vertical" onFinish={handleExamNumberSubmit} disabled={loading}>
        <Form.Item label="시험명" required>
          <Select
            value={selectedExam}
            onChange={(v) => {
              setSelectedExam(v);
              // 시험 변경 시 현재 회차와 중복 상태 재검토
              if (examNumber) {
                handleExamNumberChange(examNumber);
              } else {
                setIsDuplicate(false);
              }
            }}
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

        <Form.Item label="시험 회차 번호(연1회 시행 시 1입력)" required>
          <Input
            placeholder={selectedExam ? '시험 회차 번호(자연수만 입력 가능)' : '시험명을 먼저 선택해주세요.'}
            value={examNumber}
            onChange={(e) => {
              const v = e.target.value;
              // 자연수만 허용 (빈값 OK)
              if (/^[1-9]\d*$/.test(v) || v === '') {
                handleExamNumberChange(v);
              }
            }}
            disabled={!selectedExam}
            inputMode="numeric"
          />
          {isDuplicate && <Text type="danger">이미 입력된 시험회차입니다.</Text>}
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
            disabled={isDuplicate || !examNumber || !selectedExam || !date}
            loading={loading}
          >
            등록
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default StudyWriteExamnumber;
