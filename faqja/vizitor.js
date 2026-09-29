'use strict';
// Regjistron çdo vizitë: IP-në, gjeolokacionin, shfletuesin dhe faqen ku hyn.
// Punon në GitHub Pages (faqe statike, pa server): të dhënat vijnë nga ipwho.is
// dhe dërgohen te webhook-u i Discord-it. Historiku lokal: vizitor-view.html
// Vendose te index.html, pas app.js:  <script src="vizitor.js" defer></script>
(() => {
/* ---------- Rregullimet ---------- */
const WEBHOOK = '';            // NGJITE KËTU URL-në e webhook-ut të Discord
const KYÇI = 'viz-hyrje';      // ruajtja në localStorage
const PRAPI = 60e3;            // s'dyfishon vizitat brenda 60 sekondash
const MAX = 500;               // sa vizita mbahen në kujtesën e pajisjes
const API = 'https://ipwho.is/'; // JSON: ip, country, city, region, latitude, longitude, postal, connection{isp,org,asn}, timezone{id}

/* ---------- Ndihmësit ---------- */
const P = window.PDSH || {};
const MUAJT = P.MUAJT || ['janar','shkurt','mars','prill','maj','qershor','korrik','gusht','shtator','tetor','nëntor','dhjetor'];
const DITET = P.DITET || ['e diel','e hënë','e martë','e mërkurë','e enjte','e premte','e shtunë'];
const lexo = P.lexo || (k => { try { return localStorage.getItem(k); } catch (e) { return null; } });
const ruaj = P.ruaj || ((k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* shfletim privat */ } });
const pajisja = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'iPhone/iPad'
  : /Android/i.test(navigator.userAgent) ? 'Android'
  : /Macintosh/i.test(navigator.userAgent) ? 'Mac'
  : /Windows/i.test(navigator.userAgent) ? 'Windows' : 'Tjetër';

// Safari e mban faqen në kujtesë dhe e hap prapë me butonin "prapa": s'është vizitë e re.
let ngaKujtesa = false;
addEventListener('pageshow', e => { ngaKujtesa = e.persisted; });

/* ---------- Vizita ---------- */
async function regjistro() {
  if (ngaKujtesa) return;
  const tani = Date.now();
  if (tani - (+lexo('viz-cfa') || 0) < PRAPI) return;
  ruaj('viz-cfa', String(tani));

  let geo = {};
  try {
    const c = new AbortController();
    const tm = setTimeout(() => c.abort(), 6000);
    const pergjigja = await fetch(API, { signal: c.signal });
    clearTimeout(tm);
    geo = await pergjigja.json();
  } catch (e) { /* pa internet ose API poshtë: vazhdo pa gjeo */ }

  const d = new Date(), p = n => String(n).padStart(2, '0');
  const vizita = {
    id: Math.random().toString(36).slice(2, 8),
    koha: `${p(d.getHours())}:${p(d.getMinutes())} · ${d.getDate()} ${MUAJT[d.getMonth()]} ${d.getFullYear()}`,
    dita: DITET[d.getDay()],
    ip: geo.ip || '?',
    vendi: geo.country || '?',
    kodi: geo.country_code || '',
    rajoni: geo.region || '',
    qyteti: geo.city || '',
    zip: geo.postal || '',
    gjerësi: geo.latitude ?? '',
    gjatësi: geo.longitude ?? '',
    ofruesi: (geo.connection && geo.connection.isp) || '',
    asn: geo.connection ? 'AS' + geo.connection.asn : '',
    zona: (geo.timezone && geo.timezone.id) || '',
    shfletuesi: navigator.userAgent,
    gjuha: navigator.language || '',
    ekrani: (screen.width || '?') + '×' + (screen.height || '?'),
    pajisja: pajisja(),
    faqja: location.pathname,
    burimi: document.referrer || '—',
  };

  // Historiku lokal — vetëm në kujtesën e KËSAJ pajisjeje.
  try {
    const te = JSON.parse(lexo(KYÇI) || '[]');
    te.unshift(vizita);
    ruaj(KYÇI, JSON.stringify(te.slice(0, MAX)));
  } catch (e) { /* kujtesë e pamundur */ }

  // Dërgesa te Discord-i — e vetmja mënyrë të sheh vizitat e pajisjeve të tjera.
  if (WEBHOOK) {
    const teksti =
`[Vizitë] ${vizita.koha} · ${vizita.pajisja}
IP: ${vizita.ip}${vizita.kodi ? ' (' + vizita.kodi + ')' : ''}
 ${vizita.qyteti}${vizita.rajoni && vizita.qyteti !== vizita.rajoni ? ', ' + vizita.rajoni : ''}${vizita.vendi ? ' · ' + vizita.vendi : ''}
Gjerësi/Gjatësi: ${vizita.gjerësi}, ${vizita.gjatësi}${vizita.zip ? ' · ZIP ' + vizita.zip : ''}
 ${vizita.ofruesi}${vizita.asn ? ' · ' + vizita.asn : ''}${vizita.zona ? ' · ' + vizita.zona : ''}
Ekrani: ${vizita.ekrani} · Gjuha: ${vizita.gjuha}
Faqja: ${vizita.faqja} · Nga: ${vizita.burimi}
#${vizita.id}`;
    const trupi = JSON.stringify({ content: teksti.slice(0, 2000) });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(WEBHOOK, new Blob([trupi], { type: 'application/json' }));
    } else {
      fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: trupi, keepalive: true }).catch(() => {});
    }
  }
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', regjistro);
else regjistro();
})();
