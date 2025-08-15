// components/WikiParser.js — v0.4 consolidated
// Adds: 표 고급문법, 접기/문단 앵커, [목차], 리다이렉트, 각주 위치 지정([각주]), 틀(include/틀:)
// NOTE: DOM 삽입 전 반드시 DOMPurify.sanitize() 사용 권장

export default function parseWikiSyntax(input) {
  if (!input) return '';
  let text = String(input).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

  // ---- 리다이렉트(#redirect, #넘겨주기) ----
  const firstLine = (text.match(/^\s*([^\n]*)/) || ['',''])[1].trim();
  const mRedirect = firstLine.match(/^#\s*(?:redirect|\uB118\uACA8\uC8FC\uAE30)\s+(.+)$/i);
  if (mRedirect) {
    const target = mRedirect[1].trim();
    const href = `/wiki/v/${encodeURIComponent(target)}`;
    return `<div class="redirect" style="padding:12px;border:1px solid #e5e7eb;background:#f9fafb;border-radius:12px">이 문서는 <a href="${href}">${escapeHtml(target)}</a>(으)로 넘겨집니다.</div>`;
  }

  // ---- [목차] 자리표시자 ----
  const TOC_TOKEN = `__TOC__${Math.random().toString(36).slice(2)}__`;
  text = text.replace(/\[\uBAA9\uCC28\]/g, TOC_TOKEN);

  // ---- 이스케이프 1차 보호 ----
  const ESC = new Map(); let escId = 0;
  text = text.replace(/\\([\\\[\]\{\}\|#`*_\-~=<>:()!^,])/g, (_, ch) => {
    const key = `__ESC_${escId++}__`; ESC.set(key, ch); return key;
  });

  // ---- 리터럴 보호 {{{[[...]]}}} ----
  const LIT = new Map(); let litId = 0;
  text = text.replace(/\{\{\{\s*\[\[(.*?)\]\]\s*\}\}\}/gs, (_, inner) => {
    const key = `__LIT_${litId++}__`; LIT.set(key, escapeHtml(inner)); return key;
  });

  // ---- 블록 수준 ----
  text = parseFolding(text);
  text = parseCodeBlocks(text);
  const hCtx = renderHeadingsCollect(text); // H2~H6 + 앵커 수집
  text = hCtx.html;
  text = parseTables(text);
  text = parseLists(text);
  text = parseBlockquotes(text);
  text = parseHr(text);

  // ---- 인라인 ----
  text = parseLinksAndFiles(text);
  text = parseTemplates(text); // include, 틀:
  text = parseInline(text);

  // ---- 각주 처리 ----
  const footCtx = collectFootnotes(text);
  text = footCtx.html;

  // ---- 이스케이프 복원 ----
  for (const [k,v] of LIT) text = text.replaceAll(k, `<code>${v}</code>`);
  for (const [k,v] of ESC) text = text.replaceAll(k, escapeHtml(v));

  // ---- 목차 주입 ----
  if (text.includes(TOC_TOKEN)) {
    text = text.replaceAll(TOC_TOKEN, buildTOC(hCtx.headings));
  }

  // ---- 문단 포장 ----
  text = text.split(/\n{2,}/).map(b => b.trim().startsWith('<') ? b : `<p>${b.replace(/\n/g,'<br>')}</p>`).join('\n');

  // ---- 각주 목록 위치 ----
  if (footCtx.list.length) {
    const footHtml = renderFootnoteList(footCtx.list);
    if (text.includes('__FOOT_PLACE__')) text = text.replaceAll('__FOOT_PLACE__', footHtml);
    else text += footHtml;
  }

  return text;
}

// ========== Helpers ==========
function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');}
function escAttr(s){return String(s).replace(/["'<>]/g,'');}
function slugId(title){return title.trim().replace(/[\u0000-\u001F]/g,'').replace(/[\s\t\n]+/g,'-').replace(/[^\w\-\u3131-\uD79D]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')||'section';}

// ---- 접기 ----
function parseFolding(text){
  return text.replace(/\{\{\{\s*#!folding\s*(.*?)\n([\s\S]*?)\n\}\}\}/g,(_,sum,body)=>{
    return `<details class="nm-fold"><summary>${inlineOnly(sum||'More')}</summary><div class="nm-fold-body">${body.trim()}</div></details>`;
  });
}

// ---- 코드블록 ----
function parseCodeBlocks(text){
  return text.replace(/\{\{\{\s*(?:#!([\w\-]+))?\n([\s\S]*?)\n\}\}\}/g,(_,lang,body)=>{
    const cls = lang?` class="language-${lang}"`:''; return `<pre><code${cls}>${escapeHtml(body)}</code></pre>`;
  });
}

// ---- 제목/앵커 수집 ----
function renderHeadingsCollect(text){
  const heads=[]; let i=0;
  const html=text.replace(/^(={2,6})\s*(.+?)\s*\1\s*$/gm,(m,eqs,title)=>{
    const lvl=eqs.length; const sid=`s-${++i}`; const id=slugId(title);
    heads.push({level:lvl,title:title.trim(),sid,id});
    return `<a id="${sid}"></a><h${lvl} id="${id}">${escapeHtml(title.trim())}</h${lvl}>`;
  });
  return {html,headings:heads};
}

function buildTOC(heads){ if(!heads.length) return '';
  const stack=[{level:1,children:[]}];
  heads.forEach(h=>{ while(stack[stack.length-1].level>=h.level) stack.pop(); const n={level:h.level,children:[],html:`<a href="#${h.sid}">${escapeHtml(h.title)}</a>`}; stack[stack.length-1].children.push(n); stack.push(n); });
  const render=nodes=>!nodes?.length?'':`<ul style="list-style:none;padding-left:1rem;margin:0.25rem 0">${nodes.map(n=>`<li style=\"margin:2px 0\">${n.html}${render(n.children)}</li>`).join('')}</ul>`;
  return `<nav class="toc" id="toc" style="border:1px solid #e5e7eb;background:#f8fafc;border-radius:12px;padding:12px;margin:12px 0"><div style="font-weight:600;margin-bottom:6px">목차</div>${render(stack[0].children)}</nav>`;
}

// ---- 표 (고급) ----
function parseTables(text){
  const lines=text.split('\n'); const out=[]; let i=0;
  while(i<lines.length){ if(/^\s*\|\|/.test(lines[i])){ const rows=[]; while(i<lines.length && /^\s*\|\|/.test(lines[i])){ rows.push(lines[i++]); } out.push(renderTable(rows)); continue;} out.push(lines[i++]); }
  return out.join('\n');
}
function renderTable(rows){
  const tOpt={width:null,align:null,borderColor:null};
  const trHtml=rows.map(r=>{
    let row=r.trim().replace(/^\|\|/,'').replace(/\|\|\s*$/,'');
    const parts=row.split(/\|\|/); const cells=[];
    for(let seg of parts){
      if(seg===''&&cells.length){cells[cells.length-1].colspan=(cells[cells.length-1].colspan||1)+1; continue;}
      const cell={styles:{},colspan:1,rowspan:1,html:''};
      let m; while((m=seg.match(/^<([^>]+)>/))){ const tok=m[1].trim(); seg=seg.slice(m[0].length);
        if(/^tablewidth\s*=/.test(tok)){tOpt.width=tok.split('=')[1]; continue;}
        if(/^tablealign\s*=/.test(tok)){tOpt.align=tok.split('=')[1]; continue;}
        if(/^tablebordercolor\s*=/.test(tok)){tOpt.borderColor=tok.split('=')[1]; continue;}
        if(/^<-\d+>$/.test(tok)){cell.colspan=parseInt(tok.match(/<-(\d+)>/)[1]); continue;}
        if(/^<\|\d+>$/.test(tok)){cell.rowspan=parseInt(tok.match(/<\|(\d+)>/)[1]); continue;}
        if(/^<\(>$/.test(tok)){cell.styles['text-align']='left'; continue;}
        if(/^<:>$/.test(tok)){cell.styles['text-align']='center'; continue;}
        if(/^<\)>$/.test(tok)){cell.styles['text-align']='right'; continue;}
        if(/^width\s*=/.test(tok)){cell.styles.width=tok.split('=')[1]; continue;}
        if(/^height\s*=/.test(tok)){cell.styles.height=tok.split('=')[1]; continue;}
        if(/^bgcolor\s*=/.test(tok)){cell.styles['background-color']=tok.split('=')[1]; continue;}
        if(/^color\s*=/.test(tok)){cell.styles.color=tok.split('=')[1]; continue;}
        if(/^nopad$/i.test(tok)){cell.styles.padding='0'; continue;}
      }
      cell.html=inlineOnly(seg.trim()); cells.push(cell);
    }
    const td=cells.map(c=>{const attrs=[]; if(c.colspan>1) attrs.push(`colspan="${c.colspan}"`); if(c.rowspan>1) attrs.push(`rowspan="${c.rowspan}"`); const st=Object.keys(c.styles).length?` style="${Object.entries(c.styles).map(([k,v])=>`${k}:${escAttr(String(v))}`).join(';')}"`:''; return `<td ${attrs.join(' ')}${st}>${c.html}</td>`;}).join('');
    return `<tr>${td}</tr>`;
  }).join('');
  const tStyles={'margin':'1rem 0','border-collapse':'collapse'}; if(tOpt.width) tStyles.width=tOpt.width; if(tOpt.align==='center') tStyles.margin='1rem auto'; if(tOpt.align==='right') tStyles.margin='1rem 0 1rem auto';
  const tStyle=Object.entries(tStyles).map(([k,v])=>`${k}:${escAttr(String(v))}`).join(';');
  const border=tOpt.borderColor?` style="border:1px solid ${escAttr(tOpt.borderColor)};${tStyle}"`:` style="${tStyle}"`;
  return `<table border="1"${border}>${trHtml}</table>`;
}

// ---- 리스트 ----
function parseLists(text){
  const lines=text.split('\n'); const out=[]; let i=0;
  while(i<lines.length){ if(/^\s*([*]|\d+\.|[aAiI]\.)\s+/.test(lines[i])){ const chunk=[]; while(i<lines.length && /^\s*([*]|\d+\.|[aAiI]\.)\s+/.test(lines[i])) chunk.push(lines[i++]); out.push(renderList(chunk)); continue;} out.push(lines[i++]); }
  return out.join('\n');
}
function renderList(lines){ const root={level:0,children:[]}; const stack=[root];
  lines.forEach(line=>{ const m=line.match(/^(\s*)([*]|\d+\.|[aAiI]\.)\s+(.*)$/); if(!m) return; const level=Math.floor(m[1].length/1)+1; while(stack.length>1 && stack[stack.length-1].level>=level) stack.pop(); const node={level,ordered:/^(\d+\.|[aAiI]\.)$/.test(m[2]),children:[],html:parseInline(m[3])}; (stack[stack.length-1].children||=[]).push(node); stack.push(node); });
  const render=nodes=>!nodes?.length?'':{true:'ol',false:'ul'}[nodes[0].ordered]+'';
  const walk=nodes=>!nodes?.length?'':`<${nodes[0].ordered?'ol':'ul'} style="margin:0.25rem 0 0.25rem 1.25rem">${nodes.map(n=>`<li>${n.html}${walk(n.children)}</li>`).join('')}</${nodes[0].ordered?'ol':'ul'}>`;
  return walk(root.children||[]);
}

// ---- 인용/수평선 ----
function parseBlockquotes(text){
  const lines=text.split('\n'); const out=[]; let i=0; while(i<lines.length){ if(/^\s*>/.test(lines[i])){ const chunk=[]; while(i<lines.length && /^\s*>/.test(lines[i])){ chunk.push(lines[i].replace(/^\s*>\s?/,'')); i++; } out.push(`<blockquote style="border-left:3px solid #e5e7eb;margin:8px 0;padding:6px 10px">${parseInline(chunk.join('\n'))}</blockquote>`); continue;} out.push(lines[i++]); } return out.join('\n');
}
function parseHr(text){ return text.replace(/\n[-]{4,9}\n/g,'\n<hr>\n'); }

// ---- 링크 & 파일 ----
function parseLinksAndFiles(text){
  // 파일 먼저 보존
  text=text.replace(/\[\[파일:([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,file,opts)=>{
    let style=''; if(opts){ const m=opts.match(/width\s*=\s*([^|&\s]+)/); if(m) style=` style=\"max-width:100%;width:${escAttr(m[1])}\"`; }
    return `<img src="/files/${encodeURIComponent(file.trim())}" alt="${escAttr(file)}"${style}>`;
  });
  // 일반/분류/앵커
  return text.replace(/\[\[(.+?)\]\]/g,(m,body)=>{
    if(/^분류\s*:/.test(body)){ const name=body.split(':').slice(1).join(':').trim(); return `<span class="nm-category"><a href="/wiki/category/${encodeURIComponent(name)}">분류:${escAttr(name)}</a></span>`; }
    let target=body,label=body; const pipe=body.indexOf('|'); if(pipe!==-1){ target=body.slice(0,pipe); label=body.slice(pipe+1); }
    if(target.startsWith('#')){ const a=target.slice(1); return `<a href="#${encodeURIComponent(a)}">${escapeHtml(pipe===-1?'#'+a:label)}</a>`; }
    const [doc,anch]=target.split('#'); const href=`/wiki/v/${encodeURIComponent(doc)}${anch?'#'+encodeURIComponent(anch):''}`; return `<a href="${href}">${escapeHtml(label)}</a>`;
  });
}

// ---- 템플릿 ----
function parseTemplates(text){
  // include(Name, key=val, ...)
  text=text.replace(/\[include\((.*?)\)\]/g,(_,args)=>{ const {name,kv}=splitIncludeArgs(args); return templatePlaceholder(name,kv); });
  // {{틀:Name|a|b|key=val}}
  text=text.replace(/\{\{\s*틀\s*:\s*([^|}]+)(\|[^}]*)?\}\}/g,(_,name,raw)=>{ const kv=splitTemplateArgs(raw||''); return templatePlaceholder(`틀:${name.trim()}`,kv); });
  return text;
}
function splitIncludeArgs(s){ const parts=String(s).split(',').map(x=>x.trim()).filter(Boolean); const name=parts.shift()||''; const kv={}; parts.forEach((p,i)=>{ const e=p.indexOf('='); if(e!==-1) kv[p.slice(0,e).trim()]=p.slice(e+1).trim(); else kv[String(i+1)]=p; }); return {name,kv}; }
function splitTemplateArgs(raw){ const kv={}; if(!raw) return kv; const parts=raw.split('|'); for(let i=1;i<parts.length;i++){ const seg=parts[i].trim(); if(!seg) continue; const e=seg.indexOf('='); if(e!==-1) kv[seg.slice(0,e).trim()]=seg.slice(e+1).trim(); else kv[String(i)]=seg; } return kv; }
function templatePlaceholder(name,kv){ let data='{}'; try{data=escAttr(JSON.stringify(kv||{}));}catch{} return `<span class="nm-template" data-name="${escAttr(name)}" data-args='${data}'>[template:${escAttr(name)}]</span>`; }

// ---- 인라인 서식 ----
function parseInline(text){
  // [br]
  text=text.replace(/\[br\]/g,'<br>');
  // 굵/기/밑/취/위/아래
  text=text.replace(/'''([\s\S]*?)'''/g,'<strong>$1</strong>')
           .replace(/''([\s\S]*?)''/g,'<em>$1</em>')
           .replace(/__([^_][\s\S]*?)__/g,'<u data-u>$1</u>')
           .replace(/~~([\s\S]*?)~~|--([\s\S]*?)--/g,(_,a,b)=>`<del>${escapeHtml(a||b||'')}</del>`) 
           .replace(/\^\^([\s\S]*?)\^\^/g,'<sup>$1</sup>')
           .replace(/,,([\s\S]*?),,/g,'<sub>$1</sub>');
  // 크기 {{{+n text}}}
  text=text.replace(/\{\{\{\s*([+\-]?\d+)\s+([\s\S]*?)\}\}\}/g,(_,n,body)=>`<span style=\"font-size:${sizeToEm(parseInt(n,10))}em\">${parseInline(body)}</span>`);
  // 색상 {{{#color text}}}
  text=text.replace(/\{\{\{\s*#([^\s,}]+)(?:,[^\s}]+)?\s+([\s\S]*?)\}\}\}/g,(_,c,body)=>`<span data-color=\"${escAttr(c)}\">${parseInline(body)}</span>`);
  // 밑줄+색상 순서 정규화
  text=text.replace(/<u[^>]*data-u[^>]*><span\s+data-color=\"([^\"]+)\">([\s\S]*?)<\/span><\/u>/g,(_,c,x)=>`<span style=\"color:${escAttr(c)}\"><u>${x}</u></span>`)
           .replace(/<span\s+data-color=\"([^\"]+)\"><u>([\s\S]*?)<\/u><\/span>/g,(_,c,x)=>`<span style=\"color:${escAttr(c)}\"><u>${x}</u></span>`)
           .replace(/<span\s+data-color=\"([^\"]+)\">/g,(_,c)=>`<span style=\"color:${escAttr(c)}\">`)
           .replace(/<u[^>]*data-u[^>]*>/g,'<u>');
  // [각주] 자리표시자
  text=text.replace(/\[(각주|footnotes?)\]/gi,'__FOOT_PLACE__');
  return text;
}
function sizeToEm(n){ if(!isFinite(n)) return 1; return 1*Math.pow(1.1,n); }

// ---- 각주 수집 ----
function collectFootnotes(text){
  const map=new Map(); const list=[]; let idx=1;
  const html=text.replace(/\[\*([^\]\s]*)\s*([^\]]*)\]/g,(_,name,body)=>{ const key=(name||String(idx)).trim(); if(!map.has(key)){ map.set(key,idx); list.push({name:key,html:inlineOnly((body||'').trim())}); idx++; } const num=map.get(key); return `<sup id=\"fnref:${key}\"><a href=\"#fn:${key}\">[${num}]<\/a><\/sup>`; });
  return {html,list};
}
function renderFootnoteList(list){ if(!list.length) return ''; return `\n<section class=\"footnotes\"><ol>${list.map(fn=>`<li id=\"fn:${fn.name}\">${fn.html} <a href=\"#fnref:${fn.name}\" class=\"fn-back\">↩<\/a><\/li>`).join('')}</ol></section>`; }

// ---- inlineOnly ----
function inlineOnly(s){ if(!s) return ''; s=parseInline(s); return s; }
