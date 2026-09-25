'use strict';
// Faqja "Menaxho": poston, fshin dhe ndryshon orarin pa kod.
// Hyrja: çelësi i GitHub ruhet te hyrja.json i enkriptuar (AES-256-GCM, PBKDF2 600 000 herë)
// me përdoruesin dhe fjalëkalimin. Fjalëkalimi nuk ruhet askund, prandaj leximi ose ndryshimi
// i këtij kodi nuk jep leje: pa fjalëkalimin e saktë çelësi s'mund të hapet.
(() => {
  const { MUAJT, DITET, DITET_PER, RENDITJA, LEVIZJE, esc, slug, ikona, lexo, ruaj, zbulo, konfeti } = window.PDSH;
  const API = 'https://api.github.com';
  const FOTO = /\.(jpe?g|jpe|jfif|png|webp|heic|heif|avif|gif|bmp|tiff?)$/i;
  const DITET_FILLIMI = [['die', 0], ['han', 1], ['hen', 1], ['mar', 2], ['mer', 3], ['mek', 3], ['enj', 4], ['pre', 5], ['sht', 6]];
  const PA_DETYRA = ['Fiskulturë', 'TIK'];
  const DITA = 864e5;

  const m = document.getElementById('m');
  const skedat = document.getElementById('skedat');
  const njoftim = document.getElementById('njoftim');

  const cfg = { token: '', owner: '', repo: '', branch: '' };
  let HYRJA = null; // përmbajtja e hyrja.json

  let LENDET = [];   // [{emri, dosja, postime: [{dosja, foto, te}], te}]
  let ORARI = [];    // [{dita, lendet: [emri]}]
  let skeda = 'posto';
  let duke_punuar = false;
  let forma = formaEre();

  /* ---------- Ndihmës ---------- */

  function formaEre(lenda) {
    return { lenda: lenda || null, data: dataISO(0), pershkrim: '', lloji: '', fotot: [], dosja: null };
  }

  function dataISO(ditePara) {
    const d = new Date(Date.now() - ditePara * DITA);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dite(iso) {
    const [y, mu, d] = iso.split('-').map(Number);
    return new Date(y, mu - 1, d);
  }

  const kapitalizo = s => s.charAt(0).toUpperCase() + s.slice(1);
  const pauze = ms => new Promise(r => setTimeout(r, ms));

  // Heq shkronjat që s'lejohen në emra dosjesh.
  const pastro = s => s.normalize('NFC').replace(/[\\/:*?"<>|#%\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/\.+$/, '').slice(0, 60);

  function emriPostimit(dosja) {
    if (!dosja) return 'Foto pa dosje';
    const mm = dosja.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s*(.*)$/);
    if (!mm) return dosja;
    const d = new Date(+mm[1], mm[2] - 1, +mm[3]);
    return `${DITET[d.getDay()]}, ${d.getDate()} ${MUAJT[d.getMonth()]}` + (mm[4] ? ' · ' + mm[4] : '');
  }

  let njoftimKoha = 0;
  function njofto(tekst) {
    njoftim.textContent = tekst;
    njoftim.classList.add('duket');
    clearTimeout(njoftimKoha);
    njoftimKoha = setTimeout(() => njoftim.classList.remove('duket'), 3000);
  }

  function mesazhiGabimit(e) {
    switch (e.status) {
      case 0: return 'S\'ka internet. Provo përsëri.';
      case 401: return 'Çelësi i GitHub ka skaduar ose është fshirë. Bëj një të ri (“Çelësi i GitHub ka skaduar?”).';
      case 403: return 'Çelësi i GitHub s\'ka leje të shkruajë. Te GitHub, “Contents” duhet të jetë “Read and write”.';
      case 404: return 'Nuk u gjet repo në GitHub. Kontrollo emrin e llogarisë dhe të repos, dhe që çelësi ka akses te ajo.';
      case 409: case 422: return 'Diçka ndryshoi njëkohësisht. Provo përsëri.';
      default: return `Diçka nuk shkoi (kodi ${e.status}). Provo përsëri.`;
    }
  }

  function gjejRepon() {
    const mh = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (!mh) return { owner: '', repo: '' };
    const seg = location.pathname.split('/').filter(Boolean)[0];
    return { owner: mh[1], repo: seg && !/\.html?$/.test(seg) ? seg : location.hostname };
  }

  /* ---------- GitHub ---------- */

  function koka(json) {
    const h = { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  async function gh(rruga, metoda, trupi) {
    let r;
    try {
      r = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}${rruga}`, {
        method: metoda || 'GET', headers: koka(!!trupi), body: trupi ? JSON.stringify(trupi) : undefined, cache: 'no-store',
      });
    } catch (e) {
      throw Object.assign(new Error(''), { status: 0 });
    }
    if (!r.ok) throw Object.assign(new Error(''), { status: r.status });
    return r.status === 204 ? null : r.json();
  }

  // Fotot dërgohen me XHR që të shihet përqindja e ngarkimit.
  function ngarkoBlob(b64, neProgres) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open('POST', `${API}/repos/${cfg.owner}/${cfg.repo}/git/blobs`);
      Object.entries(koka(true)).forEach(([k, v]) => x.setRequestHeader(k, v));
      x.upload.onprogress = e => { if (e.lengthComputable) neProgres(e.loaded / e.total); };
      x.onload = () => {
        let d = {};
        try { d = JSON.parse(x.responseText); } catch (e) { /* përgjigje bosh */ }
        if (x.status < 300 && d.sha) res(d.sha);
        else rej(Object.assign(new Error(''), { status: x.status }));
      };
      x.onerror = () => rej(Object.assign(new Error(''), { status: 0 }));
      x.send(JSON.stringify({ content: b64, encoding: 'base64' }));
    });
  }

  // Të gjitha ndryshimet ruhen njëherësh, që faqja të ndërtohet vetëm një herë.
  async function bejCommit(mesazhi, ndryshimet) {
    for (let prova = 0; ; prova++) {
      const ref = await gh(`/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
      const prind = await gh(`/git/commits/${ref.object.sha}`);
      const pema = await gh('/git/trees', 'POST', {
        base_tree: prind.tree.sha,
        tree: ndryshimet.map(n => {
          const e = { path: n.path, mode: '100644', type: 'blob' };
          if (n.fshi) e.sha = null;
          else if (n.content != null) e.content = n.content;
          else e.sha = n.sha;
          return e;
        }),
      });
      const c = await gh('/git/commits', 'POST', { message: mesazhi, tree: pema.sha, parents: [ref.object.sha] });
      try {
        await gh(`/git/refs/heads/${encodeURIComponent(cfg.branch)}`, 'PATCH', { sha: c.sha });
        return c.sha;
      } catch (e) {
        if (e.status !== 422 || prova >= 2) throw e; // dikush tjetër ruajti në të njëjtën kohë
      }
    }
  }

  function dekodo(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  }

  async function ngarkoTeDhenat() {
    cfg.branch = (await gh('')).default_branch;
    const ref = await gh(`/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
    const c = await gh(`/git/commits/${ref.object.sha}`);
    const pema = (await gh(`/git/trees/${c.tree.sha}?recursive=1`)).tree;
    LENDET = ndertoLendet(pema);
    const o = pema.find(e => e.path === 'orari.txt');
    ORARI = lexoOrarin(o ? dekodo((await gh(`/git/blobs/${o.sha}`)).content) : '');
  }

  /* ---------- Enkriptimi i çelësit ---------- */

  const enc = new TextEncoder();
  const ITERACIONE = 600000; // e bën çdo provë fjalëkalimi të ngadaltë për hakerat
  const neB64 = b => btoa(String.fromCharCode(...new Uint8Array(b)));
  const ngaB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function celesiNga(perdoruesi, fjalekalimi, kripa, iteracione) {
    const baza = await crypto.subtle.importKey('raw', enc.encode(perdoruesi + '\u0000' + fjalekalimi), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: kripa, iterations: iteracione, hash: 'SHA-256' },
      baza, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function enkripto(token, perdoruesi, fjalekalimi) {
    const kripa = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const celesi = await celesiNga(perdoruesi, fjalekalimi, kripa, ITERACIONE);
    const e = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, celesi, enc.encode(JSON.stringify({ t: token })));
    return { v: 1, iteracione: ITERACIONE, kripa: neB64(kripa), iv: neB64(iv), e: neB64(e), owner: cfg.owner, repo: cfg.repo };
  }

  // Kthen çelësin e GitHub, ose null kur përdoruesi/fjalëkalimi është gabim (AES-GCM e dallon vetë).
  async function dekripto(h, perdoruesi, fjalekalimi) {
    try {
      const celesi = await celesiNga(perdoruesi, fjalekalimi, ngaB64(h.kripa), h.iteracione);
      const d = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ngaB64(h.iv) }, celesi, ngaB64(h.e));
      return JSON.parse(new TextDecoder().decode(d)).t || null;
    } catch (e) {
      return null;
    }
  }

  function ruajToken(mbajMend) {
    try { (mbajMend ? localStorage : sessionStorage).setItem('pdsh-token', cfg.token); } catch (e) { /* shfletim privat */ }
  }
  function lexoToken() {
    try { return sessionStorage.getItem('pdsh-token') || localStorage.getItem('pdsh-token') || ''; } catch (e) { return ''; }
  }
  function fshiToken() {
    try { sessionStorage.removeItem('pdsh-token'); localStorage.removeItem('pdsh-token'); } catch (e) { /* s'ka gjë */ }
  }

  async function ruajHyrjen(perdoruesi, fjalekalimi) {
    const e = await enkripto(cfg.token, perdoruesi, fjalekalimi);
    await bejCommit('Ndrysho hyrjen e Menaxho', [{ path: 'faqja/hyrja.json', content: JSON.stringify(e, null, 1) + '\n' }]);
    HYRJA = e;
  }

  function ndertoLendet(pema) {
    const lendet = new Map();
    const lende = dosja => {
      if (!lendet.has(dosja)) lendet.set(dosja, { emri: dosja.normalize('NFC'), dosja, postime: new Map(), te: [] });
      return lendet.get(dosja);
    };
    pema.forEach(e => {
      if (!e.path.startsWith('detyra/')) return;
      const pj = e.path.split('/').slice(1);
      if (/^[._]/.test(pj[0])) return;
      if (e.type === 'tree') { if (pj.length === 1) lende(pj[0]); return; }
      if (e.type !== 'blob' || pj.length < 2) return;
      const l = lende(pj[0]);
      l.te.push(e.path);
      const eshteFoto = FOTO.test(pj[pj.length - 1]);
      if (pj.length === 2 && !eshteFoto) return; // .gitkeep i lëndës
      const dosja = pj.length === 2 ? '' : pj[1];
      if (!l.postime.has(dosja)) l.postime.set(dosja, { dosja, foto: 0, te: [] });
      const p = l.postime.get(dosja);
      p.te.push(e.path);
      if (eshteFoto) p.foto++;
    });
    const renditja = id => { const i = RENDITJA.indexOf(id); return i < 0 ? 99 : i; };
    return [...lendet.values()]
      .map(l => Object.assign(l, {
        id: slug(l.emri),
        postime: [...l.postime.values()].sort((a, b) => b.dosja.localeCompare(a.dosja, undefined, { numeric: true })),
      }))
      .sort((a, b) => renditja(a.id) - renditja(b.id) || a.emri.localeCompare(b.emri));
  }

  /* ---------- Orari ---------- */

  function lexoOrarin(tekst) {
    const o = new Map();
    tekst.split(/\r?\n/).forEach(r => {
      r = r.split('#')[0].trim();
      const i = r.indexOf(':');
      if (i < 0) return;
      const d = slug(r.slice(0, i)).replace(/^e-/, '');
      const f = DITET_FILLIMI.find(([p]) => d.startsWith(p));
      if (!f) return;
      const lendet = r.slice(i + 1).split(/[,;]/).map(s => s.trim().normalize('NFC')).filter(Boolean);
      o.set(f[1], (o.get(f[1]) || []).concat(lendet));
    });
    return [1, 2, 3, 4, 5, 6, 0].filter(d => o.has(d) || (d >= 1 && d <= 5)).map(d => ({ dita: d, lendet: o.get(d) || [] }));
  }

  function shkruajOrarin() {
    return '# Orari i mësimit. Për çdo ditë shkruaj lëndët, të ndara me presje.\n' +
      '# Mund ta ndryshosh edhe nga faqja "Menaxho" → Orari.\n\n' +
      ORARI.filter(o => o.lendet.length || (o.dita >= 1 && o.dita <= 5))
        .map(o => `${kapitalizo(DITET[o.dita])}: ${o.lendet.join(', ')}`).join('\n') + '\n';
  }

  // Si te nderto.py: "Fizik" lidhet me "Fizikë", "Gjuh" me "Gjuhë shqipe".
  function perputhet(emriOrarit, lenda) {
    const s = slug(emriOrarit);
    return s === lenda.id || (s.length >= 4 && (lenda.id.startsWith(s) || s.startsWith(lenda.id)));
  }

  function afati(lenda, dataIso) {
    const ditet = ORARI.filter(o => o.lendet.some(x => perputhet(x, lenda))).map(o => o.dita);
    if (!ditet.length) return null;
    const nga = dite(dataIso);
    for (let k = 1; k <= 7; k++) {
      const d = new Date(nga.getFullYear(), nga.getMonth(), nga.getDate() + k);
      if (ditet.includes(d.getDay())) return d;
    }
    return null;
  }

  /* ---------- Hyrja ---------- */

  const NGARKIM = '<div class="ngarkim"><span></span><span></span><span></span></div>';

  function faqjaHyrjes(mesazhi, perdoruesi) {
    skedat.hidden = true;
    m.innerHTML = `<section class="m-karte m-hyrje">
      <p class="pershendetje">Menaxho</p>
      <p>Vetëm për ata që postojnë detyrat.</p>
      <form id="h-forma">
        <label class="m-etiketa">Përdoruesi
          <input id="h-emri" class="m-fushe" autocomplete="username" autocapitalize="off" spellcheck="false" required value="${esc(perdoruesi || '')}"></label>
        <label class="m-etiketa">Fjalëkalimi
          <input id="h-fjalekalimi" class="m-fushe" type="password" autocomplete="current-password" required></label>
        <label class="m-kutiza"><input type="checkbox" id="h-mbaj"><span>Më mbaj brenda në këtë pajisje</span></label>
        ${mesazhi ? `<p class="m-gabim">${esc(mesazhi)}</p>` : ''}
        <button id="h-hyr" class="m-buton kryesor" type="submit">Hyr</button>
      </form>
      <p class="m-poshte"><button type="button" id="h-ri" class="m-lidhje">Çelësi i GitHub ka skaduar?</button></p>
    </section>`;

    document.getElementById('h-forma').onsubmit = async e => {
      e.preventDefault();
      const emri = document.getElementById('h-emri').value;
      const fjalekalimi = document.getElementById('h-fjalekalimi').value;
      const mbaj = document.getElementById('h-mbaj').checked;
      const buton = document.getElementById('h-hyr');
      buton.disabled = true;
      buton.textContent = 'Po kontrollohet…';
      const token = await dekripto(HYRJA, emri, fjalekalimi);
      if (!token) return faqjaHyrjes('Përdoruesi ose fjalëkalimi është gabim.', emri);
      Object.assign(cfg, { token, owner: HYRJA.owner, repo: HYRJA.repo });
      m.innerHTML = NGARKIM;
      try {
        await ngarkoTeDhenat();
        ruajToken(mbaj);
        njofto('Mirë se erdhe!');
        nisPanelin();
      } catch (err) {
        faqjaHyrjes(mesazhiGabimit(err), emri);
      }
    };
    document.getElementById('h-ri').onclick = () => faqjaKonfigurimit(true);
  }

  // Konfigurimi i parë, ose kur duhet vendosur një çelës i ri GitHub.
  function faqjaKonfigurimit(iRi, mesazhi) {
    skedat.hidden = true;
    const r = HYRJA ? { owner: HYRJA.owner, repo: HYRJA.repo } : gjejRepon();
    m.innerHTML = `<section class="m-karte m-hyrje">
      <p class="pershendetje">${iRi ? 'Çelës i ri' : 'Konfigurimi i parë'}</p>
      <p>${iRi ? 'Bëj një çelës të ri në GitHub dhe vendos përsëri përdoruesin dhe fjalëkalimin.'
        : 'Bëhet vetëm një herë. Pastaj hyn vetëm me përdorues dhe fjalëkalim, nga çdo pajisje.'}</p>
      <ol class="hapat">
        <li>Hap <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">këtë faqe të GitHub</a> dhe hyr në llogari.</li>
        <li><b>Token name</b>: <code>PostimDSH</code>. <b>Expiration</b>: afati më i gjatë.</li>
        <li><b>Repository access</b> → <b>Only select repositories</b> → ${r.repo ? `<b>${esc(r.repo)}</b>` : 'repoja e faqes'}.</li>
        <li><b>Permissions</b>: <b>Contents</b> → <b>Read and write</b>, <b>Actions</b> → <b>Read-only</b>.</li>
        <li><b>Generate token</b>, kopjoje dhe ngjite këtu:</li>
      </ol>
      <input id="k-token" class="m-fushe" type="password" placeholder="github_pat_…" autocomplete="off" autocapitalize="off" spellcheck="false">
      <details class="m-avancuar"${r.owner && r.repo ? '' : ' open'}><summary>Llogaria dhe repoja në GitHub</summary>
        <label>Llogaria (username)<input id="k-owner" class="m-fushe" value="${esc(r.owner)}" autocapitalize="off" spellcheck="false"></label>
        <label>Repo<input id="k-repo" class="m-fushe" value="${esc(r.repo)}" autocapitalize="off" spellcheck="false"></label>
      </details>
      <label class="m-etiketa">Përdoruesi për Menaxho
        <input id="k-emri" class="m-fushe" autocomplete="username" autocapitalize="off" spellcheck="false"></label>
      <label class="m-etiketa">Fjalëkalimi
        <input id="k-fj1" class="m-fushe" type="password" autocomplete="new-password"></label>
      <label class="m-etiketa">Përsërite fjalëkalimin
        <input id="k-fj2" class="m-fushe" type="password" autocomplete="new-password"></label>
      ${mesazhi ? `<p class="m-gabim">${esc(mesazhi)}</p>` : ''}
      <button id="k-ruaj" class="m-buton kryesor" type="button">Ruaj</button>
      ${HYRJA ? '<p class="m-poshte"><button type="button" id="k-kthehu" class="m-lidhje">Kthehu te hyrja</button></p>' : ''}
      <p class="m-shenim">Çelësi i GitHub ruhet i enkriptuar me fjalëkalimin. Pa fjalëkalimin askush s'mund ta përdorë.</p>
    </section>`;

    const kthehu = document.getElementById('k-kthehu');
    if (kthehu) kthehu.onclick = () => faqjaHyrjes();
    document.getElementById('k-ruaj').onclick = async () => {
      const v = id => document.getElementById(id).value;
      const token = v('k-token').trim(), owner = v('k-owner').trim(), repo = v('k-repo').trim();
      const emri = v('k-emri'), fj1 = v('k-fj1'), fj2 = v('k-fj2');
      if (!token || !owner || !repo || !emri || !fj1) return njofto('Plotëso të gjitha fushat.');
      if (fj1 !== fj2) return njofto('Fjalëkalimet nuk janë njësoj.');
      Object.assign(cfg, { token, owner, repo });
      m.innerHTML = NGARKIM;
      try {
        await ngarkoTeDhenat();
        await ruajHyrjen(emri, fj1);
        ruajToken(false);
        njofto('U ruajt! Nga tani hyn me përdorues dhe fjalëkalim.');
        nisPanelin();
      } catch (e) {
        cfg.token = '';
        faqjaKonfigurimit(iRi, mesazhiGabimit(e));
      }
    };
  }

  function dil(mesazhi) {
    fshiToken();
    cfg.token = '';
    faqjaHyrjes(mesazhi);
  }

  /* ---------- Paneli ---------- */

  const SKEDAT = ['posto', 'postimet', 'orari', 'cilesimet'];

  function nisPanelin() {
    skedat.hidden = false;
    hapSkeden(skeda);
  }

  function hapSkeden(s) {
    skeda = s;
    skedat.querySelectorAll('button').forEach(b => b.classList.toggle('aktiv', b.dataset.skeda === s));
    document.getElementById('skedat-brenda').style.setProperty('--i', SKEDAT.indexOf(s));
    ({ posto: faqjaPostos, postimet: faqjaPostimeve, orari: faqjaOrarit, cilesimet: faqjaCilesimeve })[s]();
    if (LEVIZJE) {
      m.classList.remove('hyr');
      void m.offsetWidth; // rinis animacionin e hyrjes
      m.classList.add('hyr');
    }
    window.scrollTo(0, 0);
  }

  skedat.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && !duke_punuar && b.dataset.skeda !== skeda) hapSkeden(b.dataset.skeda);
  });

  /* ---------- Posto ---------- */

  const hapatKryer = new Set();

  function hapi(celesi, numri, titulli) {
    return `<h2 class="m-hapi"><span data-hapi="${celesi}">${numri}</span>${titulli}</h2>`;
  }

  // Numri i hapit kthehet në ✓ kur hapi plotësohet (me një kërcim të vogël herën e parë).
  function shenoHapat() {
    const p = document.getElementById('p-pershkrim');
    const kryer = {
      lenda: !!forma.lenda, data: !!forma.lenda, lloji: !!forma.lenda,
      pershkrim: !!(p && p.value.trim()), fotot: forma.fotot.length > 0,
    };
    m.querySelectorAll('[data-hapi]').forEach(s => {
      const k = s.dataset.hapi, po = kryer[k];
      s.classList.toggle('kryer', po);
      if (po && !hapatKryer.has(k) && LEVIZJE) {
        s.classList.add('i-ri');
        s.addEventListener('animationend', () => s.classList.remove('i-ri'), { once: true });
      }
      if (po) hapatKryer.add(k); else hapatKryer.delete(k);
    });
  }

  function faqjaPostos() {
    const lenda = LENDET.find(l => l.dosja === forma.lenda);
    const shton = forma.dosja !== null;
    let h = '<section class="m-karte m-posto">';

    if (shton && lenda) {
      h += `<div class="m-banderole">Po shton foto te <b>${esc(lenda.emri)} · ${esc(emriPostimit(forma.dosja))}</b>
        <button type="button" id="p-anulo" class="m-lidhje">Anulo</button></div>`;
    }

    h += '<div class="m-posto-majtas">' + hapi('lenda', 1, 'Lënda') + '<div class="m-lendet">';
    LENDET.forEach((l, i) => {
      h += `<button type="button" class="m-lende${l.dosja === forma.lenda ? ' zgjedhur' : ''}" data-lenda="${esc(l.dosja)}"${shton ? ' disabled' : ''}>` +
        `${ikona(l, i, 'e-vogel')}<span>${esc(l.emri)}</span></button>`;
    });
    h += '</div>';

    if (!shton) {
      const a = lenda && afati(lenda, forma.data);
      h += hapi('data', 2, 'Kur u dha detyra?') + `
        <div class="m-rresht">
          <button type="button" class="m-cip${forma.data === dataISO(0) ? ' zgjedhur' : ''}" data-dite="0">Sot</button>
          <button type="button" class="m-cip${forma.data === dataISO(1) ? ' zgjedhur' : ''}" data-dite="1">Dje</button>
          <input type="date" id="p-data" class="m-fushe m-data" value="${forma.data}" max="${dataISO(0)}">
        </div>
        <p class="m-afati">${!lenda ? 'Zgjidh lëndën që të shohësh afatin.'
          : a ? `Afati: <b>${tekstAfati(a)}</b> (nga orari)` : 'Kjo lëndë s\'është në orar, prandaj pa afat.'}</p>` +
        hapi('pershkrim', 3, 'Përshkrimi <small>(s\'është e detyrueshme)</small>') +
        `<input id="p-pershkrim" class="m-fushe" maxlength="60" placeholder="p.sh. Ushtrime faqe 34" value="${esc(forma.pershkrim)}">`;
    }

    h += hapi('lloji', shton ? 2 : 4, 'Nga është?') + '<div class="m-rresht">' +
      [['', 'Pa ndarje'], ['Libri', 'Libri'], ['Fletore', 'Fletore']].map(([v, t]) =>
        `<button type="button" class="m-cip${forma.lloji === v ? ' zgjedhur' : ''}" data-lloji="${v}">${t}</button>`).join('') +
      '</div></div>';

    h += '<div class="m-posto-djathtas">' + hapi('fotot', shton ? 3 : 5, 'Fotot') + `
      <div class="m-rresht m-zgjidh">
        <label class="m-buton"><input type="file" id="p-galeria" multiple accept="image/*,.heic,.heif,.avif,.jfif,.tif,.tiff">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>Zgjidh fotot</label>
        <label class="m-buton"><input type="file" id="p-kamera" accept="image/*" capture="environment">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/></svg>Bëj foto</label>
      </div>
      <div class="m-hedh">Tërhiq fotot këtu nga dosja, ose ngjit një screenshot me <b>Ctrl+V</b></div>
      <div class="m-paraparje" id="p-paraparje"></div>
      <label class="m-kutiza"><input type="checkbox" id="p-zvogelo"${lexo('pdsh-zvogelo') === '0' ? '' : ' checked'}>
        <span>Kurse internetin: fotot zvogëlohen pak, por teksti mbetet i qartë</span></label>
      <button type="button" id="p-posto" class="m-buton kryesor">Posto</button>
      <div id="p-gjendja"></div>
    </div></section>`;

    m.innerHTML = h;
    vizatoParaparjen();
    perditesoButonin();

    m.querySelectorAll('[data-lenda]').forEach(b => b.onclick = () => { forma.lenda = b.dataset.lenda; ruajFushat(); faqjaPostos(); });
    m.querySelectorAll('[data-dite]').forEach(b => b.onclick = () => { forma.data = dataISO(+b.dataset.dite); ruajFushat(); faqjaPostos(); });
    m.querySelectorAll('[data-lloji]').forEach(b => b.onclick = () => { forma.lloji = b.dataset.lloji; ruajFushat(); faqjaPostos(); });
    const data = document.getElementById('p-data');
    if (data) data.onchange = () => { if (data.value) forma.data = data.value; ruajFushat(); faqjaPostos(); };
    const pershkrim = document.getElementById('p-pershkrim');
    if (pershkrim) pershkrim.oninput = shenoHapat;
    const anulo = document.getElementById('p-anulo');
    if (anulo) anulo.onclick = () => { forma = formaEre(); faqjaPostos(); };
    ['p-galeria', 'p-kamera'].forEach(id => {
      document.getElementById(id).onchange = e => {
        shtoFotot(e.target.files);
        e.target.value = '';
      };
    });
    document.getElementById('p-zvogelo').onchange = e => ruaj('pdsh-zvogelo', e.target.checked ? '1' : '0');
    document.getElementById('p-posto').onclick = posto;
  }

  function shtoFotot(skedaret) {
    const te = [...skedaret].filter(f => f && (FOTO.test(f.name) || (f.type || '').startsWith('image/')));
    if (!te.length) return false;
    forma.fotot.push(...te);
    vizatoParaparjen();
    perditesoButonin();
    return true;
  }

  // Në kompjuter: tërhiq fotot nga dosja, ose ngjit screenshot me Ctrl+V.
  const mundTeShtoje = () => skeda === 'posto' && !skedat.hidden && !duke_punuar && !!document.getElementById('p-paraparje');
  let terheqje = 0;
  document.addEventListener('dragenter', e => {
    if (!mundTeShtoje() || !e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
    terheqje++;
    document.body.classList.add('terheq');
  });
  document.addEventListener('dragleave', () => {
    if (terheqje && --terheqje === 0) document.body.classList.remove('terheq');
  });
  document.addEventListener('dragover', e => { if (mundTeShtoje()) e.preventDefault(); });
  document.addEventListener('drop', e => {
    terheqje = 0;
    document.body.classList.remove('terheq');
    if (!mundTeShtoje()) return;
    e.preventDefault();
    const n = e.dataTransfer.files.length;
    if (shtoFotot(e.dataTransfer.files)) njofto(`U shtuan ${n} foto.`);
  });
  document.addEventListener('paste', e => {
    if (!mundTeShtoje() || !e.clipboardData) return;
    const skedaret = [...e.clipboardData.items].filter(i => i.kind === 'file').map((i, n) => {
      const f = i.getAsFile();
      // Screenshot-et vijnë pa emër (ose "image.png"), prandaj u japim një emër.
      return f && (!f.name || f.name === 'image.png') ? new File([f], `screenshot-${Date.now()}-${n}.png`, { type: f.type }) : f;
    });
    if (shtoFotot(skedaret)) {
      e.preventDefault();
      njofto('Fotoja u ngjit.');
    }
  });
  function ruajFushat() {
    const p = document.getElementById('p-pershkrim');
    if (p) forma.pershkrim = p.value;
  }

  function tekstAfati(a) {
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const n = Math.round((a - s) / DITA);
    const data = `${a.getDate()} ${MUAJT[a.getMonth()]}`;
    if (n === 0) return 'për sot';
    if (n === 1) return 'për nesër, ' + data;
    if (n > 1 && n < 7) return `për ${DITET_PER[a.getDay()]}, ${data}`;
    if (n === 7) return `për ${DITET_PER[a.getDay()]} e ardhshme, ${data}`;
    return `${DITET[a.getDay()]}, ${data}`;
  }

  function vizatoParaparjen() {
    const el = document.getElementById('p-paraparje');
    if (!el) return;
    el.querySelectorAll('img').forEach(i => URL.revokeObjectURL(i.src));
    el.innerHTML = forma.fotot.map((f, i) => {
      const shfaqet = /^image\/(jpeg|png|webp|gif|avif|bmp)$/.test(f.type);
      return `<div class="m-foto">${shfaqet ? `<img src="${URL.createObjectURL(f)}" alt="">` : `<span>${esc(f.name.split('.').pop().toUpperCase())}</span>`}` +
        `<b>${i + 1}</b><button type="button" data-hiq="${i}" aria-label="Hiqe foton">&times;</button></div>`;
    }).join('');
    el.querySelectorAll('[data-hiq]').forEach(b => b.onclick = () => {
      forma.fotot.splice(+b.dataset.hiq, 1);
      vizatoParaparjen();
      perditesoButonin();
    });
  }

  function perditesoButonin() {
    const b = document.getElementById('p-posto');
    if (!b) return;
    const n = forma.fotot.length;
    b.disabled = duke_punuar || !forma.lenda || !n;
    b.textContent = !forma.lenda ? 'Zgjidh lëndën' : !n ? 'Shto fotot' : `Posto ${n} foto`;
    shenoHapat();
  }

  // Zvogëlon fotot e mëdha në 3000px (faqja i shfaq deri 2560px), që ngarkimi të jetë i shpejtë.
  async function pergatit(file, zvogelo) {
    const ext = ((file.name.match(/\.[^.]+$/) || ['.jpg'])[0]).toLowerCase();
    if (!zvogelo || !/^image\/(jpeg|png|webp)$/.test(file.type)) return { blob: file, ext };
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, 3000 / Math.max(w, h));
      if (s === 1 && file.size < 2e6) return { blob: file, ext };
      const c = document.createElement('canvas');
      c.width = Math.round(w * s);
      c.height = Math.round(h * s);
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      c.width = c.height = 0; // liro memorien në telefona të dobët
      return blob && blob.size < file.size ? { blob, ext: '.jpg' } : { blob: file, ext };
    } catch (e) {
      return { blob: file, ext };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function neBase64(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1] || '');
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  function vulaKohore() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  async function posto() {
    ruajFushat();
    const lenda = LENDET.find(l => l.dosja === forma.lenda);
    if (!lenda || !forma.fotot.length || duke_punuar) return;

    const dosja = forma.dosja !== null ? forma.dosja
      : forma.data + (pastro(forma.pershkrim) ? ' ' + pastro(forma.pershkrim) : '');
    const baza = `detyra/${lenda.dosja}/${dosja ? dosja + '/' : ''}${forma.lloji ? forma.lloji + '/' : ''}`;
    const zvogelo = document.getElementById('p-zvogelo').checked;
    const gjendja = document.getElementById('p-gjendja');
    const fotot = forma.fotot.slice();
    const vula = vulaKohore();

    fillo(true);
    gjendja.innerHTML = '<div class="m-progres"><div><span id="g-shirit"></span></div><p id="g-tekst"></p></div>';
    const shirit = document.getElementById('g-shirit'), tekst = document.getElementById('g-tekst');
    const pjesa = (i, k) => { shirit.style.width = ((i + k) / fotot.length * 92).toFixed(1) + '%'; };

    try {
      const ndryshimet = [];
      for (let i = 0; i < fotot.length; i++) {
        tekst.textContent = `Po ngarkohet fotoja ${i + 1} nga ${fotot.length}…`;
        const { blob, ext } = await pergatit(fotot[i], zvogelo);
        const b64 = await neBase64(blob);
        let sha;
        for (let prova = 0; ; prova++) { // një provë më shumë kur interneti ndërpritet
          try { sha = await ngarkoBlob(b64, k => pjesa(i, k)); break; }
          catch (e) { if (e.status !== 0 || prova) throw e; await pauze(2000); }
        }
        ndryshimet.push({ path: `${baza}${vula}-${String(i + 1).padStart(2, '0')}${ext}`, sha });
        pjesa(i + 1, 0);
      }
      tekst.textContent = 'Po ruhet…';
      const sha = await bejCommit(`Detyrë e re: ${lenda.emri} ${dosja}`.trim(), ndryshimet);
      shirit.style.width = '100%';
      forma = formaEre(lenda.dosja);
      fillo(false);
      faqjaPostos();
      const gj = document.getElementById('p-gjendja');
      gj.innerHTML = `<div class="m-sukses"><b>U postua!</b><p id="g-publikimi">Faqja po përditësohet… (rreth 1–2 minuta)</p></div>`;
      gj.scrollIntoView({ block: 'center', behavior: LEVIZJE ? 'smooth' : 'auto' });
      konfeti();
      ndiqPublikimin(sha, document.getElementById('g-publikimi'));
      ngarkoTeDhenat().catch(() => {});
    } catch (e) {
      fillo(false);
      gjendja.innerHTML = `<p class="m-gabim">${esc(mesazhiGabimit(e))}</p>`;
    }
  }

  function fillo(po) {
    duke_punuar = po;
    document.body.classList.toggle('po-punon', po);
    perditesoButonin();
  }

  window.addEventListener('beforeunload', e => {
    if (duke_punuar) { e.preventDefault(); e.returnValue = ''; }
  });

  async function ndiqPublikimin(sha, el) {
    const fund = Date.now() + 8 * 60e3;
    while (Date.now() < fund) {
      await pauze(6000);
      if (!el.isConnected) return;
      let run;
      try {
        run = (await gh(`/actions/runs?head_sha=${sha}&per_page=1`)).workflow_runs[0];
      } catch (e) {
        el.textContent = 'Faqja do të përditësohet për 1–2 minuta.';
        return;
      }
      if (!run || run.status !== 'completed') {
        el.textContent = run && run.status === 'in_progress' ? 'Po ndërtohet faqja…' : 'Në radhë për publikim…';
        continue;
      }
      if (run.conclusion === 'success') {
        el.innerHTML = 'Faqja u përditësua! <a href="./">Shiko faqen</a>';
        el.parentNode.classList.add('gati');
      } else if (run.conclusion === 'cancelled') {
        el.textContent = 'U bashkua me postimin tënd të radhës.';
      } else {
        el.innerHTML = `Publikimi s'u krye. <a href="https://github.com/${esc(cfg.owner)}/${esc(cfg.repo)}/actions" target="_blank" rel="noopener">Shiko te GitHub</a>`;
      }
      return;
    }
  }

  /* ---------- Postimet ---------- */

  function faqjaPostimeve() {
    let h = '';
    LENDET.forEach((l, i) => {
      const nr = l.postime.reduce((s, p) => s + p.foto, 0);
      h += `<details class="m-karte m-lista"><summary>${ikona(l, i, 'e-vogel')}<span class="l-tekst"><span class="l-emri">${esc(l.emri)}</span>` +
        `<span class="l-meta">${l.postime.length} postime · ${nr} foto</span></span></summary><div class="m-postimet">`;
      if (!l.postime.length) h += '<p class="m-shenim">Ende pa postime.</p>';
      l.postime.forEach((p, pi) => {
        h += `<div class="m-postim"><div class="l-tekst"><b>${esc(emriPostimit(p.dosja))}</b><small>${p.foto} foto</small></div>` +
          (p.dosja ? `<button type="button" class="m-cip" data-shto="${i}:${pi}">+ Foto</button>` : '') +
          `<button type="button" class="m-cip rrezik" data-fshi="${i}:${pi}">Fshi</button></div>`;
      });
      h += `<button type="button" class="m-lidhje rrezik m-fshi-lende" data-fshi-lende="${i}">Fshi lëndën ${esc(l.emri)}</button></div></details>`;
    });
    h += `<section class="m-karte"><h2 class="m-hapi">Shto lëndë të re</h2>
      <div class="m-rresht"><input id="l-emri" class="m-fushe" placeholder="p.sh. Italisht" maxlength="40">
      <button type="button" id="l-shto" class="m-buton">Shto</button></div></section>`;
    m.innerHTML = h;
    zbulo(m, '.m-lista');

    m.querySelectorAll('[data-shto]').forEach(b => b.onclick = () => {
      const [i, pi] = b.dataset.shto.split(':').map(Number);
      forma = formaEre(LENDET[i].dosja);
      forma.dosja = LENDET[i].postime[pi].dosja;
      hapSkeden('posto');
    });
    m.querySelectorAll('[data-fshi]').forEach(b => b.onclick = () => {
      const [i, pi] = b.dataset.fshi.split(':').map(Number);
      const l = LENDET[i], p = l.postime[pi];
      if (!confirm(`Ta fshij „${emriPostimit(p.dosja)}“ te ${l.emri} (${p.foto} foto)?`)) return;
      const ndryshimet = p.te.map(path => ({ path, fshi: true }));
      // Mos e humb dosjen e lëndës kur fshihet postimi i fundit.
      if (l.te.length === p.te.length) ndryshimet.push({ path: `detyra/${l.dosja}/.gitkeep`, content: '' });
      ruajNdryshimin(`Fshi: ${l.emri} ${p.dosja}`, ndryshimet, 'Postimi u fshi.');
    });
    m.querySelectorAll('[data-fshi-lende]').forEach(b => b.onclick = () => {
      const l = LENDET[+b.dataset.fshiLende];
      if (!confirm(`Ta fshij krejt lëndën „${l.emri}“ me të gjitha fotot? Kjo s'kthehet mbrapsht.`)) return;
      ruajNdryshimin(`Fshi lëndën ${l.emri}`, l.te.map(path => ({ path, fshi: true })), 'Lënda u fshi.');
    });
    document.getElementById('l-shto').onclick = () => {
      const emri = pastro(document.getElementById('l-emri').value);
      if (!emri) return njofto('Shkruaj emrin e lëndës.');
      if (LENDET.some(l => l.id === slug(emri))) return njofto('Kjo lëndë ekziston.');
      ruajNdryshimin(`Lëndë e re: ${emri}`, [{ path: `detyra/${emri}/.gitkeep`, content: '' }], `U shtua ${emri}.`);
    };
  }

  async function ruajNdryshimin(mesazhi, ndryshimet, sukses) {
    if (duke_punuar) return;
    fillo(true);
    njofto('Po ruhet…');
    try {
      await bejCommit(mesazhi, ndryshimet);
      await ngarkoTeDhenat();
      njofto(sukses + ' Faqja përditësohet për 1–2 minuta.');
    } catch (e) {
      njofto(mesazhiGabimit(e));
    }
    fillo(false);
    hapSkeden(skeda);
  }

  /* ---------- Orari ---------- */

  function faqjaOrarit() {
    const opsionet = [...new Set(LENDET.map(l => l.emri).concat(PA_DETYRA))];
    let h = '<section class="m-karte"><p class="m-shenim">Rendit lëndët siç i ke gjatë ditës. Nga orari faqja llogarit vetë afatet e detyrave.</p>';
    ORARI.forEach((o, oi) => {
      h += `<div class="m-dita"><h3>${kapitalizo(DITET[o.dita])}</h3><div class="m-rresht">` +
        o.lendet.map((x, xi) => `<span class="m-cip zgjedhur">${esc(x)}<button type="button" data-hiq-or="${oi}:${xi}" aria-label="Hiqe">&times;</button></span>`).join('') +
        `<select class="m-shto-or" data-shto-or="${oi}"><option value="">+ Shto</option>` +
        opsionet.map(x => `<option>${esc(x)}</option>`).join('') + '</select></div></div>';
    });
    h += '<button type="button" id="o-ruaj" class="m-buton kryesor">Ruaj orarin</button></section>';
    m.innerHTML = h;

    m.querySelectorAll('[data-hiq-or]').forEach(b => b.onclick = () => {
      const [oi, xi] = b.dataset.hiqOr.split(':').map(Number);
      ORARI[oi].lendet.splice(xi, 1);
      faqjaOrarit();
    });
    m.querySelectorAll('[data-shto-or]').forEach(s => s.onchange = () => {
      if (s.value) ORARI[+s.dataset.shtoOr].lendet.push(s.value);
      faqjaOrarit();
    });
    document.getElementById('o-ruaj').onclick = () =>
      ruajNdryshimin('Ndrysho orarin', [{ path: 'orari.txt', content: shkruajOrarin() }], 'Orari u ruajt.');
  }

  /* ---------- Cilësimet ---------- */

  function faqjaCilesimeve() {
    m.innerHTML = `<section class="m-karte">
      <h2 class="m-hapi">Ndrysho përdoruesin ose fjalëkalimin</h2>
      <label class="m-etiketa">Përdoruesi i ri
        <input id="c-emri" class="m-fushe" autocomplete="username" autocapitalize="off" spellcheck="false"></label>
      <label class="m-etiketa">Fjalëkalimi i ri
        <input id="c-fj1" class="m-fushe" type="password" autocomplete="new-password"></label>
      <label class="m-etiketa">Përsërite fjalëkalimin
        <input id="c-fj2" class="m-fushe" type="password" autocomplete="new-password"></label>
      <button type="button" id="c-ruaj" class="m-buton">Ruaj hyrjen e re</button>

      <h2 class="m-hapi">Çelësi i GitHub</h2>
      <p class="m-shenim">Kur t'i kalojë afati çelësit, bëj një të ri. Po ndërrove çelësin, dalin të gjithë nga të gjitha pajisjet.</p>
      <button type="button" id="c-celes" class="m-buton">Vendos çelës të ri</button>

      <h2 class="m-hapi">Dalja</h2>
      <div class="m-rresht">
        <a class="m-cip" href="./">Shiko faqen</a>
        <button type="button" id="c-dil" class="m-buton rrezik">Dil</button>
      </div>
    </section>`;

    document.getElementById('c-ruaj').onclick = async () => {
      const v = id => document.getElementById(id).value;
      if (!v('c-emri') || !v('c-fj1')) return njofto('Plotëso përdoruesin dhe fjalëkalimin.');
      if (v('c-fj1') !== v('c-fj2')) return njofto('Fjalëkalimet nuk janë njësoj.');
      if (duke_punuar) return;
      fillo(true);
      njofto('Po ruhet…');
      try {
        await ruajHyrjen(v('c-emri'), v('c-fj1'));
        njofto('U ruajt! Në pajisjet e tjera vlen pas 1–2 minutash.');
        faqjaCilesimeve();
      } catch (e) {
        njofto(mesazhiGabimit(e));
      }
      fillo(false);
    };
    document.getElementById('c-celes').onclick = () => faqjaKonfigurimit(true);
    document.getElementById('c-dil').onclick = () => dil('Dole nga Menaxho.');
  }

  /* ---------- Nisja ---------- */

  async function nis() {
    try {
      const r = await fetch('hyrja.json', { cache: 'no-cache' });
      HYRJA = r.ok ? await r.json() : null;
      if (HYRJA && !(HYRJA.e && HYRJA.kripa && HYRJA.iv)) HYRJA = null;
    } catch (e) {
      m.innerHTML = '<section class="m-karte"><p class="m-gabim">S\'ka internet. Rifresko faqen kur të lidhesh.</p></section>';
      return;
    }
    if (!HYRJA) return faqjaKonfigurimit(false);

    const token = lexoToken();
    if (!token) return faqjaHyrjes();
    Object.assign(cfg, { token, owner: HYRJA.owner, repo: HYRJA.repo });
    try {
      await ngarkoTeDhenat();
      nisPanelin();
    } catch (e) {
      if (e.status === 401) dil(mesazhiGabimit(e));
      else faqjaHyrjes(mesazhiGabimit(e));
    }
  }

  nis();
})();
