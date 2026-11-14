/* iMedicus — motion engine (vanilla JS, no dependencies) */
(() => {
  'use strict';
  const html = document.documentElement;
  const body = document.body;
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const isDesk = () => window.innerWidth > 900;
  const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };

  if (!RM) html.classList.add('motion');
  $$('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Image slots: try .jpg/.jpeg/.png/.webp, then show a placeholder ---------- */
  const EXTS = ['jpg', 'jpeg', 'png', 'webp'];
  function refreshThumbs(group) {
    if (!group) return;
    const ok = $$('button', group).filter(b => !b.hidden && b.dataset.ok === '1').length;
    group.classList.toggle('show', ok >= 2);
  }
  function resolveSlot(img) {
    const src = img.getAttribute('src') || '';
    const m = src.match(/^(.*)\.(jpe?g|png|webp)$/i);
    if (!m) return;
    const base = m[1];
    const tried = new Set([m[2].toLowerCase()]);
    const btn = img.closest('.p-thumbs button');
    let done = false;
    const ok = () => {
      if (done) return; done = true;
      if (btn) { btn.dataset.ok = '1'; btn.dataset.src = img.src; refreshThumbs(btn.parentElement); }
      const fig = img.closest('.slot'); if (fig) fig.classList.remove('empty');
    };
    const fail = () => {
      if (done) return;
      const next = EXTS.find(e => !tried.has(e));
      if (next) { tried.add(next); img.src = base + '.' + next; return; }
      done = true;
      if (btn) { btn.hidden = true; refreshThumbs(btn.parentElement); return; }
      const fig = img.closest('.slot'); if (fig) fig.classList.add('empty');
    };
    img.addEventListener('load', ok);
    img.addEventListener('error', fail);
    if (img.complete) { if (img.naturalWidth) ok(); else fail(); }
  }
  $$('img[data-slot]').forEach(resolveSlot);

  /* ---------- Word wrapping (split headings + scroll-fill text) ---------- */
  function wrapWords(el, inner) {
    const out = [];
    const walk = node => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            if (inner) {
              w.className = 'w';
              const wi = document.createElement('span');
              wi.className = 'wi';
              wi.textContent = part;
              wi.style.setProperty('--d', String(out.length * 55));
              w.append(wi);
            } else {
              w.className = 'fw';
              w.textContent = part;
            }
            out.push(w);
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          walk(n);
        }
      });
    };
    walk(el);
    return out;
  }
  $$('[data-split]').forEach(el => wrapWords(el, true));
  const fills = $$('[data-fill]').map(el => ({ el, words: wrapWords(el, false), last: -1 }));

  /* ---------- Stagger indexes ---------- */
  $$('[data-stagger]').forEach(g => Array.from(g.children).forEach((c, i) => c.style.setProperty('--si', String(i))));

  /* ---------- Reveal observer (clip reveals watch their parent) ---------- */
  const proxies = new Map();
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const targets = proxies.get(e.target) || [e.target];
      targets.forEach(el => {
        el.classList.add('is-in');
        if (el.hasAttribute('data-stagger')) setTimeout(() => el.classList.add('settled'), 1800);
      });
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  $$('[data-reveal]:not([data-hero]),[data-split]:not([data-hero]),[data-stagger],.wordmark').forEach(el => {
    if (RM) { el.classList.add('is-in'); return; }
    if (el.dataset.reveal === 'clip' && el.parentElement) {
      const host = el.parentElement;
      if (!proxies.has(host)) { proxies.set(host, []); io.observe(host); }
      proxies.get(host).push(el);
    } else {
      io.observe(el);
    }
  });

  /* ---------- Counters ---------- */
  const cio = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      const el = e.target;
      const end = parseInt(el.dataset.count, 10) || 0;
      const pad = parseInt(el.dataset.pad || '0', 10);
      const t0 = performance.now();
      const step = t => {
        const p = clamp((t - t0) / 1600);
        el.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 4)))).padStart(pad, '0');
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });
  if (!RM) $$('[data-count]').forEach(el => { el.textContent = '0'.padStart(parseInt(el.dataset.pad || '1', 10), '0'); cio.observe(el); });

  /* ---------- Intro: preloader or curtain ---------- */
  let introDone = false;
  function intro() {
    if (introDone) return;
    introDone = true;
    html.classList.add('loaded');
    $$('[data-hero]').forEach((el, k) => setTimeout(() => el.classList.add('is-in'), (RM ? 0 : 250) + k * 140));
  }
  try { sessionStorage.setItem('im-seen', '1'); } catch (e) { /* storage unavailable */ }
  const pre = $('.preloader');
  if (pre && html.classList.contains('first') && !RM) {
    const num = $('.pre-num', pre);
    const bar = $('.pre-bar i', pre);
    let pageLoaded = document.readyState === 'complete';
    window.addEventListener('load', () => { pageLoaded = true; });
    const t0 = performance.now();
    const tick = t => {
      const el = t - t0;
      let p = clamp(el / 1800);
      if (!pageLoaded && el < 4000) p = Math.min(p, 0.92);
      const eased = 1 - Math.pow(1 - p, 3);
      num.textContent = String(Math.round(eased * 100)).padStart(3, '0');
      bar.style.transform = 'scaleX(' + eased + ')';
      if (p < 1) requestAnimationFrame(tick); else setTimeout(intro, 220);
    };
    requestAnimationFrame(tick);
  } else {
    requestAnimationFrame(() => requestAnimationFrame(intro));
  }

  /* ---------- Page transitions ---------- */
  const curtain = $('.curtain');
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || RM || !curtain) return;
    if (a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    let url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.protocol !== location.protocol || url.host !== location.host) return;
    if (!/\.html$/i.test(url.pathname)) return;
    if (url.pathname === location.pathname) return;
    e.preventDefault();
    curtain.style.transition = 'none';
    curtain.style.clipPath = 'inset(100% 0 0 0)';
    void curtain.offsetHeight;
    curtain.style.transition = 'clip-path .75s cubic-bezier(.76,0,.24,1)';
    curtain.style.clipPath = 'inset(0 0 0 0)';
    setTimeout(() => { location.href = a.href; }, 700);
  });
  window.addEventListener('pageshow', e => {
    if (e.persisted && curtain) { curtain.style.transition = ''; curtain.style.clipPath = ''; html.classList.add('loaded'); }
  });

  /* ---------- Header, menu ---------- */
  const header = $('.site-header');
  const burger = $('.burger');
  const mnav = $('#mobile-menu');
  function setMenu(open) {
    body.classList.toggle('menu-open', open);
    if (!burger || !mnav) return;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) { mnav.removeAttribute('inert'); mnav.setAttribute('aria-hidden', 'false'); }
    else { mnav.setAttribute('inert', ''); mnav.setAttribute('aria-hidden', 'true'); }
  }
  if (burger) burger.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && body.classList.contains('menu-open')) { setMenu(false); burger.focus(); }
  });
  if (mnav) $$('a', mnav).forEach(a => a.addEventListener('click', () => setMenu(false)));
  if (header) header.addEventListener('focusin', () => header.classList.remove('hide'));
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const section = /^products?-/.test(page) ? 'products.html' : page;
  $$('.menu > li > a, .mnav .big').forEach(a => { if ((a.getAttribute('href') || '').toLowerCase() === section) a.setAttribute('aria-current', 'page'); });
  $$('.to-top').forEach(b => b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' })));

  /* ---------- Cursor ---------- */
  let cursor = null;
  if (FINE && !RM) {
    cursor = document.createElement('div');
    cursor.className = 'cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<span></span>';
    body.append(cursor);
    html.classList.add('has-cursor');
  }
  const mouse = { x: -200, y: -200 };
  const ring = { x: -200, y: -200 };
  window.addEventListener('pointermove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (cursor) cursor.classList.add('on');
  }, { passive: true });
  document.addEventListener('pointerleave', () => cursor && cursor.classList.remove('on'));
  if (cursor) {
    document.addEventListener('pointerover', e => {
      const lab = e.target.closest('[data-cursor]');
      const link = e.target.closest('a,button,input,select,textarea,label');
      cursor.classList.toggle('label', !!lab);
      cursor.classList.toggle('link', !lab && !!link);
      cursor.firstChild.textContent = lab ? lab.dataset.cursor : '';
    });
  }

  /* ---------- Magnetic + tilt ---------- */
  if (FINE && !RM) {
    $$('.magnetic').forEach(el => {
      const s = parseFloat(el.dataset.strength || '0.35');
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * s) + 'px,' + ((e.clientY - r.top - r.height / 2) * s) + 'px)';
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
    $$('.tilt').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', (px * 100) + '%');
        el.style.setProperty('--my', (py * 100) + '%');
        el.style.transform = 'perspective(900px) rotateX(' + ((0.5 - py) * 8) + 'deg) rotateY(' + ((px - 0.5) * 10) + 'deg) translateY(-6px)';
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- Particle network ---------- */
  if (!RM) {
    $$('canvas.particles').forEach(cv => {
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      let w = 0, h = 0, pts = [], run = false;
      const m = { x: -999, y: -999 };
      const size = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const r = cv.getBoundingClientRect();
        w = r.width; h = r.height;
        cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const n = Math.round(clamp((w * h) / 17000, 18, 95));
        pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: Math.random() * 1.6 + 0.6 }));
      };
      const frame = () => {
        if (!run) return;
        ctx.clearRect(0, 0, w, h);
        for (const p of pts) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          const dx = p.x - m.x, dy = p.y - m.y, dd = dx * dx + dy * dy;
          if (dd < 16000) { const d = Math.sqrt(dd) || 1; const f = (1 - dd / 16000) * 1.4; p.x += (dx / d) * f; p.y += (dy / d) * f; }
        }
        ctx.lineWidth = 1;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          for (let j = i + 1; j < pts.length; j++) {
            const b = pts[j];
            const dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
            if (d < 13000) {
              ctx.strokeStyle = 'rgba(92,192,138,' + ((1 - d / 13000) * 0.32).toFixed(3) + ')';
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
          }
          ctx.fillStyle = 'rgba(190,240,212,.8)';
          ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
        }
        requestAnimationFrame(frame);
      };
      size();
      window.addEventListener('resize', debounce(size, 200));
      const host = cv.parentElement;
      host.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); m.x = e.clientX - r.left; m.y = e.clientY - r.top; });
      host.addEventListener('pointerleave', () => { m.x = -999; m.y = -999; });
      let visible = false;
      const toggle = () => { const was = run; run = visible && !document.hidden; if (run && !was) requestAnimationFrame(frame); };
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; toggle(); }).observe(cv);
      document.addEventListener('visibilitychange', toggle);
    });
  }

  /* ---------- Marquees ---------- */
  const marquees = $$('.marquee-track').map(t => ({ t, dir: t.dataset.dir === '-1' ? -1 : 1, speed: parseFloat(t.dataset.speed || '0.6'), x: 0, w: 0 }));
  const measureMarquees = () => marquees.forEach(mq => { mq.w = mq.t.scrollWidth / 2; });

  /* ---------- Horizontal showcase ---------- */
  const hs = $('.hs');
  const hsTrack = hs ? $('.hs-track', hs) : null;
  const hsBar = hs ? $('.hs-bar i', hs) : null;
  let hsDist = 0;
  function measureHs() {
    if (!hs || !hsTrack) return;
    if (!isDesk() || RM) { hs.style.height = ''; hsTrack.style.transform = ''; hsDist = 0; return; }
    hsDist = Math.max(0, hsTrack.offsetWidth - window.innerWidth);
    hs.style.height = (hsDist + window.innerHeight) + 'px';
  }

  /* ---------- Stacking cards / lifecycle ---------- */
  const stack = $$('.stack-card');
  let stackTops = [];
  const measureStack = () => { stackTops = stack.map(c => parseFloat(getComputedStyle(c).top) || 0); };
  const lc = $('.lc');
  const lcSteps = lc ? $$('.lc-step', lc) : [];

  /* ---------- Parallax collections ---------- */
  const heroMedia = $$('[data-hero-media]');
  const heroContent = $$('[data-hero-content]');
  const drift = $$('[data-drift]');
  const speeds = $$('[data-speed]');
  const progress = $('.progress');

  function measureAll() { measureMarquees(); measureHs(); measureStack(); }

  /* ---------- Main loop ---------- */
  let lastY = window.scrollY, vel = 0;
  function loop() {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const dy = y - lastY;
    vel = lerp(vel, dy, 0.1);

    if (header && !body.classList.contains('menu-open')) {
      header.classList.toggle('scrolled', y > 40);
      if (dy > 4 && y > 320) header.classList.add('hide');
      else if (dy < -4) header.classList.remove('hide');
    }
    lastY = y;

    if (progress) {
      const max = document.documentElement.scrollHeight - vh;
      progress.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max) : 0) + ')';
    }

    if (!RM) {
      if (y < vh * 1.4) {
        const p = clamp(y / vh);
        heroMedia.forEach(el => { el.style.transform = 'translate3d(0,' + (y * 0.4) + 'px,0) scale(' + (1 + p * 0.08) + ')'; });
        heroContent.forEach(el => { el.style.transform = 'translate3d(0,' + (y * 0.18) + 'px,0)'; el.style.opacity = String(1 - p * 1.1); });
        drift.forEach(el => { el.style.transform = 'translate3d(' + (-y * 0.3) + 'px,0,0)'; });
      }

      speeds.forEach(el => {
        const host = el.parentElement.getBoundingClientRect();
        if (host.bottom < -200 || host.top > vh + 200) return;
        const off = host.top + host.height / 2 - vh / 2;
        el.style.transform = 'translate3d(0,' + (off * -parseFloat(el.dataset.speed)) + 'px,0)';
      });

      fills.forEach(f => {
        const r = f.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35));
        const n = f.words.length;
        const key = Math.round(p * 400);
        if (key === f.last) return;
        f.last = key;
        f.words.forEach((wd, i) => { wd.style.opacity = String(0.14 + 0.86 * clamp(p * n * 1.15 - i)); });
      });

      if (hsDist && hsTrack) {
        const r = hs.getBoundingClientRect();
        const p = clamp(-r.top / (hs.offsetHeight - vh));
        hsTrack.style.transform = 'translate3d(' + (-p * hsDist) + 'px,0,0)';
        if (hsBar) hsBar.style.transform = 'scaleX(' + p + ')';
      }

      if (stack.length && isDesk()) {
        stack.forEach((c, i) => {
          const n = stack[i + 1];
          if (!n) return;
          const nr = n.getBoundingClientRect();
          const p = clamp(1 - (nr.top - stackTops[i]) / (vh * 0.75));
          c.style.transform = 'scale(' + (1 - p * 0.07) + ')';
          c.style.filter = 'brightness(' + (1 - p * 0.3) + ')';
        });
      } else if (stack.length) {
        stack.forEach(c => { c.style.transform = ''; c.style.filter = ''; });
      }

      if (lc) {
        const r = lc.getBoundingClientRect();
        const p = isDesk() ? clamp((vh * 0.8 - r.top) / (vh * 0.5)) : clamp((vh * 0.75 - r.top) / r.height);
        lc.style.setProperty('--p', p.toFixed(3));
        lcSteps.forEach((s, i) => s.classList.toggle('on', p >= (i + 0.2) / lcSteps.length));
      }

      marquees.forEach(mq => {
        if (!mq.w) return;
        mq.x -= (mq.speed + Math.min(Math.abs(vel) * 0.15, 8)) * mq.dir;
        if (mq.x <= -mq.w) mq.x += mq.w;
        if (mq.x > 0) mq.x -= mq.w;
        mq.t.style.transform = 'translate3d(' + mq.x + 'px,0,0)';
      });

      if (cursor) {
        ring.x = lerp(ring.x, mouse.x, 0.2); ring.y = lerp(ring.y, mouse.y, 0.2);
        cursor.style.transform = 'translate3d(' + ring.x + 'px,' + ring.y + 'px,0)';
      }
    }
    requestAnimationFrame(loop);
  }

  /* ---------- About: floating hover preview ---------- */
  const sf = $('.serve-float');
  if (sf && FINE && !RM) {
    const img = $('img', sf);
    const inner = $('.in', sf);
    let cx = 0, cy = 0;
    $$('.serve-row').forEach(r => {
      r.addEventListener('pointerenter', () => { img.src = r.dataset.img; img.alt = ''; sf.classList.add('on'); });
      r.addEventListener('pointerleave', () => sf.classList.remove('on'));
    });
    const follow = () => {
      const px = cx;
      cx = lerp(cx, mouse.x, 0.12); cy = lerp(cy, mouse.y, 0.12);
      sf.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      inner.style.setProperty('--rot', clamp((cx - px) * 0.6, -12, 12) + 'deg');
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
  }

  /* ---------- Product gallery thumbnails ---------- */
  $$('.p-thumbs').forEach(group => {
    const main = group.parentElement.querySelector('.p-main');
    if (!main) return;
    const img = main.querySelector('img');
    $$('button', group).forEach(btn => btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-pressed') === 'true') return;
      $$('button', group).forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
      main.classList.add('swap');
      setTimeout(() => {
        img.onload = () => main.classList.remove('swap');
        img.src = btn.dataset.src; img.alt = btn.dataset.alt || img.alt;
        main.classList.remove('empty');
        setTimeout(() => main.classList.remove('swap'), 600);
      }, RM ? 0 : 250);
    }));
  });

  /* ---------- Category page: highlight subcategory pill in view ---------- */
  const pills = $$('.subnav a');
  if (pills.length && 'IntersectionObserver' in window) {
    const map = new Map(pills.map(a => [document.getElementById(a.getAttribute('href').slice(1)), a]));
    const sio = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { pills.forEach(a => a.classList.remove('on')); const a = map.get(e.target); if (a) a.classList.add('on'); }
    }), { rootMargin: '-40% 0px -55% 0px' });
    map.forEach((a, sec) => sec && sio.observe(sec));
  }

  /* ---------- Contact: prefill from ?dept= & ?product= ---------- */
  const qs = new URLSearchParams(location.search);
  const deptSel = $('#d');
  if (deptSel && qs.get('dept')) {
    const want = qs.get('dept').trim().toLowerCase();
    const opt = Array.from(deptSel.options).find(o => o.text.trim().toLowerCase() === want);
    if (opt) deptSel.value = opt.value;
  }
  const msg = $('#m');
  if (msg && qs.get('product') && !msg.value) msg.value = 'I would like a quote for the ' + qs.get('product').slice(0, 80) + '. ';

  /* ---------- Contact form ---------- */
  const form = $('#enquiry');
  if (form) {
    const card = form.closest('.form-card');
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const d = Object.fromEntries(new FormData(form).entries());
      const subject = 'Website enquiry - ' + (d.department || 'General') + ' - ' + d.name;
      const bodyText = ['Name: ' + d.name, 'Organisation: ' + (d.org || '-'), 'Email: ' + d.email, 'Phone: ' + (d.phone || '-'), 'Department: ' + d.department, '', d.message].join('\n');
      window.location.href = 'mailto:info@imedicus.co.za?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(bodyText);
      card.classList.add('sent');
      const again = $('.form-again', card);
      if (again) setTimeout(() => again.focus(), 900);
    });
    const again = $('.form-again', card);
    if (again) again.addEventListener('click', () => { card.classList.remove('sent'); form.reset(); $('input', form).focus(); });
  }

  /* ---------- Boot ---------- */
  measureAll();
  window.addEventListener('load', measureAll);
  window.addEventListener('resize', debounce(() => { measureAll(); if (isDesk()) setMenu(false); }, 150));
  $$('img').forEach(im => { if (!im.complete) im.addEventListener('load', debounce(measureAll, 100), { once: true }); });
  if (mnav) setMenu(false);
  requestAnimationFrame(loop);
})();
