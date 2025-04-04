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

  const fetchData = async () => {
    try {
      const [publications, authors, agencies] = await Promise.all([
        AxiosInstance.get('publication/'),
        AxiosInstance.get('author/'),
        AxiosInstance.get('agency/'),
      ]);
      setPublicationList(publications.data);
      setAuthorList(authors.data);
      setAgencyList(agencies.data);
    } catch (error) {
      console.error('데이터 가져오기 오류:', error);
    }
  };

  // refreshKey가 변경될 때마다 데이터를 재조회합니다.
  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  const handleAddPublication = async () => {
    try {
      const requestData = {
        category: newPublication.category,
        year: parseInt(newPublication.year, 10),
        title: newPublication.title,
        agency: newPublication.agency, // ForeignKey에 맞는 필드명 사용
        author_ids: newPublication.author, 
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
      onRefresh();
    } catch (error) {
      console.error('Publication 추가 오류:', error);
    }
  };

  return (
    <Flex vertical>
      <Text level={5}>서적 추가</Text>
      {/* 카테고리 및 출판 연도 */}
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
          onChange={(value) => setNewPublication({ ...newPublication, category: value })}
        >
        </Select>
        <Input
          placeholder="발행 연도"
          type="number"
          style={{ flex: 1, marginTop: '0.5rem' }}
          value={newPublication.year}
          onChange={(e) => setNewPublication({ ...newPublication, year: e.target.value })}
        />
      </Flex>

      {/* 저자 선택 */}
      <Select
        placeholder="저자를 선택해주세요."
        mode="multiple"
        style={{ marginTop: '0.5rem' }}
        value={newPublication.author}
        onChange={(value) => setNewPublication({ ...newPublication, author: value })}
      >
        {authorList
          .map((author) => (
            <Select.Option key={author.id} value={author.id}>
              {author.author}
            </Select.Option>
          ))}
      </Select>

      {/* 기관 이름 */}
      <Select
        placeholder="발행 기관를 선택해주세요."
        style={{ marginTop: '0.5rem' }}
        value={newPublication.agency}
        onChange={(value) => setNewPublication({ ...newPublication, agency: value })}
      >
        {agencyList
          .map((agency) => (
            <Select.Option key={agency.id} value={agency.id}>
              {agency.agency}
            </Select.Option>
          ))}
      </Select>

      {/* 제목 입력 */}
      <AutoComplete
        placeholder="제목"
        style={{ marginTop: '0.5rem' }}
        value={newPublication.title}
        onChange={(value) => setNewPublication({ ...newPublication, title: value })}
      />

      {/* 권, 호, 시작페이지, 끝페이지 */}
      {newPublication.category === 'article' && (
        <Flex  gap="small" style={{ marginTop: '0.5rem' }}>
          <Input
            placeholder="권 (Volume)"
            value={newPublication.volume}
            onChange={(e) => setNewPublication({ ...newPublication, volume: e.target.value })}
            fullWidth
            margin="normal"
          />
          <Input
            placeholder="호 (Issue)"
            value={newPublication.issue}
            onChange={(e) => setNewPublication({ ...newPublication, issue: e.target.value })}
            fullWidth
            margin="normal"
          />
          <Input
            placeholder="시작페이지 (Start Page)"
            value={newPublication.start_page}
            onChange={(e) => setNewPublication({ ...newPublication, start_page: e.target.value })}
            fullWidth
            margin="normal"
          />
          <Input
            placeholder="끝페이지 (End Page)"
            value={newPublication.end_page}
            onChange={(e) => setNewPublication({ ...newPublication, end_page: e.target.value })}
            fullWidth
            margin="normal"
          />
        </Flex>
      )}

      {/* 추가 버튼 */}
      <Button type="primary" onClick={handleAddPublication} style={{ marginTop: '0.5rem' }}>
        추가
      </Button>
    </Flex>
  );
};

export default PaperWritePublication;
