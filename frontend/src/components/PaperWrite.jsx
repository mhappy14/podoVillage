import React, { useState } from 'react';
import { Col, Row, Typography, Space } from 'antd';
import PaperWriteAuthor from './PaperWriteAuthor';
import PaperWriteAgency from './PaperWriteAgency';
import PaperWritePublication from './PaperWritePublication';
import PaperWriteText from './PaperWriteText';

const PaperWrite = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshData = () => {
    setRefreshKey((prevKey) => prevKey + 1);
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Typography.Title level={5}>Write Reviews of a paper</Typography.Title>
      
      <Space direction="vertical" 
        style={{
          border: '1px solid #ccc',
          borderRadius: 8,
          width: '100%'
        }}
      >
        <PaperWriteText onSave={refreshData} refreshKey={refreshKey} />
      </Space>
      
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
    </Space>
  );
};

export default PaperWrite;
