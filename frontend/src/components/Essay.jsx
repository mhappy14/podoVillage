import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, FormControl, InputLabel, Select, MenuItem, Stack, Pagination, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';

const Essay = () => {
  const [essays, setEssays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('');

  useEffect(() => {
    const fetchEssays = async () => {
      try {
        const response = await AxiosInstance.get('essay/', {
          headers: { Authorization: null }, // 인증 없이 데이터 요청
        });
        setEssays(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching essays:', error);
        setLoading(false);
      }
    };
    fetchEssays();
  }, []);

  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const totalPages = Math.ceil(essays.length / itemsPerPage);

  const filteredEssays = useMemo(() => {
    let filtered = essays;
    if (selectedCategory) {
      filtered = filtered.filter((essay) => essay.publication?.category === selectedCategory);
    }
    if (selectedYear) {
      filtered = filtered.filter((essay) => essay.publication?.year === parseInt(selectedYear, 10));
    }
    if (selectedAuthor) {
      filtered = filtered.filter((essay) =>
        essay.publication?.author?.some((author) => author.producer_name === selectedAuthor)
      );
    }
    return filtered;
  }, [essays, selectedCategory, selectedYear, selectedAuthor]);
  
  const sortedEssays = useMemo(() => {
    return [...filteredEssays].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [filteredEssays]);

  const paginatedEssays = sortedEssays.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  return (
    <div>
      <Box sx={{ display: 'flex', gap: '1rem', m: 1 }}>
        <FormControl sx={{ flex: 1 }}>
          <InputLabel>카테고리</InputLabel>
          <Select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
          >
            <MenuItem value="">전체</MenuItem>
            {Array.from(new Set(essays.map((essay) => essay.publication?.category || ''))).map((category, index) => (
              <MenuItem key={index} value={category}>
                {category}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ flex: 1 }}>
          <InputLabel>출판연도</InputLabel>
          <Select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setCurrentPage(1);
            }}
          >
            <MenuItem value="">전체</MenuItem>
              {Array.from(new Set(essays.map((essay) => essay.publication?.year || ''))).map((year, index) => (
                <MenuItem key={index} value={year}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ flex: 1 }}>
          <InputLabel>저자</InputLabel>
          <Select
            value={selectedAuthor}
            onChange={(e) => {
              setSelectedAuthor(e.target.value);
              setCurrentPage(1);
            }}
          >
            <MenuItem value="">전체</MenuItem>
              {Array.from(
                new Set(
                  essays.flatMap((essay) =>
                    essay.publication?.author?.map((author) => author.producer_name) || []
                  )
                )
              ).map((author, index) => (
                <MenuItem key={index} value={author}>
                  {author}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      </Box>

      <div>
        {loading ? (
          <Typography>Loading...</Typography>
        ) : (
          <div style={{ margin: '3rem 0 0 0' }}>
            {paginatedEssays.map((essay) => (
              <Box
                key={essay.id}
                sx={{ p: 2, m: 1, boxShadow: 3, cursor: 'pointer', backgroundColor: 'white', color: 'black' }}
              >
                <Link to={`/essay/view/${essay.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div>
                  <strong>{essay.publication?.title}</strong>
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
          <Button component={Link} to="/essay/write" variant="contained">
            Write
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Essay;
