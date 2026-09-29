'use strict';
// Vizitor.js v2 — regjistron çdo vizitë te Discord si embed i veçuar.
// Pa server (GitHub Pages = faqe statike): gjeo nga ipwho.is, rezervë ipapi.co.
// Historiku lokal i pajisjes: vizitor-view.html
// Vendoset te faqja/index.html, para </body>:  <script src="vizitor.js" defer></script>
(() => {

/* ---------- Rregullimet ---------- */
const WEBHOOK = 'https://discord.com/api/webhooks/1554538960187822241/SpH0Y1edu12zbjASnUOa8OCqsmSQeXR0KGXHH4geMZzTjiA1DyVUgAyCFN7IpgFilZxc';             // NGJITE KËTU URL-në e webhook-ut të Discord-it
const KYÇI  = 'viz-hyrje';      // historiku lokal (maks. MAX vizita)
const PRAPI = 60e3;             // s'dyfishon të njëjtën faqe brenda 60 sekondash
const MAX   = 500;

/* ---------- Ndihmësit ---------- */
const P = window.PDSH || {};
const MUAJT = P.MUAJT || ['janar','shkurt','mars','prill','maj','qershor','korrik','gusht','shtator','tetor','nëntor','dhjetor'];
const DITET = P.DITET || ['e diel','e hënë','e martë','e mërkurë','e enjte','e premte','e shtunë'];
const lexo = P.lexo || (k => { try { return localStorage.getItem(k); } catch (e) { return null; } });
const ruaj = P.ruaj || ((k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* shfletim privat */ } });
const log = (...a) => console.log('%c[vizitor]', 'color:#d07a12;font-weight:600', ...a);
const bashko = (...x) => x.filter(v => v !== '' && v != null).join(' · ');

// Safari iOS e hap faqen nga cache me "prapa": s'është vizitë e re.
let ngaCache = false;
addEventListener('pageshow', e => { ngaCache = e.persisted; });

/* ---------- IPv6 i shkurtuar: 2a02:0:0:0:0:0:0:4f2 → 2a02::4f2 ---------- */
function ipShkurt(ip) {
  try {
    if (!ip || !ip.includes(':')) return ip || '?';
    const v4 = ip.match(/(\d+\.\d+\.\d+\.\d+)$/);            // ::ffff:1.2.3.4
    const trupi = v4 ? ip.slice(0, ip.lastIndexOf(':')) : ip;
    const pj = trupi.split('::');
    let koka = pj[0] ? pj[0].split(':').filter(Boolean) : [];
    let biza = pj.length > 1 ? (pj[1] ? pj[1].split(':').filter(Boolean) : []) : [];
    if (pj.length > 1) {
      const mungojnë = 8 - koka.length - biza.length - (v4 ? 1 : 0);
      koka = koka.concat(Array(Math.max(mungojnë, 0)).fill('0'));
    }
    const gr = koka.concat(biza);
    if (gr.length !== 8 - (v4 ? 1 : 0)) return ip;             // format i panjohur: lëre ashtu
    let mëi = -1, mL = 0, cur = -1, cL = 0;
    gr.forEach((g, i) => {
      if (parseInt(g, 16) === 0) { if (cur < 0) cur = i; if (++cL > mL) { mL = cL; mëi = cur; } }
      else { cur = -1; cL = 0; }
    });
    let out = mL >= 2
      ? gr.slice(0, mëi).join(':') + '::' + gr.slice(mëi + mL).join(':')
      : gr.join(':');
    if (v4) out += (out.endsWith(':') ? '' : ':') + v4[1];
    return out;
  } catch (e) { return ip; }
}

/* ---------- Pajisja: emri, lloji, ngjyra ---------- */
const EKRANE_IPHONE = {
  '320x568': 'iPhone SE', '375x667': 'iPhone 6/7/8', '414x736': 'iPhone 6/7/8 Plus',
  '375x812': 'iPhone X/XS/11 Pro', '390x844': 'iPhone 12/13/14', '393x852': 'iPhone 14 Pro/15',
  '428x926': 'iPhone 12/13 Pro Max', '430x932': 'iPhone 14 Plus/Pro Max', '402x874': 'iPhone 16 Pro', '440x956': 'iPhone 16 Pro Max'
};
const EKRANE_IPAD = {
  '768x1024': 'iPad/Mini', '834x1194': 'iPad Pro/Air 11"', '820x1180': 'iPad Air 10"', '1024x1366': 'iPad Pro 12.9"'
};

function infoPajisjes() {
  const ua = navigator.userAgent || '';
  const dpr = window.devicePixelRatio || 1;
  const ekr = screen.width + 'x' + screen.height;
  let emri = 'Pajisje e panjohur', lloji = 'tjetër', ngjyra = 0x8a9096;

  if (/iPhone|iPod/.test(ua)) {
    lloji = 'telefon'; ngjyra = 0x2465a8;
    const ios = ua.match(/OS (\d+)/);
    emri = (EKRANE_IPHONE[ekr] || 'iPhone') + (ios ? ' · iOS ' + ios[1] : '');
  } else if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)) {
    lloji = 'tablet'; ngjyra = 0x7d4a9e;
    const ios = ua.match(/OS (\d+)/);
    emri = (EKRANE_IPAD[ekr] || 'iPad') + (ios ? ' · iPadOS ' + ios[1] : '');
  } else if (/Android/.test(ua)) {
    lloji = 'telefon'; ngjyra = 0x2f8a57;
    const m = ua.match(/Android [\d.]+;\s*([^;)]+?)(?:\s+Build|\))/);
    let model = m ? m[1].trim() : '';
    if (!model || /^(k|wv)$/i.test(model)) model = 'Android';
    const av = ua.match(/Android ([\d.]+)/);
    const marka = /SM-|SAMSUNG/i.test(ua) ? 'Samsung ' : /Pixel/i.test(ua) ? 'Google Pixel ' : '';
    emri = marka + model + (av ? ' · Android ' + av[1] : '');
  } else {
    lloji = 'kompjuter';
    if (/Windows NT 10/.test(ua)) { emri = 'Windows 10/11'; ngjyra = 0x16305c; }
    else if (/Windows NT 6\.3/.test(ua)) { emri = 'Windows 8.1'; }
    else if (/Windows NT 6\.1/.test(ua)) { emri = 'Windows 7'; }
    else if (/Mac OS X/.test(ua)) { emri = 'Mac · macOS'; ngjyra = 0x16305c; }
    else if (/Linux/.test(ua)) { emri = 'Linux'; }
  }
  return { emri, lloji, ngjyra, dpr, ekr };
}

function infoShfletuesit() {
  const ua = navigator.userAgent || '';
  const m = ua.match(/(Edg|OPR|CriOS|FxiOS|Firefox|Chrome)\/(\d+)/);
  if (m) {
    const emrat = { Edg: 'Edge', OPR: 'Opera', CriOS: 'Chrome', FxiOS: 'Firefox' };
    return (emrat[m[1]] || (m[1] === 'Firefox' ? 'Firefox' : 'Chrome')) + ' ' + m[2];
  }
  const s = ua.match(/Version\/(\d+).*Safari/);
  return s ? 'Safari ' + s[1] : 'Shfletues tjetër';
}

/* ---------- Gjeolokacioni: ipwho.is, rezervë ipapi.co ---------- */
async function gjeo() {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 6000);
    const r = await fetch('https://ipwho.is/', { signal: c.signal });
    clearTimeout(t);
    const g = await r.json();
    if (g && g.success !== false && g.ip) {
      log('gjeo: nga ipwho.is —', g.ip, g.city || '');
      return { ip: g.ip, vendi: g.country || '', kodi: g.country_code || '', rajoni: g.region || '',
               qyteti: g.city || '', zip: g.postal || '', gjerësi: g.latitude, gjatësi: g.longitude,
               ofruesi: (g.connection && (g.connection.isp || g.connection.org)) || '',
               asn: g.connection && g.connection.asn ? 'AS' + g.connection.asn : '',
               zona: (g.timezone && g.timezone.id) || '' };
    }
  } catch (e) { log('ipwho.is s'përgjigj — provoj rezervën'); }
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 6000);
    const r = await fetch('https://ipapi.co/json/', { signal: c.signal });
    clearTimeout(t);
    const g = await r.json();
    if (g && g.ip) {
      log('gjeo: nga ipapi.co —', g.ip, g.city || '');
      return { ip: g.ip, vendi: g.country_name || '', kodi: g.country_code || '', rajoni: g.region || '',
               qyteti: g.city || '', zip: g.postal || '', gjerësi: g.latitude, gjatësi: g.longitude,
               ofruesi: g.org || '', asn: g.asn || '', zona: g.timezone || '' };
    }
  } catch (e) { log('as ipapi.co — vazhdoj pa gjeo'); }
  return { ip: '?', vendi: '', kodi: '', rajoni: '', qyteti: '', zip: '', gjerësi: '', gjatësi: '', ofruesi: '', asn: '', zona: '' };
}

async function bateria() {
  try {
    const b = await navigator.getBattery();
    return Math.round(b.level * 100) + '%' + (b.charging ? ' (ngarkim)' : '');
  } catch (e) { return ''; }   // Safari/iphone s'e ka — thjesht hiqet
}

/* ---------- Dërgesa te Discord me prova ---------- */
async function dergjo(trupi, prove) {
  prove = prove || 0;
  try {
    const r = await fetch(WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: trupi, keepalive: true
    });
    if (r.ok) { log('dërguar te Discord'); return true; }
    if (r.status === 429 && prove < 3) {   // shumë vizita njëherësh: pret e provon prapë
      const p = (await r.json().catch(() => ({}))).retry_after || 1;
      log('429 (ngarkesë) — prit ' + p + 's dhe provoja ' + (prove + 1));
      return new Promise(a => setTimeout(() => a(dergjo(trupi, prove + 1)), p * 1000 + 250));
    }
    log('gabim dërgese:', r.status, await r.text().catch(() => ''));
  } catch (e) {
    if (prove < 3) { log('rrjeti — provoja ' + (prove + 1)); return new Promise(a => setTimeout(() => a(dergjo(trupi, prove + 1)), 1500)); }
    log('s'dërgohet dot');
  }
  return false;
}

/* ---------- Regjistrimi ---------- */
async function regjistro() {
  if (ngaCache) return;
  const faqja = location.pathname;
  const tani = Date.now();
  if (tani - (+lexo('viz-cfa:' + faqja) || 0) < PRAPI) { log('e njëjta faqe <60s — s'dyfishoj'); return; }
  ruaj('viz-cfa:' + faqja, String(tani));

  const g = await gjeo();
  const v = infoPajisjes();
  const sh = infoShfletuesit();
  const bat = await bateria();
  const conn = navigator.connection || {};
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const id = Math.random().toString(36).slice(2, 8);
  const llojiIp = (g.ip || '').includes(':') ? 'IPv6' : 'IPv4';
  const ipTxt = ipShkurt(g.ip);
  const ora = p(d.getHours()) + ':' + p(d.getMinutes());
  const aplikacion = (matchMedia('(display-mode: standalone)').matches || navigator.standalone)
    ? 'aplikacion (ekran kryesor)' : 'shfletues';
  const errësi = matchMedia('(prefers-color-scheme: dark)').matches ? 'ekran i errët' : 'ekran i ndritshëm';
  const prekja = (navigator.maxTouchPoints || 0) > 0 ? 'me prekje' : 'maus/tastierë';
  const rrjeti = bashko(conn.effectiveType, conn.downlink ? conn.downlink + ' Mb/s' : '');
  const hardueri = bashko(
    navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' bërthama' : '',
    navigator.deviceMemory ? navigator.deviceMemory + ' GB RAM' : '',
    bat ? 'bateria ' + bat : '');
  const pozicioni = g.gjerësi !== '' && g.gjerësi != null
    ? '[' + g.gjerësi + ', ' + g.gjatësi + ' · hap në Harta](https://www.google.com/maps?q=' + g.gjerësi + ',' + g.gjatësi + ')'
       + (g.zip ? ' · ZIP ' + g.zip : '')
    : '';

  const vizita = {
    koha: ora + ' · ' + d.getDate() + ' ' + MUAJT[d.getMonth()] + ' ' + d.getFullYear(),
    dita: DITET[d.getDay()], ip: ipTxt, llojiIp, vendi: g.vendi || '?', kodi: g.kodi,
    rajoni: g.rajoni, qyteti: g.qyteti, zip: g.zip, gjerësi: g.gjerësi, gjatësi: g.gjatësi,
    ofruesi: g.ofruesi, asn: g.asn, zona: g.zona, pajisja: v.emri, shfletuesi: sh,
    gjuha: navigator.language || '', ekrani: v.ekr + ' @' + v.dpr + 'x',
    hardueri, rrjeti, bateria: bat, errësi, prekja, aplikacion,
    faqja, burimi: document.referrer || '—', id
  };

  // Historiku lokal — vetëm kujtesa e KËSAJ pajisjeje (vizitor-view.html).
  try {
    const te = JSON.parse(lexo(KYÇI) || '[]');
    te.unshift(vizita);
    ruaj(KYÇI, JSON.stringify(te.slice(0, MAX)));
  } catch (e) { /* shfletim privat */ }

  if (!WEBHOOK) { log('WEBHOOK bosh — hap vizitor.js dhe ngjite URL-në!'); return; }

  const f = (name, value, inline) => value ? { name, value: String(value), inline: inline !== false } : null;
  const embed = {
    title: v.emri + ' · ' + sh,
    color: v.ngjyra,
    timestamp: new Date().toISOString(),
    footer: { text: 'PostimDSH · ' + location.hostname + ' · #' + id },
    description: bashko(g.qyteti, g.rajoni !== g.qyteti ? g.rajoni : '', g.vendi) || 'vend i panjohur',
    fields: [
      f('IP (' + llojiIp + ')', '`' + ipTxt + '`'),
      f('Vendi', (g.vendi || '—') + (g.kodi ? ' (' + g.kodi + ')' : '')),
      f('Qyteti', bashko(g.qyteti, g.rajoni && g.rajoni !== g.qyteti ? g.rajoni : '') || '—'),
      f('Pozicioni', pozicioni, false),
      f('Ofruesi', bashko(g.ofruesi, g.asn) || '—'),
      f('Zona kohore', bashko(g.zona, 'ora ' + ora) || '—'),
      f('Ekrani', v.ekr + ' @' + v.dpr + 'x (realisht ' + Math.round(screen.width * v.dpr) + '×' + Math.round(screen.height * v.dpr) + ')'),
      f('Sistemi', bashko(vizita.gjuha, errësi, prekja, aplikacion)),
      f('Hardueri', hardueri),
      f('Rrjeti', rrjeti),
      f('Faqja', '`' + faqja + '` ← ' + (document.referrer || 'drejtpërdrejt'), false)
    ].filter(Boolean)
  };
  dergjo(JSON.stringify({ embeds: [embed] }));
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', regjistro);
else regjistro();
})();
