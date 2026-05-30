/* ─────────────────────────────────────────────
   MedQBank — Shared Utilities
   ───────────────────────────────────────────── */

// ── MANIFEST (loaded once globally) ──────────────────────────────────────────
let MANIFEST = null;
async function getManifest() {
  if (MANIFEST) return MANIFEST;
  const res = await fetch(`https://raw.githubusercontent.com/vhaldkar66-web/medqbank/main/manifest.json?t=${Date.now()}`);
  MANIFEST = await res.json();
  return MANIFEST;
}

// ── NAVBAR ───────────────────────────────────────────────────────────────────
function injectNavbar(activePage) {
  const links = [
    { href: 'index.html', label: 'Home' },
    { href: 'qbank.html', label: 'QBank' },
    { href: 'subjects.html', label: 'Subjects' },
    { href: 'about.html', label: 'About' },
  ];
  const linksHtml = links.map(l =>
    `<a href="${l.href}" class="nav-link ${activePage === l.label ? 'active' : ''}">${l.label}</a>`
  ).join('');

  const html = `
  <nav id="navbar">
    <div class="nav-inner">
      <button class="sb-toggle-btn" id="sb-toggle" onclick="toggleSidebar()" style="display:none">☰</button>
      <a href="index.html" class="nav-logo">Med<span>QBank</span></a>
      <div class="nav-links">${linksHtml}</div>
      <div class="nav-actions">
        <a href="qbank.html" class="btn btn-primary btn-sm">Start Practice →</a>
      </div>
      <button class="nav-menu-btn" id="mobile-menu-btn" onclick="toggleMobileMenu()" aria-label="Menu">☰</button>
    </div>
    <!-- Mobile menu -->
    <div id="mobile-menu" style="display:none; background:var(--surface); border-top:1px solid var(--border); padding:12px 24px 16px;">
      ${links.map(l => `<a href="${l.href}" style="display:block;padding:10px 0;font-size:14px;color:var(--text2);border-bottom:1px solid var(--border)">${l.label}</a>`).join('')}
      <a href="qbank.html" class="btn btn-primary" style="margin-top:12px;display:inline-flex">Start Practice →</a>
    </div>
  </nav>`;

  const placeholder = document.getElementById('navbar-placeholder');
  if (placeholder) placeholder.outerHTML = html;
  else document.body.insertAdjacentHTML('afterbegin', html);
}

function toggleMobileMenu() {
  const m = document.getElementById('mobile-menu');
  if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
}

// ── FOOTER ───────────────────────────────────────────────────────────────────
function injectFooter() {
  const subjects = [
    'Anatomy','Physiology','Biochemistry','Pharmacology','Pathology',
    'Microbiology','Medicine','Surgery','Obstetrics & Gynecology','Pediatrics'
  ];
  const subjectLinks = subjects.map(s => {
    const slug = s.toLowerCase().replace(/ & /g,'-').replace(/ /g,'-').replace(/\//g,'-');
    return `<li><a href="qbank.html#${slug}">${s}</a></li>`;
  }).join('');

  const html = `
  <footer>
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="logo">Med<span>QBank</span></div>
          <p>Free previous year MCQs for NEET PG, AIIMS, INICET, FMGE and UPSC-CMS — with explanations.</p>
          <p style="margin-top:10px;font-size:12px">Questions are sourced from publicly available previous year papers. Explanations are for educational purposes only.</p>
        </div>
        <div class="footer-col">
          <h4>Subjects</h4>
          <ul>${subjectLinks}</ul>
        </div>
        <div class="footer-col">
          <h4>Exams</h4>
          <ul>
            <li><a href="qbank.html?exam=NEET PG">NEET PG</a></li>
            <li><a href="qbank.html?exam=AIIMS">AIIMS PG</a></li>
            <li><a href="qbank.html?exam=INICET">INICET</a></li>
            <li><a href="qbank.html?exam=FMGE">FMGE / MCI Screening</a></li>
            <li><a href="qbank.html?exam=UPSC-CMS">UPSC CMS</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Info</h4>
          <ul>
            <li><a href="about.html">About Us</a></li>
            <li><a href="privacy.html">Privacy Policy</a></li>
            <li><a href="terms.html">Terms of Use</a></li>
            <li><a href="disclaimer.html">Medical Disclaimer</a></li>
            <li><a href="contact.html">Contact</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© ${new Date().getFullYear()} MedQBank. All rights reserved. Not affiliated with NBE, AIIMS, or FMG India.</p>
        <div class="footer-bottom-links">
          <a href="privacy.html">Privacy</a>
          <a href="terms.html">Terms</a>
          <a href="disclaimer.html">Disclaimer</a>
        </div>
      </div>
    </div>
  </footer>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

// ── COOKIE BANNER ────────────────────────────────────────────────────────────
function initCookieBanner() {
  if (localStorage.getItem('cookie_ok')) return;
  const html = `
  <div id="cookie-banner">
    <p>We use cookies and Google AdSense to personalise ads and analyse traffic.
       See our <a href="privacy.html">Privacy Policy</a>.</p>
    <div class="cookie-btns">
      <button class="btn btn-secondary btn-sm" onclick="rejectCookies()">Reject Non-Essential</button>
      <button class="btn btn-primary btn-sm" onclick="acceptCookies()">Accept All</button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function acceptCookies() {
  localStorage.setItem('cookie_ok', 'all');
  document.getElementById('cookie-banner')?.remove();
  loadAdsense();
  loadGA();
}

function rejectCookies() {
  localStorage.setItem('cookie_ok', 'essential');
  document.getElementById('cookie-banner')?.remove();
}

// ── GOOGLE ADSENSE ────────────────────────────────────────────────────────────
// Replace ca-pub-XXXXXXXXXXXXXXXX with your actual AdSense publisher ID
const ADSENSE_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX';

function loadAdsense() {
  if (document.getElementById('adsense-script')) return;
  const s = document.createElement('script');
  s.id = 'adsense-script';
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
}

// ── GOOGLE ANALYTICS ─────────────────────────────────────────────────────────
// Replace G-XXXXXXXXXX with your actual GA4 Measurement ID
const GA_ID = 'G-XXXXXXXXXX';

function loadGA() {
  if (document.getElementById('ga-script')) return;
  const s = document.createElement('script');
  s.id = 'ga-script';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID);
}

function trackEvent(name, params = {}) {
  if (window.gtag) gtag('event', name, params);
}

// ── TOAST ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, duration = 2500) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── LIGHTBOX ─────────────────────────────────────────────────────────────────
function initLightbox() {
  if (document.getElementById('lightbox')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="lightbox" onclick="closeLightbox()">
      <button id="lightbox-close" onclick="closeLightbox()">✕</button>
      <img id="lightbox-img" src="" alt="Enlarged view">
    </div>`);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
}

function openLightbox(url) {
  document.getElementById('lightbox-img').src = url;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lightbox-img').src = '';
  document.body.style.overflow = '';
}

// ── SHARE ────────────────────────────────────────────────────────────────────
function shareQuestion(qid) {
  const url = `${location.origin}${location.pathname}#q=${qid}`;
  if (navigator.share) {
    navigator.share({ title: 'MedQBank Question', url });
  } else {
    navigator.clipboard.writeText(url).then(() => showToast('Link copied to clipboard!'));
  }
  trackEvent('share_question', { qid });
}

// ── LOCAL STORAGE HELPERS ────────────────────────────────────────────────────
const Store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
  }
};

// ── DOMPURIFY (XSS sanitisation) ─────────────────────────────────────────────
// Sanitises explanation HTML before it is injected into the DOM via innerHTML.
// safeHTML() is called in qbank.js wherever q.exp is rendered.
function safeHTML(dirty) {
  if (window.DOMPurify) return DOMPurify.sanitize(dirty || '', { USE_PROFILES: { html: true } });
  // Fallback if DOMPurify hasn't loaded yet — strip all tags
  return (dirty || '').replace(/<script[\s\S]*?<\/script>/gi, '')
                       .replace(/<[^>]+on\w+="[^"]*"/gi, '');
}

// ── INIT ON LOAD ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Load DOMPurify from CDN for XSS protection
  const dp = document.createElement('script');
  dp.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js';
  dp.integrity = 'sha512-/lGGVWpafGFxE1OmJJhS5HoG/oCFQGEPBW4Wo2QFSXjvdFMGPxGX3rlb8H+7JYxMV+y0dBSR0RWvBE0yL8oA==';
  dp.crossOrigin = 'anonymous';
  document.head.appendChild(dp);

  initLightbox();
  initCookieBanner();
  // Auto-load ads/GA if already consented
  const consent = localStorage.getItem('cookie_ok');
  if (consent === 'all') { loadAdsense(); loadGA(); }
});
