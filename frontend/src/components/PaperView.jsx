import React, { useEffect, useState, useMemo } from 'react';
import { Flex, Space, Card, Row, Col, Divider, Pagination, Typography, Button } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import Comments from './Comments';
import DOMPurify from 'dompurify';

const { Title, Text } = Typography;

const PaperView = () => {
  const { id } = useParams(); // URL의 id 파라미터
  const navigate = useNavigate();
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [Papers, setPapers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 모든 에세이 가져오기
        const paperRes = await AxiosInstance.get('paper/');
        setPapers(paperRes.data);

        // 선택된 에세이 및 관련 댓글 가져오기
        const selectedPaperRes = await AxiosInstance.get(`paper/${id}/`);
        setSelectedPaper(selectedPaperRes.data);

        // 전체 댓글 가져온 후, Paper id 기준 필터링
        const commentRes = await AxiosInstance.get('comment/');
        const filteredComments = commentRes.data.filter(
          (c) => c.Paper?.id === parseInt(id, 10)
        );
        setComments(filteredComments);

        // 사용자 정보 가져오기
        const token = localStorage.getItem('Token');
        if (token) {
          const userRes = await AxiosInstance.get('users/me/', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUser(userRes.data);
          setLoggedIn(true);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

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
        paper.publication?.author?.some((author) => author.author === selectedAuthor)
      );
    }
    return filtered;
  }, [Papers, selectedCategory, selectedYear, selectedAuthor]);

  const sortedPapers = useMemo(() => {
    return [...filteredPapers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [filteredPapers]);

  const paginatedPapers = sortedPapers.slice(indexOfFirstItem, indexOfLastItem);

  const getDynamicText = (paper) => {
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
    return dynamicText;
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleCommentChange = (e) => {
    setComment(e.target.value);
  };

  const handleCommentSubmit = async () => {
    if (!loggedIn) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!comment.trim()) {
      alert('댓글 내용을 입력하세요.');
      return;
    }
    try {
      const res = await AxiosInstance.post('comment/', { content: comment, Paper: selectedPaper.id });
      setComment('');
      setComments((prev) => [...prev, res.data]);
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('댓글 작성 실패');
    }
  };

  const handleEditClick = () => {
    navigate(`/paper/edit/${id}`, { state: { selectedPaper } });
  };

  return (
    <Space direction="vertical" style={{ width: '100%', padding: '20px' }} size="large">
      {/* 글 상세 내용 */}
      {selectedPaper ? (
        <Card style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          <Row justify="space-between">
            {/* 타이틀 및 서적 제목 */}
            <Col flex="auto">
              <Title level={3} style={{ margin: 0, whiteSpace: 'nowrap' }}>
                {selectedPaper.title}
              </Title>
              <Text>
                {getDynamicText(selectedPaper)}
              </Text>
            </Col>
            {/* 연도, 카테고리, 작성자 */}
            <Col style={{ width: 200, textAlign: 'right' }}>
              <Text strong>
                {selectedPaper.publication.year}년 ({selectedPaper.publication.category})
              </Text>
              <br />
              <Text>
                작성자 {selectedPaper.nickname ? selectedPaper.nickname.nickname : 'null'}
              </Text>
            </Col>
          </Row>
          <Divider />
          {/* 본문 */}
          <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(selectedPaper.contents),
            }}
            style={{ marginBottom: '1rem' }}
          />
          <Row justify="center" gutter={16}>
            {/* 수정 버튼 (작성자와 로그인 사용자가 일치할 경우) */}
            {user && selectedPaper.nickname && user.id === selectedPaper.nickname.id && (
              <Col>
                <Button type="primary" danger onClick={handleEditClick}>
                  수정
                </Button>
              </Col>
            )}
            <Col>
              <Button type="primary">
                좋아요 {selectedPaper.likes}
              </Button>
            </Col>
            <Col>
              <Button>
                북마크 {selectedPaper.bookmarks}
              </Button>
            </Col>
          </Row>
          <Divider />
          {/* 댓글 영역 */}
          <Comments
            filteredComments={comments}
            comment={comment}
            loggedIn={loggedIn}
            handleCommentChange={handleCommentChange}
            handleCommentSubmit={handleCommentSubmit}
          />
        </Card>
      ) : (
        <Title level={4}>Loading Paper...</Title>
      )}

      {/* 글 목록 */}
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
                    backgroundColor: selectedPaper?.id === paper.id ?'rgb(238, 247, 255)' : 'white',
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
    </Space>
  );
};

export default PaperView;
