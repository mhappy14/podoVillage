// src/WikiEditTabs.jsx
// 편집 / 미리보기 / 문법 도움말 — 입력창·미리보기·도움말·탭바·저장버튼을
// 각각 독립 컴포넌트(named export)로 분리하여 호출부에서 레이아웃을 자유롭게 구성.
// - 기본 조합 컴포넌트(default export)는 그대로 두어 WikiEdit 페이지와 호환.
// - ExplanationCarousel 등 인라인 편집에서는 named export 들을 조합해서 사용.
import React, { useMemo, useState } from 'react';
import { Input, Button } from 'antd';
import WikiGuide from './WikiGuide';
import DOMPurify from 'dompurify';
import parseWikiSyntax from './WikiParser';

// 탭 정의 (key / label) — 외부에서도 참조 가능
export const WIKI_TABS = [
  { key: 'edit', label: '편집' },
  { key: 'preview', label: '미리보기' },
  { key: 'guide', label: '문법 도움말' },
];

// ---------- 입력창 (textarea 단독) ----------
export function WikiEditInput({ content, onContentChange, rows = 16, style, ...rest }) {
  return (
    <Input.TextArea
      value={content ?? ''}
      onChange={(e) => onContentChange?.(e.target.value)}
      rows={rows}
      style={style}
      {...rest}
    />
  );
}

// ---------- 미리보기 ----------
export function WikiPreview({ content, className = 'wiki-body wiki-preview', style }) {
  const previewHtml = useMemo(() => {
    const raw = parseWikiSyntax(content || '');
    return DOMPurify.sanitize(raw);
  }, [content]);
  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: previewHtml }}
    />
  );
}

// ---------- 문법 도움말 ----------
export function WikiGuidePanel() {
  return <WikiGuide />;
}

// ---------- 탭 바 (편집/미리보기/문법 도움말 전환) ----------
// thirds=true → 3등분 버튼 형태(인라인 편집용), 아니면 기본 텍스트 탭
export function WikiTabBar({ activeKey, onChange, thirds = false, style }) {
  if (thirds) {
    return (
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, ...style }}>
        {WIKI_TABS.map((it) => {
          const active = activeKey === it.key;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onChange?.(it.key)}
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
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        borderBottom: '1px solid #f0f0f0',
        marginBottom: 12,
        ...style,
      }}
    >
      {WIKI_TABS.map((it) => {
        const active = activeKey === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange?.(it.key)}
            style={{
              padding: '8px 0',
              fontSize: 14,
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              borderBottom: `2px solid ${active ? '#1677ff' : 'transparent'}`,
              color: active ? '#1677ff' : 'rgba(0,0,0,0.85)',
              fontWeight: active ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- 저장 버튼 (단독) ----------
// onSave 에 현재 content 를 넘겨 호출. 버튼 위치/스타일은 호출부에서 자유 배치.
export function WikiSaveButton({ onSave, content, loading = false, children = '저장', ...rest }) {
  return (
    <Button
      type="primary"
      htmlType="button"
      loading={loading}
      onClick={() => onSave?.(content)}
      {...rest}
    >
      {children}
    </Button>
  );
}

// ---------- 활성 탭에 맞는 본문 (입력창/미리보기/도움말) ----------
export function WikiEditBody({
  activeKey,
  content,
  onContentChange,
  rows = 16,
  inputStyle,
  previewStyle,
}) {
  if (activeKey === 'preview') return <WikiPreview content={content} style={previewStyle} />;
  if (activeKey === 'guide') return <WikiGuidePanel />;
  return (
    <WikiEditInput
      content={content}
      onContentChange={onContentChange}
      rows={rows}
      style={inputStyle}
    />
  );
}

// ---------- 기본 조합 컴포넌트 (WikiEdit 페이지 호환) ----------
export default function WikiEditTabs({
  content,
  onContentChange,
  onFinish,
  submitting = false,
  thirds = false,
  defaultActiveKey = 'edit',
}) {
  const [activeKey, setActiveKey] = useState(defaultActiveKey);

  return (
    <div>
      <WikiTabBar activeKey={activeKey} onChange={setActiveKey} thirds={thirds} />
      <WikiEditBody
        activeKey={activeKey}
        content={content}
        onContentChange={onContentChange}
      />
      {activeKey === 'edit' && (
        <div style={{ marginTop: 12 }}>
          <WikiSaveButton
            content={content}
            loading={submitting}
            onSave={(c) => onFinish?.({ content: c })}
          />
        </div>
      )}
    </div>
  );
}
