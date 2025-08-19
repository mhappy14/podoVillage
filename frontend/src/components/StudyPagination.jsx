import React, { useMemo, useState } from 'react';
import { Card, Row, Col, Pagination, Button, Typography } from 'antd';
import { Link } from 'react-router-dom';

const { Text } = Typography;

const StudyPagination = ({ explanations, selectedExplanation, handleBoxClick }) => {
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const sortedExplanations = useMemo(() => {
    return [...explanations].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [explanations]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedExplanations = sortedExplanations.slice(indexOfFirstItem, indexOfLastItem);

  const totalPages = Math.ceil(explanations.length / itemsPerPage);

  const onPageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div>
      {/* Explanation 목록 */}
      <div style={{ marginTop: '3rem' }}>
        {paginatedExplanations.map((item) => (
          <Card
            key={item.id}
            hoverable
            style={{
              marginBottom: 16,
              backgroundColor: selectedExplanation?.id === item.id ? '#F0F8FF' : 'white',
            }}
            onClick={() => handleBoxClick(item)}
          >
            <Text strong>{item.exam.examname}</Text> {item.examnumber.examnumber}회 {item.examnumber.year}년 Q
            {item.question.questionnumber1}-{item.question.questionnumber2}. {item.question.questiontext}
            <br />
            <Text>좋아요: {item.like.length}개</Text>
          </Card>
        ))}
      </div>

      {/* Pagination 및 Write 버튼 */}
      <Row justify="space-between" align="middle" style={{ margin: '2rem 0' }}>
        <Col flex="auto" />
        <Col>
          <Pagination
            current={currentPage}
            total={explanations.length}
            pageSize={itemsPerPage}
            onChange={onPageChange}
          />
        </Col>
        <Col>
          <Button type="primary" as={Link} to="/write">
            Write
          </Button>
        </Col>
      </Row>
    </div>
  );
};

export default StudyPagination;
