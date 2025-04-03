import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import PaperWriteAuthor from './PaperWriteAuthor';
import PaperWriteAgency from './PaperWriteAgency';
import PaperWritePublication from './PaperWritePublication';
import PaperWriteText from './PaperWriteText';

const PaperWrite = () => {
  const [refreshKey, setRefreshKey] = useState(0); // 새로고침 키

  const refreshData = () => {
    setRefreshKey((prevKey) => prevKey + 1); // 키 증가
  };

  return (
    <div style={{ padding: '20px' }}>
      <Typography variant="h5" gutterBottom>
        Write Reviews of a paper
      </Typography>
      <Box sx={{ border: '1px solid #ccc', borderRadius: '8px', margin: '0 0 3rem 0' }}>
        <PaperWriteText onSave={refreshData} refreshKey={refreshKey} />
      </Box>
      <Box
        sx={{
          border: '1px solid #ccc',
          borderRadius: '8px',
          margin: '1rem 0',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'row', // 가로 배치
          gap: '1rem', // 부모 컨테이너의 너비를 채움
          alignItems: 'stretch', // 하단 라인 정렬
        }}
      >
        {/* 왼쪽 박스 (Producer, Agency) */}
        <Box sx={{ display: 'flex', width: '35%', flexDirection: 'column', gap: '2rem' }}>
          <PaperWriteAuthor onRefresh={refreshData} />
          <PaperWriteAgency onRefresh={refreshData} />
        </Box>
        {/* 오른쪽 박스 (Publication) */}
        <Box sx={{ width: '65%' }}>
          <PaperWritePublication onRefresh={refreshData} />
        </Box>
      </Box>
    </div>
  );
};

export default PaperWrite;
