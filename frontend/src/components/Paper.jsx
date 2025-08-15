import React, { useEffect, useMemo, useState } from 'react';
import { AutoComplete, Input, Select, Button, Flex, Space, Pagination, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';

const { Text } = Typography;

const Paper = () => {
  const [Papers, setPapers] = useState([]); // 항상 '배열' 유지
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
          headers: { Authorization: null },
        });
        const raw = response.data;
        // ✅ 배열 표준화: 배열이면 그대로, 아니면 results에서 꺼냄, 아니면 빈 배열
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.results) ? raw.results : []);
        setPapers(list);
      } catch (error) {
        console.error('Error fetching Papers:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPapers();
  }, []);

  // 페이지네이션 계산은 "정렬된/필터된" 결과 기준으로
  const itemsPerPage = 10;

  // ===== 필터링 (null-safe) =====
  const filteredPapers = useMemo(() => {
    const src = Array.isArray(Papers) ? Papers : [];
    let filtered = src;

    if (selectedCategory) {
      filtered = filtered.filter((paper) => paper?.publication?.category === selectedCategory);
    }
    if (selectedYear) {
      filtered = filtered.filter((paper) => paper?.publication?.year === parseInt(selectedYear, 10));
    }
    if (selectedAuthor) {
      filtered = filtered.filter((paper) =>
        Array.isArray(paper?.publication?.author) &&
        paper.publication.author.some((a) => a?.author === selectedAuthor)
      );
    }
    return filtered;
  }, [Papers, selectedCategory, selectedYear, selectedAuthor]);

  // ===== 정렬 (항상 배열 보장) =====
  const sortedPapers = useMemo(() => {
    const arr = Array.isArray(filteredPapers) ? filteredPapers : [];
    return arr.slice().sort((a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0));
  }, [filteredPapers]);

  // ===== 페이지네이션 (정렬된 결과 기준) =====
  const total = sortedPapers.length;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedPapers = sortedPapers.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page /* , pageSize */) => {
    setCurrentPage(page);
  };

  // ===== 옵션 생성 (null-safe + 중복 제거) =====
  const safe = Array.isArray(Papers) ? Papers : [];

  const categoryOptions = [
    { value: '', label: '카테고리' },
    ...Array.from(new Set(safe.map((p) => p?.publication?.category).filter(Boolean))).map((category) => ({
      value: category,
      label: category,
    })),
  ];

  const yearOptions = [
    { value: '', label: '발행연도' },
    ...Array.from(new Set(safe.map((p) => p?.publication?.year).filter((v) => v !== null && v !== undefined))).map(
      (year) => ({
        value: year,
        label: year,
      })
    ),
  ];

  const authorOptions = [
    { value: '', label: '저자' },
    ...Array.from(
      new Set(
        safe.flatMap((p) =>
          Array.isArray(p?.publication?.author)
            ? p.publication.author.map((a) => a?.author).filter(Boolean)
            : []
        )
      )
    ).map((author) => ({ value: author, label: author })),
  ];

  return (
    <div>
      <Flex gap="small" style={{ margin: '1rem 0 0 0', width: '100%' }}>
        <Select
          placeholder="카테고리를 선택해주세요."
          value={selectedCategory}
          onChange={(value) => { setSelectedCategory(value); setCurrentPage(1); }}
          options={categoryOptions}
          style={{ width: '100%' }}
        />
        <Select
          placeholder="발행연도를 선택해주세요."
          value={selectedYear}
          onChange={(value) => { setSelectedYear(value); setCurrentPage(1); }}
          options={yearOptions}
          style={{ width: '100%' }}
        />
        <Select
          placeholder="저자를 선택해주세요."
          value={selectedAuthor}
          onChange={(value) => { setSelectedAuthor(value); setCurrentPage(1); }}
          options={authorOptions}
          style={{ width: '100%' }}
        />
      </Flex>

      <Flex>
        {loading ? (
          <Text>Loading...</Text>
        ) : (
          <Flex vertical style={{ margin: '1rem 0 0 0', width: '100%' }}>
            {paginatedPapers.map((paper) => {
              const pub = paper?.publication;
              const category = pub?.category;

              // JSX로 표현 (문자열 아님)
              let dynamicNode = null;

              if (category === 'research') {
                dynamicNode = (
                  <>
                    {pub?.extra_author}, {pub?.title}({pub?.agency?.agency}, {pub?.year})
                  </>
                );
              } else if (category === 'article') {
                dynamicNode = (
                  <>
                    {pub?.extra_author}, "{pub?.title}," {pub?.agency?.agency} {pub?.volume}, no.{pub?.issue} ({pub?.year})
                    :{pub?.start_page}-{pub?.end_page}
                  </>
                );
              } else if (category === 'dissertation') {
                dynamicNode = (
                  <>
                    {pub?.extra_author}, "{pub?.title}," (박사학위, {pub?.agency?.agency}, {pub?.year})
                  </>
                );
              } else if (category === 'thesis') {
                dynamicNode = (
                  <>
                    {pub?.extra_author}, "{pub?.title}," (석사학위, {pub?.agency?.agency}, {pub?.year})
                  </>
                );
              }

              return (
                <Space
                  key={paper?.id}
                  direction="vertical"
                  size={0}
                  style={{
                    padding: '0.5rem 1rem',
                    margin: '0.5rem',
                    boxShadow: '0px 3px 6px rgba(0, 0, 0, 0.2)',
                    cursor: 'pointer',
                    backgroundColor: 'white',
                  }}
                  onClick={() => navigate(`/paper/view/${paper?.id}`)}
                >
                  <Text style={{ fontSize: '0.7rem' }}>{paper?.title ?? '-'}</Text>
                  <Text style={{ fontSize: '0.7rem', color: 'gray' }}>{dynamicNode}</Text>
                </Space>
              );
            })}
          </Flex>
        )}
      </Flex>

      <Flex style={{ display: 'flex', marginLeft: '2rem', marginRight: '2rem', marginTop: '2rem' }}>
        <div style={{ flex: 1 }} />
        <div style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Pagination
            current={currentPage}
            total={total}              // ✅ 필터/정렬 결과 기준
            pageSize={itemsPerPage}
            onChange={handlePageChange}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button type="primary" onClick={() => navigate('/paper/write')}>
            Write
          </Button>
        </div>
      </Flex>
    </div>
  );
};

export default Paper;
