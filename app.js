/* KrazyBuy workspace — v3.0
 * Hardened client: safer transport, resilient UI state, better accessibility,
 * real progress/error handling, and no fake capabilities.
 * Backend endpoints remain unchanged. AI is intentionally out of scope. */
/* KrazyBuy workspace — v2.0 
 * Real endpoints only. Every control performs a real action, opens a real 
 * workflow, or is explicitly disabled with a reason. 
 */ 
(() => { 
'use strict'; 
 
/* ============================================================ 
 * 1. Utilities 
 * ==========================================================*/ 
const $  = (s, r = document) => r.querySelector(s); 
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s)); 
 
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => 
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); 
 
const fmtSize = (n = 0) => { 
  const u = ['B','KB','MB','GB']; let i = 0, x = Number(n) || 0; 
  while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; } 
  return `${x.toFixed(i ? 1 : 0)} ${u[i]}`; 
}; 
const extOf = (n = '') => { 
  const s = String(n), i = s.lastIndexOf('.'); 
  return i > -1 ? s.slice(i + 1).toLowerCase() : ''; 
}; 
const KIND = { 
  pdf:'PDF', docx:'DOC', doc:'DOC', rtf:'DOC', txt:'TXT', 
  pptx:'PPT', ppt:'PPT', xlsx:'XLS', xls:'XLS', csv:'CSV', 
  png:'IMG', jpg:'IMG', jpeg:'IMG', webp:'IMG', bmp:'IMG', gif:'IMG', zip:'ZIP' 
}; 
const kindOf = n => KIND[extOf(n)] || 'FILE'; 
const relPathOf = f => f.relPath || f.webkitRelativePath || f.name; 
const debounce = (fn, ms = 140) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }; 
const timeAgo = ts => { 
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000)); 
  if (s < 60) return 'just now'; 
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`; 
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`; 
  return new Date(ts).toLocaleDateString(); 
}; 
const announce = msg => { const n = $('#sr'); if (n) n.textContent = msg; };

const CONFIG = Object.assign({
  apiBase: '/api',
  requestTimeoutMs: 120000,
  healthTimeoutMs: 7000,
  maxRecent: 60
}, window.KRAZYBUY_CONFIG || {});
const apiUrl = path => `${String(CONFIG.apiBase).replace(/\/$/, '')}${path}`; 
 
/* ============================================================ 
 * 2. Icons — one system, 1.7 stroke, currentColor 
 * ==========================================================*/ 
const P = { 
  home:'M3 10.5 12 3l9 7.5M5 9.8V20h14V9.8', 
  pdf:'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4', 
  ppt:'M4 4h16v11H4zM12 15v5M8 20h8M9 8h4a2 2 0 1 1 0 4H9zm0 0v4', 
  doc:'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 12h6M9 16h6', 
  xls:'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16', 
  image:'M3 5h18v14H3zM3 15l5-4 4 3 3-3 6 5', 
  zip:'M6 3h12v18H6zM11 3v4M13 7v4M11 11v4M13 15v3', 
  search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2', 
  upload:'M12 17V4m0 0-4 4m4-4 4 4M4 20h16', 
  download:'M12 4v13m0 0-4-4m4 4 4-4M4 20h16', 
  plus:'M12 5v14M5 12h14', 
  close:'M6 6l12 12M18 6 6 18', 
  check:'M4 12.5 9 17.5 20 6.5', 
  alert:'M12 4 2.5 20h19zM12 10v4M12 17.5v.5', 
  trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6', 
  rotate:'M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4', 
  copy:'M9 9h11v11H9zM15 5H4v11h3', 
  chevR:'M9 5l7 7-7 7',
  chevL:'M15 5l-7 7 7 7', 
  chevD:'M5 9l7 7 7-7', 
  menu:'M4 7h16M4 12h16M4 17h16', 
  star:'M12 4l2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.9-5 2.9 1-5.6-4-3.9 5.5-.8z', 
  clock:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4.5l3 2', 
  help:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM9.6 9.5a2.4 2.4 0 1 1 3.6 2.1c-.8.5-1.2 1-1.2 1.9M12 16.6v.4', 
  edit:'M4 20h4L19 9l-4-4L4 16zM14.5 5.5 18.5 9.5', 
  split:'M4 6h7M4 18h7M11 6v12M13 12h7M20 12l-3-3M20 12l-3 3', 
  lock:'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3', 
  compress:'M8 4v4H4M16 4v4h4M8 20v-4H4M16 20v-4h4', 
  swap:'M4 8h13l-3-3M20 16H7l3 3', 
  grid:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', 
  shield:'M12 3 5 6v6c0 4 3 7.4 7 9 4-1.6 7-5 7-9V6z', 
  folder:'M3 6h6l2 2h10v12H3z', 
  refresh:'M4 12a8 8 0 0 1 13.6-5.7M20 12a8 8 0 0 1-13.6 5.7M18 3v4h-4M6 21v-4h4', 
  loader:'M12 4v4m0 8v4M4 12h4m8 0h4M6.3 6.3l2.8 2.8m5.8 5.8 2.8 2.8m0-11.4-2.8 2.8m-5.8 5.8-2.8 2.8' 
}; 
/* ============================================================
 * Icon renderer — strict and debuggable
 * ==========================================================*/

/* Strict icon renderer: unknown icon names never fall back to the Help/question icon. */
const ICON_FALLBACK = 'M4 7h16M4 12h16M4 17h16';

const resolveIconPath = (name) => {
  const key = String(name ?? '').trim();
  if (Object.prototype.hasOwnProperty.call(P, key)) return P[key];
  console.error('[KrazyBuy] Unknown icon:', { requested: name, available: Object.keys(P) });
  return ICON_FALLBACK;
};

const ico = (name, cls = '') => {
  const path = resolveIconPath(name);
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="${esc(cls)}" aria-hidden="true" focusable="false" data-kb-icon="${esc(name)}"><path d="${path}"></path></svg>`;
};

function validateToolIcons() {
  const missing = TOOLS.filter(tool => tool?.icon && !Object.prototype.hasOwnProperty.call(P, tool.icon))
    .map(tool => ({ id: tool.id, icon: tool.icon }));
  if (missing.length) console.error('[KrazyBuy] Icon validation failed:', missing);
  else console.info('[KrazyBuy] Icon validation passed:', TOOLS.length, 'tools checked');
  return missing;
}

/* ============================================================ 
 * 3. Persistence (local only — never claimed as server storage) 
 * ==========================================================*/ 
const LS = { 
  get(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }, 
  set(k, v)  { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }, 
  del(k)     { try { localStorage.removeItem(k); } catch {} } 
}; 
const K = { recent:'kb.recent.v2', fav:'kb.favorites.v2', last:'kb.lastTool.v2', used:'kb.usage.v2', collapsed:'kb.collapsed.v2' }; 
 
const recent    = () => LS.get(K.recent, []); 
const favorites = () => LS.get(K.fav, []); 
const usage     = () => LS.get(K.used, {}); 
 
function pushRecent(files, toolId) { 
  const list = recent(); 
  for (const f of files) { 
    list.unshift({ id: `${f.name}:${f.size}:${f.lastModified}`, name: f.name, size: f.size, 
                   type: kindOf(f.name), path: relPathOf(f), workflow: toolId, when: Date.now() }); 
  } 
  const seen = new Set(); 
  LS.set(K.recent, list.filter(r => !seen.has(r.id) && seen.add(r.id)).slice(0, CONFIG.maxRecent)); 
} 
function bumpUsage(id) { const u = usage(); u[id] = (u[id] || 0) + 1; LS.set(K.used, u); } 
function toggleFavorite(id) { 
  const f = favorites(); const i = f.indexOf(id); 
  i > -1 ? f.splice(i, 1) : f.unshift(id); 
  LS.set(K.fav, f.slice(0, 12)); 
  return i === -1; 
} 
 
/* ============================================================ 
 * 4. Global state — per-workflow file buckets (BUG 1 & 2) 
 * ==========================================================*/ 
const state = { 
  toolId: null, 
  buckets: new Map(),        // toolId -> File[] 
  handoff: null,             // { fromId, files } — reuse is always explicit 
  server: { online: false, version: '', capabilities: null }, 
  scratch: {},               // per-tool editor working data, reset on navigation 
  inflight: null 
}; 
const bucket   = id => state.buckets.get(id) || []; 
const setBucket = (id, files) => { state.buckets.set(id, files); }; 
 
/* ============================================================ 
 * 5. Tool registry — single source of truth for nav, cards, palette 
 * ==========================================================*/ 
const IMG = ['jpg','jpeg','png','webp','bmp','gif']; 
const T = (o) => ({ multiple:false, directory:false, min:1, max:60, maxMB:200, ...o }); 
 
const TOOLS = [ 
  T({ id:'dashboard', name:'Dashboard', group:'Home', icon:'home', desc:'Overview, uploads and recent work.', nav:true, card:false, accept:null }), 
 
  T({ id:'pdf-organize', name:'Organize PDF', group:'PDF', icon:'grid', accept:['pdf'], family:'pdf', mode:'organize', 
      desc:'Select, delete, rotate and reorder real PDF pages.', keywords:'pages reorder rotate delete organize arrange' }), 
  T({ id:'pdf-edit', name:'Edit PDF', group:'PDF', icon:'edit', accept:['pdf'], family:'pdf', mode:'edit', 
      desc:'Add text, watermark and page numbers to a PDF.', keywords:'text watermark annotate page numbers' }), 
  T({ id:'pdf-merge', name:'Merge PDF', group:'PDF', icon:'copy', accept:['pdf'], multiple:true, min:2, family:'pdf', mode:'merge', 
      desc:'Combine several PDFs into one, in your chosen order.', keywords:'merge combine join append' }), 
  T({ id:'pdf-split', name:'Split PDF', group:'PDF', icon:'split', accept:['pdf'], family:'pdf', mode:'split', 
      desc:'Extract selected pages or page ranges.', keywords:'split extract range separate' }), 
  T({ id:'pdf-compress', name:'Compress PDF', group:'PDF', icon:'compress', accept:['pdf'], family:'pdf', mode:'compress', 
      desc:'Rewrite the PDF with compact object streams.', keywords:'compress optimize shrink smaller size' }), 
  T({ id:'pdf-protect', name:'Protect PDF', group:'PDF', icon:'lock', accept:['pdf'], family:'pdf', mode:'protect', 
      desc:'Add a password when qpdf is installed on the server.', requires:'qpdf', keywords:'password encrypt protect secure' }), 
  T({ id:'pdf-image', name:'PDF → Image', group:'PDF', icon:'image', accept:['pdf'], family:'pdf', mode:'to-image', 
      desc:'Render the first page as PNG or JPG.', requires:'pdftoppm', keywords:'render png jpg export picture' }), 
  T({ id:'images-pdf', name:'Images → PDF', group:'PDF', icon:'pdf', accept:IMG, multiple:true, family:'pdf', mode:'images-pdf', 
      desc:'Turn image files into a single PDF document.', keywords:'images pictures photos pdf merge' }), 
 
  T({ id:'ppt-edit', name:'Edit PPTX', group:'PowerPoint', icon:'ppt', accept:['pptx'], family:'ppt', mode:'edit', 
      desc:'Edit slide text, delete, duplicate and reorder slides.', keywords:'presentation slides text edit deck' }), 
  T({ id:'ppt-create', name:'Create PPTX', group:'PowerPoint', icon:'plus', accept:null, family:'ppt', mode:'create', 
      desc:'Generate a new presentation from a title and body text.', keywords:'new presentation create deck slides' }), 
  T({ id:'ppt-pdf', name:'PPTX → PDF', group:'PowerPoint', icon:'pdf', accept:['pptx','ppt'], family:'ppt', mode:'to-pdf', 
      desc:'Convert a deck with LibreOffice on the server.', requires:'libreoffice', keywords:'presentation pdf convert' }), 
  T({ id:'ppt-images', name:'PPTX → Images', group:'PowerPoint', icon:'image', accept:['pptx','ppt'], family:'ppt', mode:'to-images', 
      desc:'Render slides and download them as a ZIP.', requires:'libreoffice', keywords:'slides images png render zip' }), 
  T({ id:'images-ppt', name:'Images → PPTX', group:'PowerPoint', icon:'ppt', accept:IMG, multiple:true, family:'ppt', mode:'images-to-pptx', 
      desc:'One slide per image, in the order you choose.', keywords:'images presentation slideshow deck' }), 
  T({ id:'pdf-ppt', name:'PDF → PPTX', group:'PowerPoint', icon:'ppt', accept:['pdf'], family:'ppt', mode:'pdf-to-pptx', 
      desc:'Build slides from rendered PDF pages.', requires:'pdftoppm', keywords:'pdf presentation convert slides' }), 
 
  T({ id:'doc-edit', name:'Edit DOCX', group:'Documents', icon:'doc', accept:['docx'], family:'doc', mode:'edit', 
      desc:'Load document text, edit or find/replace, then save.', keywords:'word document edit text replace' }), 
  T({ id:'doc-create', name:'Create DOCX', group:'Documents', icon:'plus', accept:null, family:'doc', mode:'create', 
      desc:'Write a document and export DOCX or PDF.', keywords:'new word document write create' }), 
  T({ id:'doc-pdf', name:'DOCX → PDF', group:'Documents', icon:'pdf', accept:['docx'], family:'doc', mode:'to-pdf', 
      desc:'Convert a Word document to PDF.', keywords:'word pdf convert export' }), 
  T({ id:'doc-txt', name:'DOCX → TXT', group:'Documents', icon:'doc', accept:['docx'], family:'doc', mode:'to-txt', 
      desc:'Export the readable text of a document.', keywords:'text plain export txt' }), 
  T({ id:'pdf-docx', name:'PDF → DOCX', group:'Documents', icon:'doc', accept:['pdf'], family:'doc', mode:'pdf-to-docx', 
      desc:'Extract PDF text into a Word document.', keywords:'pdf word convert editable' }), 
 
  T({ id:'xlsx-edit', name:'Edit XLSX', group:'Spreadsheets', icon:'xls', accept:['xlsx'], family:'xlsx', mode:'edit', 
      desc:'Edit cells in a live grid and save the workbook.', keywords:'excel spreadsheet cells grid sheet edit' }), 
  T({ id:'csv-xlsx', name:'CSV → XLSX', group:'Spreadsheets', icon:'swap', accept:['csv'], family:'xlsx', mode:'csv-to-xlsx', 
      desc:'Convert CSV data into a real workbook.', keywords:'csv excel workbook convert' }), 
  T({ id:'xlsx-csv', name:'XLSX → CSV', group:'Spreadsheets', icon:'swap', accept:['xlsx'], family:'xlsx', mode:'xlsx-to-csv', 
      desc:'Export the first worksheet as CSV.', keywords:'excel csv export data' }), 
  T({ id:'xlsx-pdf', name:'XLSX → PDF', group:'Spreadsheets', icon:'pdf', accept:['xlsx'], family:'xlsx', mode:'to-pdf', 
      desc:'Create a readable PDF report from workbook data.', keywords:'excel pdf report print' }), 
 
  T({ id:'img-edit', name:'Image Editor', group:'Images & Files', icon:'image', accept:IMG, family:'image', mode:'edit', 
      desc:'Resize, rotate, flip, crop and overlay text.', keywords:'resize rotate flip crop watermark text image' }), 
  T({ id:'img-convert', name:'Convert Image', group:'Images & Files', icon:'swap', accept:IMG, family:'image', mode:'convert', 
      desc:'Convert between JPG, PNG and WebP.', keywords:'convert format jpg png webp image' }), 
  T({ id:'img-compress', name:'Compress Image', group:'Images & Files', icon:'compress', accept:IMG, family:'image', mode:'compress', 
      desc:'Re-encode with quality control to reduce size.', keywords:'compress optimize quality smaller image' }), 
  T({ id:'zip-create', name:'Files → ZIP', group:'Images & Files', icon:'zip', accept:null, multiple:true, directory:true, max:100, 
      family:'zip', desc:'Archive files or a whole folder, structure preserved.', keywords:'zip archive folder compress bundle' }), 
  T({ id:'recent', name:'Recent Files', group:'Images & Files', icon:'clock', accept:null, family:'recent', card:false, 
      desc:'Files you have opened in this browser.', keywords:'recent history files' }) 
]; 
const byId = id => TOOLS.find(t => t.id === id); 
const GROUPS = ['PDF','PowerPoint','Documents','Spreadsheets','Images & Files'];
validateToolIcons(); 
 
/* Endpoint manifest — used by tests/regression.mjs for the API diff */ 
const ENDPOINTS = [ 
  '/health', 
  '/pdf/info','/pdf/edit','/pdf/merge','/pdf/split','/pdf/compress','/pdf/protect','/pdf/to-image','/pdf/images-to-pdf', 
  '/ppt/inspect','/ppt/edit','/ppt/create','/ppt/to-pdf','/ppt/to-images','/ppt/images-to-pptx','/ppt/pdf-to-pptx', 
  '/documents/read','/documents/edit','/documents/create','/documents/to-pdf','/documents/to-txt','/documents/text-to-pdf','/documents/pdf-to-docx', 
  '/xlsx/inspect','/xlsx/edit','/xlsx/csv-to-xlsx','/xlsx/xlsx-to-csv','/xlsx/to-pdf', 
  '/image/edit','/image/convert','/image/compress', 
  '/archive/create' 
]; 
 
/* ============================================================ 
 * 6. Transport — XHR for genuine upload progress + honest errors 
 * ==========================================================*/ 
const HUMAN = [ 
  [/password|encrypt/i,          'This PDF requires a password before it can be processed.'], 
  [/libreoffice|soffice/i,       'This conversion needs LibreOffice installed on the KrazyBuy server.'], 
  [/qpdf/i,                      'Password protection needs qpdf installed on the KrazyBuy server.'], 
  [/pdftoppm|poppler/i,          'PDF rendering needs Poppler (pdftoppm) installed on the KrazyBuy server.'], 
  [/corrupt|invalid pdf|malformed/i, 'This PDF appears to be corrupted or unreadable.'], 
  [/too large|limit|413/i,       'This file exceeds the configured upload limit.'], 
  [/unsupported|mime|file type/i,'That file type is not supported by this workflow.'] 
]; 
function humanize(msg = '') { 
  for (const [re, out] of HUMAN) if (re.test(msg)) return out; 
  const clean = String(msg).split('\n')[0].slice(0, 180); 
  return clean && !/^\s*<|at\s.+:\d+:\d+/.test(clean) ? clean : 'The server could not complete this operation.'; 
} 
 
function request({ path, body, expect = 'blob', onProgress, timeout = CONFIG.requestTimeoutMs }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (fn, value) => { if (!settled) { settled = true; fn(value); } };
    state.inflight = xhr;
    xhr.open('POST', apiUrl(path), true);
    xhr.responseType = 'blob';
    xhr.timeout = timeout;
    xhr.setRequestHeader('X-KrazyBuy-Client', 'workspace-v3');
    xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(Math.min(1, e.loaded / e.total)); };
    xhr.onerror = () => finish(reject, new Error('KrazyBuy cannot reach the local processing server. Check that the server is running.'));
    xhr.onabort = () => finish(reject, Object.assign(new Error('Cancelled.'), { cancelled: true }));
    xhr.ontimeout = () => finish(reject, new Error('The server took too long to respond. Try a smaller file or a simpler operation.'));
    xhr.onload = async () => {
      const blob = xhr.response instanceof Blob ? xhr.response : new Blob([xhr.response || '']);
      if (xhr.status < 200 || xhr.status >= 300) {
        let msg = `Request failed (${xhr.status})`;
        try {
          const text = await blob.text();
          try { const j = JSON.parse(text); msg = j.error || j.message || msg; }
          catch { if (text.trim()) msg = text.trim(); }
        } catch {}
        return finish(reject, new Error(humanize(msg)));
      }
      if (expect === 'json') {
        try { finish(resolve, JSON.parse(await blob.text())); }
        catch { finish(reject, new Error('The server returned an unreadable JSON response.')); }
        return;
      }
      const cd = xhr.getResponseHeader('content-disposition') || '';
      const utf = cd.match(/filename\*=UTF-8''([^;]+)/i);
      const normal = cd.match(/filename=\"?([^\";]+)\"?/i);
      let filename = '';
      try { filename = utf ? decodeURIComponent(utf[1]) : (normal ? normal[1] : ''); }
      catch { filename = normal?.[1] || ''; }
      finish(resolve, { blob, filename });
    };
    try { xhr.send(body ?? null); }
    catch (err) { finish(reject, err instanceof Error ? err : new Error(String(err))); }
  }).finally(() => { state.inflight = null; });
}

function saveBlob(blob, name) { 
  const url = URL.createObjectURL(blob); 
  const a = Object.assign(document.createElement('a'), { href: url, download: name }); 
  document.body.appendChild(a); a.click(); a.remove(); 
  setTimeout(() => URL.revokeObjectURL(url), 8000); 
} 
 
/* ============================================================ 
 * 7. Feedback: toast, phase machine, modal, confirm 
 * ==========================================================*/ 
let toastTimer; 
function toast(msg, kind = 'ok') { 
  const n = $('#toast'); 
  n.dataset.kind = kind; 
  n.innerHTML = `${ico(kind === 'error' ? 'alert' : kind === 'info' ? 'help' : 'check')}<span>${esc(msg)}</span>`; 
  requestAnimationFrame(() => n.classList.add('show')); 
  clearTimeout(toastTimer); 
  toastTimer = setTimeout(() => n.classList.remove('show'), 3400); 
  announce(msg); 
} 
 
/* Explicit lifecycle: ready → uploading → processing → finalizing → ok | error */ 
function phase(node, opts) { 
  if (!node) return; 
  const { state: st = 'busy', label = '', pct = null, actions = [] } = opts; 
  node.hidden = false; 
  node.dataset.state = st; 
  const icon = st === 'ok' ? 'check' : st === 'error' ? 'alert' : 'loader'; 
  const spin = st === 'busy' ? 'spin' : ''; 
  node.innerHTML = ` 
    <div class="phase-top">${ico(icon, spin)}<span>${esc(label)}</span></div> 
    ${st === 'busy' ? `<div class="phase-bar ${pct === null ? 'indeterminate' : ''}"><i style="width:${Math.round((pct || 0) * 100)}%"></i></div>` : ''} 
    ${actions.length ? `<div class="phase-actions">${actions.map(a => 
        `<button class="btn ${a.variant || 'btn--soft'} btn--sm" type="button" data-phase-act="${esc(a.id)}">${esc(a.label)}</button>`).join('')}</div>` : ''}`; 
  node._acts = Object.fromEntries(actions.map(a => [a.id, a.run])); 
  announce(label); 
} 
 
function closeModal() { const l = $('#layer-modal'); if (!l) return; l.hidden = true; l.innerHTML = ''; } 
function openModal({ title, bodyHTML = '', actions = [], onMount }) { 
  const layer = $('#layer-modal'); 
  layer.hidden = false; 
  layer.innerHTML = ` 
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"> 
      <h2>${esc(title)}</h2>${bodyHTML} 
      <div class="modal-actions">${actions.map((a, i) => 
        `<button class="btn ${a.variant || ''}" type="button" data-modal-act="${i}">${esc(a.label)}</button>`).join('')}</div> 
    </div>`; 
  const box = $('.modal', layer); 
  actions.forEach((a, i) => $(`[data-modal-act="${i}"]`, layer) 
    .addEventListener('click', () => { const keep = a.run?.(box); if (!keep) closeModal(); })); 
  layer.onclick = e => { if (e.target === layer) closeModal(); }; 
  onMount?.(box); 
  (box.querySelector('input,textarea,button') || box).focus(); 
} 
const confirmDialog = ({ title, message, confirmLabel = 'Delete', danger = true }) => 
  new Promise(res => openModal({ 
    title, bodyHTML: `<p>${esc(message)}</p>`, 
    actions: [{ label: 'Cancel', run: () => res(false) }, 
              { label: confirmLabel, variant: danger ? 'btn--danger' : 'btn--primary', run: () => res(true) }] 
  })); 
 
/* ============================================================ 
 * 8. Validation (BUG 5) + folder-aware picking (BUG 6, 7) 
 * ==========================================================*/ 
function validateFiles(list, tool) { 
  const accepted = [], rejected = []; 
  const allow = tool.accept; 
  for (const f of list) { 
    const e = extOf(f.name); 
    if (allow && !allow.includes(e))    { rejected.push({ name: f.name, why: `${e ? '.' + e : 'This file'} is not accepted here` }); continue; } 
    if (f.size === 0)                    { rejected.push({ name: f.name, why: 'File is empty' }); continue; } 
    if (f.size > tool.maxMB * 1024 ** 2) { rejected.push({ name: f.name, why: `Larger than ${tool.maxMB} MB` }); continue; } 
    accepted.push(f); 
  } 
  return { accepted, rejected }; 
} 
function acceptLabel(tool) { 
  if (!tool.accept) return 'Any file type'; 
  return tool.accept.map(e => '.' + e).join(' · '); 
} 
 
let sharedInput; 
function pick({ accept, multiple, directory }, cb) { 
  sharedInput?.remove(); 
  sharedInput = document.createElement('input'); 
  sharedInput.type = 'file'; 
  sharedInput.style.cssText = 'position:fixed;left:-9999px'; 
  if (accept) sharedInput.accept = accept.map(e => '.' + e).join(','); 
  if (multiple || directory) sharedInput.multiple = true; 
  if (directory) { sharedInput.webkitdirectory = true; sharedInput.setAttribute('webkitdirectory',''); } 
  sharedInput.addEventListener('change', () => { cb(Array.from(sharedInput.files || [])); sharedInput.remove(); sharedInput = null; }, { once: true }); 
  document.body.appendChild(sharedInput); 
  sharedInput.click(); 
} 
 
function walkEntry(entry, prefix, out) { 
  return new Promise(done => { 
    if (entry.isFile) { 
      entry.file(f => { 
        try { Object.defineProperty(f, 'relPath', { value: prefix + entry.name }); } catch {} 
        out.push(f); done(); 
      }, () => done()); 
    } else if (entry.isDirectory) { 
      const reader = entry.createReader(), all = []; 
      const next = () => reader.readEntries(async batch => { 
        if (!batch.length) { for (const e of all) await walkEntry(e, `${prefix}${entry.name}/`, out); return done(); } 
        all.push(...batch); next(); 
      }, () => done()); 
      next(); 
    } else done(); 
  }); 
} 
async function filesFromDrop(dt) { 
  const entries = Array.from(dt.items || []).map(i => i.webkitGetAsEntry?.()).filter(Boolean); 
  if (!entries.length) return Array.from(dt.files || []); 
  const out = []; 
  for (const e of entries) await walkEntry(e, '', out); 
  return out.length ? out : Array.from(dt.files || []); 
} 
 
/* ============================================================ 
 * 9. Reusable render blocks 
 * ==========================================================*/ 
function renderUploadZone(tool) { 
  const t = tool; 
  return ` 
  <div class="dropzone" data-dz tabindex="0" role="button" 
       aria-label="Add files for ${esc(t.name)}. Press Enter to browse."> 
    <div class="dz-orb">${ico('upload')}</div> 
    <div class="dz-title">${t.multiple ? 'Drop your files here' : 'Drop your file here'}</div> 
    <div class="dz-hint">${t.directory ? 'Files or a whole folder — structure is preserved.' : 'Drag and drop, or browse from your device.'}</div> 
    <div class="dz-actions"> 
      <button class="btn btn--primary" type="button" data-act="browse">${ico('upload')}Browse files</button> 
      ${t.directory ? `<button class="btn" type="button" data-act="folder">${ico('folder')}Choose folder</button>` : ''} 
    </div> 
    <div class="dz-meta">${esc(acceptLabel(t))}${t.multiple ? ` · up to ${t.max} files` : ' · single file'} · max ${t.maxMB} MB each</div> 
  </div>`; 
} 
 
function renderFileList(tool) { 
  const files = bucket(tool.id); 
  if (!files.length) return '<div class="note">Nothing selected yet.</div>'; 
  const rows = files.map((f, i) => ` 
    <div class="file-row" ${tool.multiple ? 'draggable="true"' : ''} data-idx="${i}"> 
      <div class="thumb" data-thumb="${i}">${kindOf(f.name)}</div> 
      <div class="file-meta"> 
        <b title="${esc(relPathOf(f))}">${esc(f.name)}</b> 
        <span>${esc(kindOf(f.name))} · ${fmtSize(f.size)}${relPathOf(f) !== f.name ? ` · ${esc(relPathOf(f).split('/').slice(0, -1).join('/'))}/` : ''}</span> 
      </div> 
      <button class="icon-btn icon-btn--bare" type="button" data-act="rmfile" data-idx="${i}" 
              data-tip="Remove file" aria-label="Remove ${esc(f.name)}">${ico('close')}</button> 
    </div>`).join(''); 
  const totals = files.reduce((a, f) => a + f.size, 0); 
  const folders = new Set(files.map(f => relPathOf(f)).filter(p => p.includes('/')).map(p => p.split('/')[0])); 
  return ` 
    <div class="file-list">${rows}</div> 
    <div class="btn-row" style="margin-top:12px;align-items:center"> 
      <span class="pill">${files.length} file${files.length === 1 ? '' : 's'} · ${fmtSize(totals)}${folders.size ? ` · ${folders.size} folder${folders.size === 1 ? '' : 's'}` : ''}</span> 
      ${tool.multiple ? `<button class="btn btn--sm" type="button" data-act="addmore">${ico('plus')}Add more</button>` : ''} 
      <button class="btn btn--sm" type="button" data-act="clearfiles">${ico('trash')}Clear all</button> 
      ${tool.multiple ? '<span class="dz-meta">Drag rows to change order.</span>' : ''} 
    </div>`; 
} 
 
function renderEmptyState({ icon = 'upload', title, body, actionLabel, actionAttr = 'data-act="browse"' }) { 
  return `<div class="empty"> 
    <div class="empty-orb">${ico(icon)}</div><h3>${esc(title)}</h3><p>${esc(body)}</p> 
    ${actionLabel ? `<button class="btn btn--primary" type="button" ${actionAttr}>${esc(actionLabel)}</button>` : ''} 
  </div>`; 
} 
 
function renderAside(tool) { 
  const req = tool.requires 
    ? `<div class="panel"><span class="pill pill--warn">${ico('alert')}Needs ${esc(tool.requires)}</span> 
         <p style="margin-top:8px">This workflow calls a native tool on the server. If it is missing, KrazyBuy will tell you instead of failing silently.</p></div>` : ''; 
  return `<aside class="aside"> 
    ${req} 
    <div class="panel"> 
      <span class="pill pill--ok">${ico('shield')}Local processing</span> 
      <p style="margin-top:8px">Your files are processed by your local KrazyBuy server. Nothing is stored in the cloud and temporary files are cleaned up after each run.</p> 
    </div> 
    <div class="panel"> 
      <h3>How this works</h3> 
      <ul> 
        <li>Add ${esc(acceptLabel(tool))}.</li> 
        <li>Set the options you need.</li> 
        <li>Run it — the finished file downloads to your device.</li> 
      </ul> 
    </div> 
    <div class="panel"> 
      <h3>Shortcuts</h3> 
      <p><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> command palette · <kbd>Esc</kbd> close · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> run</p> 
    </div> 
  </aside>`; 
} 
 
function renderReuseBar(tool) { 
  const h = state.handoff; 
  if (!h || h.fromId === tool.id || bucket(tool.id).length) return ''; 
  const { accepted } = validateFiles(h.files, tool); 
  if (!accepted.length) return ''; 
  return `<div class="reuse-bar">${ico('refresh')} 
    <span><b>${accepted.length} file${accepted.length === 1 ? '' : 's'}</b> from <b>${esc(byId(h.fromId)?.name || 'a previous tool')}</b> can be reused here.</span> 
    <button class="btn btn--sm btn--soft" type="button" data-act="reuse">Use them</button> 
    <button class="btn btn--sm btn--ghost" type="button" data-act="dismiss-reuse">Dismiss</button> 
  </div>`; 
} 
 
/* ============================================================ 
 * 10. Shell 
 * ==========================================================*/ 
function navItem(t, { fav = false, mobile = false } = {}) { 
  return `<button class="nav-item" type="button" data-nav="${t.id}" ${mobile ? '' : `data-tip-below data-tip="${esc(t.name)}"`}> 
    ${ico(t.icon)}<span>${esc(mobile && t.short ? t.short : t.name)}</span> 
    ${fav ? `<span class="nav-fav" data-on="1">${ico('star')}</span>` : ''} 
  </button>`; 
} 
 
function renderShell() { 
  const favs = favorites().map(byId).filter(Boolean); 
  const groups = GROUPS.map(g => ` 
    <div class="nav-label">${esc(g.toUpperCase())}</div> 
    ${TOOLS.filter(t => t.group === g).map(t => navItem(t)).join('')}`).join(''); 
 
  $('#app').className = ''; 
  $('#app').innerHTML = ` 
  <div class="shell"> 
    <aside class="sidebar" aria-label="Primary"> 
      <div class="brand"> 
        <div class="brand-mark">K</div> 
        <div class="brand-copy"><strong>KrazyBuy</strong><span>Document Workspace</span></div> 
      </div> 
      <nav class="nav-scroll"> 
        <div class="nav-label">HOME</div>${navItem(byId('dashboard'))} 
        ${favs.length ? `<div class="nav-label">FAVORITES</div>${favs.map(t => navItem(t, { fav: true })).join('')}` : ''} 
        ${groups} 
      </nav> 
      <div class="side-foot"> 
        <div class="dot-row" id="serverDot"><span class="dot"></span><b>Checking server…</b></div> 
        <small>Processed on your machine. No cloud storage, no persistence.</small> 
      </div> 
    </aside> 
 
    <div class="main"> 
      <header class="topbar">
        <div class="mobile-brand"><div class="brand-mark">K</div>KrazyBuy</div>
        <div class="topbar-spacer"></div>
        <div class="top-actions">
          <button class="icon-btn" type="button" data-act="palette" data-tip-below data-tip="Search tools" aria-label="Search tools">${ico('search')}</button>
          <button class="icon-btn desktop-only" type="button" data-act="collapse" data-tip-below data-tip="Collapse sidebar" aria-label="Collapse sidebar">${ico('menu')}</button>
          <button class="icon-btn" type="button" data-act="help" data-tip-below data-tip="Help & shortcuts" aria-label="Help and shortcuts">${ico('help')}</button>
          <div class="avatar" title="Local session">ME</div>
        </div>
      </header> 
      <main class="content" id="workspace" tabindex="-1"></main> 
    </div> 
 
    <nav class="mobile-nav" aria-label="Sections"> 
      ${navItem({ ...byId('dashboard'), short: 'Home' }, { mobile: true })} 
      ${navItem({ ...byId('pdf-organize'), short: 'PDF', icon: 'pdf' }, { mobile: true })} 
      ${navItem({ ...byId('ppt-edit'), short: 'PPT' }, { mobile: true })} 
      ${navItem({ ...byId('doc-edit'), short: 'Docs' }, { mobile: true })} 
      <button class="nav-item" type="button" data-act="drawer"><span>${ico('menu')}</span><span>More</span></button> 
    </nav> 
  </div>`; 
 
  if (LS.get(K.collapsed, false)) document.body.classList.add('collapsed'); 
  probeServer(); 
} 
 
function openDrawer() { 
  if ($('#drawer')) return closeDrawer(); 
  const extra = ['xlsx-edit','img-edit','zip-create','csv-xlsx','img-convert','recent'].map(byId).filter(Boolean); 
  const el = document.createElement('div'); 
  el.id = 'drawer'; el.className = 'drawer'; el.setAttribute('role','dialog'); 
  el.innerHTML = ` 
    <div style="display:flex;align-items:center;justify-content:space-between"> 
      <h2 style="font-size:17px">More tools</h2> 
      <button class="icon-btn icon-btn--bare" type="button" data-act="drawer-close" aria-label="Close">${ico('close')}</button> 
    </div> 
    <div class="drawer-grid">${extra.map(t => 
      `<button class="btn btn--block" type="button" data-nav="${t.id}">${ico(t.icon)}${esc(t.name)}</button>`).join('')}</div> 
    <div class="btn-row" style="margin-top:10px"> 
      <button class="btn btn--soft btn--block" type="button" data-act="palette">${ico('search')}Search everything</button> 
    </div>`; 
  document.body.appendChild(el); 
} 
const closeDrawer = () => $('#drawer')?.remove(); 
 
async function probeServer() {
  const dot = $('#serverDot');
  if (!dot) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.healthTimeoutMs);
  try {
    const r = await fetch(apiUrl('/health'), { cache: 'no-store', signal: controller.signal });
    const j = await r.json().catch(() => ({}));
    state.server = { online: r.ok, version: j.version || '', capabilities: j.capabilities || j.tools || null };
    dot.classList.toggle('off', !r.ok);
    dot.innerHTML = `<span class="dot"></span><b>${r.ok ? `Server online${j.version ? ' · ' + esc(j.version) : ''}` : 'Server unavailable'}</b>`;
  } catch {
    state.server = { online: false, version: '', capabilities: null };
    dot.classList.add('off');
    dot.innerHTML = `<span class="dot"></span><b>Server unavailable</b>`;
  } finally { clearTimeout(timer); }
}
/* null = unknown (never disable on a guess); false = confirmed missing */ 
function capabilityOf(tool) { 
  const caps = state.server.capabilities; 
  if (!tool.requires || !caps) return null; 
  const v = caps[tool.requires]; 
  return typeof v === 'boolean' ? v : v == null ? null : Boolean(v); 
} 
 
/* ============================================================ 
 * 11. Command palette (BUG 4) 
 * ==========================================================*/ 
let palette = { open: false, index: 0, results: [] }; 
 
function paletteResults(q) { 
  const term = q.trim().toLowerCase(); 
  const score = t => { 
    const hay = `${t.name} ${t.desc} ${t.keywords || ''} ${t.group}`.toLowerCase(); 
    if (!term) return 0; 
    if (t.name.toLowerCase().startsWith(term)) return 100; 
    if (t.name.toLowerCase().includes(term)) return 70; 
    if (hay.includes(term)) return 40; 
    return -1; 
  }; 
  const tools = TOOLS.filter(t => t.id !== 'dashboard'); 
  const out = []; 
 
  if (!term) { 
    const u = usage(); 
    const top = tools.filter(t => u[t.id]).sort((a, b) => u[b.id] - u[a.id]).slice(0, 4); 
    if (top.length) out.push({ group: 'MOST USED', items: top.map(t => ({ kind:'tool', tool:t })) }); 
    const favs = favorites().map(byId).filter(Boolean); 
    if (favs.length) out.push({ group: 'FAVORITES', items: favs.map(t => ({ kind:'tool', tool:t })) }); 
    for (const g of GROUPS) 
      out.push({ group: g.toUpperCase(), items: tools.filter(t => t.group === g).map(t => ({ kind:'tool', tool:t })) }); 
    return out; 
  } 
 
  const matched = tools.map(t => [score(t), t]).filter(([s]) => s >= 0).sort((a, b) => b[0] - a[0]).map(([, t]) => t); 
  for (const g of GROUPS) { 
    const items = matched.filter(t => t.group === g); 
    if (items.length) out.push({ group: g.toUpperCase(), items: items.map(t => ({ kind:'tool', tool:t })) }); 
  } 
  const files = recent().filter(r => r.name.toLowerCase().includes(term)).slice(0, 4); 
  if (files.length) out.push({ group: 'RECENT FILES', items: files.map(r => ({ kind:'recent', rec:r })) }); 
  return out; 
} 
 
function drawPalette(q = '') { 
  const groups = paletteResults(q); 
  palette.results = groups.flatMap(g => g.items); 
  if (palette.index >= palette.results.length) palette.index = 0; 
  let i = -1; 
  $('#paletteList').innerHTML = groups.length ? groups.map(g => ` 
    <div class="palette-group">${esc(g.group)}</div> 
    ${g.items.map(item => { i++; return item.kind === 'tool' 
      ? `<button class="p-item" type="button" data-pi="${i}" data-active="${i === palette.index ? 1 : 0}"> 
           ${ico(item.tool.icon)}<span><b>${esc(item.tool.name)}</b><span>${esc(item.tool.desc)}</span></span></button>` 
      : `<button class="p-item" type="button" data-pi="${i}" data-active="${i === palette.index ? 1 : 0}"> 
           ${ico('clock')}<span><b>${esc(item.rec.name)}</b><span>${esc(item.rec.type)} · ${fmtSize(item.rec.size)} · opens ${esc(byId(item.rec.workflow)?.name || 'Dashboard')}</span></span></button>`; 
    }).join('')}`).join('') 
    : `<div class="empty" style="margin:8px">${ico('search')}<h3 style="margin-top:10px">No matches</h3><p>Try “merge”, “compress”, “presentation” or “csv”.</p></div>`; 
  $('.p-item[data-active="1"]', $('#paletteList'))?.scrollIntoView({ block: 'nearest' }); 
} 
 
function openPalette() { 
  const layer = $('#layer-palette'); 
  palette.open = true; palette.index = 0; 
  layer.hidden = false; 
  layer.innerHTML = ` 
    <div class="palette" role="dialog" aria-modal="true" aria-label="Command palette"> 
      <div class="palette-input">${ico('search')} 
        <input id="paletteInput" type="text" placeholder="Search tools, conversions, recent files…" 
               autocomplete="off" role="combobox" aria-expanded="true" aria-controls="paletteList"> 
        <kbd>Esc</kbd> 
      </div> 
      <div class="palette-list" id="paletteList" role="listbox"></div> 
      <div class="palette-foot"><span>↑↓ navigate</span><span>↵ open</span><span>Esc close</span></div> 
    </div>`; 
  drawPalette(''); 
  const input = $('#paletteInput'); 
  input.focus(); 
  input.addEventListener('input', debounce(() => { palette.index = 0; drawPalette(input.value); }, 90)); 
  input.addEventListener('keydown', e => { 
    if (e.key === 'ArrowDown') { e.preventDefault(); palette.index = Math.min(palette.index + 1, palette.results.length - 1); drawPalette(input.value); } 
    if (e.key === 'ArrowUp')   { e.preventDefault(); palette.index = Math.max(palette.index - 1, 0); drawPalette(input.value); } 
    if (e.key === 'Enter')     { e.preventDefault(); runPaletteItem(palette.index); } 
  }); 
  layer.onclick = e => { 
    if (e.target === layer) return closePalette(); 
    const btn = e.target.closest('[data-pi]'); 
    if (btn) runPaletteItem(Number(btn.dataset.pi)); 
  }; 
} 
function closePalette() { palette.open = false; const l = $('#layer-palette'); if (!l) return; l.hidden = true; l.innerHTML = ''; } 
function runPaletteItem(i) { 
  const item = palette.results[i]; 
  if (!item) return; 
  closePalette(); 
  if (item.kind === 'tool') return openTool(item.tool.id); 
  toast(`Opening ${byId(item.rec.workflow)?.name || 'Dashboard'} — reselect the file to process it.`, 'info'); 
  openTool(item.rec.workflow || 'dashboard'); 
} 
 
/* ============================================================ 
 * 12. Dashboard 
 * ==========================================================*/ 
const SUGGESTED = [ 
  ['pdf-docx','PDF → DOCX'], ['pdf-ppt','PDF → PPTX'], ['images-pdf','Images → PDF'], 
  ['images-ppt','Images → PPTX'], ['doc-pdf','DOCX → PDF'], ['ppt-pdf','PPTX → PDF'], 
  ['xlsx-pdf','XLSX → PDF'], ['zip-create','Files → ZIP'] 
]; 
 
function viewDashboard() { 
  const favs = favorites(); 
  const u = usage(); 
  const most = TOOLS.filter(t => u[t.id]).sort((a, b) => u[b.id] - u[a.id]).slice(0, 4); 
  const rec = recent().slice(0, 5); 
  const cards = TOOLS.filter(t => t.card !== false && t.id !== 'dashboard'); 
 
  $('#workspace').innerHTML = ` 
  <section class="hero"> 
    <div> 
      <div class="eyebrow">KRAZYBUY WORKSPACE</div> 
      <h1>Everything you create,<br><em>one warm workspace.</em></h1> 
      <p class="lede">PDFs, presentations, documents, spreadsheets, images and archives — one calm surface, real processing on your own machine, and a finished file at the end of every action.</p> 
      <div class="btn-row" style="margin-top:18px"> 
        <button class="btn btn--primary" type="button" data-act="palette">${ico('search')}Find a tool</button> 
        <button class="btn btn--soft" type="button" data-nav="pdf-organize">${ico('pdf')}Open a PDF</button> 
        <button class="btn" type="button" data-nav="zip-create">${ico('zip')}Create a ZIP</button> 
      </div> 
      <div class="trust"> 
        <span>${ico('check')}Processed locally</span> 
        <span>${ico('check')}Real file output</span> 
        <span>${ico('check')}No cloud storage</span> 
      </div> 
    </div> 
    <div class="hero-card"> 
      <span class="pill" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.14);color:#f6ded0;width:max-content">WORKSPACE V2</span> 
      <strong>Built for document work.</strong> 
      <p>Quiet interface. One obvious next action. Nothing pretends to work.</p> 
      <div class="stat-row"> 
        <div><b>${cards.length}</b><small>workflows</small></div> 
        <div><b>6</b><small>file families</small></div> 
        <div><b>${rec.length}</b><small>recent files</small></div> 
      </div> 
    </div> 
  </section> 
 
  ${most.length ? ` 
  <div class="section-head"><div><div class="eyebrow">PICK UP WHERE YOU LEFT OFF</div><h2>Most used</h2></div></div> 
  <div class="btn-row">${most.map(t => `<button class="btn" type="button" data-nav="${t.id}">${ico(t.icon)}${esc(t.name)}</button>`).join('')}</div>` : ''} 
 
  <div class="section-head"><div><div class="eyebrow">QUICK TOOLS</div><h2>Choose your workflow</h2></div> 
    <span class="pill">${cards.length} real workflows</span></div> 
  <div class="tool-grid"> 
    ${cards.map(t => { 
      const cap = capabilityOf(t); 
      return `<div class="tool-card" role="button" tabindex="0" data-nav="${t.id}" ${cap === false ? 'aria-disabled="true"' : ''}> 
        <span class="star icon-btn icon-btn--bare" data-act="fav" data-id="${t.id}" data-on="${favs.includes(t.id) ? 1 : 0}" 
              role="button" tabindex="0" data-tip="${favs.includes(t.id) ? 'Remove favorite' : 'Add to favorites'}" 
              aria-label="Toggle favorite for ${esc(t.name)}">${ico('star')}</span> 
        <span class="tool-ico">${ico(t.icon)}</span> 
        <h3>${esc(t.name)}</h3> 
        <p>${esc(t.desc)}</p> 
        ${cap === false ? `<span class="pill pill--warn">Unavailable · ${esc(t.requires)} missing</span>` 
          : t.requires ? `<span class="pill pill--warn">Needs ${esc(t.requires)}</span>` : ''} 
      </div>`; }).join('')} 
  </div> 
 
  <div class="section-head"><div><div class="eyebrow">SUGGESTED</div><h2>Common conversions</h2></div></div> 
  <div class="btn-row">${SUGGESTED.map(([id, label]) => 
    `<button class="btn btn--soft" type="button" data-nav="${id}">${label}${ico('chevR')}</button>`).join('')}</div> 
 
  <div class="section-head"><div><div class="eyebrow">RECENT</div><h2>Recent files</h2></div> 
    <button class="btn btn--sm" type="button" data-nav="recent">View all</button></div> 
  <div class="file-list">${rec.length ? rec.map(r => ` 
    <div class="recent-row"> 
      <div class="thumb">${esc(r.type)}</div> 
      <div class="file-meta"><b>${esc(r.name)}</b><span>${fmtSize(r.size)} · ${esc(timeAgo(r.when))} · ${esc(byId(r.workflow)?.name || 'Upload')}</span></div> 
      <button class="btn btn--sm" type="button" data-nav="${esc(r.workflow || 'dashboard')}">Open tool</button> 
    </div>`).join('') 
    : renderEmptyState({ icon:'clock', title:'No recent files yet', body:'Your recent work will appear here. Files stay on your device — this list is browser-local.', actionLabel:'Choose a tool', actionAttr:'data-act="palette"' })} 
  </div>`; 
} 
 
/* ============================================================ 
 * 13. Workflow scaffold 
 * ==========================================================*/ 
function workflowShell(tool, { optionsHTML = '', primaryLabel = 'Run', primaryAct = 'run', extraButtons = '', belowHTML = '' }) { 
  const cap = capabilityOf(tool); 
  const files = bucket(tool.id); 
  const fav = favorites().includes(tool.id); 
  const organizerNeedsPages = tool.id === 'pdf-organize';
  const primaryDisabled = cap === false || (organizerNeedsPages && !state.scratch.pages);
  $('#workspace').innerHTML = ` 
    <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:18px"> 
      <div> 
        <div class="eyebrow">${esc(tool.group.toUpperCase())} WORKFLOW</div> 
        <h1 class="page-title">${esc(tool.name)}</h1> 
        <p class="lede">${esc(tool.desc)}</p> 
      </div> 
      <div class="btn-row"> 
        <button class="icon-btn" type="button" data-act="fav" data-id="${tool.id}" data-on="${fav ? 1 : 0}" 
                data-tip="${fav ? 'Remove favorite' : 'Add to favorites'}" aria-pressed="${fav}" 
                aria-label="Toggle favorite">${ico('star')}</button> 
        <button class="btn btn--soft" type="button" data-nav="dashboard">Dashboard</button> 
      </div> 
    </div> 
 
    ${cap === false ? `<div class="note note--warn">${ico('alert')} <b>${esc(tool.name)}</b> is unavailable: <b>${esc(tool.requires)}</b> is not installed on the KrazyBuy server. Install it and reload, or pick a different workflow.</div>` : ''} 
 
    <div class="work-layout"> 
      <section class="panel"> 
        ${renderReuseBar(tool)} 
        ${tool.accept === null && !tool.multiple ? '' : renderUploadZone(tool)} 
        <div id="fileArea">${tool.accept === null && !tool.multiple ? '' : renderFileList(tool)}</div> 
        <div id="rejects"></div> 
        ${optionsHTML} 
        ${belowHTML} 
        <div class="btn-row sticky-cta" style="margin-top:18px"> 
          <button class="btn btn--primary" type="button" data-act="${primaryAct}" ${primaryDisabled ? 'disabled' : ''}> 
            ${ico('download')}${esc(primaryLabel)}</button> 
          ${extraButtons} 
        </div> 
        <div class="phase" id="phase" hidden></div> 
      </section> 
      ${renderAside(tool)} 
    </div>`; 
  paintThumbs(tool); 
  if (files.length) announce(`${files.length} files ready for ${tool.name}`); 
} 
 
/* Real image thumbnails only; other kinds keep their honest type badge */ 
function paintThumbs(tool) { 
  bucket(tool.id).forEach((f, i) => { 
    if (!IMG.includes(extOf(f.name))) return; 
    const slot = $(`[data-thumb="${i}"]`); 
    if (!slot) return; 
    const url = URL.createObjectURL(f); 
    slot.innerHTML = `<img src="${url}" alt="">`; 
    slot.firstChild.onload = () => setTimeout(() => URL.revokeObjectURL(url), 3000); 
  }); 
} 
 
function addFiles(tool, incoming) {
  const inputFiles = Array.isArray(incoming) ? incoming : [];
  const current = bucket(tool.id);

  const {
    accepted: validated,
    rejected
  } = validateFiles(inputFiles, tool);

  const fileKey = f =>
    `${relPathOf(f)}:${f.size}:${f.lastModified}`;

  const existing = new Set(current.map(fileKey));
  const seenIncoming = new Set();
  const unique = [];

  for (const file of validated) {
    const key = fileKey(file);

    if (existing.has(key)) continue;
    if (seenIncoming.has(key)) continue;

    seenIncoming.add(key);
    unique.push(file);
  }

  let accepted = [];
  let overflow = [];

  if (tool.multiple) {
    const remaining = Math.max(0, tool.max - current.length);

    accepted = unique.slice(0, remaining);
    overflow = unique.slice(remaining);
  } else {
    accepted = unique.slice(-1);
  }

  if (overflow.length) {
    rejected.push({
      name: `${overflow.length} extra file(s)`,
      why: `Limit is ${tool.max} files`
    });
  }

  const next = tool.multiple
    ? [...current, ...accepted]
    : accepted.slice(-1);

  setBucket(tool.id, next);

  /* Only files actually stored in the bucket count as accepted. */
  if (accepted.length) {
    pushRecent(accepted, tool.id);

    state.handoff = {
      fromId: tool.id,
      files: next.slice()
    };
  }

  const area = $('#fileArea');
  if (area) {
    area.innerHTML = renderFileList(tool);
  }

  paintThumbs(tool);

  const rj = $('#rejects');

  if (rj) {
    rj.innerHTML = rejected.length
      ? `
        <div class="reject-bar">
          ${ico('alert')}
          <b>
            ${accepted.length} of
            ${accepted.length + rejected.length}
            files accepted.
          </b>

          ${
            tool.accept
              ? `${esc(tool.name)} accepts ${esc(acceptLabel(tool))}.`
              : ''
          }

          <ul>
            ${rejected.map(r => `
              <li>
                ${esc(r.name)} — ${esc(r.why)}
              </li>
            `).join('')}
          </ul>
        </div>
      `
      : '';
  }

  if (accepted.length) {
    toast(
      `${accepted.length} file${accepted.length === 1 ? '' : 's'} added`,
      'ok'
    );
  } else if (rejected.length) {
    toast(
      `No new files added. ${tool.name} is limited to ${tool.max} files.`,
      'error'
    );
  }

  onFilesChanged?.(tool);
}

let onFilesChanged = null; 
 
/* Shared run pipeline with a real lifecycle */ 
async function runJob({ path, body, fallbackName, label = 'Processing', expect = 'blob', onDone }) { 
  const node = $('#phase'); 
  const btns = $$('#workspace .sticky-cta .btn'); btns.forEach(b => b.disabled = true); 
  try { 
    phase(node, { state:'busy', label:'Uploading…', pct:0, 
                  actions:[{ id:'cancel', label:'Cancel', run:() => state.inflight?.abort() }] }); 
    let switched = false; 
    const res = await request({ path, body, expect, onProgress: p => { 
      if (p < 1) phase(node, { state:'busy', label:`Uploading… ${Math.round(p * 100)}%`, pct:p, 
                               actions:[{ id:'cancel', label:'Cancel', run:() => state.inflight?.abort() }] }); 
      else if (!switched) { switched = true; phase(node, { state:'busy', label:`${label}… this runs on your machine`, pct:null }); } 
    }}); 
    if (expect === 'json') { phase(node, { state:'ok', label:'Loaded.' }); onDone?.(res); return res; } 
    phase(node, { state:'busy', label:'Preparing download…', pct:null }); 
    const name = res.filename || fallbackName; 
    saveBlob(res.blob, name); 
    phase(node, { state:'ok', label:`Done — ${name} (${fmtSize(res.blob.size)}) saved to your downloads.`, 
                  actions:[{ id:'again', label:'Run again', run:() => phase(node, { state:'ok', label:'Ready when you are.' }) }] }); 
    toast(`Downloaded ${name}`); 
    onDone?.(res); 
    return res; 
  } catch (err) { 
    if (err.cancelled) { phase(node, { state:'error', label:'Cancelled before completion.' }); return; } 
    phase(node, { state:'error', label:err.message, 
      actions:[{ id:'retry', label:'Try again', variant:'btn--soft', 
                 run:() => runJob({ path, body, fallbackName, label, expect, onDone }) }, 
               { id:'other', label:'Choose another file', run:() => { setBucket(state.toolId, []); openTool(state.toolId); } }, 
               { id:'back',  label:'Back to dashboard', variant:'btn--ghost', run:() => openTool('dashboard') }] }); 
  } finally { 
    $$('#workspace .sticky-cta .btn').forEach(b => {
      const current = byId(state.toolId);
      b.disabled = capabilityOf(current) === false || (state.toolId === 'pdf-organize' && !state.scratch.pages);
    }); 
  } 
} 
const fd = (tool, field = 'file') => { 
  const files = bucket(tool.id); 
  if (!files.length) throw new Error('Add a file first.'); 
  const f = new FormData(); f.append(field, files[0], files[0].name); return f; 
}; 
 
/* ============================================================ 
 * 14. PDF workflows (incl. real page organizer) 
 * ==========================================================*/ 
function viewPdf(tool) { 
  const m = tool.mode; 
  let options = ''; 
  if (m === 'split') options = `<div class="grid-2"><div class="field field--full"> 
      <label for="ranges">Pages and ranges</label> 
      <input id="ranges" placeholder="1-3,5,8-10" inputmode="numeric"> 
      <small>Comma-separated. Examples: 1,2,4 or 1-3,7,9-11</small></div></div>`; 
  if (m === 'compress') options = `<div class="grid-2"><div class="field field--full"> 
      <label for="quality">Optimization profile</label> 
      <select id="quality"><option value="balanced">Balanced</option><option value="maximum">Maximum compression</option><option value="high">Keep highest quality</option></select> 
      <small>KrazyBuy rewrites PDF structure. Image re-encoding is not claimed.</small></div></div>`; 
  if (m === 'protect') options = `<div class="grid-2"><div class="field field--full"> 
      <label for="password">Open password</label><input id="password" type="password" autocomplete="new-password" placeholder="At least 6 characters"> 
      <small>Applied server-side by qpdf. KrazyBuy never stores the password.</small></div></div>`; 
  if (m === 'to-image') options = `<div class="grid-2"><div class="field"> 
      <label for="format">Output format</label><select id="format"><option value="png">PNG</option><option value="jpg">JPG</option></select></div></div>`; 
  if (m === 'edit') options = ` 
    <div class="grid-2"> 
      <div class="field field--full"><label for="text">Text to add</label><input id="text" placeholder="e.g. Approved — internal copy"></div> 
      <div class="field"><label for="page">Target page</label><input id="page" type="number" min="1" value="1"></div> 
      <div class="field"><label for="fontSize">Font size</label><input id="fontSize" type="number" min="6" max="96" value="18"></div> 
      <div class="field field--full"><label for="watermark">Watermark text</label><input id="watermark" placeholder="Optional diagonal watermark"></div> 
      <div class="field"><label for="rotate">Rotate all pages</label><select id="rotate"><option value="0">No rotation</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></div> 
      <div class="field"><label class="check"><input id="pageNumbers" type="checkbox"> Stamp page numbers</label></div> 
    </div>`; 
  if (m === 'merge') options = `<div class="note">${ico('help')} Files are merged top-to-bottom. Drag the rows above to change the order.</div>`; 
  if (m === 'images-pdf') options = `<div class="note">${ico('help')} One image per PDF page, in the order listed above.</div>`; 
 
    const organizer = m === 'organize' ? `
    <div class="section-head organizer-head" style="margin:22px 0 8px">
      <div><div class="eyebrow">PAGES</div><h2 style="font-size:17px">Page organizer</h2></div>
      <span class="pill" id="pageCount" data-organizer-state="empty">No document loaded</span>
    </div>
    <div class="organizer-actions">
      <button class="btn btn--soft" type="button" data-act="p-load">${ico('refresh')}Load pages</button>
      <span class="organizer-help" id="organizerHelp">Add a PDF, then load its real page list from the server.</span>
    </div>
    <div class="toolbar" role="toolbar" aria-label="Page actions">
      <button class="icon-btn icon-btn--bare" type="button" data-act="p-all" data-tip="Select all" aria-label="Select all pages">${ico('grid')}</button>
      <button class="icon-btn icon-btn--bare" type="button" data-act="p-none" data-tip="Clear selection" aria-label="Clear selection">${ico('close')}</button>
      <span class="toolbar-sep"></span>
      <button class="icon-btn icon-btn--bare" type="button" data-act="p-rot" data-tip="Rotate selected pages" aria-label="Rotate selected pages">${ico('rotate')}</button>
      <button class="icon-btn icon-btn--bare" type="button" data-act="p-del" data-tip="Delete selected pages" aria-label="Delete selected pages">${ico('trash')}</button>
      <button class="icon-btn icon-btn--bare" type="button" data-act="p-restore" data-tip="Restore deleted pages" aria-label="Restore deleted pages">${ico('refresh')}</button>
      <span class="toolbar-sep"></span>
      <button class="icon-btn icon-btn--bare" type="button" data-act="p-left" data-tip="Move selection earlier" aria-label="Move selection earlier">${ico('chevL')}</button>
    </div>
    <div class="tile-strip" id="tiles">${renderEmptyState({ icon:'pdf', title:'Open a PDF to begin organizing', body:'Add a PDF above. KrazyBuy will read the real page count before enabling page actions.', actionLabel:'Load pages', actionAttr:'data-act="p-load"' })}</div>
    <div class="note">${ico('help')} Page numbers come from <code>/api/pdf/info</code>. Previews are only shown when the server provides a real rendered page image.</div>` : ''; 

  workflowShell(tool, { 
    optionsHTML: options, 
    belowHTML: organizer, 
    primaryLabel: { merge:'Merge PDFs', split:'Extract pages', organize:'Apply page changes', compress:'Optimize PDF', 
                    protect:'Protect PDF', 'to-image':'Render page', 'images-pdf':'Create PDF' }[m] || 'Apply PDF edits', 
    extraButtons: ['edit','organize','split','compress','protect','to-image'].includes(m) 
      ? `<button class="btn" type="button" data-act="pdf-info">${ico('help')}Read PDF info</button>` : '' 
  }); 
 
  state.scratch.pages = null;
  if (m === 'organize') {
    setOrganizerState(bucket(tool.id).length ? 'ready-to-load' : 'empty', bucket(tool.id).length ? 'PDF selected' : 'No document loaded', bucket(tool.id).length ? 'Press Load pages to read the document.' : 'Add a PDF first.');
    onFilesChanged = t => {
      if (t.mode === 'organize' && bucket(t.id).length) loadPages(t).catch(() => {});
    };
    if (bucket(tool.id).length) loadPages(tool).catch(() => {});
  } 
} 
 
function setOrganizerState(kind, label, help = '') {
  const pill = $('#pageCount');
  const helpEl = $('#organizerHelp');
  const apply = document.querySelector('#workspace .sticky-cta .btn--primary');
  if (pill) { pill.dataset.organizerState = kind; pill.textContent = label; }
  if (helpEl) helpEl.textContent = help;
  if (apply && state.toolId === 'pdf-organize') apply.disabled = kind !== 'ready';
}

function extractPdfPageCount(res) {
  const candidates = [res?.data?.pages, res?.data?.pageCount, res?.data?.info?.pages, res?.data?.info?.pageCount, res?.pages, res?.pageCount, res?.info?.pages, res?.info?.pageCount];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return 0;
}

async function loadPages(tool) {
  if (!tool || tool.id !== 'pdf-organize') return;
  const file = bucket(tool.id)[0];
  if (!file) {
    state.scratch.pages = null;
    setOrganizerState('empty', 'No document loaded', 'Add a PDF first.');
    toast('Add a PDF first.', 'info');
    return;
  }
  state.scratch.pages = null;
  setOrganizerState('loading', 'Reading pages…', 'KrazyBuy is reading the real page count from the server.');
  const loadId = (state.scratch.pageLoadId || 0) + 1;
  state.scratch.pageLoadId = loadId;
  try {
    const res = await runJob({ path:'/pdf/info', body:fd(tool), expect:'json', label:'Reading document' });
    if (state.scratch.pageLoadId !== loadId || state.toolId !== tool.id) return;
    const n = extractPdfPageCount(res);
    if (!n) {
      setOrganizerState('error', 'Page count unavailable', 'The server answered, but no page count was returned.');
      toast('The PDF info endpoint did not return a usable page count.', 'error');
      return;
    }
    state.scratch.pages = Array.from({ length: n }, (_, i) => ({ src:i + 1, rot:0, removed:false, sel:false }));
    setOrganizerState('ready', `${n} page${n === 1 ? '' : 's'} loaded`, 'Select pages, rotate, delete, or drag pages into a new order.');
    drawTiles();
  } catch (err) {
    if (state.scratch.pageLoadId !== loadId) return;
    setOrganizerState('error', 'Could not load pages', humanize(err?.message || 'Unable to read PDF pages.'));
    throw err;
  }
}

function drawTiles() {
  const pages = state.scratch.pages || [];
  const pageCount = $('#pageCount');
  const tiles = $('#tiles');
  const live = pages.filter(p => !p.removed).length;
  if (!pageCount || !tiles) return;
  pageCount.textContent = pages.length ? `${live} of ${pages.length} pages kept` : 'No document loaded';
  pageCount.dataset.organizerState = pages.length ? 'ready' : 'empty';
  const apply = document.querySelector('#workspace .sticky-cta .btn--primary');
  if (apply && state.toolId === 'pdf-organize') apply.disabled = !pages.length;
  if (!pages.length) {
    tiles.innerHTML = renderEmptyState({ icon:'pdf', title:'Open a PDF to begin organizing', body:'Add a PDF above, then press Load pages.', actionLabel:'Load pages', actionAttr:'data-act="p-load"' });
    return;
  }
  tiles.innerHTML = pages.map((p, i) => ` 
    <button class="tile" type="button" draggable="true" data-page="${i}" data-removed="${p.removed ? 1 : 0}" 
            aria-pressed="${p.sel}" aria-label="Page ${p.src}${p.removed ? ', marked for deletion' : ''}"> 
      ${p.src} 
      <span class="tile-no">${i + 1}</span> 
      ${p.rot ? `<span class="tile-rot">${p.rot}°</span>` : ''} 
    </button>`).join(''); 
} 
function pdfOrganizePayload() { 
  const pages = state.scratch.pages || []; 
  const del = pages.filter(p => p.removed).map(p => p.src); 
  const order = pages.filter(p => !p.removed).map(p => p.src); 
  const rots = new Set(pages.filter(p => !p.removed).map(p => p.rot)); 
  const rotate = rots.size === 1 ? [...rots][0] : 0; 
  const mixed = rots.size > 1; 
  return { del, order, rotate, mixed }; 
} 
 
/* ============================================================ 
 * 15. PPTX workflows (incl. real slide-text editor) 
 * ==========================================================*/ 
function viewPpt(tool) { 
  const m = tool.mode; 
  if (m === 'create') { 
    workflowShell(tool, { 
      primaryLabel: 'Create PPTX', primaryAct: 'ppt-create', 
      optionsHTML: `<div class="grid-2"> 
        <div class="field"><label for="title">Title</label><input id="title" value="KrazyBuy Presentation"></div> 
        <div class="field"><label for="subtitle">Subtitle</label><input id="subtitle" value="Created with KrazyBuy"></div> 
        <div class="field"><label for="slides">Slides</label><input id="slides" type="number" min="1" max="100" value="5"></div> 
        <div class="field field--full"><label for="contentText">Body content</label><textarea id="contentText" placeholder="One line per slide works well…"></textarea></div> 
      </div>` }); 
    return; 
  } 
  if (m === 'edit') { 
    workflowShell(tool, { 
      primaryLabel: 'Save presentation', primaryAct: 'ppt-save', 
      extraButtons: `<button class="btn" type="button" data-act="ppt-load">${ico('refresh')}Load slides</button>`, 
      belowHTML: ` 
        <div class="section-head" style="margin:22px 0 8px"><div><div class="eyebrow">SLIDES</div><h2 style="font-size:17px">Slide text</h2></div> 
          <span class="pill" id="slideCount">No deck loaded</span></div> 
        <div id="slides">${renderEmptyState({ icon:'ppt', title:'Open a presentation to begin', body:'Add a .pptx above and load it. KrazyBuy reads each slide’s real text, and saving sends only your changed strings back for replacement.', actionLabel:'Browse files' })}</div> 
        <div class="grid-2" style="margin-top:14px"> 
          <div class="field"><label for="deleteSlides">Delete slides</label><input id="deleteSlides" placeholder="2,4"></div> 
          <div class="field"><label for="reorderSlides">Reorder slides</label><input id="reorderSlides" placeholder="3,1,2"></div> 
          <div class="field"><label for="duplicateSlide">Duplicate slide</label><input id="duplicateSlide" type="number" min="1" placeholder="2"></div> 
          <div class="field"><label class="check"><input id="addSlide" type="checkbox"> Append a cloned slide</label></div> 
        </div> 
        <div class="note">${ico('help')} Text replacement rewrites matching runs inside the real PPTX package. Shape geometry, images and animations are left untouched — KrazyBuy does not pretend to edit them.</div>` }); 
    state.scratch.deck = null; 
    onFilesChanged = () => { state.scratch.deck = null; }; 
    return; 
  } 
  workflowShell(tool, { 
    primaryLabel: { 'to-pdf':'Convert to PDF', 'to-images':'Render slide images (ZIP)', 
                    'images-to-pptx':'Create presentation', 'pdf-to-pptx':'Create presentation' }[m], 
    optionsHTML: m === 'images-to-pptx' ? `<div class="note">${ico('help')} One slide per image, in the order listed above.</div>` : '', 
    extraButtons: ['to-pdf','to-images'].includes(m) ? `<button class="btn" type="button" data-act="ppt-inspect">${ico('help')}Inspect deck</button>` : '' 
  }); 
} 
 
function drawSlides() { 
  const deck = state.scratch.deck || []; 
  $('#slideCount').textContent = `${deck.length} slide${deck.length === 1 ? '' : 's'}`; 
  $('#slides').innerHTML = deck.map((s, i) => ` 
    <div class="slide-row ${s.text !== s.orig ? 'dirty' : ''}" data-slide="${i}"> 
      <div class="slide-no">${i + 1}</div> 
      <div style="flex:1"> 
        <div class="field" style="margin:0"> 
          <label for="slide-${i}">Slide ${i + 1} text${s.text !== s.orig ? ' · edited' : ''}</label> 
          <textarea id="slide-${i}" data-slide-input="${i}" placeholder="(this slide has no extractable text)">${esc(s.text)}</textarea> 
        </div> 
      </div> 
    </div>`).join(''); 
} 
 
/* ============================================================ 
 * 16. Documents 
 * ==========================================================*/ 
function viewDoc(tool) { 
  const m = tool.mode; 
  if (m === 'create') { 
    workflowShell(tool, { 
      primaryLabel:'Create DOCX', primaryAct:'doc-new-docx', 
      extraButtons:`<button class="btn" type="button" data-act="doc-new-pdf">${ico('pdf')}Create PDF instead</button>`, 
      optionsHTML:`<div class="grid-2"> 
        <div class="field field--full"><label for="title">Document title</label><input id="title" value="KrazyBuy Document"></div> 
        <div class="field field--full"><label for="text">Body</label><textarea id="text" class="editor-area" placeholder="Write your document…"></textarea></div> 
      </div>` }); 
    return; 
  } 
  if (m === 'edit') { 
    workflowShell(tool, { 
      primaryLabel:'Save as new DOCX', primaryAct:'doc-save-text', 
      extraButtons:` 
        <button class="btn" type="button" data-act="doc-load">${ico('refresh')}Load text</button> 
        <button class="btn" type="button" data-act="doc-replace">${ico('swap')}Find &amp; replace in original</button> 
        <button class="btn" type="button" data-act="doc-export-pdf">${ico('pdf')}Export PDF</button>`, 
      optionsHTML:` 
        <div class="field"><label for="docText">Document text</label> 
          <textarea id="docText" class="editor-area" placeholder="Load a .docx to extract its text…"></textarea> 
          <small id="docMeta">Not loaded.</small></div> 
        <div class="grid-2"> 
          <div class="field"><label for="find">Find</label><input id="find" placeholder="Old wording"></div> 
          <div class="field"><label for="replace">Replace with</label><input id="replace" placeholder="New wording"></div> 
        </div> 
        <div class="note note--warn">${ico('alert')} Two honest paths: <b>Find &amp; replace</b> edits the original file and keeps its formatting. <b>Save as new DOCX</b> builds a clean document from the edited text — original layout is not carried over.</div>` }); 
    return; 
  } 
  workflowShell(tool, { 
    primaryLabel:{ 'to-pdf':'Convert to PDF', 'to-txt':'Export TXT', 'pdf-to-docx':'Convert to DOCX' }[m] }); 
} 
 
/* ============================================================ 
 * 17. Spreadsheets (incl. real editable grid) 
 * ==========================================================*/ 
const colName = n => { let s = ''; n++; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - 1 - r) / 26; } return s; }; 
 
function viewXlsx(tool) { 
  const m = tool.mode; 
  if (m !== 'edit') { 
    workflowShell(tool, { primaryLabel:{ 'csv-to-xlsx':'Convert to XLSX', 'xlsx-to-csv':'Export CSV', 'to-pdf':'Export PDF' }[m] }); 
    return; 
  } 
  workflowShell(tool, { 
    primaryLabel:'Save workbook', primaryAct:'xlsx-save', 
    extraButtons:` 
      <button class="btn" type="button" data-act="xlsx-load">${ico('refresh')}Load workbook</button> 
      <button class="btn" type="button" data-act="xlsx-csv">${ico('swap')}Export CSV</button> 
      <button class="btn" type="button" data-act="xlsx-pdf">${ico('pdf')}Export PDF</button>`, 
    belowHTML:` 
      <div class="section-head" style="margin:22px 0 6px"><div><div class="eyebrow">GRID</div><h2 style="font-size:17px">Worksheet</h2></div> 
        <span class="pill" id="gridMeta">No workbook loaded</span></div> 
      <div class="formula-bar"><b id="cellRef">—</b><input id="formula" placeholder="Select a cell to edit its value" aria-label="Cell value"></div> 
      <div id="sheetTabs" class="sheet-tabs"></div> 
      <div id="grid">${renderEmptyState({ icon:'xls', title:'Open a spreadsheet to begin', body:'Add an .xlsx above and load it. Edited cells are highlighted and only the changed ones are written back to the real workbook.', actionLabel:'Browse files' })}</div> 
      <div class="grid-2"> 
        <div class="field"><label for="rename">Rename active sheet</label><input id="rename" placeholder="Leave blank to keep"></div> 
        <div class="field"><label for="deleteRow">Delete row number</label><input id="deleteRow" type="number" min="1" placeholder="Optional"></div> 
        <div class="field"><label for="freezeRows">Freeze top rows</label><input id="freezeRows" type="number" min="0" value="0"></div> 
      </div> 
      <div class="note">${ico('help')} Formulas are preserved as-is by the server; this grid edits values, not formula logic.</div>` }); 
  state.scratch.wb = null; 
  onFilesChanged = () => { state.scratch.wb = null; }; 
} 
 
function drawGrid() { 
  const wb = state.scratch.wb; 
  if (!wb) return; 
  const ws = wb.sheets[wb.active]; 
  const dirty = Object.keys(ws.dirty).length; 
  $('#gridMeta').textContent = `${ws.title} · ${ws.rows.length} rows × ${ws.cols} cols${dirty ? ` · ${dirty} edited` : ''}`; 
  $('#sheetTabs').innerHTML = wb.sheets.map((s, i) => 
    `<button class="btn btn--sm ${i === wb.active ? 'btn--soft' : ''}" type="button" data-act="sheet-tab" data-i="${i}">${esc(s.title)}</button>`).join(''); 
  const head = `<tr><th style="min-width:44px">#</th>${Array.from({ length: ws.cols }, (_, c) => `<th>${colName(c)}</th>`).join('')}</tr>`; 
  const body = ws.rows.map((row, r) => `<tr><th>${r + 1}</th>${Array.from({ length: ws.cols }, (_, c) => { 
    const ref = `${colName(c)}${r + 1}`; 
    const val = ws.dirty[ref] ?? row[c] ?? ''; 
    return `<td class="${ws.dirty[ref] !== undefined ? 'dirty' : ''}"><input value="${esc(val)}" data-cell="${ref}" aria-label="Cell ${ref}"></td>`; 
  }).join('')}</tr>`).join(''); 
  $('#grid').innerHTML = `<div class="sheet-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`; 
} 
 
/* ============================================================ 
 * 18. Images 
 * ==========================================================*/ 
function viewImage(tool) { 
  const m = tool.mode; 
  workflowShell(tool, { 
    primaryLabel: m === 'convert' ? 'Convert image' : m === 'compress' ? 'Compress image' : 'Process image', 
    belowHTML:` 
      <div class="section-head" style="margin:20px 0 6px"><div><div class="eyebrow">PREVIEW</div><h2 style="font-size:17px">Canvas</h2></div> 
        <span class="pill" id="imgMeta">No image loaded</span></div> 
      <div id="canvasBox" style="border:1px solid var(--line);border-radius:14px;background: 
        repeating-conic-gradient(#f6eee7 0 25%, #fffaf5 0 50%) 0 0/18px 18px;padding:16px;display:grid;place-items:center;min-height:230px"> 
        ${renderEmptyState({ icon:'image', title:'Open an image to begin', body:'Add a JPG, PNG or WebP above. The preview is approximate — the server produces the final file.', actionLabel:'Browse files' })} 
      </div>`, 
    optionsHTML:` 
      <div class="grid-2"> 
        <div class="field"><label for="width">Width (px)</label><input id="width" type="number" min="1" placeholder="Auto"></div> 
        <div class="field"><label for="height">Height (px)</label><input id="height" type="number" min="1" placeholder="Auto"></div> 
        <div class="field"><label for="degrees">Rotation (°)</label><input id="degrees" type="number" value="0" step="90"></div> 
        <div class="field"><label for="quality">Quality (1–100)</label><input id="quality" type="number" min="1" max="100" value="82"></div> 
        <div class="field"><label for="format">Output format</label><select id="format"><option value="webp">WebP</option><option value="png">PNG</option><option value="jpg">JPG</option></select></div> 
        <div class="field"><label for="flip">Flip</label><select id="flip"><option value="">None</option><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></div> 
        <div class="field field--full"><label for="text">Text overlay</label><input id="text" placeholder="Optional"></div> 
        <div class="field field--full"><label for="watermark">Watermark</label><input id="watermark" placeholder="Optional"></div> 
      </div>` }); 
  onFilesChanged = t => paintCanvas(t); 
  if (bucket(tool.id).length) paintCanvas(tool); 
} 
function paintCanvas(tool) { 
  const f = bucket(tool.id)[0]; if (!f) return; 
  const url = URL.createObjectURL(f); 
  const img = new Image(); 
  img.onload = () => { 
    $('#imgMeta').textContent = `${img.naturalWidth} × ${img.naturalHeight} px · ${extOf(f.name).toUpperCase()} · ${fmtSize(f.size)}`; 
    $('#canvasBox').innerHTML = `<img id="previewImg" src="${url}" alt="Preview of ${esc(f.name)}" style="max-width:100%;max-height:420px;border-radius:8px;box-shadow:var(--shadow-sm)">`; 
    if (!$('#width').value) { $('#width').placeholder = img.naturalWidth; $('#height').placeholder = img.naturalHeight; } 
  }; 
  img.onerror = () => { $('#canvasBox').innerHTML = `<div class="reject-bar">${ico('alert')} This image could not be decoded by the browser.</div>`; }; 
  img.src = url; 
} 
function livePreview() { 
  const img = $('#previewImg'); if (!img) return; 
  const deg = Number($('#degrees')?.value || 0); 
  const flip = $('#flip')?.value; 
  img.style.transform = `rotate(${deg}deg) scaleX(${flip === 'horizontal' ? -1 : 1}) scaleY(${flip === 'vertical' ? -1 : 1})`; 
} 
 
/* ============================================================ 
 * 19. ZIP + Recent 
 * ==========================================================*/ 
function viewZip(tool) { 
  workflowShell(tool, { 
    primaryLabel:'Create ZIP', 
    optionsHTML:`<div class="grid-2"><div class="field field--full"> 
        <label for="zipName">Archive name</label><input id="zipName" value="krazybuy-files.zip"> 
        <small>Folder structure is preserved when your browser reports relative paths.</small></div></div> 
      <div class="note">${ico('folder')} Dropped folders are walked recursively, so <code>reports/q3/data.csv</code> stays at that path inside the archive.</div>` }); 
} 
 
function viewRecent() { 
  const all = recent(); 
  const types = ['All','PDF','PPT','DOC','XLS','CSV','IMG','ZIP']; 
  $('#workspace').innerHTML = ` 
    <div class="eyebrow">HISTORY</div><h1 class="page-title">Recent files</h1> 
    <p class="lede">Files you selected in this browser. This list is local to your device — KrazyBuy does not store your files on a server.</p> 
    <div class="filter-row"> 
      <div class="field" style="margin:0;min-width:220px"><input id="recentSearch" type="search" placeholder="Search by name…" aria-label="Search recent files"></div> 
      ${types.map((t, i) => `<button class="btn btn--sm ${i === 0 ? 'btn--soft' : ''}" type="button" data-act="rfilter" data-type="${t}">${t}</button>`).join('')} 
      <button class="btn btn--sm btn--danger" type="button" data-act="rclear">${ico('trash')}Clear history</button> 
    </div> 
    <div class="file-list" id="recentList"></div>`; 
  state.scratch.rFilter = 'All'; state.scratch.rQuery = ''; 
  drawRecent(); 
  $('#recentSearch').addEventListener('input', debounce(e => { state.scratch.rQuery = e.target.value; drawRecent(); }, 120)); 
  if (!all.length) toast('No recent files yet — upload something to get started.', 'info'); 
} 
function drawRecent() { 
  const q = (state.scratch.rQuery || '').toLowerCase(), f = state.scratch.rFilter; 
  const rows = recent().filter(r => (f === 'All' || r.type === f) && r.name.toLowerCase().includes(q)); 
  $('#recentList').innerHTML = rows.length ? rows.map(r => ` 
    <div class="recent-row" data-rec="${esc(r.id)}"> 
      <div class="thumb">${esc(r.type)}</div> 
      <div class="file-meta"><b>${esc(r.name)}</b> 
        <span>${fmtSize(r.size)} · ${esc(timeAgo(r.when))} · ${esc(byId(r.workflow)?.name || 'Upload')}${r.path !== r.name ? ` · ${esc(r.path)}` : ''}</span></div> 
      <button class="btn btn--sm" type="button" data-nav="${esc(r.workflow || 'dashboard')}">Open tool</button> 
      <button class="icon-btn icon-btn--bare" type="button" data-act="rname" data-id="${esc(r.id)}" data-tip="Rename entry" aria-label="Rename entry">${ico('edit')}</button> 
      <button class="icon-btn icon-btn--bare" type="button" data-act="rdel" data-id="${esc(r.id)}" data-tip="Remove from history" aria-label="Remove from history">${ico('trash')}</button> 
    </div>`).join('') 
    : renderEmptyState({ icon:'clock', title:'Nothing here yet', body:'Your recent work will appear here once you add files to a workflow.', actionLabel:'Find a tool', actionAttr:'data-act="palette"' }); 
  const note = document.createElement('div'); 
  note.className = 'note'; 
  note.innerHTML = `${ico('help')} Entries record file names only. The file contents were never uploaded anywhere except your local server during processing.`; 
  $('#recentList').appendChild(note); 
} 
 
/* ============================================================ 
 * 20. Router 
 * ==========================================================*/ 
function openTool(id) { 
  const tool = byId(id) || byId('dashboard'); 
  closeDrawer(); closePalette(); closeModal(); 
  state.toolId = tool.id; 
  state.scratch = {}; 
  onFilesChanged = null; 
  LS.set(K.last, tool.id); 
  bumpUsage(tool.id); 
 
  $$('[data-nav]').forEach(b => { 
    const on = b.dataset.nav === tool.id; 
    on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); 
  }); 
  document.title = tool.id === 'dashboard' ? 'KrazyBuy — Document Workspace' : `${tool.name} · KrazyBuy`; 
  if (location.hash !== '#' + tool.id) history.replaceState(null, '', '#' + tool.id); 
 
  if (tool.id === 'dashboard') viewDashboard(); 
  else if (tool.id === 'recent') viewRecent(); 
  else if (tool.family === 'pdf')   viewPdf(tool); 
  else if (tool.family === 'ppt')   viewPpt(tool); 
  else if (tool.family === 'doc')   viewDoc(tool); 
  else if (tool.family === 'xlsx')  viewXlsx(tool); 
  else if (tool.family === 'image') viewImage(tool); 
  else if (tool.id === 'zip-create') viewZip(tool); 
  else viewDashboard(); 
 
  $('#workspace').scrollIntoView({ block: 'start' }); 
  announce(`${tool.name} opened`); 
} 
 
/* ============================================================ 
 * 21. One delegated event router (BUG 8 & 9) 
 * ==========================================================*/ 
document.addEventListener('click', async e => { 
  const nav = e.target.closest('[data-nav]'); 
  const act = e.target.closest('[data-act]'); 
  const tool = byId(state.toolId); 
 
  if (act) e.stopPropagation(); 
 
  if (nav && !act) { 
    if (nav.disabled) return; 
    return openTool(nav.dataset.nav); 
  } 
  if (!act) { 
    const target = e.target instanceof Element ? e.target : null;
    const tile = target?.closest('[data-page]'); 
    if (tile) { 
      const p = state.scratch.pages?.[Number(tile.dataset.page)]; 
      if (p) { p.sel = !p.sel; drawTiles(); } 
    } 
    return; 
  } 
 
  const a = act.dataset.act; 
  const phaseNode = $('#phase'); 
  if (a in (phaseNode?._acts || {})) return phaseNode._acts[a](); 
 
  try { 
    switch (a) { 
      /* ---- shell ---- */ 
      case 'palette': return openPalette(); 
      case 'drawer': return openDrawer(); 
      case 'drawer-close': return closeDrawer(); 
      case 'collapse': { 
        const on = document.body.classList.toggle('collapsed'); 
        LS.set(K.collapsed, on); 
        return toast(on ? 'Sidebar collapsed' : 'Sidebar expanded', 'info'); 
      } 
      case 'help': return openModal({ 
        title:'Keyboard shortcuts & how KrazyBuy works', 
        bodyHTML:` 
          <p><b>Ctrl/⌘ + K</b> — command palette · <b>Esc</b> — close overlays · <b>Ctrl + Enter</b> — run the current workflow.</p> 
          <p>Each workflow keeps its own file selection, so nothing leaks between tools. When files can be reused, KrazyBuy asks first.</p> 
          <p>Everything is processed by your local KrazyBuy server. Some conversions need native tools (LibreOffice, qpdf, Poppler) — those tools say so up front instead of failing silently.</p>`, 
        actions:[{ label:'Close', variant:'btn--primary' }] }); 
      case 'fav': { 
        const id = act.dataset.id; 
        const on = toggleFavorite(id); 
        toast(on ? `${byId(id).name} added to favorites` : `${byId(id).name} removed`, 'info'); 
        renderShell(); return openTool(state.toolId); 
      } 
 
      /* ---- files ---- */ 
      case 'browse': return pick({ accept: tool.accept, multiple: tool.multiple }, f => addFiles(tool, f)); 
      case 'addmore': return pick({ accept: tool.accept, multiple: true }, f => addFiles(tool, f)); 
      case 'folder':  return pick({ accept: null, directory: true }, f => addFiles(tool, f)); 
      case 'rmfile': { 
        const list = bucket(tool.id).slice(); 
        list.splice(Number(act.dataset.idx), 1); 
        setBucket(tool.id, list); 
        $('#fileArea').innerHTML = renderFileList(tool); paintThumbs(tool); 
        return onFilesChanged?.(tool); 
      } 
      case 'clearfiles': { 
        if (!bucket(tool.id).length) return; 
        if (!await confirmDialog({ title:'Clear selection?', message:`This removes all ${bucket(tool.id).length} file(s) from ${tool.name}. Your files on disk are untouched.`, confirmLabel:'Clear' })) return; 
        setBucket(tool.id, []); 
        state.scratch = {}; 
        return openTool(tool.id); 
      } 
      case 'reuse': { 
        const { accepted } = validateFiles(state.handoff.files, tool); 
        setBucket(tool.id, tool.multiple ? accepted : accepted.slice(0, 1)); 
        return openTool(tool.id); 
      } 
      case 'dismiss-reuse': state.handoff = null; return openTool(tool.id); 
 
      /* ---- PDF ---- */ 
      case 'pdf-info': { 
        const r = await runJob({ path:'/pdf/info', body:fd(tool), expect:'json', label:'Reading document' }); 
        const d = r?.data || r || {};
        const pages = extractPdfPageCount(r);
        return phase($('#phase'), { state:'ok', label:`${d.name || bucket(tool.id)[0].name} · ${pages || '?'} pages · ${fmtSize(d.size ?? bucket(tool.id)[0].size)}` }); 
      } 
      case 'p-load': return loadPages(tool); 
      case 'p-all': case 'p-none': { 
        if (!state.scratch.pages?.length) return toast('Load the PDF pages first.', 'info');
        (state.scratch.pages || []).forEach(p => p.sel = a === 'p-all' && !p.removed); 
        return drawTiles(); 
      } 
      case 'p-rot': { 
        if (!state.scratch.pages?.length) return toast('Load the PDF pages first.', 'info');
        const sel = (state.scratch.pages || []).filter(p => p.sel); 
        if (!sel.length) return toast('Select at least one page first.', 'info'); 
        sel.forEach(p => p.rot = (p.rot + 90) % 360); 
        return drawTiles(); 
      } 
      case 'p-del': { 
        if (!state.scratch.pages?.length) return toast('Load the PDF pages first.', 'info');
        const sel = (state.scratch.pages || []).filter(p => p.sel && !p.removed); 
        if (!sel.length) return toast('Select the pages you want to delete.', 'info'); 
        if (!await confirmDialog({ title:`Delete ${sel.length} page(s)?`, message:'Pages are marked for deletion and removed when you apply changes. Nothing is written until then.', confirmLabel:'Mark deleted' })) return; 
        sel.forEach(p => { p.removed = true; p.sel = false; }); 
        return drawTiles(); 
      } 
      case 'p-restore': { 
        if (!state.scratch.pages?.length) return toast('Load the PDF pages first.', 'info');
        (state.scratch.pages || []).forEach(p => p.removed = false); 
        toast('All pages restored', 'info'); return drawTiles(); 
      } 
      case 'p-left': { 
        if (!state.scratch.pages?.length) return toast('Load the PDF pages first.', 'info');
        const pages = state.scratch.pages || []; 
        for (let i = 1; i < pages.length; i++) if (pages[i].sel) { [pages[i - 1], pages[i]] = [pages[i], pages[i - 1]]; } 
        return drawTiles(); 
      } 
 
      /* ---- PPT ---- */ 
      case 'ppt-load': { 
        const r = await runJob({ path:'/ppt/inspect', body:fd(tool), expect:'json', label:'Reading deck' }); 
        const items = r?.data?.items || r?.items || []; 
        if (!items.length) return toast('The server reported no readable slide text in this deck.', 'error'); 
        state.scratch.deck = items.map(it => ({ orig: it.text || '', text: it.text || '' })); 
        return drawSlides(); 
      } 
      case 'ppt-inspect': { 
        const r = await runJob({ path:'/ppt/inspect', body:fd(tool), expect:'json', label:'Reading deck' }); 
        const n = r?.data?.slides ?? r?.slides ?? '?'; 
        return phase($('#phase'), { state:'ok', label:`${bucket(tool.id)[0].name} · ${n} slides` }); 
      } 
    } 
  } catch (err) { 
    phase($('#phase'), { state:'error', label: err.message }); 
    return; 
  } 
 
  /* Long-form handlers */ 
  try { await heavyAction(a, tool, act); } 
  catch (err) { phase($('#phase'), { state:'error', label: err.message }); } 
}); 
 
async function heavyAction(a, tool, actEl = null) { 
  const v = id => $('#' + id)?.value ?? ''; 
  const files = bucket(tool.id); 
 
  switch (a) { 
    /* ---------- generic primary run ---------- */ 
    case 'run': { 
      if (tool.accept && !files.length) throw new Error(`Add ${acceptLabel(tool)} to continue.`); 
      if (files.length < tool.min) throw new Error(`This workflow needs at least ${tool.min} files.`); 
      const form = new FormData(); 
 
      if (tool.family === 'pdf') { 
        const m = tool.mode; 
        if (m === 'merge')      { files.forEach(f => form.append('files', f, f.name)); return runJob({ path:'/pdf/merge', body:form, fallbackName:'krazybuy-merged.pdf', label:'Merging PDFs' }); } 
        if (m === 'images-pdf') { files.forEach(f => form.append('files', f, f.name)); return runJob({ path:'/pdf/images-to-pdf', body:form, fallbackName:'krazybuy-images.pdf', label:'Building PDF' }); } 
        form.append('file', files[0], files[0].name); 
        if (m === 'split')    { if (!v('ranges').trim()) throw new Error('Enter the pages or ranges to extract.'); form.append('ranges', v('ranges')); return runJob({ path:'/pdf/split', body:form, fallbackName:'krazybuy-pages.pdf', label:'Extracting pages' }); } 
        if (m === 'compress') { form.append('quality', v('quality')); return runJob({ path:'/pdf/compress', body:form, fallbackName:'krazybuy-compressed.pdf', label:'Optimizing PDF' }); } 
        if (m === 'protect')  { if (v('password').length < 6) throw new Error('Use a password of at least 6 characters.'); form.append('password', v('password')); return runJob({ path:'/pdf/protect', body:form, fallbackName:'krazybuy-protected.pdf', label:'Protecting PDF' }); } 
        if (m === 'to-image') { form.append('format', v('format')); return runJob({ path:'/pdf/to-image', body:form, fallbackName:`krazybuy-page.${v('format') || 'png'}`, label:'Rendering page' }); } 
        if (m === 'organize') { 
          const p = state.scratch.pages; 
          if (!p) throw new Error('Load the pages first, then apply your changes.'); 
          if (!p.some(x => !x.removed)) throw new Error('At least one page must remain.'); 
          const { del, order, rotate, mixed } = pdfOrganizePayload(); 
          if (mixed) toast('Mixed rotations detected — the server applies one rotation to all pages, so only the first was used.', 'info'); 
          form.append('deletePages', del.join(',')); 
          form.append('reorder', JSON.stringify(order)); 
          form.append('rotate', String(rotate)); 
          form.append('text', ''); form.append('watermark', ''); form.append('pageNumbers', 'false'); 
          form.append('page', '1'); form.append('fontSize', '18'); 
          return runJob({ path:'/pdf/edit', body:form, fallbackName:'krazybuy-organized.pdf', label:'Rebuilding document' }); 
        } 
        /* edit */ 
        form.append('text', v('text')); form.append('page', v('page') || '1'); 
        form.append('fontSize', v('fontSize') || '18'); form.append('watermark', v('watermark')); 
        form.append('rotate', v('rotate') || '0'); 
        form.append('pageNumbers', String(Boolean($('#pageNumbers')?.checked))); 
        form.append('deletePages', ''); form.append('reorder', JSON.stringify([])); 
        if (!v('text') && !v('watermark') && v('rotate') === '0' && !$('#pageNumbers')?.checked) 
          throw new Error('Add text, a watermark, page numbers or a rotation before running.'); 
        return runJob({ path:'/pdf/edit', body:form, fallbackName:'krazybuy-edited.pdf', label:'Editing PDF' }); 
      } 
 
      if (tool.family === 'ppt') { 
        if (tool.mode === 'images-to-pptx') { files.forEach(f => form.append('files', f, f.name)); return runJob({ path:'/ppt/images-to-pptx', body:form, fallbackName:'krazybuy-presentation.pptx', label:'Building presentation' }); } 
        form.append('file', files[0], files[0].name); 
        if (tool.mode === 'to-pdf')      return runJob({ path:'/ppt/to-pdf', body:form, fallbackName:'krazybuy-slides.pdf', label:'Converting with LibreOffice' }); 
        if (tool.mode === 'to-images')   return runJob({ path:'/ppt/to-images', body:form, fallbackName:'krazybuy-slides.zip', label:'Rendering slides' }); 
        if (tool.mode === 'pdf-to-pptx') return runJob({ path:'/ppt/pdf-to-pptx', body:form, fallbackName:'krazybuy-presentation.pptx', label:'Building presentation' }); 
      } 
 
      if (tool.family === 'doc') { 
        form.append('file', files[0], files[0].name); 
        const map = { 'to-pdf':['/documents/to-pdf','krazybuy-document.pdf','Converting document'], 
                      'to-txt':['/documents/to-txt','krazybuy-document.txt','Extracting text'], 
                      'pdf-to-docx':['/documents/pdf-to-docx','krazybuy-document.docx','Extracting text'] }[tool.mode]; 
        if (map) return runJob({ path:map[0], body:form, fallbackName:map[1], label:map[2] }); 
      } 
 
      if (tool.family === 'xlsx') { 
        form.append('file', files[0], files[0].name); 
        const map = { 'csv-to-xlsx':['/xlsx/csv-to-xlsx','krazybuy-workbook.xlsx','Building workbook'], 
                      'xlsx-to-csv':['/xlsx/xlsx-to-csv','krazybuy-sheet.csv','Exporting CSV'], 
                      'to-pdf':['/xlsx/to-pdf','krazybuy-workbook.pdf','Rendering report'] }[tool.mode]; 
        if (map) return runJob({ path:map[0], body:form, fallbackName:map[1], label:map[2] }); 
      } 
 
      if (tool.family === 'image') { 
        form.append('file', files[0], files[0].name); 
        ['width','height','degrees','quality','format','flip','text','watermark'].forEach(id => { 
          const el = $('#' + id); if (el && el.value !== '') form.append(id, el.value); 
        }); 
        const path = tool.mode === 'convert' ? '/image/convert' : tool.mode === 'compress' ? '/image/compress' : '/image/edit'; 
        return runJob({ path, body:form, fallbackName:`krazybuy-image.${v('format') || 'webp'}`, label:'Processing image' }); 
      } 
 
      if (tool.id === 'zip-create') { 
        const paths = []; 
        files.forEach(f => { form.append('files', f, f.name); paths.push(relPathOf(f)); }); 
        form.append('relativePaths', JSON.stringify(paths)); 
        const name = (v('zipName').trim() || 'krazybuy-files.zip').replace(/(\.zip)?$/i, '.zip'); 
        return runJob({ path:'/archive/create', body:form, fallbackName:name, label:'Compressing archive' }); 
      } 
      throw new Error('This workflow has no runnable action yet.'); 
    } 
 
    /* ---------- PPT ---------- */ 
    case 'ppt-create': { 
      const slides = Number(v('slides') || 1); 
      if (!v('title').trim()) throw new Error('Give the presentation a title.'); 
      if (!(slides >= 1 && slides <= 100)) throw new Error('Choose between 1 and 100 slides.'); 
      return runJob({ path:'/ppt/create', label:'Building presentation', fallbackName:'krazybuy-presentation.pptx', 
        body: new Blob([JSON.stringify({ title:v('title'), subtitle:v('subtitle'), slides, content:v('contentText') })], 
                       { type:'application/json' }) }); 
    } 
    case 'ppt-save': { 
      if (!files.length) throw new Error('Add a .pptx first.'); 
      const deck = state.scratch.deck || []; 
      const repl = {}; 
      deck.forEach(s => { if (s.orig && s.text !== s.orig) repl[s.orig] = s.text; }); 
      const anyStructural = v('deleteSlides') || v('reorderSlides') || v('duplicateSlide') || $('#addSlide')?.checked; 
      if (!Object.keys(repl).length && !anyStructural) throw new Error('Edit some slide text or set a slide operation first.'); 
      const form = new FormData(); 
      form.append('file', files[0], files[0].name); 
      form.append('textReplacements', JSON.stringify(repl)); 
      form.append('addText', ''); form.append('addTextSlide', '1'); 
      form.append('deleteSlides', v('deleteSlides')); 
      form.append('reorderSlides', v('reorderSlides')); 
      form.append('duplicateSlide', v('duplicateSlide')); 
      form.append('addSlide', String(Boolean($('#addSlide')?.checked))); 
      return runJob({ path:'/ppt/edit', body:form, fallbackName:'krazybuy-presentation.pptx', label:'Saving presentation' }); 
    } 
 
    /* ---------- DOC ---------- */ 
    case 'doc-load': { 
      const r = await runJob({ path:'/documents/read', body:fd(tool), expect:'json', label:'Extracting text' }); 
      const text = r?.text ?? r?.data?.text ?? ''; 
      $('#docText').value = text; 
      $('#docMeta').textContent = `${text.length.toLocaleString()} characters · ${text.split(/\s+/).filter(Boolean).length.toLocaleString()} words · about ${Math.max(1, Math.ceil(text.length / 3000))} page(s)`; 
      return toast('Document text loaded'); 
    } 
    case 'doc-save-text': { 
      const text = v('docText'); 
      if (!text.trim()) throw new Error('Load a document or type some text first.'); 
      const title = (files[0]?.name || 'KrazyBuy Document').replace(/\.[^.]+$/, ''); 
      return runJob({ path:'/documents/create', label:'Building DOCX', fallbackName:`${title}-krazybuy.docx`, 
        body: new URLSearchParams({ text, title }) }); 
    } 
    case 'doc-replace': { 
      if (!files.length) throw new Error('Add a .docx first.'); 
      if (!v('find')) throw new Error('Enter the text you want to find.'); 
      const form = fd(tool); 
      form.append('find', v('find')); form.append('replace', v('replace')); 
      form.append('title', (files[0].name || 'document').replace(/\.[^.]+$/, '')); 
      return runJob({ path:'/documents/edit', body:form, fallbackName:'krazybuy-edited.docx', label:'Rewriting document' }); 
    } 
    case 'doc-export-pdf': { 
      if (v('docText').trim()) 
        return runJob({ path:'/documents/text-to-pdf', label:'Rendering PDF', fallbackName:'krazybuy-document.pdf', 
          body: new URLSearchParams({ text: v('docText'), title:'KrazyBuy Document' }) }); 
      return runJob({ path:'/documents/to-pdf', body:fd(tool), fallbackName:'krazybuy-document.pdf', label:'Converting document' }); 
    } 
    case 'doc-new-docx': { 
      if (!v('text').trim()) throw new Error('Write some content first.'); 
      return runJob({ path:'/documents/create', label:'Building DOCX', fallbackName:'krazybuy-document.docx', 
        body: new URLSearchParams({ text: v('text'), title: v('title') || 'KrazyBuy Document' }) }); 
    } 
    case 'doc-new-pdf': { 
      if (!v('text').trim()) throw new Error('Write some content first.'); 
      return runJob({ path:'/documents/text-to-pdf', label:'Rendering PDF', fallbackName:'krazybuy-document.pdf', 
        body: new URLSearchParams({ text: v('text'), title: v('title') || 'KrazyBuy Document' }) }); 
    } 
 
    /* ---------- XLSX ---------- */ 
    case 'xlsx-load': { 
      const r = await runJob({ path:'/xlsx/inspect', body:fd(tool), expect:'json', label:'Reading workbook' }); 
      const sheets = (r?.data?.worksheets || r?.worksheets || []).map(ws => { 
        const rows = (ws.rows || []).map(row => (row.cells || row || []).map(c => c ?? '')); 
        return { title: ws.title || 'Sheet1', rows: rows.length ? rows : [[]], dirty: {}, 
                 cols: Math.max(6, ...rows.map(r2 => r2.length)) }; 
      }); 
      if (!sheets.length) throw new Error('The server reported no worksheets in this workbook.'); 
      state.scratch.wb = { sheets, active: 0 }; 
      drawGrid(); 
      return toast(`${sheets.length} sheet${sheets.length === 1 ? '' : 's'} loaded`); 
    } 
    case 'sheet-tab': { 
      state.scratch.wb.active = Number(actEl?.dataset?.i || 0); 
      return drawGrid(); 
    } 
    case 'xlsx-save': { 
      const wb = state.scratch.wb; 
      if (!wb) throw new Error('Load the workbook first.'); 
      const ws = wb.sheets[wb.active]; 
      const cells = ws.dirty; 
      if (!Object.keys(cells).length && !v('rename') && !v('deleteRow') && v('freezeRows') === '0') 
        throw new Error('Edit a cell or set a sheet option before saving.'); 
      const form = fd(tool); 
      form.append('sheet', ws.title); 
      form.append('cells', JSON.stringify(cells)); 
      form.append('renameSheet', v('rename')); 
      form.append('deleteRow', v('deleteRow')); 
      form.append('freezeRows', v('freezeRows') || '0'); 
      return runJob({ path:'/xlsx/edit', body:form, fallbackName:'krazybuy-workbook.xlsx', label:'Writing workbook' }); 
    } 
    case 'xlsx-csv': return runJob({ path:'/xlsx/xlsx-to-csv', body:fd(tool), fallbackName:'krazybuy-sheet.csv', label:'Exporting CSV' }); 
    case 'xlsx-pdf': return runJob({ path:'/xlsx/to-pdf', body:fd(tool), fallbackName:'krazybuy-workbook.pdf', label:'Rendering report' }); 
 
    /* ---------- Recent ---------- */ 
    case 'rfilter': { 
      state.scratch.rFilter = actEl?.dataset?.type || 'All'; 
      $$('[data-act="rfilter"]').forEach(b => b.classList.toggle('btn--soft', b.dataset.type === state.scratch.rFilter)); 
      return drawRecent(); 
    } 
    case 'rclear': { 
      if (!await confirmDialog({ title:'Clear recent history?', message:'This removes the local list of file names. Your actual files are not affected.', confirmLabel:'Clear history' })) return; 
      LS.del(K.recent); toast('History cleared', 'info'); return viewRecent(); 
    } 
    case 'rdel': { 
      const id = actEl?.dataset?.id || ''; 
      LS.set(K.recent, recent().filter(r => r.id !== id)); 
      return drawRecent(); 
    } 
    case 'rname': { 
      const id = actEl?.dataset?.id || ''; 
      const rec = recent().find(r => r.id === id); 
      return openModal({ 
        title:'Rename history entry', 
        bodyHTML:`<p>This changes the label in your local history only — the file on disk keeps its name.</p> 
          <div class="field"><label for="newName">Name</label><input id="newName" value="${esc(rec?.name || '')}"></div>`, 
        actions:[{ label:'Cancel' }, { label:'Save', variant:'btn--primary', run: box => { 
          const val = $('#newName', box).value.trim(); 
          if (!val) return true; 
          LS.set(K.recent, recent().map(r => r.id === id ? { ...r, name: val } : r)); 
          drawRecent(); toast('Entry renamed', 'info'); 
        }}] }); 
    } 
  } 
} 
 
/* Inputs: grid cells, slide text, live image preview */ 
document.addEventListener('input', e => { 
  const cell = e.target.closest('[data-cell]'); 
  if (cell) { 
    const wb = state.scratch.wb; if (!wb) return; 
    const ws = wb.sheets[wb.active], ref = cell.dataset.cell; 
    ws.dirty[ref] = cell.value; 
    cell.parentElement.classList.add('dirty'); 
    $('#cellRef').textContent = ref; 
    $('#formula').value = cell.value; 
    return; 
  } 
  const slide = e.target.closest('[data-slide-input]'); 
  if (slide) { 
    const s = state.scratch.deck?.[Number(slide.dataset.slideInput)]; 
    if (s) { s.text = slide.value; slide.closest('.slide-row').classList.toggle('dirty', s.text !== s.orig); } 
    return; 
  } 
  if (e.target.id === 'degrees' || e.target.id === 'flip') livePreview(); 
}); 
document.addEventListener('focusin', e => { 
  const cell = e.target.closest('[data-cell]'); 
  if (cell) { $('#cellRef').textContent = cell.dataset.cell; $('#formula').value = cell.value; } 
}); 
$('#app').addEventListener?.('change', e => { if (e.target.id === 'flip') livePreview(); }); 
 
/* Dropzone keyboard accessibility */
document.addEventListener('keydown', e => {
  const dz = e.target instanceof Element ? e.target.closest('[data-dz]') : null;
  if (!dz || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault();
  const tool = byId(state.toolId);
  if (!tool) return;
  pick({ accept: tool.accept, multiple: tool.multiple }, files => addFiles(tool, files));
});

/* Drag & drop — zone + row reordering */ 
document.addEventListener('dragover', e => { 
  const target = e.target instanceof Element ? e.target : null;
  const dz = target?.closest('[data-dz]'); 
  const row = target?.closest('.file-row[draggable="true"]'); 
  const tile = target?.closest('[data-page]'); 
  if (dz) { e.preventDefault(); dz.classList.add('is-drag'); } 
  if (row) { e.preventDefault(); row.classList.add('is-drop-target'); } 
  if (tile) e.preventDefault(); 
}); 
document.addEventListener('dragleave', e => { 
  const target = e.target instanceof Element ? e.target : null;
  target?.closest('[data-dz]')?.classList.remove('is-drag'); 
  target?.closest('.file-row')?.classList.remove('is-drop-target'); 
}); 
let dragIdx = null, dragPage = null; 
document.addEventListener('dragstart', e => { 
  const target = e.target instanceof Element ? e.target : null;
  const row = target?.closest('.file-row[draggable="true"]'); 
  const tile = target?.closest('[data-page]'); 
  if (row) { dragIdx = Number(row.dataset.idx); e.dataTransfer.effectAllowed = 'move'; } 
  if (tile) { dragPage = Number(tile.dataset.page); e.dataTransfer.effectAllowed = 'move'; } 
}); 
document.addEventListener('drop', async e => { 
  const tool = byId(state.toolId); 
  if (!tool) { e.preventDefault(); return; }
  const target = e.target instanceof Element ? e.target : null;
  const dz = target?.closest('[data-dz]'); 
  if (dz) { 
    e.preventDefault(); dz.classList.remove('is-drag'); 
    const files = await filesFromDrop(e.dataTransfer); 
    if (files.length) addFiles(tool, files); 
    return; 
  } 
  const row = target?.closest('.file-row[draggable="true"]'); 
  if (row && dragIdx !== null) { 
    e.preventDefault(); row.classList.remove('is-drop-target'); 
    const to = Number(row.dataset.idx), list = bucket(tool.id).slice(); 
    list.splice(to, 0, ...list.splice(dragIdx, 1)); 
    setBucket(tool.id, list); 
    $('#fileArea').innerHTML = renderFileList(tool); paintThumbs(tool); 
    dragIdx = null; toast('Order updated', 'info'); 
    return; 
  } 
  const tile = target?.closest('[data-page]'); 
  if (tile && dragPage !== null) { 
    e.preventDefault(); 
    const to = Number(tile.dataset.page), pages = state.scratch.pages; 
    pages.splice(to, 0, ...pages.splice(dragPage, 1)); 
    dragPage = null; drawTiles(); 
  } 
}); 
/* Never let the browser navigate away on a stray drop */ 
window.addEventListener('dragover', e => e.preventDefault()); 
window.addEventListener('drop', e => {
  const target = e.target instanceof Element ? e.target : null;
  if (!target?.closest('[data-dz]')) e.preventDefault();
}); 
 
/* Keyboard */ 
document.addEventListener('keydown', e => { 
  const k = (e.key || '').toLowerCase(); 
  if ((e.ctrlKey || e.metaKey) && k === 'k') { e.preventDefault(); return palette.open ? closePalette() : openPalette(); } 
  if (k === 'escape') { if (palette.open) return closePalette(); if ($('#layer-modal') && !$('#layer-modal').hidden) return closeModal(); if ($('#drawer')) return closeDrawer(); } 
  if ((e.ctrlKey || e.metaKey) && k === 'enter') { e.preventDefault(); $('#workspace .sticky-cta .btn--primary')?.click(); } 
  if (k === 'enter' || k === ' ') { 
    const star = e.target instanceof Element ? e.target.closest('[data-act="fav"][role="button"]') : null; 
    if (star) { e.preventDefault(); star.click(); } 
  } 
}); 
 
/* ============================================================ 
 * 22. Boot 
 * ==========================================================*/ 
renderShell(); 
openTool((location.hash || '').slice(1) || LS.get(K.last, 'dashboard')); 
window.addEventListener('hashchange', () => { 
  const id = location.hash.slice(1); 
  if (id && id !== state.toolId) openTool(id); 
}); 
window.KRAZYBUY = { ENDPOINTS, TOOLS, state, CONFIG, openTool, request, saveBlob };   // exposed for regression/testing 
})();
