// =====================================================================
// [필요없음] — 새 Study.jsx 아이콘 그리드 + 4-필터 디자인에서는
// 페이지네이션 대신 grid + filter 가 모든 시험을 한 화면에 노출하므로
// 이 컴포넌트는 더이상 import 되지 않습니다.
// 추후 필요 시 다시 살릴 수 있도록 파일은 보존.
// =====================================================================

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
