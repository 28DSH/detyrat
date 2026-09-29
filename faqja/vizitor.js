'use strict';
// Vizitor.js v3 — modele të sakta telefonesh, orë e vërtetë, bateri, debug UA.
// Pa server (GitHub Pages = statike): gjeo nga ipwho.is, rezervë ipapi.co.
// Vendoset te faqja/index.html, para </body>:  <script src="vizitor.js" defer></script>
(() => {

/* ---------- Rregullimet ---------- */
const WEBHOOK = 'https://discord.com/api/webhooks/1554538960187822241/SpH0Y1edu12zbjASnUOa8OCqsmSQeXR0KGXHH4geMZzTjiA1DyVUgAyCFN7IpgFilZxc';             // NGJITE KËTU URL-në e webhook-ut të Discord-it
const KYÇI  = 'viz-hyrje';
const PRAPI = 60e3;
const MAX   = 500;

/* ---------- Ndihmësit ---------- */
const P = window.PDSH || {};
const MUAJT = P.MUAJT || ['janar','shkurt','mars','prill','maj','qershor','korrik','gusht','shtator','tetor','nëntor','dhjetor'];
const DITET = P.DITET || ['e diel','e hënë','e martë','e mërkurë','e enjte','e premte','e shtunë'];
const lexo = P.lexo || (k => { try { return localStorage.getItem(k); } catch (e) { return null; } });
const ruaj = P.ruaj || ((k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* shfletim privat */ } });
const log = (...a) => console.log('%c[vizitor]', 'color:#d07a12;font-weight:600', ...a);
const bashko = (...x) => x.filter(v => v !== '' && v != null).join(' · ');

let ngaCache = false;
addEventListener('pageshow', e => { ngaCache = e.persisted; });

/* ---------- IPv6 i shkurtuar: 2a02:0:0:0:0:0:0:4f2 → 2a02::4f2 ---------- */
function ipShkurt(ip) {
  try {
    if (!ip || !ip.includes(':')) return ip || '?';
    const v4 = ip.match(/(\d+\.\d+\.\d+\.\d+)$/);
    const trupi = v4 ? ip.slice(0, ip.lastIndexOf(':')) : ip;
    const pj = trupi.split('::');
    let koka = pj[0] ? pj[0].split(':').filter(Boolean) : [];
    let biza = pj.length > 1 ? (pj[1] ? pj[1].split(':').filter(Boolean) : []) : [];
    if (pj.length > 1) {
      const mungojnë = 8 - koka.length - biza.length - (v4 ? 1 : 0);
      koka = koka.concat(Array(Math.max(mungojnë, 0)).fill('0'));
    }
    const gr = koka.concat(biza);
    if (gr.length !== 8 - (v4 ? 1 : 0)) return ip;
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

/* ---------- iPhone: [ekran@dpi] → [emër, iOS-min, iOS-max] ----------
   Shfletuesi s'e thotë modelin, por i thotë ekranin, dpi-në dhe versionin e iOS.
   Versioni i iOS eleminon të pamundurat: iPhone X s'ngjitet dot në iOS 26. */
const IPHONE = {
  '320x568@2':  [['iPhone SE / 6s', 9, 15]],
  '375x667@2':  [['iPhone SE 3', 15, 26], ['iPhone SE 2', 13, 26], ['iPhone 8', 11, 16], ['iPhone 7', 10, 15], ['iPhone 6', 8, 12]],
  '414x736@3':  [['iPhone 8 Plus', 11, 16], ['iPhone 7 / 6s Plus', 8, 15]],
  '375x812@3':  [['iPhone 13 mini', 15, 26], ['iPhone 12 mini', 14, 26], ['iPhone 11 Pro', 13, 26], ['iPhone XS', 12, 18], ['iPhone X', 11, 16]],
  '390x844@3':  [['iPhone 14', 16, 26], ['iPhone 13', 15, 26], ['iPhone 12', 14, 26]],
  '393x852@3':  [['iPhone 17', 26, 26], ['iPhone 16', 18, 26], ['iPhone 15', 17, 26], ['iPhone 14 Pro', 16, 26]],
  '402x874@3':  [['iPhone 17 Pro', 26, 26], ['iPhone 17', 26, 26], ['iPhone 16 Pro', 18, 26]],
  '414x896@2':  [['iPhone 11', 13, 26], ['iPhone XR', 12, 18]],
  '414x896@3':  [['iPhone 11 Pro Max', 13, 26], ['iPhone XS Max', 12, 18]],
  '428x926@3':  [['iPhone 14 Plus', 16, 26], ['iPhone 13 Pro Max', 15, 26], ['iPhone 12 Pro Max', 14, 26]],
  '430x932@3':  [['iPhone 17 Plus', 26, 26], ['iPhone 16 Pro Max', 18, 26], ['iPhone 16 Plus', 18, 26], ['iPhone 15 Pro Max', 17, 26], ['iPhone 15 Plus', 17, 26], ['iPhone 14 Pro Max', 16, 26]],
  '440x956@3':  [['iPhone 17 Pro Max', 26, 26], ['iPhone 16 Pro Max', 18, 26]],
  '420x912@3':  [['iPhone Air', 26, 26]]
};
const IPAD = {
  '768x1024': 'iPad 9.7"', '744x1133': 'iPad mini 6', '748x1138': 'iPad mini 7',
  '834x1112': 'iPad Pro 10.5 / Air 3', '834x1194': 'iPad Pro 11 / Air 4+',
  '820x1180': 'iPad Air 10.9"', '1024x1366': 'iPad Pro 12.9"'
};

function emriIPhone(ua, ekr, dpr) {
  const vm = ua.match(/OS (\d+)_/);
  const ios = vm ? +vm[1] : null;
  const kand = (IPHONE[ekr + '@' + dpr] || []).filter(m => ios == null || (ios >= m[1] && ios <= m[2]));
  const baza = kand.length ? kand.slice(0, 3).map(m => m[0]).join(' / ') : 'iPhone';
  return baza + (ios ? ' · iOS ' + ios : '');
}

/* ---------- Android: marka lexohet drejt e nga UA (Redmi para Pixel!) ---------- */
function emriAndroid(ua) {
  const av = (ua.match(/Android ([\d.]+)/) || [])[1] || '';
  const m = (ua.match(/Android [\d.]+;\s*([^;)]+?)(?:\s+Build|\))/) || [])[1] || '';
  const f = (m || '').trim().replace(/_/g, ' ');
  const prapashtesa = av ? ' · Android ' + av : '';

  // Fusha e pajisjes e mban vetë emrin: "Redmi Note 12", "Pixel 7a", "SM-A546B"...
  if (f && /Redmi|POCO|Xiaomi|Pixel|vivo|OPPO|OnePlus|realme|HUAWEI|HONOR|Infinix|TECNO|Nokia|moto|SM-/i.test(f)) {
    return f + prapashtesa;
  }
  // Fusha s'e ka markën (kod si 22081212C, ose "K" nga Chrome): kërko në gjithë UA-në.
  const kërkimet = [
    [/Redmi\s+(?:Note\s+)?([A-Za-z0-9]+)/i, 'Redmi '],
    [/POCO\s+([A-Za-z0-9]+)/i, 'POCO '],
    [/Pixel\s+([0-9][a-zA-Z]*(?:\s?Pro)*(?:\s?XL)?)/i, 'Google Pixel '],
    [/(SM-[A-Za-z0-9]+)/, 'Samsung '],
    [/OnePlus\s+([A-Za-z0-9]+)/i, 'OnePlus '],
    [/realme\s+([A-Za-z0-9]+)/i, 'realme '],
    [/vivo\s+([0-9]{3,}[a-zA-Z]?)/i, 'vivo '],
    [/OPPO\s+([A-Za-z0-9]+)/i, 'OPPO '],
    [/HUAWEI\s+([A-Za-z0-9-]+)/i, 'HUAWEI '],
    [/HONOR\s+([A-Za-z0-9]+)/i, 'HONOR '],
    [/Infinix\s+([A-Za-z0-9]+)/i, 'Infinix '],
    [/TECNO\s+([A-Za-z0-9]+)/i, 'TECNO '],
    [/Nokia\s+([A-Za-z0-9]+)/i, 'Nokia '],
    [/moto\s+([a-z0-9-]+)/i, 'Motorola '],
    [/Xiaomi\s+([A-Za-z0-9]+)/i, 'Xiaomi ']
  ];
  for (const [re, prefix] of kërkimet) {
    const g = ua.match(re);
    if (g) return prefix + (g[1] || '').trim() + prapashtesa;
  }
  if (f && !/^(k|wv)$/i.test(f)) return (/^\d{7,}[a-z]?$/i.test(f) ? 'Android (kod ' + f + ')' : f) + prapashtesa;
  return (av ? 'Android ' + av : 'Android') + ' (model i fshehur)';
}

function infoPajisjes() {
  const ua = navigator.userAgent || '';
  const dpr = Math.round(window.devicePixelRatio || 1);
  const sw = Math.min(screen.width, screen.height);   // portret gjithmonë, edhe në landscape
  const sh = Math.max(screen.width, screen.height);
  const ekr = sw + 'x' + sh;
  let emri = 'Pajisje e panjohur', lloji = 'tjetër', ngjyra = 0x8a9096;

  if (/iPhone|iPod/.test(ua)) {
    lloji = 'telefon'; ngjyra = 0x2465a8;
    emri = emriIPhone(ua, ekr, dpr);
  } else if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1)) {
    lloji = 'tablet'; ngjyra = 0x7d4a9e;
    const vm = ua.match(/OS (\d+)_/);
    emri = (IPAD[ekr] || 'iPad') + (vm ? ' · iPadOS ' + vm[1] : '');
  } else if (/Android/.test(ua)) {
    lloji = 'telefon'; ngjyra = 0x2f8a57;
    emri = emriAndroid(ua);
  } else {
    lloji = 'kompjuter';
    if (/Windows NT 10/.test(ua)) { emri = 'Windows 10/11'; ngjyra = 0x16305c; }
    else if (/Windows NT 6\.3/.test(ua)) emri = 'Windows 8.1';
    else if (/Windows NT 6\.1/.test(ua)) emri = 'Windows 7';
    else if (/Mac OS X/.test(ua)) { emri = 'Mac · macOS'; ngjyra = 0x16305c; }
    else if (/Linux/.test(ua)) emri = 'Linux';
  }
  return { emri, lloji, ngjyra, dpr: window.devicePixelRatio || 1, ekr };
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

/* ---------- Gjeolokacioni ---------- */
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
  } catch (e) { log("ipwho.is s'përgjigj — provoj rezervën"); }
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
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return "iOS s'e tregon dot";
  try {
    const b = await navigator.getBattery();
    return Math.round(b.level * 100) + '%' + (b.charging ? ' (ngarkim)' : '');
  } catch (e) { return ''; }
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
    if (r.status === 429 && prove < 3) {
      const p = (await r.json().catch(() => ({}))).retry_after || 1;
      log('429 (ngarkesë) — prit ' + p + 's dhe prova ' + (prove + 1));
      return new Promise(a => setTimeout(() => a(dergjo(trupi, prove + 1)), p * 1000 + 250));
    }
    log('gabim dërgese:', r.status, await r.text().catch(() => ''));
  } catch (e) {
    if (prove < 3) { log('rrjeti — prova ' + (prove + 1)); return new Promise(a => setTimeout(() => a(dergjo(trupi, prove + 1)), 1500)); }
    log("s'dërgohet dot");
  }
  return false;
}

/* ---------- Regjistrimi ---------- */
async function regjistro() {
  if (ngaCache) return;
  const faqja = location.pathname;
  const tani = Date.now();
  if (tani - (+lexo('viz-cfa:' + faqja) || 0) < PRAPI) { log("e njëjta faqe <60s — s'dyfishoj"); return; }
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

  // Ora e vërtetë: ora e pajisjes vetë, në zonën e saj kohore — jo zona e IP-së.
  let zonaPajisjes = '';
  try { zonaPajisjes = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  const oraNe = z => {
    try { return new Intl.DateTimeFormat('sq-AL', { timeZone: z, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); }
    catch (e) { return ''; }
  };
  const ora = oraNe(zonaPajisjes) || p(d.getHours()) + ':' + p(d.getMinutes());
  const oraIp = g.zona ? oraNe(g.zona) : '';
  const zonaDyshim = !!(g.zona && zonaPajisjes && g.zona !== zonaPajisjes);

  const aplikacion = (matchMedia('(display-mode: standalone)').matches || navigator.standalone)
    ? 'aplikacion (ekran kryesor)' : 'shfletues';
  const errësi = matchMedia('(prefers-color-scheme: dark)').matches ? 'ekran i errët' : 'ekran i ndritshëm';
  const prekja = (navigator.maxTouchPoints || 0) > 0 ? 'me prekje' : 'maus/tastierë';
  const rrjeti = bashko(conn.effectiveType, conn.downlink ? conn.downlink + ' Mb/s' : '');
  const hardueri = bashko(
    navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' bërthama' : '',
    navigator.deviceMemory ? navigator.deviceMemory + ' GB RAM' : '');
  const pozicioni = g.gjerësi !== '' && g.gjerësi != null
    ? '[' + g.gjerësi + ', ' + g.gjatësi + ' · hap në Harta](https://www.google.com/maps?q=' + g.gjerësi + ',' + g.gjatësi + ')'
       + (g.zip ? ' · ZIP ' + g.zip : '')
    : '';

  const vizita = {
    koha: ora + ' · ' + d.getDate() + ' ' + MUAJT[d.getMonth()] + ' ' + d.getFullYear(),
    dita: DITET[d.getDay()], ip: ipTxt, llojiIp, vendi: g.vendi || '?', kodi: g.kodi,
    rajoni: g.rajoni, qyteti: g.qyteti, zip: g.zip, gjerësi: g.gjerësi, gjatësi: g.gjatësi,
    ofruesi: g.ofruesi, asn: g.asn, zona: zonaPajisjes, zonaIp: g.zona,
    pajisja: v.emri, shfletuesi: sh, gjuha: navigator.language || '',
    ekrani: v.ekr + ' @' + v.dpr + 'x', hardueri, rrjeti, bateria: bat,
    errësi, prekja, aplikacion, faqja, burimi: document.referrer || '—', id
  };

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
      f('Ora e pajisjes', bashko('ora ' + ora, zonaPajisjes) || '—'),
      zonaDyshim ? f('Zona e IP', g.zona + ' · ora ' + (oraIp || '?') + ' — ndryshon nga pajisja (VPN?)', false) : null,
      f('Bateria', bat),
      f('Ekrani', v.ekr + ' @' + v.dpr + 'x (realisht ' + Math.round(screen.width * v.dpr) + '×' + Math.round(screen.height * v.dpr) + ')'),
      f('Sistemi', bashko(vizita.gjuha, errësi, prekja, aplikacion)),
      f('Hardueri', hardueri || '—'),
      f('Rrjeti', rrjeti || '—'),
      f('Faqja', '`' + faqja + '` ← ' + (document.referrer || 'drejtpërdrejt'), false),
      f('Identifikimi (UA)', '`' + (navigator.userAgent || '').slice(0, 400) + '`', false)
    ].filter(Boolean)
  };
  dergjo(JSON.stringify({ embeds: [embed] }));
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', regjistro);
else regjistro();
})();
