import React, { useEffect, useMemo, useState } from 'react';
import { Button, Pagination, Typography, Select, Card, Space, Flex } from 'antd';
import { Link } from 'react-router-dom';
import AxiosInstance from './AxiosInstance';

const { Text } = Typography;

// 안전 배열
const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

// 표시용 라벨
const renderExamLabel = (exam) =>
  exam?.examtype === 'Public'
    ? `${exam?.ragent ?? ''} ${exam?.rposition ?? ''} ${exam?.examname ?? ''}`.trim()
    : exam?.examname;

const Study = () => {
  const [explanations, setExplanations] = useState([]);   // 항상 배열 유지
  const [loading, setLoading] = useState(true);

  // ✅ 필터는 id 기반으로 관리
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedExamnumberId, setSelectedExamnumberId] = useState('');
  const [selectedQsubjectId, setSelectedQsubjectId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [qsubjMap, setQsubjMap] = useState({});

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [exRes, qsRes] = await Promise.all([
          AxiosInstance.get('explanation/', { headers: { Authorization: null } }),
          AxiosInstance.get('examqsubject/'), // ← 추가
        ]);
        setExplanations(asArray(exRes.data));

        const list = asArray(qsRes.data);
        const map = {};
        for (const s of list) if (s?.id) map[String(s.id)] = s;
        setQsubjMap(map);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // ===== 옵션 구성 (중복 제거)
  const examOptions = useMemo(() => {
    const uniq = new Map();
    for (const it of asArray(explanations)) {
      const ex = it?.exam;
      if (!ex?.id) continue;
      if (!uniq.has(ex.id)) uniq.set(ex.id, { value: String(ex.id), label: renderExamLabel(ex) });
    }
    return [{ value: '', label: '전체' }, ...Array.from(uniq.values())];
  }, [explanations]);

  const examnumberOptions = useMemo(() => {
    const uniq = new Map();
    for (const it of asArray(explanations)) {
      const en = it?.examnumber;
      const exam = it?.exam;
      if (!en?.id) continue;
      // 선택된 시험이 있다면 해당 시험에 속하는 회차만
      if (selectedExamId && String(exam?.id) !== String(selectedExamId)) continue;
      const label = en?.slug ?? `${en?.year ?? '-'}년 ${en?.examnumber ?? '-'}회`;
      if (!uniq.has(en.id)) uniq.set(en.id, { value: String(en.id), label });
    }
    return [{ value: '', label: '전체' }, ...Array.from(uniq.values())];
  }, [explanations, selectedExamId]);

  const qsubjectOptions = useMemo(() => {
    const uniq = new Map();
    for (const it of asArray(explanations)) {
      const q = it?.question;
      const en = it?.examnumber;
      const ex = it?.exam;
      const qs = q?.examqsubject;
      if (!qs?.id) continue;

      // 선택된 시험/회차 조건 적용
      if (selectedExamId && String(ex?.id) !== String(selectedExamId)) continue;
      if (selectedExamnumberId && String(en?.id) !== String(selectedExamnumberId)) continue;

      const label = qs?.slug || `${qs?.esn ?? ''}. ${qs?.est ?? ''}`.trim();
      if (!uniq.has(qs.id)) uniq.set(qs.id, { value: String(qs.id), label });
    }
    return [{ value: '', label: '전체' }, ...Array.from(uniq.values())];
  }, [explanations, selectedExamId, selectedExamnumberId]);

  // ===== 필터링 =====
  const filteredExplanations = useMemo(() => {
    let filtered = asArray(explanations);

    if (selectedExamId) {
      filtered = filtered.filter((item) => String(item?.exam?.id) === String(selectedExamId));
    }
    if (selectedExamnumberId) {
      filtered = filtered.filter(
        (item) => String(item?.examnumber?.id) === String(selectedExamnumberId)
      );
    }
    if (selectedQsubjectId) {
      filtered = filtered.filter(
        (item) => String(item?.question?.examqsubject?.id) === String(selectedQsubjectId)
      );
    }
    return filtered;
  }, [explanations, selectedExamId, selectedExamnumberId, selectedQsubjectId]);

  // ===== 정렬 =====
  const sortedExplanations = useMemo(() => {
    const arr = asArray(filteredExplanations);
    return arr.slice().sort((a, b) => new Date(b?.created_at) - new Date(a?.created_at));
  }, [filteredExplanations]);

  // ===== 페이지네이션 =====
  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(sortedExplanations.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedExplanations = sortedExplanations.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page) => setCurrentPage(page);

  return (
    <div style={{ padding: '1rem' }}>
      {/* 필터링 Select */}
      <Flex gap="middle" style={{ marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <Text strong>시험명</Text>
          <Select
            value={selectedExamId}
            onChange={(value) => {
              setSelectedExamId(value);
              // 하위 의존 필터 초기화
              setSelectedExamnumberId('');
              setSelectedQsubjectId('');
              setCurrentPage(1);
            }}
            style={{ width: '100%' }}
            options={examOptions}
            placeholder="시험명을 선택하세요"
            allowClear
          />
        </div>

        <div style={{ flex: 1 }}>
          <Text strong>시험회차</Text>
          <Select
            value={selectedExamnumberId}
            onChange={(value) => {
              setSelectedExamnumberId(value);
              // 과목 필터 초기화
              setSelectedQsubjectId('');
              setCurrentPage(1);
            }}
            style={{ width: '100%' }}
            options={examnumberOptions}
            placeholder="시험회차를 선택하세요"
            allowClear
            disabled={!selectedExamId && examnumberOptions.length > 1 /* 전체만 있을 때만 허용 */}
          />
        </div>

        <div style={{ flex: 1 }}>
          <Text strong>
            {selectedExamnumberId ? '과목' : '(과목) 시험회차를 먼저 선택해주세요.'}
          </Text>
          <Select
            value={selectedQsubjectId}
            onChange={(value) => {
              setSelectedQsubjectId(value);
              setCurrentPage(1);
            }}
            style={{ width: '100%' }}
            options={qsubjectOptions}
            placeholder={selectedExamnumberId ? '과목을 선택하세요' : '시험회차를 먼저 선택해주세요.'}
            disabled={!selectedExamnumberId}
            allowClear
            showSearch
            optionFilterProp="children"
          />
        </div>
      </Flex>

      {/* Explanation 목록 */}
      {loading ? (
        <Text>Loading data...</Text>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {paginatedExplanations.map((item) => {
            const ex = item?.exam;
            const en = item?.examnumber;
            const q = item?.question;
            let qs = q?.examqsubject;
            if (qs && typeof qs !== 'object') {
              qs = qsubjMap[String(qs)] || null;
            }
            const subjLabel = qs?.esn;
            return (
              <Link key={item?.id} to={`/study/view/${item?.id}`} style={{ textDecoration: 'none' }}>
                <Card hoverable>
                  <Flex justify="space-between" align="center">
                    <div style={{ width: '20%' }}>
                      <strong>{renderExamLabel(ex) ?? '-'}</strong>
                    </div>
                    <div style={{ width: '20%' }}>
              {en?.year ?? '-'}년 {en?.examnumber ?? '-'}회 {subjLabel}-{q?.qnumber ?? '-'}
                    </div>
                    <div style={{ width: '50%' }}>{q?.qtext ?? ''}</div>
                    <div style={{ width: '10%', textAlign: 'right' }}>
                      좋아요: {item?.like_count ?? 0}개
                    </div>
                  </Flex>
                </Card>
              </Link>
            );
          })}
        </Space>
      )}

      {/* Pagination + Write 버튼 */}
      <Flex justify="space-between" align="center" style={{ marginTop: '2rem' }}>
        <div />
        <Pagination
          current={currentPage}
          total={sortedExplanations.length}
          pageSize={itemsPerPage}
          onChange={handlePageChange}
        />
        <Button type="primary">
          <Link to="/study/write" style={{ color: 'white' }}>
            Write
          </Link>
        </Button>
      </Flex>
    </div>
  );
};

export default Study;
