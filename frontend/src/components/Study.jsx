import React, { useEffect, useMemo, useState } from 'react';
import { Button, Pagination, Typography, Select, Card, Space, Flex } from 'antd';
import { Link } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';

const { Text } = Typography;

const Study = () => {
  const [explanations, setExplanations] = useState([]);   // 항상 배열 유지
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedExamNumber, setSelectedExamNumber] = useState('');
  const [selectedQuestionNumber, setSelectedQuestionNumber] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchExplanations = async () => {
      try {
        const res = await AxiosInstance.get('explanation/', { headers: { Authorization: null } });
        const raw = res.data;
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.results) ? raw.results : []);
        setExplanations(list);
      } catch (error) {
        console.error('Error fetching explanations:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchExplanations();
  }, []);

  // ===== 필터링 =====
  const filteredExplanations = useMemo(() => {
    if (!Array.isArray(explanations)) return [];
    let filtered = explanations;

    if (selectedExam) {
      filtered = filtered.filter((item) => item?.exam?.examname === selectedExam);
    }
    if (selectedExamNumber) {
      filtered = filtered.filter((item) => item?.examnumber?.examnumber === Number(selectedExamNumber));
    }
    if (selectedQuestionNumber) {
      // Question의 1차 번호가 qsubject로 변경됨
      filtered = filtered.filter((item) => item?.question?.qsubject === Number(selectedQuestionNumber));
    }
    return filtered;
  }, [explanations, selectedExam, selectedExamNumber, selectedQuestionNumber]);

  // ===== 정렬 =====
  const sortedExplanations = useMemo(() => {
    const arr = Array.isArray(filteredExplanations) ? filteredExplanations : [];
    return arr.slice().sort((a, b) => new Date(b?.created_at) - new Date(a?.created_at));
  }, [filteredExplanations]);

  // ===== 페이지네이션 =====
  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(sortedExplanations.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedExplanations = sortedExplanations.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page) => setCurrentPage(page);

  // ===== Select 옵션 =====
  const safe = Array.isArray(explanations) ? explanations : [];

  const examOptions = [
    { value: '', label: '전체' },
    ...Array.from(new Set(safe.map((it) => it?.exam?.examname).filter(Boolean))).map((name) => ({
      value: name, label: name,
    })),
  ];

  const examNumberOptions = [
    { value: '', label: '전체' },
    ...Array.from(new Set(safe.map((it) => it?.examnumber?.examnumber).filter((v) => v !== null && v !== undefined))).map((num) => ({
      value: num, label: `${num}회`,
    })),
  ];

  const questionOptions = [
    { value: '', label: '전체' },
    // Question의 1차 번호는 qsubject로 변경
    ...Array.from(new Set(safe.map((it) => it?.question?.qsubject).filter((v) => v !== null && v !== undefined))).map((q) => ({
      value: q, label: q,
    })),
  ];

  return (
    <div style={{ padding: '1rem' }}>
      {/* 필터링 Select */}
      <Flex gap="middle" style={{ marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <Text strong>시험명</Text>
          <Select
            value={selectedExam}
            onChange={(value) => { setSelectedExam(value); setCurrentPage(1); }}
            style={{ width: '100%' }}
            options={examOptions}
            placeholder="시험명을 선택하세요"
            allowClear
          />
        </div>

        <div style={{ flex: 1 }}>
          <Text strong>시험회차</Text>
          <Select
            value={selectedExamNumber}
            onChange={(value) => { setSelectedExamNumber(value); setCurrentPage(1); }}
            style={{ width: '100%' }}
            options={examNumberOptions}
            placeholder="시험회차를 선택하세요"
            allowClear
          />
        </div>

        <div style={{ flex: 1 }}>
          <Text strong>{selectedExam ? '과목번호' : '(과목번호) 시험회차를 먼저 선택해주세요.'}</Text>
          <Select
            value={selectedQuestionNumber}
            onChange={(value) => { setSelectedQuestionNumber(value); setCurrentPage(1); }}
            style={{ width: '100%' }}
            options={questionOptions}
            placeholder={selectedExam ? '과목번호를 선택하세요' : '시험회차를 먼저 선택해주세요.'}
            disabled={!selectedExam}
            allowClear
          />
        </div>
      </Flex>

      {/* Explanation 목록 */}
      {loading ? (
        <Text>Loading data...</Text>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {paginatedExplanations.map((item) => (
            <Link key={item?.id} to={`/study/view/${item?.id}`} style={{ textDecoration: 'none' }}>
              <Card hoverable>
                <Flex justify="space-between" align="center">
                  <div style={{ width: '10%' }}>
                    <strong>{item?.exam?.examname ?? '-'}</strong>
                  </div>
                  <div style={{ width: '15%' }}>
                    {item?.examnumber?.year ?? '-'}년 {item?.examnumber?.examnumber ?? '-'}회 {item?.question?.qsubject ?? '-'}-{item?.question?.qnumber ?? '-'}
                  </div>
                  <div style={{ width: '65%' }}>{item?.question?.qtext ?? ''}</div>
                  {/* like_count로 변경 (M2M 배열 길이 아님) */}
                  <div style={{ width: '10%', textAlign: 'right' }}>좋아요: {item?.like_count ?? 0}개</div>
                </Flex>
              </Card>
            </Link>
          ))}
        </Space>
      )}

      {/* Pagination + Write 버튼 */}
      <Flex justify="space-between" align="center" style={{ marginTop: '2rem' }}>
        <div />
        <Pagination current={currentPage} total={sortedExplanations.length} pageSize={itemsPerPage} onChange={handlePageChange} />
        <Button type="primary">
          <Link to="/study/write" style={{ color: 'white' }}>Write</Link>
        </Button>
      </Flex>
    </div>
  );
};

export default Study;
