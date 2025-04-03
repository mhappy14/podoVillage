import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Stack, Pagination, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import { Select } from 'antd';

const Study = ({ examList, examNumberList, questionList, mainsubjectList, detailsubjectList }) => {
  const [explanations, setExplanations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedExamNumber, setSelectedExamNumber] = useState('');
  const [selectedQuestionNumber, setSelectedQuestionNumber] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchExplanations = async () => {
      try {
        const explanationRes = await AxiosInstance.get('explanation/', {
          headers: { Authorization: null },
        });
        setExplanations(explanationRes.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching explanations:', error);
        setLoading(false);
      }
    };
    fetchExplanations();
  }, []);

  const itemsPerPage = 10;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const totalPages = Math.ceil(explanations.length / itemsPerPage);

  // 필터링
  const filteredExplanations = useMemo(() => {
    let filtered = explanations;
    if (selectedExam) {
      filtered = filtered.filter((item) => item.exam?.examname === selectedExam);
    }
    if (selectedExamNumber) {
      filtered = filtered.filter((item) => item.examnumber?.examnumber === Number(selectedExamNumber));
    }
    if (selectedQuestionNumber) {
      filtered = filtered.filter((item) => item.question?.questionnumber1 === Number(selectedQuestionNumber));
    }
    return filtered;
  }, [explanations, selectedExam, selectedExamNumber, selectedQuestionNumber]);

  const sortedExplanations = useMemo(() => {
    return [...filteredExplanations].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [filteredExplanations]);

  const paginatedExplanations = sortedExplanations.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  // antd Select에 전달할 옵션 배열 생성
  const examOptions = [
    { value: '', label: '전체' },
    ...Array.from(new Set(explanations.map((item) => item.exam.examname))).map((examName) => ({
      value: examName,
      label: examName,
    })),
  ];

  const examNumberOptions = [
    { value: '', label: '전체' },
    ...Array.from(new Set(explanations.map((item) => item.examnumber.examnumber))).map((examNumber) => ({
      value: examNumber,
      label: `${examNumber}회`,
    })),
  ];

  const questionOptions = [
    { value: '', label: '전체' },
    ...Array.from(new Set(explanations.map((item) => item.question.questionnumber1))).map((questionNumber) => ({
      value: questionNumber,
      label: questionNumber,
    })),
  ];

  return (
    <div>
      {/* 필터링 Select 컴포넌트 */}
      <Box sx={{ display: 'flex', gap: '1rem', m: 1 }}>
        {/* 시험명 선택 */}
        <div style={{ flex: 1 }}>
          <label style={{ marginBottom: '0.5rem', display: 'block' }}>시험명</label>
          <Select
            value={selectedExam}
            onChange={(value) => {
              setSelectedExam(value);
              setCurrentPage(1);
            }}
            style={{ width: '100%' }}
            options={examOptions}
            placeholder="시험명을 선택하세요"
          />
        </div>

        {/* 시험회차 선택 */}
        <div style={{ flex: 1 }}>
          <label style={{ marginBottom: '0.5rem', display: 'block' }}>시험회차</label>
          <Select
            value={selectedExamNumber}
            onChange={(value) => {
              setSelectedExamNumber(value);
              setCurrentPage(1);
            }}
            style={{ width: '100%' }}
            options={examNumberOptions}
            placeholder="시험회차를 선택하세요"
          />
        </div>

        {/* 문제번호 선택 */}
        <div style={{ flex: 1 }}>
          <label style={{ marginBottom: '0.5rem', display: 'block' }}>
            {selectedExam ? '과목번호' : '(과목번호)시험회차를 먼저 선택해주세요.'}
          </label>
          <Select
            value={selectedQuestionNumber}
            onChange={(value) => {
              setSelectedQuestionNumber(value);
              setCurrentPage(1);
            }}
            style={{ width: '100%' }}
            options={questionOptions}
            placeholder={selectedExam ? '과목번호를 선택하세요' : '시험회차를 먼저 선택해주세요.'}
            disabled={!selectedExam}
          />
        </div>
      </Box>

      {/* Explanation 목록 */}
      <div>
        {loading ? (
          <Typography>Loading data...</Typography>
        ) : (
          <div style={{ margin: '1rem 0 0 0' }}>
            {paginatedExplanations.map((item) => (
              <Box
                key={item.id}
                sx={{ p: 1, m: 1, boxShadow: 3, cursor: 'pointer', backgroundColor: 'white', color: 'black' }}
              >
                <Link to={`/study/view/${item.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display:'flex' }}>
                    <div style={{ width:'10%'}}><strong>{item.exam.examname}</strong></div>
                    <div style={{ width:'15%'}}>{item.examnumber.year}년 {item.examnumber.examnumber}회 Q
                    {item.question.questionnumber1}-{item.question.questionnumber2}.</div>
                    <div style={{ width:'65%'}}>{item.question.questiontext}</div>
                    <div style={{ width:'10%'}}>좋아요: {item.like.length}개</div>
                  </div>
                </Link>
              </Box>
            ))}
          </div>
        )}
      </div>

      {/* Pagination 및 Write 버튼 */}
      <div style={{ display: 'flex', marginLeft: '2rem', marginRight: '2rem', marginTop: '2rem' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}></div>
        <div style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Stack spacing={2}>
            <Pagination count={totalPages} page={currentPage} onChange={handlePageChange} />
          </Stack>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button component={Link} to="/study/write" variant="contained">
            Write
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Study;
