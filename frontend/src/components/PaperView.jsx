import React, { useEffect, useState, useMemo } from 'react';
import { Flex, Space, Card, Row, Col, Divider, Pagination, Typography, Button } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';
import Comments from './Comments';
import DOMPurify from 'dompurify';

const { Title, Text } = Typography;

const PaperView = () => {
  const { id } = useParams();
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

  // 배열 표준화 유틸
  const toList = (raw) => (Array.isArray(raw) ? raw : (Array.isArray(raw?.results) ? raw.results : []));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const paperRes = await AxiosInstance.get('paper/');
        setPapers(toList(paperRes.data));

        const selectedPaperRes = await AxiosInstance.get(`paper/${id}/`);
        setSelectedPaper(selectedPaperRes.data ?? null);

        const commentRes = await AxiosInstance.get('comment/');
        const allComments = toList(commentRes.data);
        setComments(allComments.filter((c) => c?.Paper?.id === Number(id)));

        const token = localStorage.getItem('Token');
        if (token) {
          const userRes = await AxiosInstance.get('users/me/', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUser(userRes.data);
          setLoggedIn(true);
        } else {
          setLoggedIn(false);
          setUser(null);
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

  const filteredPapers = useMemo(() => {
    const src = Array.isArray(Papers) ? Papers : [];
    let filtered = src;

    if (selectedCategory) {
      filtered = filtered.filter((p) => p?.publication?.category === selectedCategory);
    }
    if (selectedYear) {
      filtered = filtered.filter((p) => p?.publication?.year === parseInt(selectedYear, 10));
    }
    if (selectedAuthor) {
      filtered = filtered.filter((p) =>
        Array.isArray(p?.publication?.author) &&
        p.publication.author.some((a) => a?.author === selectedAuthor)
      );
    }
    return filtered;
  }, [Papers, selectedCategory, selectedYear, selectedAuthor]);

  const sortedPapers = useMemo(() => {
    const arr = Array.isArray(filteredPapers) ? filteredPapers : [];
    return arr.slice().sort((a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0));
  }, [filteredPapers]);

  const total = sortedPapers.length;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedPapers = sortedPapers.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page) => setCurrentPage(page);
  const handleCommentChange = (e) => setComment(e.target.value);

  const handleCommentSubmit = async () => {
    if (!loggedIn) return alert('로그인이 필요합니다.');
    if (!comment.trim()) return alert('댓글 내용을 입력하세요.');

    try {
      const res = await AxiosInstance.post('comment/', { content: comment, Paper: selectedPaper.id });
      setComment('');
      setComments((prev) => [...prev, res.data]);
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('댓글 작성 실패');
    }
  };

  const handleEditClick = () => navigate(`/paper/edit/${id}`, { state: { selectedPaper } });

  const getDynamicNode = (paper) => {
    const pub = paper?.publication;
    const category = pub?.category;
    if (category === 'research') {
      return <>{pub?.extra_author}, {pub?.title}({pub?.agency?.agency}, {pub?.year})</>;
    }
    if (category === 'article') {
      return <>{pub?.extra_author}, "{pub?.title}," {pub?.agency?.agency} {pub?.volume}, no.{pub?.issue} ({pub?.year}):{pub?.start_page}-{pub?.end_page}</>;
    }
    if (category === 'dissertation') {
      return <>{pub?.extra_author}, "{pub?.title}," (박사학위, {pub?.agency?.agency}, {pub?.year})</>;
    }
    if (category === 'thesis') {
      return <>{pub?.extra_author}, "{pub?.title}," (석사학위, {pub?.agency?.agency}, {pub?.year})</>;
    }
    return null;
  };

  return (
    <Space direction="vertical" style={{ width: '100%', padding: '20px' }} size="large">
      {selectedPaper ? (
        <Card style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          <Row justify="space-between">
            <Col flex="auto">
              <Title level={3} style={{ margin: 0, whiteSpace: 'nowrap' }}>
                {selectedPaper?.title ?? '-'}
              </Title>
              <Text>{getDynamicNode(selectedPaper)}</Text>
            </Col>
            <Col style={{ width: 200, textAlign: 'right' }}>
              <Text strong>
                {(selectedPaper?.publication?.year ?? '-') }년 ({selectedPaper?.publication?.category ?? '-'})
              </Text>
              <br />
              <Text>
                작성자 {selectedPaper?.nickname?.nickname ?? 'null'}
              </Text>
            </Col>
          </Row>
          <Divider />
          <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(selectedPaper?.contents ?? ''),
            }}
            style={{ marginBottom: '1rem' }}
          />
          <Row justify="center" gutter={16}>
            {user && selectedPaper?.nickname && user.id === selectedPaper.nickname.id && (
              <Col>
                <Button type="primary" danger onClick={handleEditClick}>
                  수정
                </Button>
              </Col>
            )}
            <Col>
              <Button type="primary">
                좋아요 {selectedPaper?.likes ?? 0}
              </Button>
            </Col>
            <Col>
              <Button>
                북마크 {selectedPaper?.bookmarks ?? 0}
              </Button>
            </Col>
          </Row>
          <Divider />
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
          <Flex vertical style={{ margin: '1rem 0 0 0', width: '100%' }}>
            {paginatedPapers.map((paper) => {
              const dynamicNode = getDynamicNode(paper);
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
                    backgroundColor: selectedPaper?.id === paper?.id ? 'rgb(238, 247, 255)' : 'white',
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
            total={total}        // ✅ 필터/정렬 결과 기준
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
    </Space>
  );
};

export default PaperView;
