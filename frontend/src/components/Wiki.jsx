// src/Wiki.jsx
import React, { useEffect, useState } from 'react';
import { List, Typography, Tag, Button, Space, Spin, Alert, message } from 'antd';
import { Link, useNavigate, Outlet, useOutlet } from 'react-router-dom'; // ✅ 추가
import AxiosInstance from './AxiosInstance';

const { Title, Text } = Typography;

export default function Wiki() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const isLoggedIn = !!localStorage.getItem('Token');
  const navigate = useNavigate();

  // ✅ 자식 매칭 여부(Outlet이 있으면 상세 화면 중)
  const outlet = useOutlet();
  const isDetail = Boolean(outlet);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await AxiosInstance.get('/wiki/recent/');
        if (!alive) return;
        setItems(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        if (!alive) return;
        setErr('최근 문서를 불러오지 못했습니다.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const t = q.trim();
    if (!t) return message.warning('문서 제목을 입력하세요.');
    navigate(`/wiki/v/${encodeURIComponent(t)}`);
  };

  // 공통 상단(전체폭 검색바)은 항상 보여줌
  const TopSearchBar = (
    <div
      className="wiki-top-search"  // ✅ 추가: 넓은 화면에서 숨기기 위해
      style={{
        width: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        background: '#fff',
        borderBottom: '1px solid #f0f0f0'
      }}
    >
      <form onSubmit={handleSearchSubmit}>
        <div style={{ height: '2rem', width: '100%', display: 'flex' }}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="문서 제목을 입력하고 Enter"
            aria-label="문서 검색"
            style={{ lineHeight: '1rem', border: '1px solid #d9d9d9', fontSize: '0.9rem', flex: 1, outline: 'none' }}
          />
          <button
            type="submit"
            style={{ lineHeight: '1rem', border: '1px solid #d9d9d9', fontSize: '0.9rem', background: '#f5f5f5', cursor: 'pointer' }}
          >
            이동
          </button>
        </div>
      </form>
    </div>
  );

  if (loading) return (<>{TopSearchBar}<Spin size="large" style={{ marginTop: '2rem' }} /></>);
  if (err) return (<>{TopSearchBar}<Alert message={err} type="error" showIcon style={{ marginTop: '2rem' }} /></>);

  return (
    <>
      {TopSearchBar}

      {/* ✅ 자식 라우트(UI: WikiView/Version들)가 있으면 여기 출력 */}
      {outlet}

      {/* ✅ 자식 라우트가 없을 때만(= /wiki 인덱스) 최근 문서 리스트 표시 */}
      {!isDetail && (
        <div style={{ maxWidth: 900, margin: '1rem auto 2rem' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
            <Title level={3} style={{ margin: 0 }}>최근 변경된 문서</Title>
          </Space>

          <List
            bordered
            dataSource={items}
            locale={{ emptyText: '최근 문서가 없습니다.' }}
            renderItem={(it) => {
              const title = it?.title ?? '(제목 없음)';
              const updated = it?.updated_at ? new Date(it.updated_at).toLocaleString() : '';
              return (
                <List.Item
                  actions={[
                    <Tag key="updated" color="default">업데이트: {updated}</Tag>
                  ]}
                >
                  <List.Item.Meta
                    // ✅ 백틱 문자열 사용 주의
                    title={<Link to={`/wiki/v/${encodeURIComponent(title)}`}>{title}</Link>}
                  />
                </List.Item>
              );
            }}
          />
        </div>
      )}
    </>
  );
}
