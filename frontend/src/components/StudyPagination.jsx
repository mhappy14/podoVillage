import React, { useMemo, useState } from 'react';
import { Card, Row, Col, Pagination, Button, Typography } from 'antd';
import { Link } from 'react-router-dom';

const { Text } = Typography;

const StudyPagination = ({ explanations = [], selectedExplanation, handleBoxClick }) => {
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // 최신순 정렬 (created_at 기준)
  const sortedExplanations = useMemo(() => {
    const arr = Array.isArray(explanations) ? explanations : [];
    return arr.slice().sort((a, b) => new Date(b?.created_at) - new Date(a?.created_at));
  }, [explanations]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedExplanations = sortedExplanations.slice(indexOfFirstItem, indexOfLastItem);

  const onPageChange = (page) => setCurrentPage(page);

  return (
    <div>
      {/* Explanation 목록 */}
      <div style={{ marginTop: '3rem' }}>
        {paginatedExplanations.map((item) => {
          const isSelected = selectedExplanation?.id === item?.id;
          const examName = item?.exam?.examname ?? '-';
          const round = item?.examnumber?.examnumber ?? '-';
          const year = item?.examnumber?.year ?? '-';
          const sub = item?.question?.qsubject ?? '-';
          const num = item?.question?.qnumber ?? '-';
          const qtext = item?.question?.qtext ?? '';
          const likeCount = item?.like_count ?? 0;

          return (
            <Card
              key={item?.id}
              hoverable
              style={{
                marginBottom: 16,
                backgroundColor: isSelected ? '#F0F8FF' : 'white',
              }}
              onClick={() => handleBoxClick?.(item)}
            >
              <Text strong>{examName}</Text>{' '}
              {round}회 {year}년 {sub}-{num}. {qtext}
              <br />
              <Text>좋아요: {likeCount}개</Text>
            </Card>
          );
        })}
      </div>

      {/* Pagination 및 Write 버튼 */}
      <Row justify="space-between" align="middle" style={{ margin: '2rem 0' }}>
        <Col flex="auto" />
        <Col>
          <Pagination
            current={currentPage}
            total={Array.isArray(explanations) ? explanations.length : 0}
            pageSize={itemsPerPage}
            onChange={onPageChange}
          />
        </Col>
        <Col>
          <Button type="primary">
            <Link to="/study/write" style={{ color: 'white' }}>
              Write
            </Link>
          </Button>
        </Col>
      </Row>
    </div>
  );
};

export default StudyPagination;
