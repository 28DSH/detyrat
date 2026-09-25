'use strict';
// Gjërat e përbashkëta për faqen kryesore dhe faqen "Menaxho".
window.PDSH = (() => {
  const MUAJT = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'];
  const DITET = ['e diel', 'e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë'];
  const DITET_PER = ['të dielën', 'të hënën', 'të martën', 'të mërkurën', 'të enjten', 'të premten', 'të shtunën'];

  // Ngjyra dhe ikona për çdo lëndë (sipas emrit të dosjes pa shkronja speciale).
  const LENDET = {
    'gjuhe-shqipe': ['#c23b2e', '<path d="M20 3.5C13 4 8.5 9 7.5 16l-2.5 4.5 4.5-2.5C16 17 19.5 11 20 3.5Z"/><path d="M7.5 16 14 9.5"/>'],
    'letersi': ['#7d4a9e', '<path d="M3 5.5c3-1.2 6-1 9 1v13c-3-2-6-2.2-9-1Z"/><path d="M21 5.5c-3-1.2-6-1-9 1v13c3-2 6-2.2 9-1Z"/>'],
    'anglisht': ['#b8456b', '<path d="M4 5h16v11H10l-5 4v-4H4Z"/><path d="M8.5 13V8h3M8.5 10.5h2.5M14 13V9.5M14 11c0-1.2 3-1.8 3 0v2"/>'],
    'matematike': ['#d07a12', '<path d="M4 7h6M7 4v6M14.5 4.5l5 5M19.5 4.5l-5 5M4 16h6M4 19.5h6M14 17.75h6"/>'],
    'fizike': ['#2a7d8f', '<circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>'],
    'kimi': ['#2f8a57', '<path d="M9 3h6M10 3v6.5L4.8 18.3A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.7L14 9.5V3"/><path d="M7 15h10"/>'],
    'biologji': ['#5b8f22', '<path d="M5 19C5 10.5 10 5 20 4c0 10-5.5 15-15 15Z"/><path d="M5 19l8.5-8.5"/>'],
    'histori': ['#8d5a2b', '<path d="M3 9l9-5 9 5Z"/><path d="M5.5 9v9M10 9v9M14 9v9M18.5 9v9M3 20.5h18"/>'],
    'gjeografi': ['#2465a8', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3.4 3.2 14.6 0 18M12 3c-3.2 3.4-3.2 14.6 0 18"/>'],
    'qytetari': ['#4b5563', '<path d="M12 4v16M8 20.5h8M5 7h14M5 7l-3 6a3 3 0 0 0 6 0ZM19 7l-3 6a3 3 0 0 0 6 0Z"/>'],
    'gjermanisht': ['#b5892a', '<path d="M4 5h16v11H10l-5 4v-4H4Z"/><path d="M7.5 8.5v5H9a2.5 2.5 0 0 0 0-5ZM13.5 8.5v5h3M13.5 8.5h3M13.5 11h2.5"/>'],
    'fiskulture': ['#8a9096', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8"/>'],
    'tik': ['#8a9096', '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'],
  };
  const NGJYRAT = ['#c23b2e', '#2465a8', '#2f8a57', '#d07a12', '#7d4a9e', '#2a7d8f', '#b8456b', '#8d5a2b'];
  // Njëlloj si RENDITJA te nderto.py.
  const RENDITJA = ['gjuhe-shqipe', 'letersi', 'anglisht', 'gjermanisht', 'matematike', 'fizike',
    'kimi', 'biologji', 'histori', 'gjeografi', 'qytetari'];

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Njëlloj si slug() te nderto.py: "Gjuhë shqipe" -> "gjuhe-shqipe".
  const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

  const ngjyra = (l, i) => (LENDET[l.id] || [NGJYRAT[i % NGJYRAT.length]])[0];

  function ikona(l, i, klasa) {
    const e = LENDET[l.id];
    const brenda = e ? `<svg viewBox="0 0 24 24" aria-hidden="true">${e[1]}</svg>` : esc(l.emri.slice(0, 2));
    return `<span class="ikona ${klasa || ''}" style="--c:${ngjyra(l, i)}">${brenda}</span>`;
  }

  function lexo(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ruaj(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* shfletim privat */ } }

  /* ---------- Efektet ---------- */

  const LEVIZJE = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Vala që përhapet nga gishti kur prek butona dhe karta.
  const ME_VALE = '.lenda, .rej, a.or-lende, .m-buton, .m-lende, .m-cip, .skedat button, .sh-veprime > *';
  document.addEventListener('pointerdown', e => {
    const el = LEVIZJE && e.target.closest(ME_VALE);
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const v = document.createElement('span');
    v.className = 'vale';
    v.style.left = (e.clientX - r.left) + 'px';
    v.style.top = (e.clientY - r.top) + 'px';
    v.style.setProperty('--s', Math.ceil(Math.hypot(r.width, r.height) / 10));
    el.appendChild(v);
    setTimeout(() => v.remove(), 600);
  }, { passive: true });

  // Koka zvogëlohet dhe merr hije kur rrëshqet poshtë.
  const krye = document.getElementById('krye');
  let rafKryes = 0;
  if (krye) {
    window.addEventListener('scroll', () => {
      if (rafKryes) return;
      rafKryes = requestAnimationFrame(() => {
        rafKryes = 0;
        const y = window.scrollY;
        if (y > 24) krye.classList.add('me-hije');
        else if (y < 4) krye.classList.remove('me-hije');
      });
    }, { passive: true });
  }

  // Kartat shfaqen butë kur hyjnë në ekran gjatë rrëshqitjes.
  let vezhgues = null;
  function zbulo(rrenja, selektor) {
    if (!LEVIZJE || !('IntersectionObserver' in window)) return;
    if (!vezhgues) {
      vezhgues = new IntersectionObserver(hyrjet => {
        let n = 0;
        hyrjet.forEach(h => {
          if (!h.isIntersecting) return;
          const el = h.target;
          el.style.setProperty('--vonesa', Math.min(n++, 6) * 60 + 'ms');
          el.classList.add('dukshem');
          vezhgues.unobserve(el);
        });
      }, { rootMargin: '0px 0px -24px 0px' });
    }
    rrenja.querySelectorAll(selektor).forEach(el => {
      el.classList.add('zbulo');
      // Pas animacionit hiqen klasat, që të punojnë efektet e prekjes/hover.
      const mbaro = e => {
        if (e.target !== el) return;
        el.classList.remove('zbulo', 'dukshem');
        el.removeEventListener('animationend', mbaro);
      };
      el.addEventListener('animationend', mbaro);
      vezhgues.observe(el);
    });
  }

  function konfeti() {
    if (!LEVIZJE) return;
    const c = document.createElement('div');
    c.className = 'konfeti';
    const ngjyrat = ['#c8322a', '#16305c', '#c9a23a', '#2f8a57', '#2465a8'];
    for (let i = 0; i < 30; i++) {
      const k = document.createElement('i');
      k.style.cssText = `--x:${Math.random() * 100}%;--k:${ngjyrat[i % ngjyrat.length]};` +
        `--t:${(1.4 + Math.random() * 1.2).toFixed(2)}s;--v:${(Math.random() * .3).toFixed(2)}s;` +
        `--dx:${((Math.random() - .5) * 160).toFixed(0)}px;--r:${((Math.random() - .5) * 900).toFixed(0)}deg`;
      c.appendChild(k);
    }
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3200);
  }

  return { MUAJT, DITET, DITET_PER, LENDET, NGJYRAT, RENDITJA, LEVIZJE, esc, slug, ngjyra, ikona, lexo, ruaj, zbulo, konfeti };
})();
