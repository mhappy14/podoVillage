// components/WikiParser.js
export default function parseWikiSyntax(text) {
  if (!text) return '';

  let html = text;

  // 내부 링크 [[문서제목]]
  html = html.replace(/\[\[(.+?)\]\]/g, (match, p1) => {
    const encoded = encodeURIComponent(p1.trim());
    return `<a href="/wiki/view/${encoded}">${p1}</a>`;
  });

  // 색상 태그 #red 텍스트
  html = html.replace(/#red (.+?)\n?/g, '<span style="color:red;">$1</span><br>');

  // 제목 ==제목==
  html = html.replace(/==(.+?)==/g, '<h2>$1</h2>');

  // 테이블 ||A||B||
  html = html.replace(/\|\|(.+?)\|\|/g, '<td>$1</td>');
  html = html.replace(/((<td>.*?<\/td>)+)/g, '<tr>$1</tr>');
  html = html.replace(/((<tr>.*?<\/tr>)+)/g, '<table border="1" style="margin:1rem 0;">$1</table>');

  return html;
}
