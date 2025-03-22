import React, { useEffect, useMemo, useState } from 'react';
import AxiosInstance from './AxiosInstance';
import { Box, Button, Stack, Pagination, TextField, Typography, Select, MenuItem, InputLabel, FormControl } from '@mui/material';
import { Link } from 'react-router-dom';




const StudyPagination = (explanations) => {
  // Pagination 설정
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const totalPages = Math.ceil(explanations.length / itemsPerPage);
  
  const sortedExplanations = useMemo(() => {
    return [...explanations].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [explanations]);
  
  const paginatedExplanations = sortedExplanations.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };


  return (
    <div>
      {/* Explanation 목록 */}
      <div>
          <div style={{ margin: '3rem 0 0 0' }}>
            {paginatedExplanations.map((item) => (
              <Box
                key={item.id}
                sx={{ p: 2, m: 2, boxShadow: 3, cursor: 'pointer', backgroundColor: selectedExplanation?.id === item.id ? '#ccc' : 'white' }}
                onClick={() => handleBoxClick(item)}
              >
                <div>
                  <strong>{item.exam.examname}</strong> {item.examnumber.examnumber}회 {item.examnumber.year}년 Q{item.question.questionnumber1}-{item.question.questionnumber2}. {item.question.questiontext}
                  <br />
                  좋아요: {item.like.length}개
                </div>
              </Box>
            ))}
          </div>
      </div>

      {/* Pagination 및 Write 버튼 */}
      <div style={{ display: 'flex', marginLeft: '2rem', marginRight: '2rem' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        </div>
        <div style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Stack spacing={2}>
            <Pagination count={totalPages} page={currentPage} onChange={handlePageChange} />
          </Stack>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button component={Link} to="/write" variant="contained">
            Write
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StudyPagination;
