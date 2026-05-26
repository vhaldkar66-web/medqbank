/* ─────────────────────────────────────────────
   MedQBank — QBank Engine
   ───────────────────────────────────────────── */

// ── STATE ────────────────────────────────────────────────────────────────────
const State = {
  mode: 'practice',
  exam: 'ALL',
  year: '',
  subject: null,
  topic: null,
  search: '',
  page: 1,
  perPage: 20,
  shuffle: false,
  currentTab: 'questions',
  answered: {},       // { qid: label }
  bookmarks: new Set(),
  expandedExp: new Set(),
};

const Session = { answered: 0, correct: 0, wrong: 0 };

let allQuestions = [];       // currently loaded subject's questions
let filteredQuestions = [];  // after applying filters
let displayQuestions = [];   // after shuffle

let loadedSubjects = {};     // cache: slug -> questions[]
let manifest = null;

// ── INIT ─────────────────────────────────────────────────────────────────────
async function initQBank() {
  manifest = await getManifest();

  buildYearFilter();
  buildSubjectList();
  restoreSession();

  // Handle URL params / hash routing
  parseURLParams();

  await loadSubject(State.subject);
}

function parseURLParams() {
  // Hash routing: #anatomy, #q=123
  const hash = location.hash.replace('#', '');
  if (hash.startsWith('q=')) {
    const qid = parseInt(hash.replace('q=', ''));
    // Will scroll to question after render
    State._scrollToQ = qid;
  } else if (hash) {
    State.subject = slugToSubject(hash) || null;
  }
  // Query params: ?exam=NEET PG
  const params = new URLSearchParams(location.search);
  if (params.get('exam')) {
    State.exam = params.get('exam');
    highlightExamChip(State.exam);
  }
}

function slugToSubject(slug) {
  if (!manifest) return null;
  const found = manifest.subjects.find(s => s.slug === slug);
  return found ? found.name : null;
}

function subjectToSlug(name) {
  if (!manifest) return '';
  const found = manifest.subjects.find(s => s.name === name);
  return found ? found.slug : '';
}

// ── DATA LOADING ─────────────────────────────────────────────────────────────
async function loadSubject(subjectName) {
  showLoading(true);

  if (!subjectName) {
    // Load all subjects
    if (!loadedSubjects['__all__']) {
      const all = [];
      for (const s of manifest.subjects) {
        const qs = await fetchSubjectData(s.slug);
        all.push(...qs);
      }
      loadedSubjects['__all__'] = all;
    }
    allQuestions = loadedSubjects['__all__'];
  } else {
    const slug = subjectToSlug(subjectName);
    if (!loadedSubjects[slug]) {
      loadedSubjects[slug] = await fetchSubjectData(slug);
    }
    allQuestions = loadedSubjects[slug];
  }

  showLoading(false);
  applyFilters();
}

async function fetchSubjectData(slug) {
  try {
    const res = await fetch(`${slug}.json`);
    if (!res.ok) throw new Error(`Failed to load ${slug}`);
    return await res.json();
  } catch (e) {
    console.error(e);
    return [];
  }
}

function showLoading(show) {
  document.getElementById('loading-state').style.display = show ? 'flex' : 'none';
  document.getElementById('questions-list').style.display = show ? 'none' : 'block';
}

// ── FILTER BUILDERS ──────────────────────────────────────────────────────────
function buildYearFilter() {
  const sel = document.getElementById('year-filter');
  manifest.years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    sel.appendChild(opt);
  });
}

function buildSubjectList() {
  const container = document.getElementById('subject-list');
  container.innerHTML = '';

  // "All" button
  const allBtn = mkEl('button', { className: 'subj-btn active', id: 'subj-ALL' },
    `<span class="subj-name">All Subjects</span><span class="subj-count">${manifest.total.toLocaleString()}</span>`);
  allBtn.onclick = () => setSubject(null);
  container.appendChild(allBtn);

  manifest.subjects.forEach(({ name, slug, count }) => {
    const wrapper = mkEl('div');

    const btn = mkEl('button', { className: 'subj-btn', id: `subj-${slug}` },
      `<span class="subj-name">${name}</span><span class="subj-count">${count.toLocaleString()}</span>`);
    btn.onclick = () => setSubject(name);
    wrapper.appendChild(btn);

    // Topic list placeholder (built when subject loaded)
    const topicDiv = mkEl('div', { className: 'topic-list', id: `topics-${slug}` });
    wrapper.appendChild(topicDiv);

    container.appendChild(wrapper);
  });
}

function buildTopicList(subjectName) {
  const slug = subjectToSlug(subjectName);
  const container = document.getElementById(`topics-${slug}`);
  if (!container || container.dataset.built) return;

  const qs = loadedSubjects[slug] || [];
  const topicCounts = {};
  qs.forEach(q => { topicCounts[q.topic] = (topicCounts[q.topic] || 0) + 1; });
  const topics = Object.keys(topicCounts).sort();
  if (topics.length <= 1) return;

  const allT = mkEl('button', { className: 'topic-btn' },
    `<span>All Topics</span><span class="subj-count">${qs.length}</span>`);
  allT.onclick = (e) => { e.stopPropagation(); setTopic(null); };
  container.appendChild(allT);

  topics.forEach(t => {
    const tb = mkEl('button', { className: 'topic-btn', id: `topic-${slug}-${t}` },
      `<span>${t}</span><span class="subj-count">${topicCounts[t]}</span>`);
    tb.onclick = (e) => { e.stopPropagation(); setTopic(t); };
    container.appendChild(tb);
  });

  container.dataset.built = '1';
}

// ── FILTER LOGIC ─────────────────────────────────────────────────────────────
function applyFilters() {
  const search = State.search.toLowerCase().trim();

  filteredQuestions = allQuestions.filter(q => {
    if (State.exam !== 'ALL' && q.etype !== State.exam) return false;
    if (State.year && q.year !== parseInt(State.year)) return false;
    if (State.topic && q.topic !== State.topic) return false;
    if (search) {
      const hay = (q.text + ' ' + q.opts.map(o => o.t).join(' ')).toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  displayQuestions = State.shuffle ? shuffleArr([...filteredQuestions]) : [...filteredQuestions];
  State.page = 1;

  updateHeaderStats();
  updateContentHeader();
  renderPage();
}

// ── SETTERS ──────────────────────────────────────────────────────────────────
async function setSubject(name) {
  State.subject = name;
  State.topic = null;
  State.page = 1;

  // URL routing
  const slug = name ? subjectToSlug(name) : '';
  history.replaceState(null, '', slug ? `#${slug}` : location.pathname + location.search);

  updateSubjectSidebar();
  await loadSubject(name);

  if (name) buildTopicList(name);
  if (window.innerWidth <= 900) closeSidebar();
  trackEvent('filter_subject', { subject: name || 'All' });
}

function setTopic(topic) {
  State.topic = topic;
  State.page = 1;
  updateTopicHighlight();
  applyFilters();
  trackEvent('filter_topic', { topic });
}

function setExam(exam) {
  State.exam = exam;
  highlightExamChip(exam);
  applyFilters();
  trackEvent('filter_exam', { exam });
}

function setYear(year) {
  State.year = year;
  applyFilters();
}

function setMode(mode) {
  State.mode = mode;
  document.getElementById('mode-practice').classList.toggle('active', mode === 'practice');
  document.getElementById('mode-test').classList.toggle('active', mode === 'test');
  renderPage();
}

function toggleShuffle() {
  State.shuffle = !State.shuffle;
  const btn = document.getElementById('shuffle-btn');
  btn.textContent = State.shuffle ? '⇄ Shuffled' : '⇄ Shuffle';
  btn.style.background = State.shuffle ? 'var(--accent-light)' : '';
  btn.style.color = State.shuffle ? 'var(--accent-dark)' : '';
  if (State.shuffle) displayQuestions = shuffleArr([...filteredQuestions]);
  else displayQuestions = [...filteredQuestions];
  State.page = 1;
  renderPage();
}

let searchTimer;
function onSearch() {
  State.search = document.getElementById('search-input').value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applyFilters, 280);
}

// ── SIDEBAR UI ────────────────────────────────────────────────────────────────
function updateSubjectSidebar() {
  document.querySelectorAll('.subj-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.topic-list').forEach(d => d.classList.remove('open'));

  const slug = State.subject ? subjectToSlug(State.subject) : 'ALL';
  const el = document.getElementById(`subj-${slug}`);
  if (el) el.classList.add('active');

  if (State.subject) {
    const topicDiv = document.getElementById(`topics-${slug}`);
    if (topicDiv) topicDiv.classList.add('open');
  }
}

function updateTopicHighlight() {
  document.querySelectorAll('.topic-btn').forEach(b => b.classList.remove('active'));
  if (State.topic && State.subject) {
    const slug = subjectToSlug(State.subject);
    const el = document.getElementById(`topic-${slug}-${State.topic}`);
    if (el) el.classList.add('active');
  }
}

function highlightExamChip(exam) {
  document.querySelectorAll('.exam-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.exam === exam);
  });
}

// ── SIDEBAR MOBILE ───────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ── CONTENT HEADER ───────────────────────────────────────────────────────────
function updateContentHeader() {
  const title = State.subject
    ? (State.topic ? `${State.subject} — ${State.topic}` : State.subject)
    : 'All Questions';
  const n = filteredQuestions.length;
  const examPart = State.exam !== 'ALL' ? ` · ${State.exam}` : '';
  const yearPart = State.year ? ` · ${State.year}` : '';
  document.getElementById('content-title').textContent = title;
  document.getElementById('content-subtitle').textContent =
    `${n.toLocaleString()} question${n !== 1 ? 's' : ''}${examPart}${yearPart}`;
}

// ── HEADER STATS ──────────────────────────────────────────────────────────────
function updateHeaderStats() {
  document.getElementById('hs-filtered').textContent = filteredQuestions.length.toLocaleString();
  document.getElementById('hs-attempted').textContent = Object.keys(State.answered).length.toLocaleString();
  const total = Object.keys(State.answered).length;
  const correct = Object.values(State.answered).filter(v => v === '__correct__').length;
  document.getElementById('hs-accuracy').textContent = total > 0 ? Math.round(correct / total * 100) + '%' : '—';
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderPage() {
  if (State.currentTab === 'bookmarks') { renderBookmarks(); return; }

  const container = document.getElementById('questions-list');
  const start = (State.page - 1) * State.perPage;
  const pageQs = displayQuestions.slice(start, start + State.perPage);

  if (pageQs.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <h3>No questions found</h3>
      <p>Try changing the subject, exam filter, or search term.</p>
    </div>`;
    document.getElementById('pagination').innerHTML = '';
    updateProgress(0, 0);
    return;
  }

  let html = '';
  pageQs.forEach((q, i) => {
    html += renderCard(q, start + i + 1);
    // Insert ad after every 5th question
    if ((i + 1) % 5 === 0 && i < pageQs.length - 1) {
      html += `<div class="in-feed-ad">
        <ins class="adsbygoogle" style="display:block" data-ad-format="fluid"
          data-ad-layout-key="-fb+5w+4e-db+86" data-ad-client="${typeof ADSENSE_CLIENT !== 'undefined' ? ADSENSE_CLIENT : 'ca-pub-XXXXXXXXXXXXXXXX'}" data-ad-slot="XXXXXXXXXX"></ins>
        <script>(adsbygoogle=window.adsbygoogle||[]).push({});<\/script>
      </div>`;
    }
  });

  container.innerHTML = html;
  renderPagination();
  updateProgress(pageQs.filter(q => State.answered[q.id]).length, pageQs.length);

  // Scroll to specific question if requested
  if (State._scrollToQ !== undefined) {
    setTimeout(() => {
      const el = document.getElementById(`qcard-${State._scrollToQ}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      State._scrollToQ = undefined;
    }, 100);
  }
}

function renderCard(q, num) {
  const answered = State.answered[q.id];
  const isCorrect = answered === '__correct__';
  const isWrong = answered && !isCorrect;
  const expShown = State.expandedExp.has(q.id);
  const bookmarked = State.bookmarks.has(q.id);
  const testMode = State.mode === 'test';
  const slug = subjectToSlug(q.subj);

  const tags = [
    `<span class="tag tag-subj">${q.subj}</span>`,
    q.topic !== 'General' ? `<span class="tag tag-topic">${q.topic}</span>` : '',
    `<span class="tag tag-etype">${q.etype}</span>`,
    q.year ? `<span class="tag tag-year">${q.year}</span>` : '',
  ].filter(Boolean).join('');

  const opts = q.opts.map(o => {
    let cls = 'opt-btn';
    let disabled = '';
    if (answered) {
      disabled = 'disabled';
      if (o.c) cls += ' correct';
      else if ((isWrong && answered === '__wrong__' + o.l) || (State.answered[q.id] === o.l)) cls += ' wrong';
    }
    // Fix: track actual label chosen
    const chosen = State.answeredLabel?.[q.id];
    if (answered) {
      disabled = 'disabled';
      if (o.c) cls += ' correct';
      else if (chosen === o.l && !o.c) cls += ' wrong';
    }
    return `<button class="${cls}" ${disabled} onclick="selectOption(${q.id}, '${o.l}', ${o.c})">
      <span class="opt-label">${o.l}.</span>
      <span class="opt-text">${escHtml(o.t)}</span>
    </button>`;
  }).join('');

  let resultBadge = '';
  if (answered) {
    resultBadge = isCorrect
      ? `<span class="result-badge result-correct">✓ Correct</span>`
      : `<span class="result-badge result-wrong">✗ Wrong — Ans: ${q.ans}</span>`;
  }

  const showExpBtn = (answered || State.mode === 'practice')
    ? `<button class="btn btn-ghost btn-sm" onclick="toggleExp(${q.id})">${expShown ? '▲ Hide Explanation' : '📋 Explanation'}</button>`
    : `<span style="font-size:12px;color:var(--text3)">Answer to see explanation</span>`;

  const qImgs = q.qi?.length
    ? `<div class="q-images">${q.qi.map(u => `<img src="${u}" alt="Question image" onclick="openLightbox('${u}')" loading="lazy">`).join('')}</div>`
    : '';

  let expHtml = '';
  if (expShown && (answered || State.mode === 'practice')) {
    const eImgs = q.ei?.length
      ? `<div class="exp-images">${q.ei.map(u => `<img src="${u}" alt="Explanation image" onclick="openLightbox('${u}')" loading="lazy">`).join('')}</div>`
      : '';
    expHtml = `<div class="explanation">
      <div class="exp-label">📋 Explanation</div>
      <div class="exp-content">${safeHTML(q.exp) || '<p>No explanation available for this question.</p>'}</div>
      ${eImgs}
    </div>`;
  }

  return `<div class="q-card" id="qcard-${q.id}">
    <div class="q-meta">
      <span class="q-num">Q${num}</span>
      ${tags}
      <button class="bookmark-btn ${bookmarked ? 'saved' : ''}" onclick="toggleBookmark(${q.id})" title="Bookmark">${bookmarked ? '🔖' : '☆'}</button>
      <button class="share-btn" onclick="shareQuestion(${q.id})" title="Share">⎋</button>
    </div>
    <div class="q-text">${q.text}</div>
    ${qImgs}
    <div class="options">${opts}</div>
    <div class="q-actions">
      ${showExpBtn}
      ${resultBadge}
    </div>
    ${expHtml}
  </div>`;
}

// ── ACTIONS ──────────────────────────────────────────────────────────────────
function selectOption(qid, label, isCorrect) {
  if (State.answered[qid]) return;

  State.answered[qid] = isCorrect ? '__correct__' : '__wrong__';
  if (!State.answeredLabel) State.answeredLabel = {};
  State.answeredLabel[qid] = label;

  Session.answered++;
  if (isCorrect) Session.correct++;
  else Session.wrong++;

  updateSessionBar();
  updateHeaderStats();
  saveSession();
  trackEvent('answer_question', { correct: isCorrect, subject: allQuestions.find(q => q.id === qid)?.subj });

  // Re-render card
  const q = allQuestions.find(q => q.id === qid) ||
            (loadedSubjects['__all__'] || []).find(q => q.id === qid);
  if (!q) return;
  const globalIdx = displayQuestions.findIndex(dq => dq.id === qid);
  refreshCard(q, globalIdx >= 0 ? (State.page - 1) * State.perPage + globalIdx + 1 : 0);

  // Auto-expand explanation in practice mode
  if (State.mode === 'practice') {
    setTimeout(() => toggleExp(qid, true), 200);
  }
}

function toggleExp(qid, forceOpen) {
  if (forceOpen || !State.expandedExp.has(qid)) State.expandedExp.add(qid);
  else State.expandedExp.delete(qid);

  const q = displayQuestions.find(q => q.id === qid) ||
            allQuestions.find(q => q.id === qid);
  if (!q) return;
  const globalIdx = displayQuestions.findIndex(dq => dq.id === qid);
  refreshCard(q, globalIdx >= 0 ? (State.page - 1) * State.perPage + globalIdx + 1 : 0);
}

function refreshCard(q, num) {
  const el = document.getElementById(`qcard-${q.id}`);
  if (!el) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = renderCard(q, num);
  el.replaceWith(tmp.firstElementChild);
}

function toggleBookmark(qid) {
  if (State.bookmarks.has(qid)) State.bookmarks.delete(qid);
  else { State.bookmarks.add(qid); showToast('Bookmarked!'); }
  saveSession();
  document.getElementById('sb-bk').textContent = State.bookmarks.size;
  const btn = document.querySelector(`#qcard-${qid} .bookmark-btn`);
  if (btn) {
    btn.classList.toggle('saved', State.bookmarks.has(qid));
    btn.textContent = State.bookmarks.has(qid) ? '🔖' : '☆';
  }
}

function expandAll() {
  displayQuestions.slice((State.page-1)*State.perPage, State.page*State.perPage)
    .forEach(q => State.expandedExp.add(q.id));
  renderPage();
}
function collapseAll() {
  displayQuestions.slice((State.page-1)*State.perPage, State.page*State.perPage)
    .forEach(q => State.expandedExp.delete(q.id));
  renderPage();
}

// ── TABS ─────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  State.currentTab = tab;
  document.querySelectorAll('.qb-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  renderPage();
}

function renderBookmarks() {
  const container = document.getElementById('questions-list');
  const all = loadedSubjects['__all__'] || allQuestions;
  const bqs = all.filter(q => State.bookmarks.has(q.id));
  if (!bqs.length) {
    container.innerHTML = `<div class="empty-state"><h3>No bookmarks yet</h3><p>Click ☆ on any question to save it here.</p></div>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }
  container.innerHTML = bqs.map((q, i) => renderCard(q, i + 1)).join('');
  document.getElementById('pagination').innerHTML = '';
}

// ── PAGINATION ────────────────────────────────────────────────────────────────
function renderPagination() {
  const total = Math.ceil(displayQuestions.length / State.perPage);
  const cur = State.page;
  const pg = document.getElementById('pagination');
  if (total <= 1) { pg.innerHTML = ''; return; }

  let pages = [];
  if (total <= 7) { pages = Array.from({length:total},(_,i)=>i+1); }
  else {
    pages = [1];
    if (cur > 3) pages.push('…');
    for (let i = Math.max(2,cur-1); i <= Math.min(total-1,cur+1); i++) pages.push(i);
    if (cur < total-2) pages.push('…');
    pages.push(total);
  }

  pg.innerHTML = `
    <button class="page-btn" onclick="goPage(${cur-1})" ${cur===1?'disabled':''}>‹</button>
    ${pages.map(p => p==='…'
      ? `<span class="page-ellipsis">…</span>`
      : `<button class="page-btn ${p===cur?'active':''}" onclick="goPage(${p})">${p}</button>`
    ).join('')}
    <button class="page-btn" onclick="goPage(${cur+1})" ${cur===total?'disabled':''}>›</button>
    <span style="font-size:12px;color:var(--text3);margin-left:4px">${((cur-1)*State.perPage)+1}–${Math.min(cur*State.perPage,displayQuestions.length)} of ${displayQuestions.length.toLocaleString()}</span>`;
}

function goPage(p) {
  const total = Math.ceil(displayQuestions.length / State.perPage);
  if (p < 1 || p > total) return;
  State.page = p;
  renderPage();
  document.getElementById('qbank-content').scrollTo({ top: 0, behavior: 'smooth' });
}

// ── SESSION BAR ───────────────────────────────────────────────────────────────
function updateSessionBar() {
  document.getElementById('sb-ans').textContent = Session.answered;
  document.getElementById('sb-cor').textContent = Session.correct;
  document.getElementById('sb-wrg').textContent = Session.wrong;
  const acc = Session.answered > 0 ? Math.round(Session.correct / Session.answered * 100) : 0;
  document.getElementById('sb-score').textContent = Session.answered > 0 ? acc + '%' : '—';
  document.getElementById('sb-bk').textContent = State.bookmarks.size;
}

// ── PROGRESS BAR ──────────────────────────────────────────────────────────────
function updateProgress(done, total) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  document.getElementById('progress-bar').style.width = pct + '%';
}

// ── PERSIST SESSION ───────────────────────────────────────────────────────────
function saveSession() {
  Store.set('medqbank_session', {
    answered: State.answered,
    answeredLabel: State.answeredLabel || {},
    bookmarks: [...State.bookmarks],
    session: Session,
  });
}

function restoreSession() {
  const saved = Store.get('medqbank_session');
  if (!saved) return;
  State.answered = saved.answered || {};
  State.answeredLabel = saved.answeredLabel || {};
  State.bookmarks = new Set(saved.bookmarks || []);
  Object.assign(Session, saved.session || {});
  updateSessionBar();
  updateHeaderStats();
}

function resetSession() {
  if (!confirm('Reset all answers and bookmarks?')) return;
  State.answered = {};
  State.answeredLabel = {};
  State.bookmarks = new Set();
  State.expandedExp = new Set();
  Object.assign(Session, { answered: 0, correct: 0, wrong: 0 });
  Store.remove('medqbank_session');
  updateSessionBar();
  updateHeaderStats();
  renderPage();
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mkEl(tag, props = {}, html = '') {
  const el = document.createElement(tag);
  Object.assign(el, props);
  el.innerHTML = html;
  return el;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
