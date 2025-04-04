import React, { useEffect, useMemo, useState } from 'react';
import { AutoComplete, Input, Select, Button, Flex, Space, Pagination, Typography } from 'antd';
import { Link, useNavigate  } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';

const { Text } = Typography;

const Paper = () => {
  const [Papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchPapers = async () => {
      try {
        const response = await AxiosInstance.get('paper/', {
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

  const filteredPapers = useMemo(() => {
    let filtered = Papers;
    if (selectedCategory) {
      filtered = filtered.filter((paper) => paper.publication?.category === selectedCategory);
    }
    if (selectedYear) {
      filtered = filtered.filter((paper) => paper.publication?.year === parseInt(selectedYear, 10));
    }
    if (selectedAuthor) {
      filtered = filtered.filter((paper) =>
        paper.publication?.author?.some((author) => author.author  === selectedAuthor)
      );
    }
    return filtered;
  }, [Papers, selectedCategory, selectedYear, selectedAuthor]);

  const sortedPapers = useMemo(() => {
    return [...filteredPapers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [filteredPapers]);

  const paginatedPapers = sortedPapers.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page, pageSize) => {
    setCurrentPage(page);
  };

  // antd Select에 전달할 옵션 배열 생성
  const categoryOptions = [
    { value: '', label: '카테고리' },
    ...Array.from(new Set(Papers.map((paper) => paper.publication?.category || ''))).map((category) => ({
      value: category,
      label: category,
    })),
  ];

  const yearOptions = [
    { value: '', label: '발행연도' },
    ...Array.from(new Set(Papers.map((paper) => paper.publication?.year || ''))).map((year) => ({
      value: year,
      label: year,
    })),
  ];

  const authorOptions = [
    { value: '', label: '저자' },
    ...Array.from(
      new Set(
        Papers.flatMap((paper) =>
          paper.publication?.author?.map((author) => author.author) || []
        )
      )
    ).map((author) => ({
      value: author,
      label: author,
    })),
  ];

  return (
    <div>
      <Flex gap="small" style={{ margin: '1rem 0 0 0', width: '100%' }}>
        <Select
          placeholder="카테고리를 선택해주세요."
          value={selectedCategory}
          onChange={(value) => {
            setSelectedCategory(value);
            setCurrentPage(1);
          }}
          options={categoryOptions}
          style={{ width: '100%' }}
        />
        <Select
          placeholder="발행연도를 선택해주세요."
          value={selectedYear}
          onChange={(value) => {
            setSelectedYear(value);
            setCurrentPage(1);
          }}
          options={yearOptions}
          style={{ width: '100%' }}
        />
        <Select
          placeholder="저자를 선택해주세요."
          value={selectedAuthor}
          onChange={(value) => {
            setSelectedAuthor(value);
            setCurrentPage(1);
          }}
          options={authorOptions}
          style={{ width: '100%' }}
        />
      </Flex >

      <Flex>
        {loading ? (
          <Text>Loading...</Text>
            ) : (
          <Flex vertical style={{ margin: '1rem 0 0 0',
            width: '100%', }}>
            {paginatedPapers.map((paper) => {
              let dynamicText = '';
              const category = paper.publication?.category;

              if (category === 'research') {
                dynamicText = (<>{paper.publication.extra_author}, {paper.publication.title}({paper.publication.agency.agency}, {paper.publication.year})</>);
              } else if (category === 'article') {
                dynamicText = (<>{paper.publication.extra_author}, "{paper.publication.title}," {paper.publication.agency.agency} {paper.publication.volume}, no.{paper.publication.issue} ({paper.publication.year}):{paper.publication.start_page}-{paper.publication.end_page}</>);
              } else if (category === 'dissertation') {
                dynamicText = (<>{paper.publication.extra_author}, "{paper.publication.title}," (박사학위, {paper.publication.agency.agency}, {paper.publication.year})</>);
              } else if (category === 'thesis') {
                dynamicText = (<>{paper.publication.extra_author}, "{paper.publication.title}," (석사학위, {paper.publication.agency.agency}, {paper.publication.year})</>);
              }

              return (
                <Space
                  key={paper.id}
                  direction="vertical"
                  size={0}
                  style={{
                    padding: '0.5rem 1rem 0.5rem 1rem',   // 상 우 하 좌
                    margin: '0.5rem 0.5rem 0.5rem 0.5rem',   // 상 우 하 좌
                    boxShadow: '0px 3px 6px rgba(0, 0, 0, 0.2)', // MUI boxShadow:3와 유사한 효과 (필요에 따라 조정)
                    cursor: 'pointer',
                    backgroundColor: 'white',
                  }}
                  onClick={() => navigate(`/paper/view/${paper.id}`)}
                >
                  <Text style={{ fontSize: '0.7rem' }} >{paper.title}</Text>
                  <Text style={{ fontSize: '0.7rem', color: 'gray' }} >{dynamicText}</Text>
                </Space>
              );
            })}
          </Flex>
        )}
      </Flex>

      <Flex style={{ display: 'flex', marginLeft: '2rem', marginRight: '2rem', marginTop: '2rem' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}></div>
        <div style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Pagination 
            current={currentPage}
            total={Papers.length}
            pageSize={itemsPerPage}
            onChange={handlePageChange}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button  type="primary" onClick={() => navigate('/paper/write')}>
            Write
          </Button>
        </div>
      </Flex>
    </div>
  );
};

export default Paper;
