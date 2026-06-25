// src/WikiEditTabs.jsx
// 편집 / 미리보기 / 문법 도움말 탭을 묶은 재사용 컴포넌트.
// - WikiEdit(문서 수정 페이지)와 ExplanationCarousel(해설 카드 인라인 편집)에서 공용.
// - thirds=true 이면 탭 바를 3등분 버튼 형태로 렌더(카드 인라인 편집용).
import React, { useMemo } from 'react';
import { Tabs, Space } from 'antd';
import WikiForm from './WikiForm';
import WikiGuide from './WikiGuide';
import DOMPurify from 'dompurify';
import parseWikiSyntax from './WikiParser';

export default function WikiEditTabs({
  content,
  onContentChange,
  onFinish,
  submitting = false,
  thirds = false,
  defaultActiveKey = 'edit',
}) {
  const previewHtml = useMemo(() => {
    const raw = parseWikiSyntax(content || '');
    return DOMPurify.sanitize(raw);
  }, [content]);

  const items = [
    {
      key: 'edit',
      label: '편집',
      children: (
        <WikiForm
          initialValues={{ content }}
          onFinish={onFinish}
          loading={submitting}
          onValuesChange={(_, values) => {
            if (Object.prototype.hasOwnProperty.call(values, 'content')) {
              onContentChange?.(values.content ?? '');
            }
          }}
          hideTitle
        />
      ),
    },
    {
      key: 'preview',
      label: '미리보기',
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <div
            className="wiki-body wiki-preview"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </Space>
      ),
    },
    {
      key: 'guide',
      label: '문법 도움말',
      children: <WikiGuide />,
    },
  ];

  // 3등분 버튼 탭 바 (carousel 카드 인라인 편집용)
  const renderThirdsBar = (tabBarProps) => {
    const { activeKey, onTabClick } = tabBarProps;
    return (
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {items.map((it) => {
          const active = activeKey === it.key;
          return (
            <button
              key={it.key}
              type="button"
              onClick={(e) => onTabClick(it.key, e)}
              style={{
                flex: 1,
                padding: '4px 0',
                fontSize: 12,
                lineHeight: 1.4,
                cursor: 'pointer',
                borderRadius: 6,
                border: `1px solid ${active ? '#1677ff' : '#d9d9d9'}`,
                background: active ? '#1677ff' : '#fff',
                color: active ? '#fff' : 'rgba(0,0,0,0.85)',
                transition: 'all 0.2s',
              }}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Tabs
      defaultActiveKey={defaultActiveKey}
      items={items}
      {...(thirds ? { renderTabBar: renderThirdsBar } : {})}
    />
  );
}
