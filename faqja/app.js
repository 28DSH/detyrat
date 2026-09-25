'use strict';
(() => {
  const { MUAJT, DITET, DITET_PER, LEVIZJE, esc, ngjyra, ikona, lexo, ruaj, zbulo } = window.PDSH;
  const MUAJT_SHKURT = ['JAN', 'SHK', 'MAR', 'PRI', 'MAJ', 'QER', 'KOR', 'GUS', 'SHT', 'TET', 'NËN', 'DHJ'];
  const DITA = 864e5;

  const SVG_SHIGJETE = '<svg class="shigjete" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  const SVG_MBRAPA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const SVG_LIDHJA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>';
  const VULE = '<span class="vule">E re</span>';

  const app = document.getElementById('app');
  const titulliBaze = document.title;
  let DATA = null;
  let ORARI_LENDES = {}; // id e lëndës -> ditët e javës kur e ke
  let lendaAktuale = null;
  let rrugaEParme = null;
  let rreshqitjaKryesore = 0;

  const numero = (n, nje, shume) => n + ' ' + (n === 1 ? nje : shume);

  /* ---------- Datat ---------- */

  function dite(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function dataPlote(iso) {
    const d = dite(iso);
    return `${DITET[d.getDay()]}, ${d.getDate()} ${MUAJT[d.getMonth()]} ${d.getFullYear()}`;
  }

  function periudha(p) {
    if (!p.deri) return dataPlote(p.data);
    const a = dite(p.data), b = dite(p.deri);
    const fund = `${b.getDate()} ${MUAJT[b.getMonth()]} ${b.getFullYear()}`;
    if (a.getFullYear() !== b.getFullYear()) return `${a.getDate()} ${MUAJT[a.getMonth()]} ${a.getFullYear()} – ${fund}`;
    if (a.getMonth() !== b.getMonth()) return `${a.getDate()} ${MUAJT[a.getMonth()]} – ${fund}`;
    return `${a.getDate()}–${fund}`;
  }

  function kalendar(p) {
    const a = dite(p.data);
    let dita = a.getDate(), varg = '';
    if (p.deri) {
      const b = dite(p.deri);
      dita = a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()}` : `${a.getDate()}+`;
      varg = ' varg';
    }
    return `<span class="kalendar"><span class="k-muaji">${MUAJT_SHKURT[a.getMonth()]}</span><span class="k-dita${varg}">${dita}</span></span>`;
  }

  function saKohe(iso) {
    const t = new Date(iso), sot = new Date();
    const n = Math.round((new Date(sot.getFullYear(), sot.getMonth(), sot.getDate()) -
      new Date(t.getFullYear(), t.getMonth(), t.getDate())) / DITA);
    if (n <= 0) return 'sot';
    if (n === 1) return 'dje';
    if (n < 7) return `para ${n} ditësh`;
    if (n < 14) return 'para një jave';
    if (n < 31) return `para ${Math.floor(n / 7)} javësh`;
    return `më ${t.getDate()} ${MUAJT[t.getMonth()]}`;
  }

  function pershendetje() {
    const o = new Date().getHours();
    if (o < 5) return 'Natën e mirë';
    if (o < 12) return 'Mirëmëngjes';
    if (o < 18) return 'Mirëdita';
    return 'Mirëmbrëma';
  }

  /* ---------- Orari dhe afatet ---------- */

  const kapitalizo = s => s.charAt(0).toUpperCase() + s.slice(1);

  function sotData() {
    const s = new Date();
    return new Date(s.getFullYear(), s.getMonth(), s.getDate());
  }

  // Ora e parë e lëndës pas datës kur u dha detyra.
  function afati(l, p) {
    const ditet = ORARI_LENDES[l.id];
    if (!ditet || !ditet.length) return null;
    const nga = dite(p.deri || p.data);
    for (let k = 1; k <= 7; k++) {
      const d = new Date(nga.getFullYear(), nga.getMonth(), nga.getDate() + k);
      if (ditet.includes(d.getDay())) return d;
    }
    return null;
  }

  // Vetëm postimi më i ri i lëndës është aktual, dhe vetëm deri në orën e mësimit.
  function gjendja(l, pi) {
    const a = afati(l, l.postime[pi]);
    return { a, kaluar: pi > 0 || (a !== null && a < sotData()) };
  }

  function tekstAfati(a) {
    const n = Math.round((a - sotData()) / DITA);
    if (n === 0) return 'Për sot';
    if (n === 1) return 'Për nesër';
    if (n < 7) return 'Për ' + DITET_PER[a.getDay()];
    return `Për ${a.getDate()} ${MUAJT[a.getMonth()]}`;
  }

  function etiketa(g) {
    if (g.kaluar) return '<span class="etikete kaluar">E kaluar</span>';
    if (g.a) return `<span class="etikete afat">${tekstAfati(g.a)}</span>`;
    return '';
  }

  function seksioniOrarit() {
    if (!DATA.orari || !DATA.orari.length) return '';
    const ditetMeMesim = new Set(DATA.orari.map(o => o.dita));
    const sot = sotData();
    let d = sot;
    do d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); while (!ditetMeMesim.has(d.getDay()));
    const n = Math.round((d - sot) / DITA);
    const dita = DATA.orari.find(o => o.dita === d.getDay());

    let h = `<section class="orari"><h2 class="titull-seksioni">${n === 1 ? 'Për nesër' : 'Për ' + DITET_PER[d.getDay()]}` +
      ` <small>${DITET[d.getDay()]}, ${d.getDate()} ${MUAJT[d.getMonth()]}</small></h2><ul class="neser">`;
    dita.lendet.forEach(x => {
      const i = DATA.lendet.findIndex(l => l.id === x.id);
      if (i < 0) {
        h += `<li><span class="or-lende pa">${ikona(x, 0, 'e-vogel')}<span class="l-tekst">` +
          `<span class="l-emri">${esc(x.emri)}</span><span class="l-meta">Pa detyra</span></span></span></li>`;
        return;
      }
      const l = DATA.lendet[i], p = l.postime[0];
      const a = p && afati(l, p);
      const ka = a && a.getTime() === d.getTime();
      const meta = ka
        ? `<span class="l-meta ka">${esc(p.pershkrim || 'Ka detyrë')} · ${numero(p.foto.length, 'foto', 'foto')}</span>`
        : '<span class="l-meta">S\'ka detyrë të postuar</span>';
      h += `<li><a class="or-lende" href="#/${l.id}${ka ? '/' + p.id : ''}">${ikona(l, i, 'e-vogel')}` +
        `<span class="l-tekst"><span class="l-emri">${esc(l.emri)}</span>${meta}</span>${SVG_SHIGJETE}</a></li>`;
    });
    h += '</ul><details class="java"><summary>Orari i javës</summary><div class="java-ditet">';
    DATA.orari.forEach(o => {
      h += `<div class="java-dita${o.dita === sot.getDay() ? ' sot' : ''}"><b>${kapitalizo(DITET[o.dita])}</b><span>`;
      o.lendet.forEach(x => {
        const i = DATA.lendet.findIndex(l => l.id === x.id);
        h += i < 0
          ? `<span class="cip pa">${esc(x.emri)}</span>`
          : `<a class="cip" href="#/${x.id}" style="--c:${ngjyra(DATA.lendet[i], i)}">${esc(x.emri)}</a>`;
      });
      h += '</span></div>';
    });
    h += '</div></details></section>';
    return h;
  }

  // "E re" = shtuar pas vizitës së fundit në atë lëndë; për vizitorë të rinj, shtuar këtë javë.
  function iRi(shtuar, pare) {
    const t = Date.parse(shtuar);
    return pare ? t > Date.parse(pare) : Date.now() - t < 7 * DITA;
  }

  /* ---------- Faqet ---------- */

  function faqjaKryesore() {
    document.title = titulliBaze;
    lendaAktuale = null;

    const teGjitha = [];
    let nrFoto = 0, nrReja = 0;
    DATA.lendet.forEach((l, i) => {
      const pare = lexo('pare:' + l.id);
      l.postime.forEach((p, pi) => {
        const g = gjendja(l, pi);
        const ri = !g.kaluar && iRi(p.shtuar, pare);
        if (ri) nrReja++;
        nrFoto += p.foto.length;
        teGjitha.push({ l, i, p, ri, g });
      });
    });
    teGjitha.sort((a, b) => Date.parse(b.p.shtuar) - Date.parse(a.p.shtuar));

    const sot = new Date();
    let h = `<section class="kreu">
      <p class="kreu-data">${DITET[sot.getDay()]}, ${sot.getDate()} ${MUAJT[sot.getMonth()]} ${sot.getFullYear()}</p>
      <p class="pershendetje">${pershendetje()}!</p>
      <p class="sot">Detyrat e shtëpisë për vitin e parë, sipas lëndëve dhe orarit.</p>
      <div class="numrat">
        <div class="numri"><b data-n="${teGjitha.length}">${teGjitha.length}</b><span>postime</span></div>
        <div class="numri"><b data-n="${nrFoto}">${nrFoto}</b><span>foto</span></div>
        <div class="numri${nrReja ? ' i-kuq' : ''}"><b data-n="${nrReja}">${nrReja}</b><span>${nrReja === 1 ? 'e re' : 'të reja'}</span></div>
      </div></section>`;

    h += seksioniOrarit();

    if (teGjitha.length) {
      h += '<section><h2 class="titull-seksioni">Të shtuara së fundmi</h2><ol class="rejat">';
      teGjitha.slice(0, 5).forEach(({ l, i, p, ri, g }) => {
        const titull = p.pershkrim || periudha(p);
        const meta = (p.pershkrim ? periudha(p) + ' · ' : '') + numero(p.foto.length, 'foto', 'foto') + ' · ' + saKohe(p.shtuar);
        h += `<li style="--c:${ngjyra(l, i)}"${g.kaluar ? ' class="kaluar"' : ''}><a class="rej" href="#/${l.id}/${p.id}">${ikona(l, i, 'e-vogel')}` +
          `<span class="rej-tekst"><span class="rej-lenda">${esc(l.emri)}${etiketa(g)}</span>` +
          `<span class="rej-titull">${esc(titull)}</span><span class="rej-meta">${esc(meta)}</span></span>` +
          `${ri ? VULE : ''}</a></li>`;
      });
      h += '</ol></section>';
    }

    h += `<section><h2 class="titull-seksioni">Lëndët <small>${DATA.lendet.length}</small></h2><ul class="lendet">`;
    DATA.lendet.forEach((l, i) => {
      const pare = lexo('pare:' + l.id);
      let meta, ri = false;
      if (l.postime.length) {
        const eFundit = l.postime.reduce((m, p) => (p.shtuar > m ? p.shtuar : m), '');
        const g = gjendja(l, 0);
        ri = !g.kaluar && iRi(eFundit, pare);
        meta = (!g.kaluar && g.a ? `<span class="ka">${tekstAfati(g.a)}</span> · ` : '') +
          numero(l.postime.length, 'postim', 'postime') + ' · ' + saKohe(eFundit);
      } else {
        meta = 'Ende pa detyra';
      }
      h += `<li><a class="lenda${l.postime.length ? '' : ' bosh'}" href="#/${l.id}">${ikona(l, i)}` +
        `<span class="l-tekst"><span class="l-emri">${esc(l.emri)}</span><span class="l-meta">${meta}</span></span>` +
        `${ri ? VULE : SVG_SHIGJETE}</a></li>`;
    });
    h += '</ul></section>';
    h += `<footer class="fund"><b>PostimDSH</b>Përditësuar ${saKohe(DATA.gjeneruar)} · <a href="menaxho.html">Menaxho</a></footer>`;

    vendos(h);
    window.scrollTo(0, rrugaEParme && rrugaEParme !== 'kryesore' ? rreshqitjaKryesore : 0);
    app.querySelectorAll('.numri b').forEach(numeroLart);
  }

  function faqjaLendes(l, i, synim) {
    document.title = l.emri + ' – ' + titulliBaze;
    lendaAktuale = l;

    const pare = lexo('pare:' + l.id);
    ruaj('pare:' + l.id, new Date().toISOString());

    const nrFoto = l.postime.reduce((s, p) => s + p.foto.length, 0);
    let h = `<section class="l-koka"><a class="kthehu" href="#/">${SVG_MBRAPA}Lëndët</a>` +
      `<div class="l-koka-rresht">${ikona(l, i, 'e-madhe')}<div><h1>${esc(l.emri)}</h1>` +
      `<p>${l.postime.length ? numero(l.postime.length, 'postim', 'postime') + ' · ' + numero(nrFoto, 'foto', 'foto') : 'Ende pa detyra'}</p>` +
      `</div></div>`;
    const ditet = (ORARI_LENDES[l.id] || []).slice().sort((a, b) => (a + 6) % 7 - (b + 6) % 7);
    if (ditet.length) h += `<p class="ne-orar">Në orar: <b>${ditet.map(d => DITET[d]).join(' · ')}</b></p>`;
    h += '</section>';

    if (!l.postime.length) h += '<p class="bosh-msg">Këtu s\'ka ende asgjë…</p>';

    let ndaresi = false;
    l.postime.forEach((p, pi) => {
      const g = gjendja(l, pi);
      const etiketat = (!g.kaluar && iRi(p.shtuar, pare) ? VULE : '') + etiketa(g);
      const koka = `<div class="p-krye">${kalendar(p)}` +
        `<div class="p-tekst">${etiketat ? `<div class="p-etiketat">${etiketat}</div>` : ''}<h2>${esc(periudha(p))}</h2>` +
        (p.pershkrim ? `<p class="pershkrim">${esc(p.pershkrim)}</p>` : '') +
        `<p class="p-meta">${numero(p.foto.length, 'foto', 'foto')} · shtuar ${saKohe(p.shtuar)}</p></div>` +
        `<div class="p-anash"><button class="p-lidhja" type="button" data-lidhja="${l.id}/${p.id}" aria-label="Dërgo lidhjen e këtij postimi">${SVG_LIDHJA}</button>` +
        (g.kaluar ? '<svg class="p-hap" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' : '') +
        '</div></div>';

      if (g.kaluar && pi > 0 && !ndaresi) {
        h += '<h2 class="titull-seksioni te-kaluarat">Të kaluarat</h2>';
        ndaresi = true;
      }
      h += g.kaluar
        ? `<details class="postim kaluar" id="p-${p.id}" style="--c:${ngjyra(l, i)}"${pi === 0 ? ' open' : ''}><summary>${koka}</summary><div class="p-fotot">`
        : `<article class="postim" id="p-${p.id}" style="--c:${ngjyra(l, i)}">${koka}<div class="p-fotot">`;

      let grupi = null;
      p.foto.forEach((f, fi) => {
        if (f.g !== grupi) {
          if (grupi !== null) h += '</div>';
          grupi = f.g;
          if (grupi) h += `<h3 class="grupi">${esc(grupi)}</h3>`;
          h += '<div class="rrjeta">';
        }
        h += `<a class="miniature" href="${f.p}" data-p="${pi}" data-f="${fi}">` +
          `<img src="${f.t}" alt="${esc(l.emri)}, ${esc(periudha(p))}, foto ${fi + 1}" loading="lazy" decoding="async">` +
          `<span class="nr">${fi + 1}</span></a>`;
      });
      if (grupi !== null) h += '</div>';
      h += g.kaluar ? '</div></details>' : '</div></article>';
    });

    vendos(h);

    const el = synim && document.getElementById('p-' + synim);
    if (el) {
      el.classList.remove('zbulo'); // ka animacionin e vet të theksimit
      if (el.tagName === 'DETAILS') el.open = true;
      el.scrollIntoView();
      el.classList.add('theksuar');
    } else {
      window.scrollTo(0, 0);
    }
  }

  function vendos(html) {
    app.classList.remove('hyr');
    app.innerHTML = html;
    if (LEVIZJE) {
      void app.offsetWidth; // rinis animacionin e hyrjes
      app.classList.add('hyr');
    }
    zbulo(app, '.rejat li, .lendet li, .neser li, .postim, .java');
  }

  function numeroLart(el) {
    const n = +el.dataset.n;
    if (!LEVIZJE || n < 2) return;
    const t0 = performance.now();
    const hap = t => {
      const k = Math.min(1, (t - t0) / 700);
      el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(hap);
    };
    el.textContent = '0';
    requestAnimationFrame(hap);
  }

  function rruga() {
    if (!DATA) return;
    let hash = location.hash.replace(/^#\/?/, '');
    try { hash = decodeURIComponent(hash); } catch (e) { /* lidhje e prishur */ }
    const pjeset = hash.split('/').filter(Boolean);
    const i = pjeset.length ? DATA.lendet.findIndex(l => l.id === pjeset[0]) : -1;
    if (rrugaEParme === 'kryesore') rreshqitjaKryesore = window.scrollY;
    if (i < 0) faqjaKryesore();
    else faqjaLendes(DATA.lendet[i], i, pjeset[1]);
    rrugaEParme = i < 0 ? 'kryesore' : pjeset[0];
  }

  app.addEventListener('load', e => {
    if (e.target.tagName === 'IMG') e.target.classList.add('gati');
  }, true);

  app.addEventListener('click', e => {
    const m = e.target.closest('.miniature');
    if (m && lendaAktuale) {
      e.preventDefault();
      const l = lendaAktuale, p = l.postime[+m.dataset.p];
      hap(p.foto.map((f, fi) => Object.assign({ emri: `PostimDSH_${l.id}_${p.data}_${fi + 1}.jpg` }, f)), +m.dataset.f, m);
      return;
    }
    const b = e.target.closest('.p-lidhja');
    if (b) {
      e.preventDefault(); // mos e hap/mbyll postimin kur butoni është brenda <summary>
      dergoLidhjen(b.dataset.lidhja);
    }
  });

  function dergoLidhjen(rruga) {
    const url = location.href.split('#')[0] + '#/' + rruga;
    if (navigator.share) {
      navigator.share({ title: document.title, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => njofto('Lidhja u kopjua'), () => njofto('Nuk u kopjua dot'));
    }
  }

  /* ---------- Njoftimi ---------- */

  const njoftim = document.getElementById('njoftim');
  let njoftimKoha = 0;
  function njofto(tekst) {
    njoftim.textContent = tekst;
    njoftim.classList.add('duket');
    clearTimeout(njoftimKoha);
    njoftimKoha = setTimeout(() => njoftim.classList.remove('duket'), 2400);
  }

  /* ---------- Shikuesi i fotove ---------- */

  const sh = document.getElementById('shikues');
  const korniza = document.getElementById('sh-korniza');
  const img = document.getElementById('sh-img');
  const nr = document.getElementById('sh-nr');
  const shkarko = document.getElementById('sh-shkarko');
  const para = document.getElementById('sh-para');
  const pas = document.getElementById('sh-pas');
  const dergo = document.getElementById('sh-dergo');
  const ndihme = document.getElementById('sh-ndihme');

  let lista = [], poz = 0, hapur = false;

  try {
    dergo.hidden = !(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.jpg', { type: 'image/jpeg' })] }));
  } catch (e) { /* shfletues pa File */ }

  function hap(fotot, i, burimi) {
    lista = fotot;
    poz = i;
    sh.hidden = false;
    sh.classList.remove('mbyllet');
    if (burimi && LEVIZJE) {
      // Fotoja zmadhohet duke dalë nga miniatura që u prek.
      const r = burimi.getBoundingClientRect();
      korniza.style.transformOrigin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
      korniza.classList.remove('hapet');
      void korniza.offsetWidth;
      korniza.classList.add('hapet');
    }
    document.body.classList.add('pa-rreshqitje');
    if (!hapur) {
      // Butoni "mbrapa" i telefonit mbyll foton në vend që të largohet nga faqja.
      history.pushState({ shikues: 1 }, '');
      hapur = true;
    }
    if (!lexo('ndihme')) {
      ndihme.hidden = false;
      ruaj('ndihme', '1');
    }
    shfaq(0);
  }

  function zvogelo() {
    sh.classList.remove('zmadh');
    img.style.width = '';
  }

  function shfaq(drejtimi) {
    zvogelo();
    const f = lista[poz];
    korniza.classList.add('po-ngarkon');
    img.classList.remove('nga-djathtas', 'nga-majtas');
    img.src = f.m;
    if (img.complete && img.naturalWidth) korniza.classList.remove('po-ngarkon');
    if (drejtimi && LEVIZJE) {
      void img.offsetWidth;
      img.classList.add(drejtimi > 0 ? 'nga-djathtas' : 'nga-majtas');
    }
    shkarko.href = f.p;
    shkarko.setAttribute('download', f.emri);
    nr.textContent = (poz + 1) + ' / ' + lista.length;
    para.disabled = poz === 0;
    pas.disabled = poz === lista.length - 1;
    [poz - 1, poz + 1].forEach(j => { if (lista[j]) new Image().src = lista[j].m; });
  }

  function leviz(d) {
    const j = poz + d;
    if (j >= 0 && j < lista.length) { poz = j; shfaq(d); }
  }

  function mbyll() { if (hapur) history.back(); }

  window.addEventListener('popstate', () => {
    if (!hapur) return;
    hapur = false;
    document.body.classList.remove('pa-rreshqitje');
    const fshih = () => {
      if (hapur) return; // u hap sërish ndërkohë
      sh.hidden = true;
      sh.classList.remove('mbyllet');
      korniza.classList.remove('hapet');
      ndihme.hidden = true;
      zvogelo();
      img.removeAttribute('src');
    };
    if (LEVIZJE) {
      sh.classList.add('mbyllet');
      setTimeout(fshih, 180);
    } else {
      fshih();
    }
  });

  img.addEventListener('load', () => korniza.classList.remove('po-ngarkon'));

  img.addEventListener('click', e => {
    if (sh.classList.contains('zmadh')) { zvogelo(); return; }
    const f = lista[poz];
    const r = img.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    img.style.width = Math.max(r.width, Math.min(f.w, r.width * 3)) + 'px';
    sh.classList.add('zmadh');
    // Mbaje pikën e prekur në qendër pas zmadhimit.
    korniza.scrollLeft = fx * img.offsetWidth - korniza.clientWidth / 2;
    korniza.scrollTop = fy * img.offsetHeight - korniza.clientHeight / 2;
    // Kur zmadhon, ngarko versionin me rezolucion të plotë.
    if (img.getAttribute('src') !== f.p) {
      const plote = new Image();
      plote.onload = () => { if (lista[poz] === f && sh.classList.contains('zmadh')) img.src = f.p; };
      plote.src = f.p;
    }
  });

  function blobPng(blob) {
    return createImageBitmap(blob).then(bmp => {
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
      return new Promise(res => c.toBlob(res, 'image/png'));
    });
  }

  function kopjo() {
    const f = lista[poz];
    const alternativa = () => njofto('Mbaje gishtin mbi foto dhe zgjidh “Kopjo”');
    if (!navigator.clipboard || !navigator.clipboard.write || !window.ClipboardItem) return alternativa();
    njofto('Po kopjohet…');
    // Clipboard pranon vetëm PNG, prandaj JPG-ja kthehet në PNG.
    const png = fetch(f.p).then(r => r.blob()).then(blobPng);
    navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      .then(() => njofto('Fotoja u kopjua'), alternativa);
  }

  function dergoFoton() {
    const f = lista[poz];
    fetch(f.p).then(r => r.blob())
      .then(b => navigator.share({ files: [new File([b], f.emri, { type: 'image/jpeg' })] }))
      .catch(e => { if (e && e.name !== 'AbortError') njofto('Nuk u dërgua dot'); });
  }

  para.addEventListener('click', () => leviz(-1));
  pas.addEventListener('click', () => leviz(1));
  document.getElementById('sh-mbyll').addEventListener('click', mbyll);
  document.getElementById('sh-kopjo').addEventListener('click', kopjo);
  dergo.addEventListener('click', dergoFoton);

  document.addEventListener('keydown', e => {
    if (!hapur) return;
    if (e.key === 'ArrowLeft') leviz(-1);
    else if (e.key === 'ArrowRight') leviz(1);
    else if (e.key === 'Escape') mbyll();
  });

  let prekjaX = null, prekjaY = 0;
  korniza.addEventListener('touchstart', e => {
    if (e.touches.length === 1 && !sh.classList.contains('zmadh')) {
      prekjaX = e.touches[0].clientX;
      prekjaY = e.touches[0].clientY;
    } else {
      prekjaX = null;
    }
  }, { passive: true });
  korniza.addEventListener('touchend', e => {
    if (prekjaX === null) return;
    const dx = e.changedTouches[0].clientX - prekjaX;
    const dy = e.changedTouches[0].clientY - prekjaY;
    prekjaX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) leviz(dx < 0 ? 1 : -1);
    else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) mbyll(); // rrëshqit poshtë për ta mbyllur
  }, { passive: true });

  /* ---------- Nisja ---------- */

  fetch('te-dhenat.json', { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => {
      DATA = d;
      (d.orari || []).forEach(o => o.lendet.forEach(x => {
        (ORARI_LENDES[x.id] = ORARI_LENDES[x.id] || []).push(o.dita);
      }));
      rruga();
      window.addEventListener('hashchange', rruga);
    })
    .catch(() => {
      app.innerHTML = '<p class="gabim">Nuk u ngarkuan detyrat. Provo ta rifreskosh faqen.</p>';
    });
})();
