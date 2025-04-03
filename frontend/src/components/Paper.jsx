import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, FormControl, InputLabel, Stack, Pagination, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import { Select } from 'antd';

const Paper = () => {
  const [Papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchPapers = async () => {
      try {
        const response = await AxiosInstance.get('Paper/', {
          headers: { Authorization: null }, // 인증 없이 데이터 요청
        });
        setPapers(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching Papers:', error);
        setLoading(false);
      }
    };
    fetchPapers();
  }, []);

  const itemsPerPage = 10;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const totalPages = Math.ceil(Papers.length / itemsPerPage);

  const filteredPapers = useMemo(() => {
    let filtered = Papers;
    if (selectedCategory) {
      filtered = filtered.filter((Paper) => Paper.publication?.category === selectedCategory);
    }
    if (selectedYear) {
      filtered = filtered.filter((Paper) => Paper.publication?.year === parseInt(selectedYear, 10));
    }
    if (selectedAuthor) {
      filtered = filtered.filter((Paper) =>
        Paper.publication?.author?.some((author) => author.producer_name === selectedAuthor)
      );
    }
    return filtered;
  }, [Papers, selectedCategory, selectedYear, selectedAuthor]);

  const sortedPapers = useMemo(() => {
    return [...filteredPapers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [filteredPapers]);

  const paginatedPapers = sortedPapers.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  // antd Select에 전달할 옵션 배열 생성
  const categoryOptions = [
    { value: '', label: '전체' },
    ...Array.from(new Set(Papers.map((Paper) => Paper.publication?.category || ''))).map((category) => ({
      value: category,
      label: category,
    })),
  ];

  const yearOptions = [
    { value: '', label: '전체' },
    ...Array.from(new Set(Papers.map((Paper) => Paper.publication?.year || ''))).map((year) => ({
      value: year,
      label: year,
    })),
  ];

  const authorOptions = [
    { value: '', label: '전체' },
    ...Array.from(
      new Set(
        Papers.flatMap((Paper) =>
          Paper.publication?.author?.map((author) => author.producer_name) || []
        )
      )
    ).map((author) => ({
      value: author,
      label: author,
    })),
  ];

  return (
    <div>
      <Box sx={{ display: 'flex', gap: '1rem', m: 1 }}>
        {/* 카테고리 선택 */}
        <FormControl sx={{ flex: 1 }}>
          <InputLabel shrink>카테고리</InputLabel>
          <Select
            value={selectedCategory}
            onChange={(value) => {
              setSelectedCategory(value);
              setCurrentPage(1);
            }}
            style={{ width: '100%' }}
            options={categoryOptions}
          />
        </FormControl>

        {/* 출판연도 선택 */}
        <FormControl sx={{ flex: 1 }}>
          <InputLabel shrink>출판연도</InputLabel>
          <Select
            value={selectedYear}
            onChange={(value) => {
              setSelectedYear(value);
              setCurrentPage(1);
            }}
            style={{ width: '100%' }}
            options={yearOptions}
          />
        </FormControl>

        {/* 저자 선택 */}
        <FormControl sx={{ flex: 1 }}>
          <InputLabel shrink>저자</InputLabel>
          <Select
            value={selectedAuthor}
            onChange={(value) => {
              setSelectedAuthor(value);
              setCurrentPage(1);
            }}
            style={{ width: '100%' }}
            options={authorOptions}
          />
        </FormControl>
      </Box>

      <div>
        {loading ? (
          <Typography>Loading...</Typography>
        ) : (
          <div style={{ margin: '3rem 0 0 0' }}>
            {paginatedPapers.map((Paper) => (
              <Box
                key={Paper.id}
                sx={{ p: 2, m: 1, boxShadow: 3, cursor: 'pointer', backgroundColor: 'white', color: 'black' }}
              >
                <Link to={`/Paper/view/${Paper.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div>
                    <strong>{Paper.publication?.title}</strong>
                  </div>
                </Link>
              </Box>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', marginLeft: '2rem', marginRight: '2rem', marginTop: '2rem' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}></div>
        <div style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Stack spacing={2}>
            <Pagination count={totalPages} page={currentPage} onChange={handlePageChange} />
          </Stack>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button component={Link} to="/Paper/write" variant="contained">
            Write
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Paper;
