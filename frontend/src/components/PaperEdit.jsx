import React, { useState, useEffect } from 'react';
import { Space, Typography, Divider, Row, Col } from 'antd';
import AxiosInstance from './AxiosInstance';
import PaperWriteText from './PaperWriteText';
import PaperWriteAuthor from './PaperWriteAuthor';
import PaperWriteAgency from './PaperWriteAgency';
import PaperWritePublication from './PaperWritePublication';
import { useParams, useNavigate } from 'react-router-dom';

const { Title } = Typography;

const PaperEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // refreshKey가 변경되면 데이터를 다시 불러옵니다.
  const refreshData = () => {
    setRefreshKey((prevKey) => prevKey + 1);
  };

  useEffect(() => {
    const fetchPaper = async () => {
      try {
        const response = await AxiosInstance.get(`paper/${id}/`);
        const data = response.data;
        setSelectedPaper(data);
      } catch (error) {
        console.error("데이터 가져오기 오류:", error);
      }
    };

    fetchPaper();
  }, [id, refreshKey]);

  const handleSave = async (updatedData) => {
    try {
      await AxiosInstance.patch(`paper/${id}/`, updatedData);
      alert("게시글이 성공적으로 수정되었습니다.");
      navigate(`/paper/view/${id}`);
    } catch (error) {
      console.error("게시글 수정 오류:", error);
      alert("게시글 수정 중 오류가 발생했습니다.");
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ padding: '20px', width: '100%' }}>
      <Title level={4}>Edit Paper</Title>
      {selectedPaper && (
        <>
          {/* PaperWriteText: 글 제목, 본문, 카테고리 등 주요 정보를 수정 */}
          <PaperWriteText
            selectedPaper={{
              id: selectedPaper.id,
              title: selectedPaper.title,
              // 'contents' 필드가 리뷰 본문에 해당한다면 PaperWriteText 컴포넌트에서 이를 사용합니다.
              Paper: selectedPaper.contents, 
              category: selectedPaper.publication?.category || "",
              // 여기서는 Publication의 author 배열 중 첫번째를 사용합니다.
              author: selectedPaper.publication?.author?.[0]?.id || "",
              // Agency는 nested 객체로 포함되어 있다면 agency.agency를 사용합니다.
              agency: selectedPaper.publication?.agency ? selectedPaper.publication.agency.agency : "",
              publication: selectedPaper.publication?.id || ""
            }}
            onSave={handleSave}
            isEdit={true}
          />

          {/* 하단 영역: 저자, 기관, 서적 정보 수정 */}
          <Row 
            style={{
              border: '1px solid #ccc',
              borderRadius: 8,
              width: '100%'
            }}
          >
            {/* 왼쪽 영역: Author, Agency */}
            <Col flex={2} style={{padding: '20px'}}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <PaperWriteAuthor onRefresh={refreshData} refreshKey={refreshKey} />
                <PaperWriteAgency onRefresh={refreshData} refreshKey={refreshKey} />
              </Space>
            </Col>
            
            {/* 오른쪽 영역: Publication */}
            <Col flex={3} style={{padding: '20px'}}>
              <PaperWritePublication onRefresh={refreshData} refreshKey={refreshKey} />
            </Col>
          </Row>
        </>
      )}
    </Space>
  );
};

export default PaperEdit;
