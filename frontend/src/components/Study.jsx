import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Stack, Pagination, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Link } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';

const Study = ({ examList, examNumberList, questionList, mainsubjectList, detailsubjectList }) => {
  const [explanations, setExplanations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState(''); // 선택된 시험명
  const [selectedExamNumber, setSelectedExamNumber] = useState(''); // 시험회차 선택
  const [selectedQuestionNumber, setSelectedQuestionNumber] = useState(''); // 문제

  useEffect(() => {
    const fetchExplanations = async () => {
      try {
        const explanationRes = await AxiosInstance.get('explanation/', {
          headers: { Authorization: null }, // 인증 없이 데이터 요청
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

  // Pagination 설정
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const totalPages = Math.ceil(explanations.length / itemsPerPage);

  // 필터링 및 정렬
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

  return (
    <div>
      {/* 필터링 Select 컴포넌트 */}
      <Box sx={{ display: 'flex', gap: '1rem', m: 1 }}>
        {/* 시험명 선택 */}
        <FormControl sx={{ flex: 1 }}>
          <InputLabel>시험명</InputLabel>
          <Select
            value={selectedExam}
            onChange={(e) => {
              setSelectedExam(e.target.value);
              setCurrentPage(1);
            }}
          >
            <MenuItem value="">전체</MenuItem>
            {Array.from(new Set(explanations.map((item) => item.exam.examname))).map((examName, index) => (
              <MenuItem key={index} value={examName}>
                {examName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 시험회차 선택 */}
        <FormControl sx={{ flex: 1 }}>
          <InputLabel>시험회차</InputLabel>
          <Select
            value={selectedExamNumber}
            onChange={(e) => {
              setSelectedExamNumber(e.target.value);
              setCurrentPage(1);
            }}
          >
            <MenuItem value="">전체</MenuItem>
            {Array.from(new Set(explanations.map((item) => item.examnumber.examnumber))).map((examNumber, index) => (
              <MenuItem key={index} value={examNumber}>
                {examNumber}회
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 문제번호 선택 */}
        <FormControl sx={{ flex: 1 }} fullWidth disabled={!selectedExam}>
          <InputLabel>{selectedExam ? '과목번호' : '(과목번호)시험회차를 먼저 선택해주세요.'}</InputLabel>
          <Select
            value={selectedQuestionNumber}
            onChange={(e) => {
              setSelectedQuestionNumber(e.target.value);
              setCurrentPage(1);
            }}
          >
            <MenuItem value="">전체</MenuItem>
            {Array.from(new Set(explanations.map((item) => item.question.questionnumber1))).map((questionNumber, index) => (
              <MenuItem key={index} value={questionNumber}>
                {questionNumber}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Explanation 목록 */}
      <div>
        {loading ? (
          <p>Loading data...</p>
        ) : (
          <div style={{ margin: '3rem 0 0 0' }}>
            {paginatedExplanations.map((item) => (
              <Box
                key={item.id}
                sx={{ p: 2, m: 1, boxShadow: 3, cursor: 'pointer', backgroundColor: 'white', color: 'black' }}
              >
                <Link to={`/study/view/${item.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div>
                    <strong>{item.exam.examname}</strong> {item.examnumber.year}년 {item.examnumber.examnumber}회 Q
                    {item.question.questionnumber1}-{item.question.questionnumber2}. {item.question.questiontext}
                    <br />
                    좋아요: {item.like.length}개
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
