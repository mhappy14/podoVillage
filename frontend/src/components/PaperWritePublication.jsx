import React, { useState, useEffect } from 'react';
import { AutoComplete, Input, Select, Button, Flex, Typography } from 'antd';
import AxiosInstance from './AxiosInstance';

const { Text } = Typography;

const PaperWritePublication = ({ onRefresh, refreshKey }) => {
  const [publicationList, setPublicationList] = useState([]);
  const [authorList, setAuthorList] = useState([]);
  const [agencyList, setAgencyList] = useState([]);
  const [newPublication, setNewPublication] = useState({
    category: '',
    year: '',
    title: '',
    agency: '',
    author: [],
    volume: '',
    issue: '',
    start_page: '',
    end_page: '',
  });

  const toList = (raw) => (Array.isArray(raw) ? raw : (Array.isArray(raw?.results) ? raw.results : []));

  const fetchData = async () => {
    try {
      const [publications, authors, agencies] = await Promise.all([
        AxiosInstance.get('publication/'),
        AxiosInstance.get('author/'),
        AxiosInstance.get('agency/'),
      ]);
      setPublicationList(toList(publications.data));
      setAuthorList(toList(authors.data));
      setAgencyList(toList(agencies.data));
    } catch (error) {
      console.error('데이터 가져오기 오류:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  const handleAddPublication = async () => {
    try {
      const requestData = {
        category: newPublication.category,
        year: newPublication.year ? parseInt(newPublication.year, 10) : null,
        title: newPublication.title,
        agency: newPublication.agency,          // FK id
        author_ids: newPublication.author,      // ids array
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
        agency: '',
        author: [],
        volume: '',
        issue: '',
        start_page: '',
        end_page: '',
      });
      onRefresh && onRefresh();
      fetchData();
    } catch (error) {
      console.error('Publication 추가 오류:', error);
    }
  };

  return (
    <Flex vertical>
      <Text strong>서적 추가</Text>
      <Flex gap="small">
        <Select
          placeholder="서적 종류를 선택해주세요."
          style={{ flex: 1, marginTop: '0.5rem' }}
          options={[
            { value: 'article', label: '학술논문' },
            { value: 'research', label: '연구보고서' },
            { value: 'dissertation', label: '박사학위논문' },
            { value: 'thesis', label: '석사학위논문' },
          ]}
          value={newPublication.category}
          onChange={(value) => setNewPublication((s) => ({ ...s, category: value }))}
        />
        <Input
          placeholder="발행 연도"
          type="number"
          style={{ flex: 1, marginTop: '0.5rem' }}
          value={newPublication.year}
          onChange={(e) => setNewPublication((s) => ({ ...s, year: e.target.value }))}
        />
      </Flex>

      <Select
        placeholder="저자를 선택해주세요."
        mode="multiple"
        style={{ marginTop: '0.5rem' }}
        value={newPublication.author}
        onChange={(value) => setNewPublication((s) => ({ ...s, author: value }))}
        options={authorList.map((a) => ({ value: a?.id, label: a?.author }))}
      />

      <Select
        placeholder="발행 기관를 선택해주세요."
        style={{ marginTop: '0.5rem' }}
        value={newPublication.agency}
        onChange={(value) => setNewPublication((s) => ({ ...s, agency: value }))}
        options={agencyList.map((g) => ({ value: g?.id, label: g?.agency }))}
      />

      <AutoComplete
        placeholder="제목"
        style={{ marginTop: '0.5rem' }}
        value={newPublication.title}
        onChange={(value) => setNewPublication((s) => ({ ...s, title: value }))}
        options={publicationList.map((p) => ({ value: p?.title, label: p?.title }))}
      />

      {newPublication.category === 'article' && (
        <Flex gap="small" style={{ marginTop: '0.5rem' }}>
          <Input
            placeholder="권 (Volume)"
            value={newPublication.volume}
            onChange={(e) => setNewPublication((s) => ({ ...s, volume: e.target.value }))}
          />
          <Input
            placeholder="호 (Issue)"
            value={newPublication.issue}
            onChange={(e) => setNewPublication((s) => ({ ...s, issue: e.target.value }))}
          />
          <Input
            placeholder="시작페이지 (Start Page)"
            value={newPublication.start_page}
            onChange={(e) => setNewPublication((s) => ({ ...s, start_page: e.target.value }))}
          />
          <Input
            placeholder="끝페이지 (End Page)"
            value={newPublication.end_page}
            onChange={(e) => setNewPublication((s) => ({ ...s, end_page: e.target.value }))}
          />
        </Flex>
      )}

      <Button type="primary" onClick={handleAddPublication} style={{ marginTop: '0.5rem' }}>
        추가
      </Button>
    </Flex>
  );
};

export default PaperWritePublication;
