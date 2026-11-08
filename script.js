/* =====================================================================
   HERO — scroll-driven frame sequence + left/right skill words
   ===================================================================== */
(function () {
  const HERO_FRAME_COUNT = 95;
  const HERO_FRAME_PATH = (i) => `frames/frame_${String(i).padStart(3, "0")}.webp`;

  const canvas  = document.getElementById("heroCanvas");
  const ctx     = canvas.getContext("2d");
  const loader  = document.getElementById("heroLoader");
  const poster  = document.getElementById("heroPoster");
  const section = document.querySelector(".hero");
  const intro   = document.getElementById("heroIntro");
  const hint    = document.getElementById("heroScroll");
  const bar     = document.getElementById("heroBar");
  const words   = [...document.querySelectorAll(".word")].map((el) => ({
    el,
    start: parseFloat(el.dataset.start),
    end: parseFloat(el.dataset.end),
    left: el.classList.contains("word--left"),
  }));

  const images = new Array(HERO_FRAME_COUNT);
  let loadedCount = 0, currentFrame = 0, targetFrame = 0, rafId = null, painted = false;
  let canvasW = 0, canvasH = 0;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const isMobile = () => window.innerWidth <= 760;
  const fitScale = () => (isMobile() ? 1.55 : 0.72);

  function measureCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasW = canvas.clientWidth;
    canvasH = canvas.clientHeight;
    if (!canvasW || !canvasH) return;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function resizeCanvas() {
    measureCanvas();
    drawFrame(currentFrame, true);
  }

  const isReady = (im) => im && im.complete && im.naturalWidth > 0;
  // nearest frame that has actually loaded (so the hero is never blank while others stream in)
  function bestAvailable(index) {
    for (let d = 0; d < HERO_FRAME_COUNT; d++) {
      if (isReady(images[index - d])) return images[index - d];
      if (isReady(images[index + d])) return images[index + d];
    }
    return null;
  }

  function drawFrame(index, force) {
    index = clamp(Math.round(index), 0, HERO_FRAME_COUNT - 1);
    if (!force && index === currentFrame) return;
    if (!canvasW || !canvasH) { measureCanvas(); if (!canvasW || !canvasH) return; }   // layout not ready yet -> retry later
    const img = bestAvailable(index);
    if (!img) return;
    currentFrame = index;
    const scale = Math.min(canvasW / img.naturalWidth, canvasH / img.naturalHeight) * fitScale();
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    const dx = (canvasW - dw) / 2, dy = (canvasH - dh) / 2 - canvasH * (isMobile() ? 0.05 : 0.07);
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.drawImage(img, dx, dy, dw, dh);

    // melt the hard bottom edge (neck / shoulders) into the background
    const fh = dh * 0.3;
    const g = ctx.createLinearGradient(0, dy + dh - fh, 0, dy + dh);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,1)");
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = g;
    ctx.fillRect(dx - 2, dy + dh - fh, dw + 4, fh + 2);
    ctx.restore();

    // canvas has really painted -> retire the plain <img> poster (they are pixel-aligned, so no jump)
    if (poster && dw > 1 && dh > 1) poster.classList.add("is-off");
    if (dw > 1 && dh > 1) painted = true;
  }

  function getProgress() {
    const total = section.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    return clamp(-section.getBoundingClientRect().top / total);
  }

  // Words fade/slide in from the outside edge, hold, then drift away.
  function updateWords(p) {
    const mobile = isMobile();
    words.forEach((w) => {
      const span = w.end - w.start;
      const t = (p - w.start) / span;
      let o = 0, shift = 0;
      if (t > 0 && t < 1) {
        const fadeIn = easeOut(clamp(t / 0.25));
        const fadeOut = easeOut(clamp((1 - t) / 0.25));
        o = Math.min(fadeIn, fadeOut);
        const travel = t < 0.5 ? 1 - fadeIn : -(1 - fadeOut);   // -1..1 offset
        shift = travel * 70;
      }
      const dir = w.left ? -1 : 1;
      const dx = dir * shift * (mobile ? 0.55 : 1);
      const dy = 0;
      w.el.style.opacity = o.toFixed(3);
      w.el.style.transform = `translate(${dx}px, calc(-50% + ${dy}px)) scale(${(0.94 + 0.06 * o).toFixed(3)})`;
    });
  }

  function onScroll() {
    const p = getProgress();
    targetFrame = p * (HERO_FRAME_COUNT - 1);
    updateWords(p);
    bar.style.transform = `scaleY(${p})`;

    const fade = clamp(1 - p / 0.06);
    intro.style.opacity = fade;
    intro.style.transform = `translateY(${(1 - fade) * 24}px)`;
    hint.style.opacity = fade;

    requestTick();
  }

  function tick() {
    const diff = targetFrame - currentFrame;
    if (Math.abs(diff) > 0.05) {
      drawFrame(currentFrame + diff * 0.25, false);
      rafId = requestAnimationFrame(tick);
    } else {
      drawFrame(targetFrame, false);
      rafId = null;
    }
  }
  function requestTick() { if (rafId === null) rafId = requestAnimationFrame(tick); }

  let shown = false;
  function showHero() {                       // reveal the page as soon as the FIRST frame is ready
    if (shown) return;
    shown = true;
    loader.classList.add("is-hidden");
    document.body.classList.add("is-ready");
  }

  function loadFrame(i) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = img.onerror = () => {
        loadedCount++;
        if (i === 0) showHero();
        // Paint as soon as ANYTHING usable has arrived (even if frame 0 itself is missing/404),
        // and swap in the exact frame once it shows up. Never wait for a scroll or the page "load" event.
        if (!painted || Math.round(targetFrame) === i) drawFrame(Math.round(targetFrame), true);
        resolve();
      };
      img.src = HERO_FRAME_PATH(i);
      images[i] = img;
    });
  }

  async function preload() {
    await loadFrame(0);                       // 1) first image — nothing else competes with it
    showHero();
    let next = 1;                             // 2) the rest, in scroll order, a few at a time
    const worker = async () => { while (next < HERO_FRAME_COUNT) await loadFrame(next++); };
    await Promise.all(Array.from({ length: 6 }, worker));
  }

  window.addEventListener("resize", () => { resizeCanvas(); onScroll(); });
  window.addEventListener("load", () => { resizeCanvas(); onScroll(); });
  if ("ResizeObserver" in window) new ResizeObserver(() => { resizeCanvas(); }).observe(canvas);   // phones: size can change after first paint
  window.addEventListener("scroll", onScroll, { passive: true });
  setTimeout(showHero, 2500);                 // safety net: reveal the page even on a very slow connection
  resizeCanvas();
  preload();
  onScroll();
})();

/* =====================================================================
   HEADER — mobile menu, scrolled state, scrollspy
   ===================================================================== */
(function () {
  const header = document.getElementById("header");
  const toggle = document.getElementById("navToggle");
  const list   = document.getElementById("navList");
  const links  = [...document.querySelectorAll(".nav__link")];
  const sections = [...document.querySelectorAll("section[id]")];

  function closeMenu() {
    list.classList.remove("is-open");
    toggle.classList.remove("is-active");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", () => {
    const open = list.classList.toggle("is-open");
    toggle.classList.toggle("is-active", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.forEach((l) => l.addEventListener("click", closeMenu));
  document.addEventListener("click", (e) => {
    if (!header.contains(e.target)) closeMenu();
  });

  function spy() {
    header.classList.toggle("is-scrolled", window.scrollY > 30);
    const mid = window.scrollY + window.innerHeight * 0.35;
    let current = sections[0].id;
    sections.forEach((s) => { if (mid >= s.offsetTop) current = s.id; });
    links.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === `#${current}`));
  }
  window.addEventListener("scroll", spy, { passive: true });
  spy();
})();

/* =====================================================================
   SCROLL REVEAL
   ===================================================================== */
(function () {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { items.forEach((i) => i.classList.add("is-in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        // small stagger for siblings
        const idx = [...e.target.parentElement.children].indexOf(e.target);
        e.target.style.transitionDelay = `${Math.min(idx, 5) * 90}ms`;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
  items.forEach((i) => io.observe(i));
})();

/* =====================================================================
   RUNNING TYPE — marquees driven by time + scroll velocity
   ===================================================================== */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const items = [...document.querySelectorAll(".marquee")].map((el) => {
    const track = el.querySelector(".marquee__track");
    const base = track.innerHTML;
    track.innerHTML = base + base;
    while (track.scrollWidth < window.innerWidth * 2.2) track.innerHTML += base;
    return {
      track, base, baseCount: (() => { const t = document.createElement('div'); t.innerHTML = base; return t.children.length; })(),
      dir: parseFloat(el.dataset.dir || -1),
      speed: parseFloat(el.dataset.speed || 0.5),
      off: 0,
    };
  });
  let lastY = window.scrollY, vel = 0;

  function loop() {
    const y = window.scrollY;
    vel += ((y - lastY) - vel) * 0.12;
    lastY = y;
    items.forEach((m) => {
      const sets = m.track.children.length / m.baseCount;
      const setW = m.track.scrollWidth / sets;
      m.off += m.dir * (reduce ? 0 : m.speed + Math.abs(vel) * 0.35);
      // scrolling down speeds it up, scrolling up reverses it
      if (vel < 0 && !reduce) m.off -= m.dir * Math.abs(vel) * 0.7;
      while (m.off <= -setW) m.off += setW;
      while (m.off > 0) m.off -= setW;
      m.track.style.transform = `translate3d(${m.off}px,0,0)`;
    });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

/* =====================================================================
   HEADING WORD-BY-WORD REVEAL + COUNTERS
   ===================================================================== */
(function () {
  document.querySelectorAll("[data-split]").forEach((h) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span"); w.className = "w";
            const s = document.createElement("span"); s.textContent = p; s.style.setProperty("--i", i++);
            w.appendChild(s); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    walk(h);
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { threshold: 0.3 });
  document.querySelectorAll("[data-split]").forEach((h) => io.observe(h));

  const cio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target, end = parseFloat(el.dataset.count), t0 = performance.now(), dur = 1600;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      cio.unobserve(el);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-count]").forEach((c) => cio.observe(c));
})();

/* =====================================================================
   PROJECTS — data-driven cards + category filter
   ===================================================================== */
(function () {
  const grid = document.getElementById("projectGrid");
  const bar  = document.getElementById("filters");
  if (!grid || !bar) return;

  const P = (cat, title, url, sub) => ({ cat, title, url, sub });
  const projects = [
    P("Shopify", "Blumun", "https://blumun.in/"),
    P("Shopify", "Hyskyn", "https://hyskyn.com/"),
    P("Shopify", "Nepterra", "https://nepterra.com"),
    P("Shopify", "Masakali", "https://masakali.co"),
    P("Shopify", "Being Painfree", "https://being-painfree.com"),
    P("Shopify", "Poshnaari", "https://poshnaari.com"),
    P("Shopify", "Raw Era", "https://raw-era.com"),
    P("Shopify", "White Rose", "https://whiteroseofficial.com"),

    P("WordPress", "Parda Sansar", "https://pardasansar.in/"),
    P("WordPress", "Tour Uncle", "https://touruncle.com/"),
    P("WordPress", "Enorma Infraa", "https://enormainfraa.com/"),
    P("WordPress", "Sudipta’s English Academy", "https://sudiptasenglishacademy.com/"),
    P("WordPress", "Ram Mandir Piplani", "https://rammandirpiplani.org/"),
    P("WordPress", "Chef Mohammad Husain", "https://chefmohammadhusain.com/"),
    P("WordPress", "DSS Jewellers", "https://dssjewellers.in/"),
    P("WordPress", "WheyFit", "https://wheyfit.co.in/"),
    P("WordPress", "GI Sewa", "https://gisewa.org/"),
    P("WordPress", "Lazeez Hakeem", "https://lazeezhakeem.com/"),

    P("Wedding Invites", "Arnav weds Diya", "https://sadarnimantran.in/invite/arnav-diya", "Sample design"),
    P("Wedding Invites", "Reyansh weds Myra", "https://sadarnimantran.in/invite/reyansh-myra", "Sample design"),
    P("Wedding Invites", "Aarav weds Kiara", "https://sadarnimantran.in/invite/aarav-kiara", "Sample design"),
    P("Wedding Invites", "Raghav weds Ishita", "https://sadarnimantran.in/invite/raghav-ishita", "Premium e-invite sample · ₹1,499"),

    P("Custom Code", "Advertising360", "https://advertising360.in/"),
    P("Custom Code", "Ankit Mathur", "http://ankitmathur.co.in/"),

    P("CRM Tools", "Salary Slip CRM", "https://salaryslip.advertising360.in", "Advertising360 tool"),
    P("CRM Tools", "Task Management CRM", "https://taskmanagementcrm.advertising360.in", "Advertising360 tool"),
    P("CRM Tools", "Meta Lead CRM", "https://metaleadcrm.advertising360.in", "Advertising360 tool"),
  ];
  const cats = ["All", ...new Set(projects.map((p) => p.cat))];
  const host = (u) => new URL(u).hostname.replace(/^www\./, "");
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  bar.innerHTML = cats.map((c, i) => {
    const n = c === "All" ? projects.length : projects.filter((p) => p.cat === c).length;
    return `<button class="filter${i === 0 ? " is-active" : ""}" role="tab" data-cat="${c}">${c}<small>${n}</small></button>`;
  }).join("");

  function render(cat) {
    const list = cat === "All" ? projects : projects.filter((p) => p.cat === cat);
    grid.innerHTML = list.map((p, i) => {
      const h = host(p.url);
      const shot = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(p.url)}?w=640&h=400`;
      return `<a class="pcard glass" style="--i:${i}" href="${p.url}" target="_blank" rel="noopener">
        <div class="pcard__shot" data-i="${esc(p.title[0])}">
          <span class="pcard__cat">${p.cat}</span>
          <img src="${shot}" alt="Preview of ${esc(p.title)}" loading="lazy" onerror="this.remove()">
        </div>
        <div>
          <h3>${esc(p.title)}</h3>
          <p>${p.sub ? esc(p.sub) + " · " : ""}${h}${p.url.includes("/invite/") ? "/" + p.url.split("/").pop() : ""}</p>
        </div>
        <div class="pcard__go"><span>Visit site</span><b>→</b></div>
      </a>`;
    }).join("");
  }

  bar.addEventListener("click", (e) => {
    const b = e.target.closest(".filter");
    if (!b) return;
    bar.querySelectorAll(".filter").forEach((x) => x.classList.toggle("is-active", x === b));
    render(b.dataset.cat);
  });
  const pcount = document.getElementById("pcount"), pfill = document.getElementById("pfill");
  function updateNav() {
    const cards = grid.children, n = cards.length;
    if (!n || !pcount) return;
    const step = cards[0].offsetWidth + 12;
    const max = grid.scrollWidth - grid.clientWidth;
    const idx = max <= 0 ? 0 : Math.min(n - 1, Math.round(grid.scrollLeft / step));
    pcount.textContent = `${idx + 1} / ${n}`;
    pfill.style.transform = `scaleX(${max <= 0 ? 1 : Math.max(0.04, grid.scrollLeft / max)})`;
  }
  grid.addEventListener("scroll", updateNav, { passive: true });
  window.addEventListener("resize", updateNav);
  const _render = render;
  render = function (cat) { _render(cat); grid.scrollLeft = 0; updateNav(); };
  render("All");
})();

/* =====================================================================
   POLISH — page progress bar + cursor spotlight on glass cards
   ===================================================================== */
(function () {
  const bar = document.getElementById("pageBar");
  const upd = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  };
  window.addEventListener("scroll", upd, { passive: true });
  upd();

  const SEL = ".card, .skill, .pcard, .tl, .step, .numbers, .contact";
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest && e.target.closest(SEL);
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
})();

/* =====================================================================
   SCROLL-LINKED CARD MOTION
   Columns drift in opposite directions (two up, one down), timeline and
   About cards slide in from the sides — all scrubbed by scroll position.
   Uses the CSS `translate` property so it never fights reveal/hover.
   ===================================================================== */
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // [selector, mode, amount]   mode: "col3" | "col2" | "alt" | "left" | "right" | "side"
  const RULES = [
    ["#skills .skill",       "col3",  0.08, 26],
    [".projects .pcard",     "col3",  0.04, 12],
    [".steps .step",         "alt",   0.06, 18],
    [".tiles .tile",         "col2",  0.06, 16],
    [".about",               "left",  60],
    [".tl",                  "side",  60],
    [".duo .card",           "side",  60],
  ];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const state = new WeakMap();
  let raf = null;

  function targetFor(el, mode, amt, vh, max) {
    const s = state.get(el) || { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2 - s.x;           // remove our own offset
    const cy = r.top + r.height / 2 - s.y;
    const idx = [...el.parentElement.children].indexOf(el);
    // grid modes: the WHOLE column moves together (reference = the grid, not the card),
    // so cards in a column never squeeze into each other
    const pr = el.parentElement.getBoundingClientRect();
    const d = clamp((mode === "side" || mode === "left" ? cy : pr.top + pr.height / 2) - vh / 2, -500, 500);
    let tx = 0, ty = 0;
    if (mode === "col3") ty = d * amt * ([-1, 1, -1][idx % 3]);
    else if (mode === "col2") ty = d * amt * ([-1, 1][idx % 2]);
    else if (mode === "alt") ty = d * amt * (idx % 2 ? 1 : -1);
    else {
      // slide in from the side while the card travels from the bottom edge to centre
      const p = clamp((cy - vh * 0.64) / (vh * 0.36), 0, 1);  // 1 = just entering, 0 = settled
      const dir = mode === "left" ? -1 : (idx % 2 ? 1 : -1);
      tx = dir * amt * p;
    }
    if (max) ty = clamp(ty, -max, max);   // never drift far enough to touch headings / filters / neighbours
    return { tx, ty };
  }

  function frame() {
    raf = null;
    const vh = window.innerHeight;
    let busy = false;
    const mobile = window.innerWidth <= 760;
    RULES.forEach(([sel, mode, amt, max]) => {
      document.querySelectorAll(sel).forEach((el) => {
        let s = state.get(el);
        if (!s) { s = { x: 0, y: 0 }; state.set(el, s); }
        if (mobile) { if (s.x || s.y) { s.x = s.y = 0; el.style.translate = "none"; } return; }
        // skip only when the whole group is far off-screen, so every card in a
        // column always updates together (never drifts out of sync with its neighbours)
        const r = (mode === "side" || mode === "left" ? el : el.parentElement).getBoundingClientRect();
        if (r.bottom < -300 || r.top > vh + 300) return;
        const t = targetFor(el, mode, amt, vh, max);
        s.x += (t.tx - s.x) * 0.14;
        s.y += (t.ty - s.y) * 0.14;
        if (Math.abs(t.tx - s.x) > 0.1 || Math.abs(t.ty - s.y) > 0.1) busy = true;
        el.style.translate = `${s.x.toFixed(2)}px ${s.y.toFixed(2)}px`;
        el.style.setProperty("--tx", `${s.x.toFixed(2)}px`);
      });
    });
    if (busy) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (raf === null) raf = requestAnimationFrame(frame); };
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);
  kick();
})();
