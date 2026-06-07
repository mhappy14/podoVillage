// src/WikiGuide.jsx
// 위키 문법 가이드 — WikiParser.js의 문법을 그대로 따라 작성되었습니다.
// 모든 "표시 결과"는 실제 parseWikiSyntax로 렌더링되므로 파서와 항상 일치합니다.
import React, { useMemo } from 'react';
import { Collapse, Typography, Alert } from 'antd';
import DOMPurify from 'dompurify';
import parseWikiSyntax from './WikiParser';

const { Text } = Typography;

function Result({ syntax }) {
  const html = useMemo(() => DOMPurify.sanitize(parseWikiSyntax(syntax)), [syntax]);
  return <div className="wiki-body wg-result" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Example({ desc, syntax, showResult = true }) {
  return (
    <div className="wg-example">
      {desc && <div className="wg-desc">{desc}</div>}
      <div className="wg-cols">
        <div className="wg-col">
          <div className="wg-label">입력</div>
          <pre className="wg-code">{syntax}</pre>
        </div>
        {showResult && (
          <div className="wg-col">
            <div className="wg-label">표시 결과</div>
            <Result syntax={syntax} />
          </div>
        )}
      </div>
    </div>
  );
}

// 표 셀/표 옵션 레퍼런스 (라이브 표로 보여주면 토큰이 실제로 적용되므로 코드로 표기)
const TABLE_OPTIONS = [
  ['<tablewidth=600px>', '표 전체 너비 — 첫 번째 셀 앞에'],
  ['<tablealign=center>', '표 정렬 (center / right) — 첫 번째 셀 앞에'],
  ['<tablebordercolor=#ccc>', '표 테두리 색 — 첫 번째 셀 앞에'],
  ['<-N>', '열 병합 (colspan). 예: <-2>'],
  ['<|N>', '행 병합 (rowspan). 예: <|2>'],
  ['<(>', '셀 텍스트 왼쪽 정렬'],
  ['<:>', '셀 텍스트 가운데 정렬'],
  ['<)>', '셀 텍스트 오른쪽 정렬'],
  ['<bgcolor=#eee>', '셀 배경색'],
  ['<color=red>', '셀 글자색'],
  ['<width=100px>', '셀 너비'],
  ['<height=40px>', '셀 높이'],
  ['<nopad>', '셀 안쪽 여백 제거'],
];

function TableOptionRef() {
  return (
    <div className="wg-optref">
      <div className="wg-desc">
        셀 내용 앞에 <code>{'<옵션>'}</code>을 붙여 서식을 지정합니다. 여러 옵션을 연달아 붙일 수 있습니다.
      </div>
      <table className="wg-opttable">
        <thead>
          <tr><th>옵션</th><th>설명</th></tr>
        </thead>
        <tbody>
          {TABLE_OPTIONS.map(([tok, desc]) => (
            <tr key={tok}><td><code>{tok}</code></td><td>{desc}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SECTIONS = [
  {
    key: 'inline',
    label: '인라인 서식',
    examples: [
      { desc: '굵게 · 기울임 · 밑줄', syntax: "'''굵게''' ''기울임'' __밑줄__" },
      { desc: '취소선 (두 가지 표기 모두 가능)', syntax: '~~취소선~~ --취소선--' },
      { desc: '위첨자 · 아래첨자', syntax: 'E=mc^^2^^ · H,,2,,O' },
      {
        desc: '글자 크기 — {{{+N ...}}} / {{{-N ...}}} (N은 단계)',
        syntax: '{{{+2 크게}}} 보통 {{{-1 작게}}}',
      },
      {
        desc: '글자 색 — {{{#색 ...}}} (색 이름 또는 #RRGGBB)',
        syntax: '{{{#red 빨간 글자}}} {{{#0080ff 파란 글자}}}',
      },
      { desc: '문단 안에서 강제 줄바꿈', syntax: '첫 번째 줄[br]두 번째 줄' },
    ],
  },
  {
    key: 'heading',
    label: '문단 제목',
    examples: [
      {
        desc: '= 기호 2~6개로 H2~H6 제목을 만듭니다. 각 문단은 접기/펼치기가 됩니다.',
        syntax: '== 대제목 ==\n=== 소제목 ===\n==== 소소제목 ====',
      },
      {
        desc: '제목 끝에 {접기} 또는 {펼침} 마커로 기본 상태를 지정합니다. (기본값: 펼침)',
        syntax: '== 기본 접힌 문단 {접기} ==\n안에 들어가는 내용',
      },
    ],
  },
  {
    key: 'toc',
    label: '목차',
    examples: [
      {
        desc: '본문에 [목차]를 넣으면 그 위치에 제목 기반 목차가 자동 생성됩니다.',
        syntax: '[목차]\n== 개요 ==\n내용\n=== 상세 ===\n내용',
      },
    ],
  },
  {
    key: 'link',
    label: '링크',
    examples: [
      {
        desc: '내부 문서 링크 — [[제목]] 또는 [[제목|표시 텍스트]]',
        syntax: '[[위키]] · [[위키|이렇게 보입니다]]',
      },
      {
        desc: '문단 앵커 링크 — 같은 문서 또는 다른 문서의 문단으로 이동',
        syntax: '[[#개요]] · [[다른문서#개요|표시 텍스트]]',
      },
      { desc: '분류', syntax: '[[분류:수학]]' },
    ],
  },
  {
    key: 'image',
    label: '이미지',
    examples: [
      {
        desc: '[[파일:파일명]] 으로 이미지를 삽입합니다. width 옵션으로 너비를 지정할 수 있습니다.',
        syntax: '[[파일:example.png]]\n[[파일:example.png|width=300px]]',
        showResult: false,
      },
    ],
  },
  {
    key: 'list',
    label: '리스트',
    examples: [
      {
        desc: '순서 없는 목록 — * (앞 공백으로 들여쓰기)',
        syntax: '* 항목 1\n* 항목 2\n  * 하위 항목',
      },
      {
        desc: '순서 있는 목록 — 1. / a. / A. / i. / I.',
        syntax: '1. 첫 번째\n2. 두 번째\n  a. 알파벳 하위',
      },
    ],
  },
  {
    key: 'table',
    label: '표',
    examples: [
      {
        desc: '각 행은 || 로 시작·구분·끝냅니다.',
        syntax: '|| 이름 || 나이 || 직업 ||\n|| 홍길동 || 30 || 개발자 ||',
      },
      {
        desc: '옵션 예시 — 가운데 정렬 + 배경색 + 열 병합 (옵션은 || 바로 뒤, 공백 없이)',
        syntax: '||<-2><:><bgcolor=#f0f0f0>가운데로 병합된 칸||\n||왼쪽||오른쪽||',
      },
    ],
    extra: <TableOptionRef />,
  },
  {
    key: 'quote',
    label: '인용',
    examples: [
      { desc: '> 로 시작하는 줄은 인용문이 됩니다.', syntax: '> 인용문입니다.\n> 여러 줄도 가능합니다.' },
    ],
  },
  {
    key: 'hr',
    label: '수평선',
    examples: [{ desc: '- 를 4~9개 쓰면 수평선이 됩니다.', syntax: '위 내용\n----\n아래 내용' }],
  },
  {
    key: 'code',
    label: '코드 블록',
    examples: [
      { desc: '{{{ ~ }}} 로 감싸면 그대로 출력됩니다.', syntax: '{{{\n코드 내용은 그대로 출력\n}}}' },
      { desc: '#!언어 로 언어를 지정할 수 있습니다.', syntax: '{{{#!python\ndef hello():\n    print("Hi")\n}}}' },
    ],
  },
  {
    key: 'folding',
    label: '접기',
    examples: [
      {
        desc: '#!folding 으로 클릭해서 펼치는 영역을 만듭니다. (기본 접힘)',
        syntax: '{{{#!folding 눌러서 펼치기\n숨겨진 내용입니다.\n}}}',
      },
    ],
  },
  {
    key: 'footnote',
    label: '각주',
    examples: [
      {
        desc: '[* 내용] 으로 각주를 답니다. 이름을 붙이면([*이름 내용]) 여러 번 재사용할 수 있고([*이름]), [각주] 위치에 목록이 표시됩니다. (없으면 맨 아래)',
        syntax: '본문입니다[* 각주 내용].\n재사용 각주[*ref 이름 있는 각주]와 다시 참조[*ref].\n\n[각주]',
      },
    ],
  },
  {
    key: 'redirect',
    label: '리다이렉트(넘겨주기)',
    examples: [
      {
        desc: '문서 첫 줄에 입력하면 해당 문서로 넘겨집니다. (#redirect 와 #넘겨주기 모두 사용 가능)',
        syntax: '#redirect 목적지 문서',
      },
    ],
  },
  {
    key: 'escape',
    label: '이스케이프',
    examples: [
      {
        desc: '특수문자([ ] { } | # * _ - ~ = < > : ( ) ! ^ , ` \\) 앞에 \\ 를 붙이면 문법으로 처리되지 않고 그대로 출력됩니다.',
        syntax: '\\[[링크 처리 안 됨\\]] \\*별표 그대로 \\=\\=제목 아님\\=\\=',
      },
    ],
  },
  {
    key: 'literal',
    label: '리터럴(인라인 코드)',
    examples: [
      {
        desc: '{{{[[ ... ]]}}} 안의 내용은 문법 처리 없이 인라인 코드로 출력됩니다.',
        syntax: "{{{[[굵게 처리 안 되는 '''예시''']]}}}",
      },
    ],
  },
  {
    key: 'template',
    label: '틀(템플릿)',
    examples: [
      {
        desc: '틀은 자리표시자로 삽입됩니다. (실제 내용은 앱에서 치환)',
        syntax: '[include(정보상자, 이름=홍길동, 직업=개발자)]\n{{틀:알림|중요|level=경고}}',
      },
    ],
  },
];

export default function WikiGuide() {
  const items = SECTIONS.map((sec) => ({
    key: sec.key,
    label: sec.label,
    children: (
      <div className="wg-panel">
        {sec.examples.map((ex, i) => (
          <Example key={i} {...ex} />
        ))}
        {sec.extra}
      </div>
    ),
  }));

  return (
    <div className="wg-guide">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="아래 '입력'을 편집 칸에 그대로 쓰면 오른쪽 '표시 결과'처럼 나타납니다."
      />
      <Collapse items={items} defaultActiveKey={['inline', 'heading']} />
    </div>
  );
}
