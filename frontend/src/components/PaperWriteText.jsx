import React, { useState, useEffect } from 'react';
import { AutoComplete, Input, Select, Button, Flex, Typography } from 'antd';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import AxiosInstance from './AxiosInstance';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

const PaperWriteText = ({ selectedPaper = null, onSave, isEdit = false }) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState(selectedPaper?.title || '');
  const [Paper, setPaper] = useState(selectedPaper?.Paper || '');
  const [selectedCategory, setSelectedCategory] = useState(selectedPaper?.category || '');
  const [selectedAuthor, setSelectedAuthor] = useState(selectedPaper?.author || '');
  const [selectedAgency, setSelectedAgency] = useState(selectedPaper?.agency || '');
  const [selectedPublication, setSelectedPublication] = useState(selectedPaper?.publication || '');
  const [categoryList] = useState([
    { value: 'article', label: '학술논문' },
    { value: 'research', label: '연구보고서' },
    { value: 'dissertation', label: '박사학위논문' },
    { value: 'thesis', label: '석사학위논문' },
  ]);
  const [authorList, setAuthorList] = useState([]);
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
      const [authors, agencies, publications] = await Promise.all([
        AxiosInstance.get('author/'),
        AxiosInstance.get('agency/'),
        AxiosInstance.get('publication/'),
      ]);

      setAuthorList(authors.data);
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

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title || !selectedCategory || !selectedAuthor || !selectedAgency || !selectedPublication || !Paper) {
      setErrorMessage('모든 필드를 입력해주세요.');
      return;
    }

    const requestData = {
      title,
      category: selectedCategory,
      author: selectedAuthor,
      agency: selectedAgency,
      publication: selectedPublication,
      contents: Paper
    };

    try {
      if (isEdit && selectedPaper?.id) {
        const response = await AxiosInstance.patch(`/paper/${selectedPaper.id}/`, requestData);
        if (onSave) onSave(response.data);
        navigate(`/paper/view/${selectedPaper.id}`);
      } else {
        const response = await AxiosInstance.post('/paper/', requestData);
        if (onSave) onSave(response.data);
        navigate(`/paper/view/${response.data.id}`);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || '저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <Flex vertical style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
      <Typography variant="h6">{isEdit ? 'Edit Paper' : 'Write Paper'}</Typography>
      <form onSubmit={handleSave}>
        <Flex gap="small">
          {/* 카테고리 선택 */}
          <div style={{ width: '100%' }}>
          <Text level={5}>카테고리</Text>
            <Select
              value={selectedCategory}
              onChange={(value) => setSelectedCategory(value)}
              style={{ width: '100%' }}
              options={categoryList}
              placeholder="카테고리 선택"
            />
          </div>

          {/* 제작자 선택 */}
          <div style={{ width: '100%' }}>
          <Text level={5}>저자</Text>
            <Select
              value={selectedAuthor}
              onChange={(value) => setSelectedAuthor(value)}
              style={{ width: '100%' }}
              placeholder="저자 선택"
              options={authorList.map((author) => ({
                value: author.id,
                label: author.author,
              }))}
            />
          </div>

          {/* 기관 선택 */}
          <div style={{ width: '100%' }}>
          <Text level={5}>기관</Text>
            <Select
              value={selectedAgency}
              onChange={(value) => setSelectedAgency(value)}
              style={{ width: '100%' }}
              placeholder="기관 선택"
              options={agencyList.map((agency) => ({
                value: agency.id,
                label: agency.agency,
              }))}
            />
          </div>

          {/* 서적 선택 */}
          <div style={{ width: '100%' }}>
            <Text level={5}>서적</Text>
            <Select
              value={selectedPublication}
              onChange={(value) => setSelectedPublication(value)}
              style={{ width: '100%' }}
              placeholder="서적 선택"
              options={filteredPublications.map((publication) => ({
                value: publication.id,
                label: publication.title,
              }))}
            />
          </div>
        </Flex>

        {/* 제목 작성 */}
        <Flex vertical style={{ marginTop: '0.5rem'}}>
          <Text level={5}>제목</Text>
          <Input
            placeholder="제목을 입력하세요."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Flex>

        {/* 본문 작성 */}
        <Flex vertical style={{ marginTop: '0.5rem'}}>
          <Text level={5}>리뷰 본문</Text>
          <ReactQuill
            value={Paper}
            onChange={setPaper}
            modules={modules}
            formats={formats}
            style={{ minHeight: '200px', height: '400px', resize: 'vertical' }}
          />
        </Flex>

        {/* 저장 버튼 */}
        <Button type="primary" 
          onClick={handleSave} 
          style={{ marginTop: '3rem', width: '100%' }}>
          {isEdit ? '수정하기' : '저장하기'}
        </Button>
        {errorMessage && (
          <Typography color="error" sx={{ marginTop: '1rem' }}>
            {errorMessage}
          </Typography>
        )}
      </form>
    </Flex>
  );
};

export default PaperWriteText;
