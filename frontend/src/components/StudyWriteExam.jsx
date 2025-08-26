import React, { useMemo, useState } from 'react';
import { Form, Input, Button, Typography, message, Select } from 'antd';
import AxiosInstance from './AxiosInstance';

const { Title } = Typography;
const { Option } = Select;

const EXAMTYPE_OPTIONS = [
  { value: 'License', label: '자격증' },
  { value: 'Public',  label: '공무원' },
  { value: 'Recruit', label: '기업채용' },
  { value: 'Other',   label: '기타' },
];

// 백엔드 모델과 동일한 ragent 문자열 values
const RAGENT_OPTIONS = [
  { value: '국가직', label: '국가직' },
  { value: '지방직', label: '지방직' },
  { value: '서울시', label: '서울시' },
  { value: '국회직', label: '국회직' },
  { value: '법원직', label: '법원직' },
  { value: '경찰',   label: '경찰' },
  { value: '소방',   label: '소방' },
  { value: '해경',   label: '해경' },
  { value: '군무원', label: '군무원' },
  { value: '기상직', label: '기상직' },
  { value: '지역인재', label: '지역인재' },
  { value: '계리직', label: '계리직' },
  { value: '간호직', label: '간호직' },
  { value: '비상대비', label: '비상대비' },
];

// ragent별 허용 직급(백엔드 검증 규칙과 동일)
const RPOSITION_MAP = {
  국가직: ['5급', '5급경력', '5급승진', '7급', '9급'],
  지방직: ['7급', '9급'],
  서울시: ['7급', '9급', '9급경력', '연구직', '지도직'],
  국회직: ['5급', '8급', '9급'],
  법원직: ['5급', '5급승진', '9급'],
  경찰:   ['간부후보', '경력채용', '공채', '승진시험', '특공대', '경찰대편입'],
  소방:   ['간부후보', '경력채용', '공채', '승진시험'],
  해경:   ['간부후보', '경력채용', '공채', '승진시험'],
  군무원: ['5급', '7급', '9급'],
  기상직: ['7급', '9급'],
  // 아래 4개는 직급 필수 아님(리스트 비워 둠)
  지역인재: [],
  계리직: [],
  간호직: [],
  비상대비: [],
};

const POSITION_REQUIRED_RAGENTS = new Set(Object.keys(RPOSITION_MAP).filter(k => RPOSITION_MAP[k].length > 0));
const RGROUP_REQUIRED_RAGENTS   = new Set(['국가직', '지방직', '서울시', '국회직', '법원직']);

// 배열/페이징 응답 정규화
const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

const StudyWriteExam = ({ examList, onExamAdd }) => {
  const [examName, setExamName] = useState('');
  const [examType, setExamType] = useState(undefined);

  // 공무원 관련 상태
  const [ragent, setRagent] = useState(undefined);
  const [rposition, setRposition] = useState(undefined);
  const [rgroup, setRgroup] = useState(''); // 텍스트

  const [loading, setLoading] = useState(false);
  const normalizedExams = useMemo(() => asArray(examList), [examList]);

  const isPublic = examType === 'Public';
  const showRagent = isPublic;
  const showRposition = isPublic && ragent && POSITION_REQUIRED_RAGENTS.has(ragent);
  const showRgroup   = isPublic && ragent && RGROUP_REQUIRED_RAGENTS.has(ragent);

  const filteredRpositions = useMemo(() => {
    if (!ragent) return [];
    return RPOSITION_MAP[ragent] || [];
  }, [ragent]);

  // 상위 변경 시 하위 초기화
  const onChangeExamType = (val) => {
    setExamType(val);
    setRagent(undefined);
    setRposition(undefined);
    setRgroup('');
  };
  const onChangeRagent = (val) => {
    setRagent(val);
    setRposition(undefined);
    setRgroup('');
  };

  const handleExamSubmit = async () => {
    const name = examName.trim();

    if (!name) {
      message.error('시험명을 입력해 주세요.');
      return;
    }
    if (!examType) {
      message.error('시험종류를 선택해 주세요.');
      return;
    }

    // 중복 방지(같은 이름+종류)
    const dup = normalizedExams.some(
      (ex) => ex?.examname === name && ex?.examtype === examType
    );
    if (dup) {
      message.warning('이미 동일한 시험명/시험종류가 등록되어 있습니다.');
      return;
    }

    // === 공무원 규칙(프론트 사전 검증) ===
    const payload = { examname: name, examtype: examType };

    if (isPublic) {
      if (!ragent) {
        message.error('채용기관을 선택해 주세요.');
        return;
      }
      payload.ragent = ragent;

      if (POSITION_REQUIRED_RAGENTS.has(ragent)) {
        if (!rposition) {
          message.error('직급을 선택해 주세요.');
          return;
        }
        // 허용목록 체크(사용자 임의 입력 방지)
        if (!(RPOSITION_MAP[ragent] || []).includes(rposition)) {
          message.error('선택한 채용기관에서 허용되지 않는 직급입니다.');
          return;
        }
        payload.rposition = rposition;
      } else if (rposition) {
        // 불필수군에 직급을 넣었으면 경고(원하면 허용 가능)
        message.error('선택한 채용기관에서는 직급을 설정하지 않습니다.');
        return;
      }

      if (RGROUP_REQUIRED_RAGENTS.has(ragent)) {
        if (!rgroup.trim()) {
          message.error('직류를 입력해 주세요.');
          return;
        }
        payload.rgroup = rgroup.trim();
      } else if (rgroup.trim()) {
        message.error('선택한 채용기관에서는 직류를 설정하지 않습니다.');
        return;
      }
    }

    setLoading(true);
    try {
      const response = await AxiosInstance.post('exam/', payload);
      onExamAdd?.(response.data);
      message.success('시험이 성공적으로 등록되었습니다.');

      // 초기화
      setExamName('');
      setExamType(undefined);
      setRagent(undefined);
      setRposition(undefined);
      setRgroup('');
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
    <div style={{ margin: '0 0 0 0' }}>
      <Title level={5}>Exam</Title>
      <Form onFinish={handleExamSubmit} layout="vertical" disabled={loading}>

        <Form.Item label="시험종류" required>
          <Select
            value={examType}
            onChange={onChangeExamType}
            placeholder="시험종류를 선택하세요"
            allowClear
          >
            {EXAMTYPE_OPTIONS.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {showRagent && (
          <Form.Item label="채용기관" required>
            <Select
              value={ragent}
              onChange={onChangeRagent}
              placeholder="채용기관을 선택하세요"
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {RAGENT_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        {showRposition && (
          <Form.Item label="직급" required>
            <Select
              value={rposition}
              onChange={setRposition}
              placeholder="직급을 선택하세요"
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {filteredRpositions.map((rp) => (
                <Option key={rp} value={rp}>
                  {rp}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        {showRgroup && (
          <Form.Item label="직렬" required>
            <Input
              value={rgroup}
              onChange={(e) => setRgroup(e.target.value)}
              placeholder="예) 행정(일반행정), 토목, 건축 등"
              maxLength={20}
              allowClear
            />
          </Form.Item>
        )}

        <Form.Item label={showRgroup ? "직류" : "시험명"} required>
          <Input
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
            placeholder={showRgroup ? "직류를 입력하세요" : "시험명을 입력하세요"}
            maxLength={200}
            allowClear
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            등록
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default StudyWriteExam;
