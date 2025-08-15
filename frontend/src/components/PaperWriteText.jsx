import React, { useState, useEffect } from 'react';
import { AutoComplete, Input, Select, Button, Flex, Typography } from 'antd';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import AxiosInstance from './AxiosInstance';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

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

  const toList = (raw) => (Array.isArray(raw) ? raw : (Array.isArray(raw?.results) ? raw.results : []));

  const fetchData = async () => {
    try {
      const [authors, agencies, publications] = await Promise.all([
        AxiosInstance.get('author/'),
        AxiosInstance.get('agency/'),
        AxiosInstance.get('publication/'),
      ]);
      setAuthorList(toList(authors.data));
      setAgencyList(toList(agencies.data));
      setPublicationList(toList(publications.data));
    } catch (error) {
      console.error('데이터 가져오기 오류:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // props로 들어온 selectedPaper가 비동기로 도착할 때 상태 동기화
  useEffect(() => {
    if (selectedPaper) {
      setTitle(selectedPaper.title || '');
      setPaper(selectedPaper.Paper || '');
      setSelectedCategory(selectedPaper.category || '');
      setSelectedAuthor(selectedPaper.author || '');
      setSelectedAgency(selectedPaper.agency || '');
      setSelectedPublication(selectedPaper.publication || '');
    }
  }, [selectedPaper]);

  // 카테고리 변경 시 해당 카테고리의 publication만 노출
  useEffect(() => {
    if (selectedCategory) {
      setFilteredPublications(publicationList.filter((p) => p?.category === selectedCategory));
    } else {
      setFilteredPublications([]);
    }
  }, [selectedCategory, publicationList]);

  const handleSave = async (e) => {
    e.preventDefault?.();
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
      contents: Paper,
    };

    try {
      if (isEdit && selectedPaper?.id) {
        const response = await AxiosInstance.patch(`paper/${selectedPaper.id}/`, requestData);
        onSave && onSave(response.data);
        navigate(`/paper/view/${selectedPaper.id}`);
      } else {
        const response = await AxiosInstance.post('paper/', requestData);
        onSave && onSave(response.data);
        navigate(`/paper/view/${response.data.id}`);
      }
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || '저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <Flex vertical style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
      <Title level={5}>{isEdit ? 'Edit Paper' : 'Write Paper'}</Title>
      <form onSubmit={handleSave}>
        <Flex gap="small">
          <div style={{ width: '100%' }}>
            <Text strong>카테고리</Text>
            <Select
              value={selectedCategory}
              onChange={(value) => setSelectedCategory(value)}
              style={{ width: '100%' }}
              options={categoryList}
              placeholder="카테고리 선택"
            />
          </div>

          <div style={{ width: '100%' }}>
            <Text strong>저자</Text>
            <Select
              value={selectedAuthor}
              onChange={(value) => setSelectedAuthor(value)}
              style={{ width: '100%' }}
              placeholder="저자 선택"
              options={authorList.map((author) => ({
                value: author?.id,
                label: author?.author,
              }))}
            />
          </div>

          <div style={{ width: '100%' }}>
            <Text strong>기관</Text>
            <Select
              value={selectedAgency}
              onChange={(value) => setSelectedAgency(value)}
              style={{ width: '100%' }}
              placeholder="기관 선택"
              options={agencyList.map((agency) => ({
                value: agency?.id,
                label: agency?.agency,
              }))}
            />
          </div>

          <div style={{ width: '100%' }}>
            <Text strong>서적</Text>
            <Select
              value={selectedPublication}
              onChange={(value) => setSelectedPublication(value)}
              style={{ width: '100%' }}
              placeholder="서적 선택"
              options={filteredPublications.map((publication) => ({
                value: publication?.id,
                label: publication?.title,
              }))}
            />
          </div>
        </Flex>

        <Flex vertical style={{ marginTop: '0.5rem'}}>
          <Text strong>제목</Text>
          <Input
            placeholder="제목을 입력하세요."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Flex>

        <Flex vertical style={{ marginTop: '0.5rem'}}>
          <Text strong>리뷰 본문</Text>
          <ReactQuill
            value={Paper}
            onChange={setPaper}
            modules={modules}
            formats={formats}
            style={{ minHeight: '200px', height: '400px', resize: 'vertical' }}
          />
        </Flex>

        <Button type="primary" onClick={handleSave} htmlType="submit" style={{ marginTop: '3rem', width: '100%' }}>
          {isEdit ? '수정하기' : '저장하기'}
        </Button>
        {errorMessage && (
          <Text type="danger" style={{ marginTop: '1rem', display: 'block' }}>
            {errorMessage}
          </Text>
        )}
      </form>
    </Flex>
  );
};

export default PaperWriteText;
