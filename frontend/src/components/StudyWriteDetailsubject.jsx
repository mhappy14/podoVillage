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

const StudyWriteDetailsubject = ({ examList, mainsubjectList, onDetailsubjectAdd }) => {
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedMainsubject, setSelectedMainsubject] = useState('');
  const [detailnumber, setDetailnumber] = useState('');
  const [detailtitle, setDetailtitle] = useState('');
  const [isDetailnumberDuplicate, setIsDetailnumberDuplicate] = useState(false);
  const [loading, setLoading] = useState(false);

  const exams = useMemo(() => asArray(examList), [examList]);
  const mains = useMemo(() => asArray(mainsubjectList), [mainsubjectList]);

  // 시험 선택에 따른 주요과목 필터
  const filteredMains = useMemo(() => {
    if (!selectedExam) return [];
    return mains.filter((m) => m?.exam?.id === Number(selectedExam));
  }, [selectedExam, mains]);

  const handleDetailnumberChange = async (value) => {
    setDetailnumber(value);

    if (!selectedMainsubject || !value) {
      setIsDetailnumberDuplicate(false);
      return;
    }

    try {
      const response = await AxiosInstance.get('detailsubject/check_detailnumber/', {
        params: { mainslug: selectedMainsubject, detailnumber: value },
      });
      setIsDetailnumberDuplicate(!!response?.data?.exists);
    } catch (error) {
      console.error('Error checking detailnumber:', error);
      setIsDetailnumberDuplicate(false);
    }
  };

  const handleSubmit = async () => {
    const numStr = String(detailnumber || '').trim();
    const title = (detailtitle || '').trim();

    if (!selectedExam || !selectedMainsubject || !numStr || !title) {
      message.error('모든 필드를 입력해 주세요.');
      return;
    }
    if (!/^[1-9]\d*$/.test(numStr)) {
      message.error('세부과목번호는 1 이상의 자연수만 입력할 수 있습니다.');
      return;
    }
    if (isDetailnumberDuplicate) {
      message.warning('이미 등록된 세부과목입니다.');
      return;
    }

    setLoading(true);
    try {
      const response = await AxiosInstance.post('detailsubject/', {
        exam: selectedExam,
        mainslug: selectedMainsubject,
        detailnumber: Number(numStr),
        detailtitle: title,
      });
      onDetailsubjectAdd?.(response.data);
      message.success('세부과목이 성공적으로 등록되었습니다.');

      // 초기화
      setSelectedExam('');
      setSelectedMainsubject('');
      setDetailnumber('');
      setDetailtitle('');
      setIsDetailnumberDuplicate(false);
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
      <Typography.Title level={5}>세부과목 등록</Typography.Title>
      <Form layout="vertical" onFinish={handleSubmit} disabled={loading}>
        <Form.Item label="시험명" required>
          <Select
            placeholder="시험명을 선택하세요"
            value={selectedExam}
            onChange={(v) => {
              setSelectedExam(v);
              setSelectedMainsubject('');
              setDetailnumber('');
              setDetailtitle('');
              setIsDetailnumberDuplicate(false);
            }}
            allowClear
          >
            {sortByKey(exams, 'examname').map((exam) => (
              <Option key={exam?.id} value={exam?.id}>
                {exam?.examname}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="주요과목" required>
          <Select
            placeholder={selectedExam ? '주요과목 선택' : '시험명을 먼저 선택해주세요'}
            value={selectedMainsubject}
            onChange={(v) => {
              setSelectedMainsubject(v);
              // 주요과목 변경 시 중복 상태 재검토
              if (detailnumber) {
                handleDetailnumberChange(detailnumber);
              } else {
                setIsDetailnumberDuplicate(false);
              }
            }}
            disabled={!selectedExam}
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {sortByKey(filteredMains, 'mainslug').map((main) => (
              <Option key={main?.id} value={main?.id}>
                {main?.mainslug}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="세부과목번호" required>
          <Input
            placeholder={selectedMainsubject ? '세부과목번호(자연수만 입력 가능)' : '주요과목을 먼저 선택해주세요'}
            value={detailnumber}
            onChange={(e) => {
              const value = e.target.value.trim();
              if (/^[1-9]\d*$/.test(value) || value === '') {
                handleDetailnumberChange(value);
              }
            }}
            disabled={!selectedMainsubject}
            inputMode="numeric"
          />
          {isDetailnumberDuplicate && <Text type="danger">이미 등록된 세부과목입니다.</Text>}
        </Form.Item>

        <Form.Item label="세부과목 이름" required>
          <Input
            placeholder={
              selectedMainsubject && !isDetailnumberDuplicate ? '세부과목 이름 입력' : '세부과목번호를 먼저 선택해주세요'
            }
            value={detailtitle}
            onChange={(e) => setDetailtitle(e.target.value)}
            disabled={!selectedMainsubject || isDetailnumberDuplicate}
            maxLength={400}
            allowClear
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            disabled={isDetailnumberDuplicate || !detailtitle.trim()}
            loading={loading}
          >
            등록
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default StudyWriteDetailsubject;
