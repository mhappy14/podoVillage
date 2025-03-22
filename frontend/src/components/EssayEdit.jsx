import React, { useState, useEffect } from "react";
import { Box, Typography } from "@mui/material";
import AxiosInstance from "./AxiosInstance";
import EssayWriteText from "./EssayWriteText";
import EssayWriteProducer from './EssayWriteProducer';
import EssayWriteAgency from './EssayWriteAgency';
import EssayWritePublication from './EssayWritePublication';
import { useParams, useNavigate } from "react-router-dom";

const EssayEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const refreshData = () => {
    setRefreshKey((prevKey) => prevKey + 1); // 키 증가
  };

  // 기존 데이터 저장
  const [selectedEssay, setSelectedEssay] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedProducer, setSelectedProducer] = useState("");
  const [selectedAgency, setSelectedAgency] = useState("");
  const [selectedPublication, setSelectedPublication] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const essayResponse = await AxiosInstance.get(`essay/${id}/`);
        const essayData = essayResponse.data;
        setSelectedEssay(essayData);

        // ✅ 기존 선택값 유지
        setSelectedCategory(essayData.publication?.category || "");
        setSelectedProducer(essayData.publication?.author[0]?.id || "");
        setSelectedAgency(essayData.publication?.agency_name || "");
        setSelectedPublication(essayData.publication?.id || "");
      } catch (error) {
        console.error("데이터 가져오기 오류:", error);
      }
    };

    fetchData();
  }, [id]);

  const handleSave = async (updatedData) => {
    try {
      await AxiosInstance.patch(`essay/${id}/`, updatedData);
      alert("게시글이 성공적으로 수정되었습니다.");
      navigate(`/essay/view/${id}`);
    } catch (error) {
      console.error("게시글 수정 오류:", error);
      alert("게시글 수정 중 오류가 발생했습니다.");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <Typography variant="h5" gutterBottom>
        Edit Essay
      </Typography>
      {selectedEssay && (
        <Box sx={{ border: "1px solid #ccc", borderRadius: "8px", margin: "0 0 3rem 0" }}>
          <EssayWriteText
            selectedEssay={{
              id: selectedEssay.id,
              essay: selectedEssay.essay,
              category: selectedCategory,
              producer: selectedProducer,
              agency: selectedAgency,
              publication: selectedPublication,
            }}
            onSave={handleSave}
            isEdit={true}
          />
          <Box
            sx={{
              border: '1px solid #ccc',
              borderRadius: '8px',
              margin: '1rem 0',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'row', // 가로 배치
              gap: '1rem', // 부모 컨테이너의 너비를 채움
              alignItems: 'stretch', // 하단 라인 정렬
            }}
          >
            {/* 왼쪽 박스 (Producer, Agency) */}
            <Box sx={{ display: 'flex', width: '35%', flexDirection: 'column', gap: '2rem' }}>
              <EssayWriteProducer onRefresh={refreshData} />
              <EssayWriteAgency onRefresh={refreshData} />
            </Box>
            {/* 오른쪽 박스 (Publication) */}
            <Box sx={{ width: '65%' }}>
              <EssayWritePublication onRefresh={refreshData} />
            </Box>
          </Box>
        </Box>
      )}
    </div>
  );
};

export default EssayEdit;
