import React, { useState, useEffect } from 'react';
import { Box, Button, FormControl, Select, InputLabel, MenuItem, Typography } from '@mui/material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import AxiosInstance from './AxiosInstance';
import { useNavigate } from 'react-router-dom';

const EssayWriteText = ({ selectedEssay = null, onSave, isEdit = false }) => {
  const navigate = useNavigate();
  const [essay, setEssay] = useState(selectedEssay?.essay || '');
  const [selectedCategory, setSelectedCategory] = useState(selectedEssay?.category || '');
  const [selectedProducer, setSelectedProducer] = useState(selectedEssay?.producer || '');
  const [selectedTranslator, setSelectedTranslator] = useState(selectedEssay?.translator || '');
  const [selectedAgency, setSelectedAgency] = useState(selectedEssay?.agency || '');
  const [selectedPublication, setSelectedPublication] = useState(selectedEssay?.publication || '');
  const [categoryList] = useState([
    { value: 'article', label: '학술논문' },
    { value: 'book', label: '단행본' },
    { value: 'translation', label: '번역서' },
    { value: 'dissertation', label: '박사학위논문' },
    { value: 'thesis', label: '석사학위논문' },
  ]);
  const [producerList, setProducerList] = useState([]);
  const [translatorList, setTranslatorList] = useState([]);
  const [agencyList, setAgencyList] = useState([]);
  const [publicationList, setPublicationList] = useState([]);
  const [filteredPublications, setFilteredPublications] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['clean'],
    ],
  };

  const formats = ['header', 'bold', 'italic', 'underline', 'list', 'bullet', 'link', 'image'];

  const fetchData = async () => {
    try {
      const [producers, agencies, publications] = await Promise.all([
        AxiosInstance.get('producer/'),
        AxiosInstance.get('agency/'),
        AxiosInstance.get('publication/'),
      ]);

      setProducerList(producers.data.filter((producer) => producer.job === 'author'));
      setTranslatorList(producers.data.filter((producer) => producer.job === 'translator'));
      setAgencyList(agencies.data);
      setPublicationList(publications.data);
    } catch (error) {
      console.error('데이터 가져오기 오류:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      setFilteredPublications(
        publicationList.filter((publication) => publication.category === selectedCategory)
      );
    }
  }, [selectedCategory, publicationList]);

  // gridTemplateColumns 조건: 번역서이면 5열, 그 외에는 4열
  const gridTemplate = selectedCategory === 'translation'
    ? '1fr 1fr 1fr 1fr 2fr'
    : '1fr 1fr 1fr 3fr';

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedCategory || !selectedProducer || !selectedAgency || !selectedPublication || !essay) {
      setErrorMessage('모든 필드를 입력해주세요.');
      return;
    }

    if (selectedCategory === 'translation' && !selectedTranslator) {
      setErrorMessage('번역서를 선택한 경우, 번역자를 선택해야 합니다.');
      return;
    }

    const requestData = {
      category: selectedCategory,
      producer: selectedProducer,
      agency: selectedAgency,
      publication: selectedPublication,
      translator: selectedCategory === 'translation' ? selectedTranslator : null,
      essay,
    };

    try {
      if (isEdit && selectedEssay?.id) {
        const response = await AxiosInstance.patch(`/essay/${selectedEssay.id}/`, requestData);
        if (onSave) onSave(response.data);
        navigate(`/essay/view/${selectedEssay.id}`);
      } else {
        const response = await AxiosInstance.post('/essay/', requestData);
        if (onSave) onSave(response.data);
        navigate(`/essay/view/${response.data.id}`);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || '저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <Box sx={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
      <Typography variant="h6">{isEdit ? 'Edit Essay' : 'Write Essay'}</Typography>
      <form onSubmit={handleSave}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          gap: '1rem',
          width: '100%',
        }}>
          {/* 카테고리 선택 */}
          <FormControl fullWidth>
            <InputLabel id="category-select-label">카테고리</InputLabel>
            <Select
              labelId="category-select-label"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categoryList.map((category) => (
                <MenuItem key={category.value} value={category.value}>
                  {category.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 제작자 선택 */}
          <FormControl fullWidth>
            <InputLabel id="producer-select-label">제작자</InputLabel>
            <Select
              labelId="producer-select-label"
              value={selectedProducer}
              onChange={(e) => setSelectedProducer(e.target.value)}
            >
              {producerList.map((producer) => (
                <MenuItem key={producer.id} value={producer.id}>
                  {producer.producer_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 번역자 선택 (번역서일 경우만 표시) */}
          {selectedCategory === 'translation' && (
            <FormControl fullWidth>
              <InputLabel id="translator-select-label">번역자</InputLabel>
              <Select
                labelId="translator-select-label"
                value={selectedTranslator}
                onChange={(e) => setSelectedTranslator(e.target.value)}
              >
                {translatorList.map((translator) => (
                  <MenuItem key={translator.id} value={translator.id}>
                    {translator.producer_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* 기관 선택 */}
          <FormControl fullWidth>
            <InputLabel id="agency-select-label">기관</InputLabel>
            <Select
              labelId="agency-select-label"
              value={selectedAgency}
              onChange={(e) => setSelectedAgency(e.target.value)}
            >
              {agencyList.map((agency) => (
                <MenuItem key={agency.id} value={agency.id}>
                  {agency.agency_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 서적 선택 */}
          <FormControl fullWidth>
            <InputLabel id="publication-select-label">서적</InputLabel>
            <Select
              labelId="publication-select-label"
              value={selectedPublication}
              onChange={(e) => setSelectedPublication(e.target.value)}
            >
              {filteredPublications.map((publication) => (
                <MenuItem key={publication.id} value={publication.id}>
                  {publication.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* 본문 작성 */}
        <Box sx={{ marginTop: '1rem', marginBottom: '1rem' }}>
          <Typography variant="body2">리뷰 본문</Typography>
          <ReactQuill
            value={essay}
            onChange={setEssay}
            modules={modules}
            formats={formats}
            style={{ minHeight: '200px', height: '400px', resize: 'vertical' }}
          />
        </Box>

        {/* 저장 버튼 */}
        <Button type="submit" variant="contained" color="primary" fullWidth sx={{ marginTop: '2rem' }}>
          {isEdit ? '수정하기' : '저장하기'}
        </Button>
        {errorMessage && (
          <Typography color="error" sx={{ marginTop: '1rem' }}>
            {errorMessage}
          </Typography>
        )}
      </form>
    </Box>
  );
};

export default EssayWriteText;
