import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import AxiosInstance from './AxiosInstance';

const EssayWritePublication = ({ onRefresh }) => {
  const [publicationList, setPublicationList] = useState([]);
  const [authorList, setAuthorList] = useState([]);
  const [translatorList, setTranslatorList] = useState([]);
  const [agencyList, setAgencyList] = useState([]);
  const [newPublication, setNewPublication] = useState({
    category: '',
    year: '',
    title: '',
    agency_name: '',
    authors: [],
    translators: [],
    volume: '',
    issue: '',
    start_page: '',
    end_page: '',
  });

  const fetchData = async () => {
    try {
      const [publications, authors, translators, agencies] = await Promise.all([
        AxiosInstance.get('publication/'),
        AxiosInstance.get('producer/?job=author'),
        AxiosInstance.get('producer/?job=translator'),
        AxiosInstance.get('agency/'),
      ]);
      setPublicationList(publications.data);
      setAuthorList(authors.data);
      setTranslatorList(translators.data);
      setAgencyList(agencies.data);
    } catch (error) {
      console.error('데이터 가져오기 오류:', error);
    }
  };

  const handleAddPublication = async () => {
    try {
      const requestData = {
        category: newPublication.category,
        year: parseInt(newPublication.year, 10), // 숫자 변환
        title: newPublication.title,
        agency: newPublication.agency_name, // ForeignKey에 맞는 필드명 사용
        author: newPublication.authors, // Many-to-Many 관계
        translator: newPublication.translators, // Many-to-Many 관계
        volume: newPublication.volume || null,
        issue: newPublication.issue || null,
        start_page: newPublication.start_page || null,
        end_page: newPublication.end_page || null,
      };
  
      await AxiosInstance.post('publication/', requestData);
      setNewPublication({
        category: '',
        year: '',
        title: '',
        agency_name: '',
        authors: [],
        translators: [],
        volume: '',
        issue: '',
        start_page: '',
        end_page: '',
      });
      onRefresh();
    } catch (error) {
      console.error('Publication 추가 오류:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Box>
      <Typography variant="h6">서적 추가</Typography>
      {/* 카테고리 및 출판 연도 */}
      <Box sx={{ display: 'flex', gap: '1rem', margin: '0 0 1rem 0', alignItems: 'center'  }}>
        <FormControl fullWidth>
          <InputLabel id="category-select-label">카테고리</InputLabel>
          <Select
            labelId="category-select-label"
            value={newPublication.category}
            onChange={(e) => setNewPublication({ ...newPublication, category: e.target.value })}
          >
            <MenuItem value="article">학술논문</MenuItem>
            <MenuItem value="book">단행본</MenuItem>
            <MenuItem value="translation">번역서</MenuItem>
            <MenuItem value="dissertation">박사학위논문</MenuItem>
            <MenuItem value="thesis">석사학위논문</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="출판 연도"
          value={newPublication.year}
          onChange={(e) => setNewPublication({ ...newPublication, year: e.target.value })}
          fullWidth
          margin="normal"
        />
      </Box>

      {/* 저자 및 번역자 선택 */}
      <Box sx={{ display: 'flex', gap: '1rem', margin: '1rem 0 1rem 0' }}>
        <FormControl fullWidth>
          <InputLabel id="author-select-label">저자</InputLabel>
          <Select
            labelId="author-select-label"
            multiple
            value={newPublication.authors}
            onChange={(e) => setNewPublication({ ...newPublication, authors: e.target.value })}
          >
            {authorList
              .filter((author) => author.job === 'author') // 저자만 필터링
              .map((author) => (
                <MenuItem key={author.id} value={author.id}>
                  {author.producer_name}
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel id="translator-select-label">번역자</InputLabel>
          <Select
            labelId="translator-select-label"
            multiple
            value={newPublication.translators}
            onChange={(e) => setNewPublication({ ...newPublication, translators: e.target.value })}
          >
            {translatorList
              .filter((translator) => translator.job === 'translator') // 번역자만 필터링
              .map((translator) => (
                <MenuItem key={translator.id} value={translator.id}>
                  {translator.producer_name}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      </Box>

      {/* 기관 이름 */}
      <FormControl fullWidth margin="normal">
        <InputLabel id="agency-select-label">기관 이름</InputLabel>
        <Select
          labelId="agency-select-label"
          value={newPublication.agency_name}
          onChange={(e) => setNewPublication({ ...newPublication, agency_name: e.target.value })}
        >
          {agencyList.map((agency) => (
            <MenuItem key={agency.id} value={agency.id}>
              {agency.agency_name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* 제목 입력 */}
      <TextField
        label="제목"
        value={newPublication.title}
        onChange={(e) => setNewPublication({ ...newPublication, title: e.target.value })}
        fullWidth
        margin="normal"
      />

      {/* 권, 호, 시작페이지, 끝페이지 */}
      {newPublication.category === 'article' && (
        <Box sx={{ display: 'flex', gap: '1rem' }}>
          <TextField
            label="권 (Volume)"
            value={newPublication.volume}
            onChange={(e) => setNewPublication({ ...newPublication, volume: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="호 (Issue)"
            value={newPublication.issue}
            onChange={(e) => setNewPublication({ ...newPublication, issue: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="시작페이지 (Start Page)"
            value={newPublication.start_page}
            onChange={(e) => setNewPublication({ ...newPublication, start_page: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="끝페이지 (End Page)"
            value={newPublication.end_page}
            onChange={(e) => setNewPublication({ ...newPublication, end_page: e.target.value })}
            fullWidth
            margin="normal"
          />
        </Box>
      )}

      {/* 추가 버튼 */}
      <Button fullWidth variant="contained" onClick={handleAddPublication} sx={{ marginTop: '1rem' }}>
        추가
      </Button>
    </Box>
  );
};

export default EssayWritePublication;
