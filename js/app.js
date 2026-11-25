/* טיול מסע ארה״ב וקנדה 2027 – static PWA, no build step, no API keys. */
(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const view = $('#view');
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
  };
  let D = null, CR = {}, RT = { days: {} }, maps = [];

  /* ---------- icons ---------- */
  const P = {
    back: '<path d="M9 6l6 6-6 6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    car: '<path d="M5 17h14M6 17l1.5-5h9L18 17M8 12l1-3h6l1 3"/><circle cx="8" cy="18" r="1.4"/><circle cx="16" cy="18" r="1.4"/>',
    plane: '<path d="M2 16l20-6-2-3-7 2-5-5-2 1 3 5-5 1-2-2-1 1z"/>', ship: '<path d="M3 17l2 3h14l2-3M5 17V11h14v6M8 11V7h8v4M12 4v3"/>',
    bus: '<rect x="4" y="4" width="16" height="13" rx="2"/><path d="M4 11h16M7 20v-3M17 20v-3"/>',
    pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    mountain: '<path d="M3 20l6-12 4 7 3-4 5 9z"/>', jacket: '<path d="M8 3l-4 4 3 2v12h10V9l3-2-4-4-2 2h-4z"/>',
    warn: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>', ticket: '<path d="M3 9a2 2 0 0 0 0 4v5h18v-5a2 2 0 0 0 0-4V5H3z"/>',
    bed: '<path d="M3 20V8M3 14h18v6M21 14a3 3 0 0 0-3-3h-8v3"/><circle cx="7" cy="11" r="2"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>', link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M16 13h2M3 10h18"/>', chev: '<path d="M15 6l-6 6 6 6"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 18z"/>', download: '<path d="M12 3v12M8 11l4 4 4-4M4 19h16"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>', doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    hike: '<circle cx="13" cy="4" r="1.6"/><path d="M10 21l2-6 3 3v3M8 12l2-4 4 2 3 2M11 9l-1 5M17 10l2 11"/>', city: '<path d="M4 21V8l6-4v17M10 21V10l10 3v8M3 21h18M7 9v.01M7 13v.01M14 15v.01M17 16v.01"/>', menu: '<path d="M4 7h16M4 12h16M4 17h10"/>'
  };
  const I = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toDate = (iso) => { if (!iso) return null; const [d, t] = iso.split('T'); const [y, m, dd] = d.split('-').map(Number); const [hh, mm] = (t || '00:00').split(':').map(Number); return new Date(y, m - 1, dd, hh, mm); };
  const fmt = (iso, o) => iso ? new Intl.DateTimeFormat('he-IL', o).format(toDate(iso)) : 'טרם נקבע';
  const dm = (iso) => { const d = toDate(iso); return `${d.getDate()}.${d.getMonth() + 1}`; };
  const fDay = (iso) => `${fmt(iso, { weekday: 'short' })} ${dm(iso)}`;
  const fLong = (iso) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' });
  const fFull = (iso) => fmt(iso, { day: 'numeric', month: 'numeric', year: 'numeric' });
  const wd = (iso) => fmt(iso, { weekday: 'narrow' });
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const daysTo = (iso) => Math.round((toDate(iso.split('T')[0]) - today()) / 864e5);
  const nights = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
  const hm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
  const durText = (min) => min < 60 ? `${min} דק׳` : `${Math.floor(min / 60)} ש׳${min % 60 ? ' ' + (min % 60) + ' דק׳' : ''}`;
  const money = (a, c) => a == null ? '<span class="muted">טרם נקבע</span>' : `<span class="num">${esc(new Intl.NumberFormat('he-IL', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(a))}</span>`;
  const STC = { booked: 'p-ok', done: 'p-ok', toclose: 'p-alert', planning: 'p-blue', option: 'p-opt' };
  const pill = (key, label) => `<span class="pill ${STC[key] || 'p-blue'}">${esc(label || D.statuses[key]?.label || key)}</span>`;
  const region = (id) => D.regions.find(r => r.id === id);
  const point = (id) => D.points.find(p => p.id === id);
  const imgs = (pid) => CR[pid] || [];
  const firstImg = (pid) => imgs(pid)[0];
  const regionImg = (r) => firstImg(r.image) || D.points.filter(p => p.region === r.id).map(p => firstImg(p.id)).find(Boolean);
  const dayImg = (d) => d.points.map(point).filter(p => p && !['transport', 'lodging'].includes(p.kind)).map(p => firstImg(p.id)).find(Boolean) || (region(d.region) && regionImg(region(d.region)));
  const bg = (c) => c ? `background-image:url('${esc(c.file)}')` : '';
  const credit = (c, label) => c ? `${label ? esc(label) + ' · ' : ''}<a href="${esc(c.source)}" target="_blank" rel="noopener">${esc(c.author)} / Wikimedia Commons</a> · ${esc(c.license)}` : '';
  const nav = (p) => ({
    google: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`,
    apple: `https://maps.apple.com/?ll=${p.lat},${p.lng}&q=${encodeURIComponent(p.nameEn || p.name)}`,
    photos: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p.nameEn || p.name)}`,
    embed: `https://maps.google.com/maps?q=${p.lat},${p.lng}&z=13&output=embed`
  });
  const gDir = (ids) => { const pts = ids.map(point); const ll = p => `${p.lat},${p.lng}`; const mid = pts.slice(1, -1).slice(0, 8).map(ll).join('|'); return `https://www.google.com/maps/dir/?api=1&origin=${ll(pts[0])}&destination=${ll(pts[pts.length - 1])}${mid ? '&waypoints=' + encodeURIComponent(mid) : ''}&travelmode=driving`; };
  const statusOf = (p) => p.suggestion ? pill('option', 'הצעה') : p.optional ? pill('option', 'אופציה') : '';
  const CAT = {
    airport: { label: 'נמל תעופה', icon: 'plane', color: '#13233d' },
    port: { label: 'קרוז ונמלים', icon: 'ship', color: '#1f8a8a' },
    lodging: { label: 'לינה', icon: 'bed', color: '#b48a4a' },
    trail: { label: 'מסלולי הליכה', icon: 'hike', color: '#2f7a55' },
    viewpoint: { label: 'תצפיות', icon: 'eye', color: '#7b4fb0' },
    attraction: { label: 'אטרקציות', icon: 'star', color: '#2d6cb5' },
    city: { label: 'ערים ועיירות', icon: 'city', color: '#5b6878' }
  };
  const catOf = (p) => p.kind === 'transport' ? (/port|terminal/i.test(p.nameEn || '') && !/airport/i.test(p.nameEn || '') ? 'port' : 'airport')
    : ['port', 'scenic-cruising'].includes(p.kind) ? 'port' : ['lodging', 'lodging-area'].includes(p.kind) ? 'lodging'
    : CAT[p.kind] ? p.kind : 'attraction';
  const catIcon = (p, size = 28) => { const c = CAT[catOf(p)]; return L.divIcon({ className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2],
    html: `<span class="cat-pin ${p.optional ? 'opt' : ''}" style="background:${c.color};width:${size}px;height:${size}px">${I(c.icon)}</span>` }); };
  const attrOf = (p) => D.attractions.filter(a => a.point === p.id);
  const bookingLabel = (b) => ({ required: 'חובה להזמין מראש', recommended: 'מומלץ להזמין מראש', check: 'לבדוק אם צריך להזמין', optional: 'אפשר להזמין מראש', none: 'לא נדרשת הזמנה (לבדוק)' }[b] || '');
  const done = () => LS.get('tg.done', {});
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }
  const EDIT = () => LS.get('tg.editMode', false);
  function saveDraft(msg) { D.meta.updated = new Date().toISOString().slice(0, 10); LS.set('tg.draft', D); if (msg) toast(msg); }
  const LODGE_PTS = ['hampton-yyc', 'forest-park', 'douglas-fir', 'marqueen', 'park-plaza'];

  /* ---------- weather (Open-Meteo, no key) ---------- */
  const WMO = (c) => c == null ? ['', ''] : c === 0 ? ['☀️', 'בהיר'] : c <= 2 ? ['🌤️', 'מעונן חלקית'] : c === 3 ? ['☁️', 'מעונן'] : c <= 48 ? ['🌫️', 'ערפל'] : c <= 57 ? ['🌦️', 'טפטוף'] : c <= 67 ? ['🌧️', 'גשם'] : c <= 77 ? ['🌨️', 'שלג'] : c <= 82 ? ['🌧️', 'ממטרים'] : c <= 86 ? ['🌨️', 'ממטרי שלג'] : ['⛈️', 'סופות רעמים'];
  async function forecast(lat, lng, date) {
    const n = daysTo(date);
    if (n < 0 || n > 15) return { pending: true, from: new Date(toDate(date) - 15 * 864e5) };
    const key = `tg.wx.${lat},${lng},${date}`, c = LS.get(key);
    if (c && Date.now() - c.t < 3 * 36e5) return c.v;
    try {
      const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${date}&end_date=${date}`)).json();
      const v = { code: j.daily.weather_code[0], max: j.daily.temperature_2m_max[0], min: j.daily.temperature_2m_min[0], pop: j.daily.precipitation_probability_max[0] };
      LS.set(key, { t: Date.now(), v }); return v;
    } catch { return c ? { ...c.v, stale: true } : { error: true }; }
  }
  function wx(lat, lng, date) {
    const id = 'wx' + Math.random().toString(36).slice(2);
    queueMicrotask(async () => {
      const el = document.getElementById(id); if (!el) return;
      const w = await forecast(lat, lng, date);
      if (w.pending) {
        el.innerHTML = `תחזית אמיתית תופיע כאן מ־${esc(new Intl.DateTimeFormat('he-IL').format(w.from))}`;
        const c = navigator.onLine || LS.get(`tg.clim.${(+lat).toFixed(1)},${(+lng).toFixed(1)}`) ? await climate(lat, lng, date) : null;
        if (c) el.innerHTML = `ממוצע לתאריך הזה ב־2016–2025: <b class="num">${Math.round(c.min)}°–${Math.round(c.max)}°</b> · גשם ב־${c.rainy}% מהימים<br><span class="tiny">תחזית אמיתית תופיע מ־${esc(new Intl.DateTimeFormat('he-IL').format(w.from))}</span>`;
        return;
      }
      el.innerHTML = w.pending ? ''
        : w.error ? 'אין חיבור. התחזית תתעדכן כשתהיה קליטה.'
        : `${WMO(w.code)[0]} <b class="num">${Math.round(w.min)}°–${Math.round(w.max)}°</b> · ${WMO(w.code)[1]} · משקעים ${w.pop ?? '–'}%${w.stale ? ' (שמור)' : ''}`;
    });
    return `<span class="wx" id="${id}">טוען…</span>`;
  }

  /* ---------- shared blocks ---------- */
  const topnav = (back, title) => `<div class="topnav">${back ? `<a class="round" href="${back}" aria-label="חזרה">${I('back')}</a>` : `<a class="brandmark" href="#/journey">ארה״ב וקנדה 2027</a>`}${title ? `<span class="brandmark">${esc(title)}</span>` : ''}<a class="round" href="#/more" aria-label="עוד">${I('menu')}</a></div>`;
  const pagehead = (kicker, title, back) => `<header class="pagehead">${back ? `<a class="backlink" href="${back}">${I('back')} חזרה</a>` : ''}<div class="kicker">${esc(kicker)}</div><h1>${esc(title)}</h1></header>`;
  function datedItems() {
    const dn = done(), out = [];
    D.tasks.forEach(t => { if (!dn[t.id] && t.status !== 'done' && (t.opens || t.due)) out.push({ id: t.id, title: t.title, date: t.opens || t.due, sub: t.opens ? `נפתח ${dm(t.opens)} · 17:00 שעון ישראל` : `עד ${fFull(t.due)}`, url: t.url }); });
    return out.sort((a, b) => toDate(a.date) - toDate(b.date));
  }
  function dayCard(d) {
    const rt = RT.days[d.date];
    const stops = d.points.map(point).filter(p => p && !['transport', 'lodging'].includes(p.kind));
    return `<a class="daycard ${d.type === 'free' ? 'free' : ''}" href="#/day/${d.date}"><span class="ph" style="${bg(dayImg(d))}"></span><div class="g">
      <div class="d">${esc(fDay(d.date))}</div><b>${esc(d.title)}</b>
      <div class="meta-row">${rt ? `<span>${I('car')}<span class="num">${rt.km} ק״מ</span></span><span>${I('clock')}<span class="num">${hm(rt.min)}</span></span>` : ''}${stops.length ? `<span>${I('pin')}${stops.length} עצירות</span>` : d.type === 'free' ? '<span>יום פתוח</span>' : ''}</div></div></a>`;
  }
  function attrRow(a) {
    const p = point(a.point);
    return `<div class="task ${a.booking === 'required' ? 'hot' : ''}"><div class="g"><div class="t">${esc(a.name)}</div>
      <div class="s"><b>${bookingLabel(a.booking)}</b>${a.opens ? ` · נפתח ${dm(a.opens)}` : ''}${a.date ? ' · ' + esc(fDay(a.date)) : ''}</div>
      ${a.notes ? `<div class="s">${esc(a.notes)}</div>` : ''}
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:4px">${a.url ? `<a class="link" href="${esc(a.url)}" target="_blank" rel="noopener">להזמנה / אתר רשמי ›</a>` : ''}${p ? `<a class="link" href="#/point/${p.id}">${esc(p.name)} ›</a>` : ''}</div></div>
      ${a.opens ? `<div class="dd"><b class="num" style="color:var(--alert)">${daysTo(a.opens)}</b><span>ימים</span></div>` : pill(a.status, a.status === 'option' && p?.suggestion ? 'הצעה' : undefined)}</div>`;
  }

  /* ---------- views ---------- */
  const V = {};

  V.journey = () => {
    const c = firstImg(D.meta.heroImage);
    const [n1, n2] = datedItems();
    const totalNights = nights(D.meta.start, D.meta.end) - 1;
    const km = Object.values(RT.days).reduce((s, d) => s + d.km, 0);
    return `
      <section class="hero" style="${bg(c)}">${topnav()}
        <div class="in"><div class="eyebrow num">${dm(D.meta.start)} — ${fFull(D.meta.end)} · ${totalNights} לילות</div>
          <h1>${esc(D.meta.title)}</h1><p>${esc(D.meta.subtitle)}</p><div class="credit">${credit(c, 'אגם מוריין')}</div></div></section>
      <div class="stats"><div><b class="num">${Math.max(0, daysTo(D.meta.start))}</b><span>ימים לטיסה</span></div><div><b>${D.regions.length}</b><span>אזורים</span></div><div><b class="num">${km ? km.toLocaleString('en-US') : '—'}</b><span>ק״מ ברכב</span></div></div>
      <div class="body">
        <div class="h2"><small>מה עכשיו</small>הצעד הבא</div>
        ${n1 ? `<a class="now" href="#/tasks"><div class="cd"><b class="num">${daysTo(n1.date)}</b><span>ימים</span></div><div><div class="t">${esc(n1.title)}</div><div class="s">${esc(n1.sub)}</div></div><span class="go">למשימה</span></a>` : ''}
        ${n2 ? `<a class="mini" href="#/tasks"><span class="cd2 num">${daysTo(n2.date)}</span><div><div class="t">${esc(n2.title)}</div><div class="s">${esc(n2.sub)}</div></div></a>` : ''}
        <div class="h2"><small>המסלול</small>${D.regions.length} פרקים</div>
        <div class="chapters">${D.regions.map((r, i) => { const n = nights(r.from, r.to); return `<div class="chap"><div class="rail"><span class="dot">${i + 1}</span><span class="ln"></span></div><div class="g">
          <a class="rcard" href="#/region/${r.id}"><span class="ph" style="${bg(regionImg(r))}"></span><div><b>${esc(r.name)}</b><div class="s"><span class="num">${dm(r.from)}–${dm(r.to)}</span> · ${n} ${n === 1 ? 'לילה' : 'לילות'}</div>${r.lodgingStatus === 'booked' ? pill('booked', 'הוזמן') : r.lodgingStatus === 'toclose' ? pill('toclose', 'לינה לסגור') : pill('option', 'לינה באופציה')}</div></a>
          ${r.transfer ? `<div class="transfer">${I(/טיסה/.test(r.transfer) ? 'plane' : /אונייה/.test(r.transfer) ? 'ship' : 'car')}${esc(r.transfer)}</div>` : ''}</div></div>`; }).join('')}</div>
        <p class="est" style="margin-top:14px">ק״מ ברכב לפי OSRM (נתוני OpenStreetMap). זמני הנסיעה הם הערכה.</p>
      </div>`;
  };

  V.region = (id) => {
    const r = region(id); if (!r) return pagehead('', 'האזור לא נמצא', '#/journey');
    const c = regionImg(r), n = nights(r.from, r.to);
    const days = D.days.filter(d => d.region === r.id);
    const km = days.reduce((s, d) => s + (RT.days[d.date]?.km || 0), 0);
    const at = D.attractions.filter(a => a.region === r.id);
    const subs = [...new Set(D.points.filter(p => p.region === r.id).map(p => p.sub).filter(Boolean))];
    return `
      <section class="hero md" style="${bg(c)}">${topnav('#/journey')}
        <div class="in"><div class="eyebrow"><span class="num">${dm(r.from)}–${dm(r.to)}</span> · ${esc(r.tzLabel)}</div><h1>${esc(r.name)}</h1><p>${esc(subs.length ? subs.join(' · ') : r.summary)}</p><div class="credit">${credit(c)}</div></div></section>
      <div class="stats"><div><b>${n}</b><span>${n === 1 ? 'לילה' : 'לילות'}</span></div><div><b>${days.length}</b><span>ימים</span></div><div><b class="num">${km || '—'}</b><span>ק״מ ברכב</span></div></div>
      <div class="body">
        <div class="facts">
          <div class="fact wide"><div class="k">${I('plane')}איך מגיעים</div><div class="v">${esc(r.arrive)}</div></div>
          <div class="fact wide"><div class="k">${I('bed')}לינה ${pill(r.lodgingStatus)}</div><div class="v">${esc(r.lodging)}</div></div>
          <div class="fact wide"><div class="k">${I('jacket')}מה ללבוש (הערכה)</div><div class="v">${esc(r.clothing.summary)}</div><div class="chips" style="margin-top:8px">${r.clothing.bring.map(b => `<span>${esc(b)}</span>`).join('')}</div></div>
        </div>
        <div class="h2"><small>יום אחר יום</small>המסלול באזור</div>
        ${days.map(dayCard).join('')}
        ${at.length ? `<div class="h2"><small>לפני שיוצאים</small>אטרקציות ומה להזמין</div>${at.map(attrRow).join('')}` : ''}
        ${foodBlock(r.id)}
        ${r.beforeYouGo?.length ? `<div class="sect warn" style="margin-top:12px"><h4>${I('warn')}לסגור לפני שיוצאים</h4><ul>${r.beforeYouGo.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      </div>`;
  };

  V.day = (date) => {
    const d = D.days.find(x => x.date === date); if (!d) return pagehead('', 'היום לא נמצא', '#/journey');
    const r = region(d.region) || { name: '', clothing: { summary: '', bring: [] }, id: '' };
    const idx = D.days.indexOf(d), prev = D.days[idx - 1], next = D.days[idx + 1];
    const rt = RT.days[d.date];
    const sights = d.points.map(point).filter(p => p && !['transport', 'lodging'].includes(p.kind));
    const c = dayImg(d);
    const regionDays = D.days.filter(x => x.region === d.region);
    const legTo = (pid) => rt?.legs.find(l => l.to === pid);
    const lodge = D.hotels.find(h => h.id === d.lodging);
    const sugg = d.type === 'free' ? D.points.filter(p => p.region === r.id && p.suggestion) : [];
    const typeLbl = { transit: 'יום מעבר', explore: 'יום טיול', cruise: 'קרוז', free: 'יום פתוח' }[d.type];
    const tl = timeline(d);
    const legChip = (l, first) => l ? `<div class="drive">${first ? '' : '<span class="line"></span>'}<a class="chip ${l.mode}" href="${gDir([l.from, l.to])}" target="_blank" rel="noopener">${I(l.mode === 'shuttle' ? 'bus' : 'car')}${first ? `יוצאים מ${esc(point(l.from).name)} · ` : ''}<b class="num">${l.km} ק״מ</b> · ${durText(l.min)}${l.mode === 'shuttle' ? ' · שאטל' : ''}</a></div>` : '';
    let n = 0;
    const stopHtml = (p) => {
      const g = p.guide, at = attrOf(p), leg = legTo(p.id);
      const how = g?.expect?.parking || (leg ? `${leg.km} ק״מ מ${point(leg.from).name}, כ־${durText(leg.min)} ${leg.mode === 'shuttle' ? 'בשאטל' : 'נסיעה'}.` : null);
      const doList = g ? g.activities.map(a => `<span class="${a.required ? 'must' : ''}">${esc(a.name)}</span>`).join('') : '';
      return `${legChip(leg, leg && leg === rt.legs[0])}
      <article class="stop" style="margin-bottom:12px">
        <a class="img" href="#/point/${p.id}" style="${bg(firstImg(p.id))}"><span class="n">${++n}</span>${p.visit ? `<span class="dur">${I('clock')}${esc(p.visit)}</span>` : ''}${statusOf(p) ? `<span class="badge">${statusOf(p)}</span>` : ''}</a>
        <div class="bd"><h3>${esc(p.name)}</h3><div class="sub">${tl?.at[p.id] ? `<b class="num" style="color:var(--blue)">≈ ${clock(tl.at[p.id])}</b> · ` : ''}${esc([p.sub || r.name, p.nameEn].filter(Boolean).join(' · '))}</div>
          <div class="rows">
            <div class="row"><span class="ic">${I('mountain')}</span><div><span class="k">מה עושים</span>${esc(p.see || p.summary || '')}${doList ? `<div class="chips" style="margin-top:6px">${doList}</div>` : ''}</div></div>
            ${how ? `<div class="row"><span class="ic">${I('pin')}</span><div><span class="k">איך מגיעים</span>${esc(how)}</div></div>` : ''}
            <div class="row"><span class="ic">${I('jacket')}</span><div><span class="k">מה ללבוש</span>${esc(g ? g.clothing[0] : r.clothing.summary.split('.').slice(0, 2).join('.') + '.')}</div></div>
            ${at.length ? `<div class="row"><span class="ic">${I('ticket')}</span><div><span class="k">הזמנה</span>${at.map(a => `${esc(a.name)}: <b>${attrState(a) === 'free' ? bookingLabel(a.booking) : ATTR_LBL[attrState(a)]}</b>${['yes', 'undecided'].includes(attrState(a)) ? ` · ${bookingLabel(a.booking)}` : ''}`).join('<br>')} <a class="link" href="#/more/attractions">שינוי ›</a></div></div>` : ''}
          </div>
          <div class="btns"><a class="btn dark" href="#/point/${p.id}">מדריך מלא</a><a class="btn" href="${nav(p).google}" target="_blank" rel="noopener">${I('pin')}נווט</a></div>
        </div></article>`;
    };
    const backLeg = rt && rt.legs[rt.legs.length - 1];
    const firstNight = !prev || prev.lodging !== d.lodging;
    const prevLodge = prev && prev.lodging !== d.lodging ? D.hotels.find(h => h.id === prev.lodging) : null;
    const checkout = prevLodge && /אאוט/.test(prevLodge.checkTimes || '') ? (prevLodge.checkTimes.split('·').find(s => /אאוט/.test(s)) || '').trim() : '';
    const lastTo = backLeg && point(backLeg.to), arrive = tl && lastTo && lastTo.kind === 'lodging' ? tl.end : null;
    const ciM = firstNight && (lodge?.checkTimes || '').match(/אין[^\d]*(\d{1,2}):(\d{2})/), early = arrive != null && ciM && arrive < +ciM[1] * 60 + +ciM[2];
    const showBack = backLeg && LODGE_PTS.includes(backLeg.to) && !sights.find(p => p.id === backLeg.to);
    const transport = d.points.map(point).filter(p => p && ['transport'].includes(p.kind));
    const anchor = sights[0] || transport[0] || D.points.find(p => p.region === r.id && !['transport', 'lodging'].includes(p.kind));
    return `
      <section class="hero md" style="${bg(c)}">${topnav(r.id ? `#/region/${r.id}` : '#/journey', r.name ? `${r.name} · יום ${regionDays.indexOf(d) + 1} מתוך ${regionDays.length}` : '')}
        <div class="in"><div class="eyebrow">${esc(fLong(d.date))} · ${typeLbl}</div><h1>${esc(d.title)}</h1><div class="credit">${credit(c)}</div></div></section>
      <div class="stats">${rt ? `<div><b class="num">${rt.km}</b><span>ק״מ</span></div><div><b class="num">${hm(rt.min)}</b><span>שעות נהיגה</span></div>` : `<div><b>${typeLbl}</b><span>${esc(r.name || 'הביתה')}</span></div>`}<div><b>${sights.length || '—'}</b><span>עצירות</span></div></div>
      ${regionDays.length > 1 ? `<nav class="daybar" aria-label="ימים באזור">${regionDays.map(x => `<a href="#/day/${x.date}" class="${x.date === d.date ? 'on' : ''}">${esc(wd(x.date))}<b class="num">${toDate(x.date).getDate()}</b></a>`).join('')}</nav>` : ''}
      <div class="body" style="padding-top:14px">
        ${d.summary ? `<p class="lead" style="margin:0 2px 12px">${esc(d.summary)}</p>` : ''}
        ${transport.length && d.type === 'transit' ? `<div class="chips" style="margin-bottom:12px">${transport.map(p => `<span>${I('plane')} ${esc(p.name)}</span>`).join('')}</div>` : ''}
        ${d.notes ? `<div class="notice">${esc(d.notes)}</div>` : ''}
        ${checkout ? `<div class="notice">${I('bed')} ${esc(prevLodge.name)}: ${esc(checkout)}</div>` : ''}
        ${tl ? `<div class="fact" style="margin-bottom:12px"><div class="k">${I('clock')}לוח זמנים משוער</div><div class="v">יציאה <b class="num">${clock(tl.start)}</b>${sights.length ? ` · ${sights.length === 1 ? 'עצירה אחת' : sights.length + ' עצירות'}` : ''} · מגיעים ל${esc(point(rt.legs[rt.legs.length - 1].to).name)} בערך ב־<b class="num">${clock(tl.end)}</b>. השעות ליד כל עצירה מחושבות מזמני הנסיעה והשהייה, ומשתנות בפועל.</div></div>` : ''}
        ${d.driveNote ? `<div class="notice">${esc(d.driveNote)}</div>` : ''}
        ${rt ? `<div class="routemap"><div id="dmap" style="height:100%"></div><a class="gbtn" href="${gDir(d.drive)}" target="_blank" rel="noopener">${I('pin')}פתח בגוגל מפות</a></div>` : ''}
        ${sights.length ? sights.map(stopHtml).join('') : `<p class="lead">${d.type === 'cruise' ? 'יום שיט. אין עצירות בחוף.' : d.type === 'free' ? 'עוד אין תוכנית ליום הזה.' : ''}</p>`}
        ${sugg.length ? `<div class="h2"><small>לא בתוכנית</small>הצעות לאזור</div><div class="list">${sugg.map(p => `<a class="li" href="#/point/${p.id}">${firstImg(p.id) ? `<img src="${esc(firstImg(p.id).file)}" alt="" loading="lazy">` : '<span class="ph"></span>'}<div class="g"><b>${esc(p.name)}</b><div class="s">${esc(p.visit ? p.visit + ' · ' + (p.see || '') : p.summary || '')}</div></div>${I('chev', 'i chev')}</a>`).join('')}</div>` : ''}
        ${showBack ? legChip(backLeg, false) : ''}
        <a class="sleep" href="#/more/hotels"><span class="ic">${I('bed')}</span><div style="flex:1;min-width:0"><b>${lodge ? (lodge.id === 'plane' ? 'לילה בטיסה' : 'לנים ב' + esc(lodge.city)) : 'הביתה'}</b>${arrive != null ? `<div class="arr">${I('clock')}${firstNight ? 'מגיעים' : 'חוזרים'} בערך ב־<b class="num">${clock(arrive)}</b></div>${early ? `<div class="tiny" style="color:var(--goldink)">לפני שעת הצ׳ק־אין. אפשר בדרך כלל להשאיר מזוודות בקבלה.</div>` : ''}` : ''}<div class="small muted">${lodge ? esc(lodge.name) : ''}${firstNight && lodge?.checkTimes ? ' · ' + esc(lodge.checkTimes.split('·')[0].trim()) : ''}</div></div>${lodge ? pill(lodge.status) : ''}</a>
        <div class="facts" style="margin-top:12px">
          <div class="fact wide"><div class="k">${I('cloud')}תחזית</div><div class="v">${anchor ? wx(anchor.lat, anchor.lng, d.date) : '—'}</div></div>
          ${d.weatherAlt ? `<div class="fact wide"><div class="k">${I('warn')}אם מזג האוויר לא טוב</div><div class="v">${esc(d.weatherAlt)}</div></div>` : ''}
          ${r.clothing?.bring?.length ? `<div class="fact wide"><div class="k">${I('jacket')}לקחת היום</div><div class="chips">${[...(d.bring || []), ...r.clothing.bring].map(b => `<span>${esc(b)}</span>`).join('')}</div></div>` : ''}
        </div>
        ${rt ? `<p class="est">ק״מ וזמני נסיעה: OSRM על בסיס OpenStreetMap. זמני השהייה הם הערכה.</p>` : ''}
        <div class="pager">${prev ? `<a class="btn" href="#/day/${prev.date}">› ${esc(fDay(prev.date))}</a>` : ''}${next ? `<a class="btn" href="#/day/${next.date}">${esc(fDay(next.date))} ‹</a>` : ''}</div>
      </div>`;
  };
  V.day.after = (date) => {
    const rt = RT.days[date]; const d = D.days.find(x => x.date === date);
    if (!rt || typeof L === 'undefined' || !$('#dmap')) return;
    const m = L.map('dmap', { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, keyboard: false, boxZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 16, attribution: '© OpenStreetMap' }).addTo(m);
    const line = L.polyline(rt.line, { color: '#13233d', weight: 4, opacity: .85 }).addTo(m);
    let k = 0;
    d.drive.forEach(id => { const p = point(id); const isStop = d.points.includes(id) && !['transport', 'lodging'].includes(p.kind);
      if (isStop) L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', iconSize: [26, 26], iconAnchor: [13, 13], html: `<span class="num-pin" style="background:${CAT[catOf(p)].color}">${++k}</span>` }) }).addTo(m);
      else L.marker([p.lat, p.lng], { icon: catIcon(p, 24) }).addTo(m); });
    m.fitBounds(line.getBounds().pad(.15));
    maps.push(m);
  };

  V.point = (id) => {
    const p = point(id); if (!p) return pagehead('', 'המקום לא נמצא', '#/journey');
    const r = region(p.region), g = p.guide, n = nav(p), list = imgs(p.id), c = list[0];
    const at = attrOf(p);
    const vis = LS.get('tg.visited', {}), notes = LS.get('tg.notes', {});
    const day = p.days?.[0] && D.days.find(x => x.date === p.days[0]);
    const leg = day && RT.days[day.date]?.legs.find(l => l.to === p.id);
    const req = at.find(a => a.booking === 'required');
    return `
      <section class="hero md" style="${bg(c)}" id="phero">${topnav(day ? `#/day/${day.date}` : `#/region/${r.id}`)}
        <div class="in"><div class="eyebrow">${esc(r.name)}${p.sub ? ' · ' + esc(p.sub) : ''}${p.days?.length ? ' · ' + esc(p.days.map(fDay).join(', ')) : ''}</div>
          <h1>${esc(p.name)}</h1><p>${esc(p.see || p.summary || '')}</p>
          ${list.length > 1 ? `<div class="hero-gal">${list.map((x, i) => `<button data-img="${i}" class="${i ? '' : 'on'}" style="${bg(x)}" aria-label="תמונה ${i + 1}"></button>`).join('')}</div>` : ''}
          <div class="credit" id="pcredit">${credit(c)}</div></div></section>
      <div class="body" style="padding-top:16px">
        <div class="facts4">
          <div>${I('clock')}<b>${esc(p.visit || g?.duration.recommended || '—')}</b><span>זמן שהייה</span></div>
          <div>${I(leg?.mode === 'shuttle' ? 'bus' : 'car')}<b class="num">${leg ? leg.km + ' ק״מ' : '—'}</b><span>${leg ? 'מ' + esc(point(leg.from).name) : 'נסיעה'}</span></div>
          <div>${I('cal')}<b class="num">${p.days?.length ? esc(dm(p.days[0])) : '—'}</b><span>${p.days?.length ? esc(fmt(p.days[0], { weekday: 'long' })) : 'לא שובץ'}</span></div>
          <div>${I('ticket')}<b>${req ? 'חובה' : at.length ? 'מומלץ' : 'לא נדרש'}</b><span>הזמנה</span></div>
        </div>
        ${statusOf(p) ? `<p style="margin:-4px 2px 12px">${statusOf(p)} <span class="small muted">${p.suggestion ? 'לא חלק מהתוכנית. רעיון לאזור.' : 'לא חובה. לפי זמן ומזג אוויר.'}</span></p>` : ''}
        ${at.map(a => `<a class="book ${a.booking === 'required' ? '' : 'soft'}" href="${esc(a.url || '#/more/attractions')}" ${a.url ? 'target="_blank" rel="noopener"' : ''}>${a.opens ? `<div class="bx"><b class="num">${daysTo(a.opens)}</b><span>ימים</span></div>` : `<div class="bx">${I('ticket')}</div>`}<div><div class="t">${esc(a.name)}: ${bookingLabel(a.booking)}</div><div class="s">${a.opens ? `נפתח ${fFull(a.opens)} · ${esc(a.opensNote)}` : esc(a.notes || '')}${a.url ? ' ›' : ''}</div></div></a>`).join('')}
        <div class="sect"><h4>${I('mountain')}מה עושים</h4>
          ${g ? g.activities.map(a => `<div class="act">${a.required ? pill('booked', 'חובה') : pill('option', 'אופציה')}<div><b>${esc(a.name)}</b><div class="d">${esc(a.note)}</div></div></div>`).join('') : `<p>${esc([p.summary, p.see].filter(Boolean).filter((x, i, arr) => arr.indexOf(x) === i).join(' ') || 'מדריך מלא יתווסף בהמשך.')}</p>`}
          ${g?.duration.trails?.length ? `<table class="plain"><tr><th>שביל</th><th>אורך</th><th>עלייה</th></tr>${g.duration.trails.map(t => `<tr><td>${esc(t.name)}</td><td>${esc(t.length)}</td><td>${esc(t.gain)}</td></tr>`).join('')}</table>` : ''}
        </div>
        <div class="sect"><h4>${I('pin')}איך מגיעים</h4><ul>
          ${g?.expect?.parking ? `<li>${esc(g.expect.parking)}</li>` : ''}
          ${leg ? `<li>${leg.mode === 'shuttle' ? 'שאטל' : 'נסיעה'} מ${esc(point(leg.from).name)}: <b class="num">${leg.km} ק״מ</b>, כ־${durText(leg.min)}.</li>` : ''}
          ${p.approx ? '<li>המיקום משוער. כדאי לחפש בניווט לפי השם באנגלית.</li>' : ''}
          <li><a href="${n.google}" target="_blank" rel="noopener">ניווט ב־Google Maps</a> · <a href="${n.apple}" target="_blank" rel="noopener">Apple Maps</a></li></ul></div>
        <div class="sect"><h4>${I('jacket')}מה ללבוש</h4><ul>${(g ? g.clothing : [r.clothing.summary]).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        ${g ? `<div class="sect"><h4>${I('clock')}כמה זמן ומתי</h4><ul><li>מינימום: ${esc(g.duration.min)}</li><li>מומלץ: ${esc(g.duration.recommended)}</li>${g.bestTime ? `<li>${esc(g.bestTime)}</li>` : ''}</ul></div>` : ''}
        ${g ? `<div class="sect warn"><h4>${I('warn')}חשוב לדעת</h4><ul>${(g.important || []).map(x => `<li>${esc(x)}</li>`).join('')}${['safety', 'crowds', 'toilets'].map(k => g.expect?.[k] ? `<li>${esc(g.expect[k])}</li>` : '').join('')}</ul></div>` : ''}
        ${g?.weatherAlt ? `<div class="sect"><h4>${I('cloud')}אם מזג האוויר לא טוב</h4><p>${esc(g.weatherAlt)}</p></div>` : ''}
        ${p.days?.[0] ? `<div class="sect"><h4>${I('sun')}תחזית ל־${esc(dm(p.days[0]))}</h4>${wx(p.lat, p.lng, p.days[0])}</div>` : ''}
        ${g?.links?.length ? `<div class="sect"><h4>${I('link')}קישורים רשמיים</h4>${g.links.map(l => `<a class="src" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ›</a>`).join('')}</div>` : ''}
        <p class="est">${g && !g.verified ? 'זמנים, ביגוד ומה מצפה הם הערכה. כדאי לאמת לפני הטיול.' : 'זמן השהייה והביגוד הם הערכה.'}</p>
        <div class="btns" style="margin-bottom:12px"><a class="btn dark" href="${n.google}" target="_blank" rel="noopener">${I('pin')}נווט</a><a class="btn" href="${n.photos}" target="_blank" rel="noopener">${I('image')}עוד תמונות בגוגל</a></div>
        <div class="sect"><h4>${I('map')}מפת Google</h4><div id="gmap"><button class="btn" id="gmapBtn" style="width:100%">הצג את המקום במפת Google</button></div></div>
        ${journalBlock()}
        <div class="sect"><label class="visited"><input type="checkbox" id="visBox" ${vis[p.id] ? 'checked' : ''}> ביקרנו כאן</label>
          <textarea id="noteBox" style="margin-top:10px" placeholder="הערה אישית: מה היה, מה כדאי לזכור">${esc(notes[p.id] || '')}</textarea>
          <p class="tiny" style="margin-top:6px">נשמר רק במכשיר הזה.</p></div>
      </div>`;
  };
  V.point.after = (id) => {
    const p = point(id), list = imgs(id); if (!p) return;
    document.querySelectorAll('[data-img]').forEach(b => b.addEventListener('click', () => {
      const c = list[+b.dataset.img]; $('#phero').style.backgroundImage = `url('${c.file}')`; $('#pcredit').innerHTML = credit(c);
      document.querySelectorAll('[data-img]').forEach(x => x.classList.toggle('on', x === b));
    }));
    $('#gmapBtn').addEventListener('click', () => {
      if (!navigator.onLine) { toast('מפת Google דורשת חיבור. כפתור ״נווט״ עובד עם מפות אופליין.'); return; }
      $('#gmap').innerHTML = `<iframe class="gframe" src="${nav(p).embed}" loading="lazy" title="מפת Google – ${esc(p.name)}"></iframe>`;
    });
    journalInit(id);
    $('#visBox').addEventListener('change', e => { const v = LS.get('tg.visited', {}); v[id] = e.target.checked; LS.set('tg.visited', v); toast(e.target.checked ? 'סומן: ביקרנו כאן' : 'הסימון בוטל'); });
    $('#noteBox').addEventListener('input', e => { const nn = LS.get('tg.notes', {}); nn[id] = e.target.value; LS.set('tg.notes', nn); });
  };

  V.today = () => {
    const t = today(), first = toDate(D.days[0].date), last = toDate(D.days[D.days.length - 1].date);
    if (t >= first && t <= last) { const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; V.today.iso = iso; return V.day(iso); }
    V.today.iso = null;
    return `${pagehead('היום בטיול', t < first ? `עוד ${daysTo(D.days[0].date)} ימים` : 'הטיול הסתיים')}
      <div class="body" style="padding-top:8px"><p class="lead" style="margin-top:0">${t < first ? `מ־${fFull(D.meta.start)} יופיע כאן אוטומטית המסלול של אותו יום. בינתיים, כל הימים:` : ''}</p>
      ${D.regions.map(r => `<div class="h2"><small class="num">${dm(r.from)}–${dm(r.to)}</small>${esc(r.name)}</div>${D.days.filter(d => d.region === r.id).map(dayCard).join('')}`).join('')}</div>`;
  };
  V.today.after = () => { if (V.today.iso) V.day.after(V.today.iso); };

  V.map = () => {
    const embed = D.meta.googleMyMapsEmbed;
    return `${pagehead('כל המסלול', 'מפת הטיול')}
      <div class="body" style="padding-top:8px">
        <div class="filters"><div><label for="regF">אזור</label><select id="regF"><option value="">כל המסע</option>${D.regions.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></div>
          <div><label for="kindF">להציג</label><select id="kindF"><option value="">הכול</option><option value="plan">רק מה שבתוכנית</option>${Object.entries(CAT).map(([k, c]) => `<option value="${k}">${c.label}</option>`).join('')}</select></div></div>
        ${EDIT() ? '<div class="notice">מצב עריכה: גררו נקודה כדי להזיז אותה, לחצו על המפה כדי להוסיף נקודה, ולחצו על נקודה כדי לערוך או למחוק.</div>' : ''}
        ${embed && !EDIT() ? `<iframe class="gframe" style="height:380px;margin-bottom:12px" src="${esc(embed)}" loading="lazy" title="מפת Google My Maps"></iframe>` : '<div id="bigmap" role="application" aria-label="מפה"></div>'}
        <div class="legend">${Object.values(CAT).map(c => `<span><i class="cat-pin" style="background:${c.color}">${I(c.icon)}</i>${c.label}</span>`).join('')}<span><i class="cat-pin opt" style="background:#7d8796">${I('star')}</i>אופציה / הצעה</span></div>
        <div class="btns" style="margin:0 0 16px"><button class="btn" id="kmlBtn">${I('download')}ייצוא ל־Google My Maps</button></div>
        <div id="stops">${D.regions.map(r => `<div class="h2" data-region-h="${r.id}"><small class="num">${dm(r.from)}–${dm(r.to)}</small>${esc(r.name)}</div><div class="list" data-region-l="${r.id}">` +
          D.points.filter(p => p.region === r.id).map(p => `<a class="li" href="#/point/${p.id}" data-plan="${p.optional ? 0 : 1}" data-cat="${catOf(p)}" data-hike="${p.hike ? 1 : 0}">${firstImg(p.id) ? `<img src="${esc(firstImg(p.id).file)}" alt="" loading="lazy">` : '<span class="ph"></span>'}
            <div class="g"><b>${esc(p.name)}</b><div class="s">${p.days?.length ? esc(p.days.map(fDay).join(', ')) : 'לא שובץ'}${p.suggestion ? ' · הצעה' : p.optional ? ' · אופציה' : ''}</div><div class="s num" style="text-align:right">${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</div></div>${I('chev', 'i chev')}</a>`).join('') + '</div>').join('')}</div>
      </div>`;
  };
  V.map.after = () => {
    const rf = $('#regF'), kf = $('#kindF');
    const vis = () => D.points.filter(p => (!rf.value || p.region === rf.value) && (!kf.value || (kf.value === 'plan' ? !p.optional : catOf(p) === kf.value || (kf.value === 'trail' && p.hike))));
    $('#kmlBtn').addEventListener('click', exportKML);
    let m, layer;
    if ((!D.meta.googleMyMapsEmbed || EDIT()) && typeof L !== 'undefined' && $('#bigmap')) {
      m = L.map('bigmap'); maps.push(m);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(m);
      layer = L.layerGroup().addTo(m);
    }
    const draw = () => {
      document.querySelectorAll('[data-region-h],[data-region-l]').forEach(el => { el.hidden = !!rf.value && (el.dataset.regionH || el.dataset.regionL) !== rf.value; });
      document.querySelectorAll('#stops .li').forEach(el => { el.hidden = !!kf.value && (kf.value === 'plan' ? el.dataset.plan === '0' : (el.dataset.cat !== kf.value && !(kf.value === 'trail' && el.dataset.hike === '1'))); });
      if (!layer) return;
      layer.clearLayers();
      Object.entries(RT.days).forEach(([date, rt]) => { const dd = D.days.find(x => x.date === date); if (!rf.value || dd.region === rf.value) L.polyline(rt.line, { color: '#13233d', weight: 3, opacity: .6, interactive: false }).addTo(layer); });
      const pts = vis();
      if (EDIT()) {
        pts.forEach(p => {
          const mk = L.marker([p.lat, p.lng], { draggable: true, icon: L.divIcon({ className: '', html: `<span class="edit-pin" style="background:${p.optional ? '#7d8796' : '#2d6cb5'}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] }) })
            .bindPopup(`<b>${esc(p.name)}</b><br><a href="#/edit/point/${p.id}">עריכה</a> · <a href="#/point/${p.id}">למדריך</a>`).addTo(layer);
          mk.on('dragend', () => { const ll = mk.getLatLng(); p.lat = +ll.lat.toFixed(5); p.lng = +ll.lng.toFixed(5); saveDraft(`המיקום של ${p.name} עודכן`); });
        });
        if (pts.length) m.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])).pad(.12), { maxZoom: 11 });
        return;
      }
      pts.forEach(p => L.marker([p.lat, p.lng], { icon: catIcon(p), title: p.name, zIndexOffset: catOf(p) === 'lodging' ? 500 : 0 })
        .bindPopup(`<span class="pop-cat" style="color:${CAT[catOf(p)].color}">${CAT[catOf(p)].label}${p.optional ? ' · ' + (p.suggestion ? 'הצעה' : 'אופציה') : ''}${p.hike && catOf(p) !== 'trail' ? ' · יש מסלולי הליכה' : ''}</span><br>` +`<b>${esc(p.name)}</b><br>${esc(region(p.region).name)}${p.days?.length ? ' · ' + esc(p.days.map(fDay).join(', ')) : ''}<br><a href="#/point/${p.id}">למדריך</a> · <a href="${nav(p).google}" target="_blank" rel="noopener">נווט</a>`).addTo(layer));
      if (pts.length) m.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])).pad(.12), { maxZoom: 11 });
    };
    rf.addEventListener('change', draw); kf.addEventListener('change', draw); draw();
    if (EDIT() && m) m.on('click', (e) => {
      const id = 'p-' + Date.now().toString(36);
      D.points.push({ id, name: 'נקודה חדשה', nameEn: '', region: rf.value || D.regions[0].id, lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5), days: [], kind: 'attraction', optional: true });
      saveDraft('נוספה נקודה חדשה'); location.hash = `#/edit/point/${id}`;
    });
  };
  function exportKML() {
    const pm = D.points.map(p => `<Placemark><name>${esc(p.nameEn || p.name)}</name><description>${esc(p.name)} · ${esc(region(p.region).name)}${p.days?.length ? ' · ' + p.days.join(', ') : ''}</description><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>`).join('');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(D.meta.title)}</name>${pm}</Document></kml>`], { type: 'application/vnd.google-earth.kml+xml' }));
    a.download = 'usa-canada-2027.kml'; a.click();
    toast('הקובץ ירד. ב־Google My Maps: מפה חדשה ← ייבוא.');
  }

  V.tasks = (tab = 'urgent') => {
    const dn = done();
    const all = [...D.tasks, ...D.entry.items];
    const doneCount = all.filter(t => dn[t.id] || t.status === 'done').length, pct = Math.round(100 * doneCount / all.length);
    const dated = datedItems(), datedIds = new Set(dated.map(x => x.id));
    const row = (id, title, sub, right, hot, extra = '') => `<div class="task ${dn[id] ? 'done' : ''} ${hot ? 'hot' : ''}"><input type="checkbox" data-done="${id}" ${dn[id] ? 'checked' : ''} aria-label="בוצע: ${esc(title)}"><div class="g"><div class="t">${esc(title)}</div>${sub ? `<div class="s">${sub}</div>` : ''}${extra}</div>${right || ''}</div>`;
    const cats = {};
    D.tasks.filter(t => !datedIds.has(t.id) && !dn[t.id] && t.status !== 'done').forEach(t => { (cats[t.category] ??= []).push(t); });
    const finished = all.filter(t => dn[t.id] || (t.status === 'done' && D.tasks.some(x => x.id === t.id)));
    const urgent = `
      <div class="grp red">${I('clock')}יש תאריך קבוע</div>
      ${dated.map((u, k) => row(u.id, u.title, esc(u.sub) + (u.url ? ` · <a href="${esc(u.url)}" target="_blank" rel="noopener">קישור</a>` : ''), `<div class="dd"><b class="num" style="color:${k ? 'var(--gold)' : 'var(--alert)'}">${daysTo(u.date)}</b><span>ימים</span></div>`, k === 0)).join('')}
      ${Object.entries(cats).map(([cat, list]) => `<div class="grp gray">${I({ 'טיסות': 'plane', 'רכב': 'car', 'מלונות': 'bed', 'קרוז': 'ship', 'הזמנות': 'ticket' }[cat] || 'doc')}${esc(cat)}</div>${list.map(t => row(t.id, t.title, esc(t.notes || ''), pill(t.status), false, t.url ? `<a class="link" href="${esc(t.url)}" target="_blank" rel="noopener">קישור ›</a>` : '')).join('')}`).join('')}
      ${finished.length ? `<details><summary class="grp gray" style="cursor:pointer">בוצעו (${finished.length})</summary>${finished.map(t => row(t.id, t.title, '', pill('done'))).join('')}</details>` : ''}`;
    const docs = `<div class="notice">נבדק במקורות רשמיים ב־${esc(fFull(D.entry.checkedOn))}. ${esc(D.entry.disclaimer)}</div>
      ${D.entry.items.filter(i => i.status !== 'done').sort((a, b) => a.order - b.order).map(i => row(i.id, i.title, i.deadline ? `<b>מתי:</b> ${esc(i.deadline)}` : '', pill(i.status), false,
        `<details><summary>פרטים ומקורות רשמיים</summary><p class="s" style="margin-top:6px">${esc(i.what)}</p>${i.tip ? `<p class="s">${esc(i.tip)}</p>` : ''}${i.facts.map(f => `<a class="src" href="${esc(f.source)}" target="_blank" rel="noopener">${esc(f.text)} · ${esc(new URL(f.source).hostname.replace(/^www\./, ''))} ›</a>`).join('')}</details>`)).join('')}`;
    const attr = D.attractions.slice().sort((a, b) => (a.booking === 'required' ? 0 : 1) - (b.booking === 'required' ? 0 : 1)).map(attrRow).join('');
    return `${pagehead('לפני הטיול', 'מה נשאר לסגור')}
      <div class="body" style="padding-top:8px">
        <div class="prog"><span class="ring" style="background:conic-gradient(var(--blue) 0 ${pct}%, var(--line) ${pct}% 100%)"><i class="num">${pct}%</i></span><div><b style="font-size:17px">${doneCount} מתוך ${all.length} הושלמו</b><div class="small muted">${dated.length} עם תאריך קבוע · ${D.entry.items.filter(i => i.status !== 'done').length} מסמכים ובריאות</div></div></div>
        <button class="btn" id="icsBtn2" style="width:100%;margin-bottom:12px">${I('cal')}הוספת כל המועדים ליומן, עם תזכורות</button>
        <div class="seg" role="tablist"><button class="${tab === 'urgent' ? 'on' : ''}" data-go="#/tasks/urgent">לפי דחיפות</button><button class="${tab === 'docs' ? 'on' : ''}" data-go="#/tasks/docs">מסמכים</button><button class="${tab === 'attr' ? 'on' : ''}" data-go="#/tasks/attr">אטרקציות</button></div>
        ${tab === 'docs' ? docs : tab === 'attr' ? attr : urgent}
        <p class="tiny" style="margin-top:12px">הסימון ״בוצע״ נשמר במכשיר הזה.</p>
      </div>`;
  };
  V.tasks.after = () => {
    $('#icsBtn2')?.addEventListener('click', exportICS);
    view.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { location.hash = b.dataset.go; }));
    view.querySelectorAll('[data-done]').forEach(cb => cb.addEventListener('change', () => { const m = done(); m[cb.dataset.done] = cb.checked; LS.set('tg.done', m); toast(cb.checked ? 'סומן כבוצע' : 'הוחזר לפתוחות'); route(); }));
  };

  V.more = (sub) => {
    if (sub && V['more_' + sub]) return V['more_' + sub]();
    const li = (href, icon, t, s) => `<a class="li" href="${href}"><span class="ic">${I(icon)}</span><div class="g"><b>${t}</b><div class="s">${s}</div></div>${I('chev', 'i chev')}</a>`;
    return `${pagehead('הכול במקום אחד', 'עוד')}
      <div class="body" style="padding-top:8px">
        <div class="list">
          ${li('#/more/attractions', 'ticket', 'אטרקציות', 'מה להזמין ומתי ההזמנה נפתחת')}
          ${li('#/more/budget', 'wallet', 'תקציב מול הזמנות', 'מה הוזמן, מה שולם ומה נשאר')}
          ${li('#/more/transport', 'plane', 'טיסות, קרוז ורכב', 'שעות מקומיות, טרמינלים ותשלומים')}
          ${li('#/more/hotels', 'bed', 'מלונות', 'לינה לפי לילות')}
        </div>
        <div class="list">
          ${li('#/more/packing', 'jacket', 'רשימת אריזה', 'לפי האקלים בכל אזור')}
          ${li('#/more/expenses', 'wallet', 'הוצאות בזמן הטיול', 'רישום מול התקציב, עם המרה לשקלים')}
          ${li('#/more/emergency', 'warn', 'מידע לחירום', '911, נציגויות ישראל, בית חולים קרוב')}
          ${li('#/more/sync', 'link', 'סנכרון עם בן/בת הזוג', 'שליחת עדכונים בוואטסאפ ומיזוג בטלפון השני')}
          <button class="li" id="icsBtn" style="width:100%;text-align:right;font:inherit"><span class="ic">${I('cal')}</span><div class="g"><b>הוספת המועדים ליומן</b><div class="s">שאטל, תשלומים, ביטולים וטיסות, עם תזכורות</div></div>${I('download', 'i chev')}</button>
        </div>
        <div class="list">
          ${li('#/more/offline', 'download', 'שמירה לאופליין ועריכה', LS.get('tg.offlineAt') ? 'נשמר במכשיר' : 'עוד לא נשמר במכשיר הזה')}
          ${li('#/more/credits', 'image', 'קרדיטים', 'תמונות, מפות ונתונים')}
        </div>
      </div>`;
  };
  V.more.after = (sub) => { if (!sub) $('#icsBtn')?.addEventListener('click', exportICS); };
  // decision per attraction: booked / yes (chosen, still to book) / undecided / no / free (no booking needed)
  const attrState = (a) => {
    const dec = (LS.get('tg.attrDec', {}) || {})[a.id];
    if (dec === 'no') return 'no';
    if (a.status === 'booked' || done()[a.id]) return 'booked';
    if (a.booking === 'none') return 'free';
    if (dec === 'yes' || (dec == null && ['planning', 'toclose'].includes(a.status))) return 'yes';
    return 'undecided';
  };
  const ATTR_LBL = { booked: 'הוזמן', yes: 'בתוכנית, להזמין', undecided: 'עוד לא הוחלט', no: 'ויתרתם', free: 'בלי הזמנה' };
  V.more_attractions = () => {
    const mode = LS.get('tg.attrView', 'todo');
    const list = D.attractions.map(a => ({ ...a, st: attrState(a), p: point(a.point) }));
    const soon = list.filter(a => a.opens && a.st !== 'no' && a.st !== 'booked' && toDate(a.opens) > new Date()).sort((x, y) => x.opens < y.opens ? -1 : 1)[0];
    const card = (a) => { const im = a.p && firstImg(a.p.id), bcls = a.booking === 'required' ? 'b-red' : a.booking === 'none' ? 'b-ok' : 'b-gold';
      return `<div class="sect att ${a.st}"><a class="aimg" href="${a.p ? '#/point/' + a.p.id : '#'}" style="${im ? `background-image:url('${esc(im.file)}')` : ''}"></a><div class="g">
        <b>${esc(a.name)}</b><div class="meta">${esc([a.date ? fDay(a.date) : '', region(a.region)?.name, a.p?.visit].filter(Boolean).join(' · '))}</div>
        <div class="badges"><span class="badge ${bcls}">${bookingLabel(a.booking)}</span>${a.st === 'booked' ? '<span class="badge b-ok">✓ הוזמן</span>' : ''}${a.cost?.amount ? `<span class="badge b-gray">${money(a.cost.amount, a.cost.currency)}</span>` : ''}</div>
        ${a.notes ? `<p class="anote">${esc(a.notes)}</p>` : ''}
        <div class="aact">${a.st === 'undecided' || a.st === 'no' ? `<button data-dec="${a.id}:yes" class="${a.st === 'undecided' ? '' : ''}">בפנים</button>${a.st === 'undecided' ? `<button data-dec="${a.id}:no">לא</button>` : ''}`
          : a.st === 'yes' ? `${a.url ? `<a class="go" href="${esc(a.url)}" target="_blank" rel="noopener">להזמנה ›</a>` : ''}<button data-booked="${a.id}">סימון ״הוזמן״</button><button class="ghost" data-dec="${a.id}:">לא בטוחים</button>`
          : a.st === 'booked' ? `<button class="ghost" data-booked="${a.id}">ביטול הסימון</button>`
          : a.url ? `<a class="go light" href="${esc(a.url)}" target="_blank" rel="noopener">אתר רשמי ›</a>` : ''}</div></div></div>`; };
    const groups = [['yes-req', 'חובה להזמין', 'var(--alert)', a => a.st === 'yes' && a.booking === 'required'], ['yes', 'בתוכנית, צריך להזמין', 'var(--gold)', a => a.st === 'yes' && a.booking !== 'required'],
      ['undecided', 'להחליט', 'var(--blue)', a => a.st === 'undecided'], ['booked', 'הוזמן', 'var(--ok)', a => a.st === 'booked'], ['free', 'בלי הזמנה', 'var(--ink3)', a => a.st === 'free'], ['no', 'ויתרתם', 'var(--line)', a => a.st === 'no']];
    const byDate = () => { const dated = list.filter(a => a.date && a.st !== 'no').sort((x, y) => x.date < y.date ? -1 : 1), und = list.filter(a => !a.date && a.st !== 'no');
      let last = ''; return dated.map(a => { const h = a.date !== last ? `<div class="grp">${esc(fLong(a.date))}</div>` : ''; last = a.date; return h + card(a); }).join('') + (und.length ? `<div class="grp">בלי תאריך קבוע</div>${und.map(card).join('')}` : ''); };
    return `${pagehead('לפני הטיול', 'אטרקציות', '#/more')}<div class="body" style="padding-top:8px">
      <div class="views"><button data-view="todo" class="${mode === 'todo' ? 'on' : ''}">לפי מה לעשות</button><button data-view="date" class="${mode === 'date' ? 'on' : ''}">לפי תאריך</button></div>
      ${soon ? (() => { const ms = toDate(soon.opens) - new Date(), dd = Math.floor(ms / 864e5), hh = Math.floor(ms % 864e5 / 36e5); return `<div class="count"><span class="k">ההזמנה הכי חשובה</span><b>${esc(soon.name)}</b><div class="small">נפתח ב־${esc(fFull(soon.opens))} ב־${esc(soon.opens.split('T')[1])} שעון ישראל${soon.opensNote ? ' · ' + esc(soon.opensNote) : ''}</div>
        <div class="cd"><div><span class="num">${dd}</span>ימים</div><div><span class="num">${hh}</span>שעות</div>${soon.url ? `<a href="${esc(soon.url)}" target="_blank" rel="noopener">לאתר ›</a>` : ''}</div></div>`; })() : ''}
      ${mode === 'date' ? byDate() : groups.map(([id, l, c, f]) => { const g = list.filter(f); return g.length ? `<div class="grp" style="--c:${c}"><i></i>${l} · ${g.length}</div>${id === 'no' || id === 'free' ? `<details class="fold"><summary>הצגה</summary>${g.map(card).join('')}</details>` : g.map(card).join('')}` : ''; }).join('')}
      <p class="tiny" style="margin-top:12px">״בפנים״ מסמן את האטרקציה ביום שלה בתוכנית. ההחלטות עוברות בסנכרון.</p></div>`;
  };
  V.more_attractions.after = () => {
    view.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { LS.set('tg.attrView', b.dataset.view); route(); }));
    view.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => { const [id, v] = b.dataset.dec.split(':'); const m = LS.get('tg.attrDec', {}) || {}; m[id] = v || 'undecided'; LS.set('tg.attrDec', m); route(); }));
    view.querySelectorAll('[data-booked]').forEach(b => b.addEventListener('click', () => { const m = LS.get('tg.done', {}); m[b.dataset.booked] = !m[b.dataset.booked]; LS.set('tg.done', m); route(); }));
  };
  V.more_budget = () => {
    const user = LS.get('tg.rates', {}) || {}, R = { ILS: 1, USD: +user.USD || D.budget.rates?.USD || 0, CAD: +user.CAD || D.budget.rates?.CAD || 0 };
    const dn = done(), ils = (i, amt) => i.ils != null && Math.abs(amt - i.amount) < .01 ? i.ils : amt * (R[i.currency] || 0);
    const cats = D.budget.categories.map(c => ({ ...c, items: c.items.map(i => ({ ...i, cat: c.id })) }));
    const items = cats.flatMap(c => c.items), booked = items.filter(i => i.status === 'booked' && i.amount != null);
    const paidOf = (i) => (i.task && (dn[i.task] || D.tasks.some(t => t.id === i.task && t.status === 'done'))) ? i.amount : (i.paid ?? 0);
    const plan = Object.fromEntries((D.paymentPlan?.items || []).filter(x => x.task).map(x => [x.task, x.month]));
    const when = (i) => (i.task && plan[i.task]) || i.due || null;
    const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
    const shek = (n) => '₪' + Math.round(n).toLocaleString('he-IL');
    const cur = (a, c) => c === 'ILS' ? '' : `${Math.round(a).toLocaleString('he-IL')} ${c === 'USD' ? '$' : 'CA$'}`;
    // rows: paid parts first, then what is left, grouped by payment (one task = one row)
    const paidRows = [], due = {};
    booked.forEach(i => {
      const pd = paidOf(i), rest = i.amount - pd, name = i.short || i.label;
      if (pd > .5) paidRows.push({ name: rest > .5 ? name + ', מקדמה' : name, ils: ils(i, pd), sub: cur(pd, i.currency), task: rest > .5 ? null : (i.task && dn[i.task] ? i.task : null) });
      if (rest > .5) { const k = i.task || name; (due[k] ??= { task: i.task, when: when(i), names: [], ils: 0, subs: [], note: i.payNote }); const nm = pd > .5 ? name + ', יתרה' : name; if (!due[k].names.includes(nm)) due[k].names.push(nm); due[k].ils += ils(i, rest); due[k].subs.push(cur(rest, i.currency)); }
    });
    const dueRows = Object.values(due).sort((a, b) => (a.when || '9') < (b.when || '9') ? -1 : 1);
    const totB = sum(booked, i => ils(i, i.amount)), totL = sum(dueRows, r => r.ils), totP = totB - totL, pct = totB ? Math.round(100 * totP / totB) : 0;
    const next = dueRows.find(r => r.when && daysTo(r.when) >= 0) || dueRows[0];
    const chip = (iso) => iso ? `<span class="date"><b class="num">${toDate(iso).getDate()}</b><small>${esc(fmt(iso, { month: 'short' }))}</small></span>` : '<span class="date">—</span>';
    const row = (r, paid) => `<div class="ti ${paid ? 'paid' : ''}">${r.task ? `<input type="checkbox" data-paid="${r.task}" ${paid ? 'checked' : ''} aria-label="שולם">` : `<span class="chk-fix">${paid ? '✓' : ''}</span>`}
      ${paid ? '<span class="date ok">✓</span>' : chip(r.when)}<div class="g"><b>${esc(r.names ? r.names.join(' + ') : r.name)}</b><span>${esc([r.subs ? r.subs.filter(Boolean).join(' + ') : r.sub, r.note].filter(Boolean).join(' · ') || (paid ? 'שולם' : ''))}</span></div><span class="v num">${shek(r.ils)}</span></div>`;
    const catTot = cats.map(c => ({ label: c.label, v: sum(c.items.filter(i => i.status === 'booked' && i.amount != null), i => ils(i, i.amount)) })).filter(c => c.v > 0);
    const COL = ['#2d6cb5', '#b48a4a', '#13233d', '#6b8fb8', '#8a6530'];
    const notYet = items.filter(i => i.amount == null);
    return `${pagehead('כסף', 'תקציב', '#/more')}<div class="body" style="padding-top:8px">
      <div class="bhero"><span class="k">נשאר לשלם</span><b class="num">${shek(totL)}</b>
        <div class="bbar"><i style="width:${pct}%"></i></div><div class="lg2"><span>שולם ${shek(totP)}</span><span>מתוך ${shek(totB)}</span></div></div>
      ${next ? `<div class="bnext"><span class="k">התשלום הבא${next.when ? ` · ${daysTo(next.when) === 0 ? 'היום' : `בעוד ${daysTo(next.when)} ימים`}` : ''}</span>
        <div class="t"><div><b>${esc(next.names.join(' + '))}</b><div class="small muted">${next.when ? esc(fmt(next.when, { day: 'numeric', month: 'long', year: 'numeric' })) : ''}${next.note ? ' · ' + esc(next.note) : ''}</div></div><b class="num">${shek(next.ils)}</b></div>
        ${next.task ? `<button class="btn dark" data-paid-btn="${next.task}">סימון ״שולם״</button>` : ''}</div>` : `<div class="sect"><b>הכול שולם 🎉</b></div>`}
      <div class="h2 bh"><span>ציר התשלומים</span><small>בערך, בשקלים</small></div>
      <div class="sect tl">${paidRows.map(r => row(r, true)).join('')}${dueRows.map(r => row(r, false)).join('')}</div>
      <div class="h2 bh"><span>לאן הולך הכסף</span></div>
      <div class="sect"><div class="stack">${catTot.map((c, k) => `<i style="width:${(100 * c.v / totB).toFixed(1)}%;background:${COL[k % COL.length]}"></i>`).join('')}</div>
        <div class="lg3">${catTot.map((c, k) => `<span style="--c:${COL[k % COL.length]}">${esc(c.label)} <b class="num">${shek(c.v)}</b></span>`).join('')}</div></div>
      ${notYet.length ? `<div class="todo"><b>עוד לא בחישוב</b> · יתווספו כשיוזמנו<div class="chips" style="margin-top:8px">${notYet.map(i => `<span>${esc(i.label)}</span>`).join('')}</div></div>` : ''}
      <p class="tiny" style="margin-top:12px">${esc(D.budget.rates?.note || '')} שער: דולר ${R.USD} · דולר קנדי ${R.CAD}. סימון ״שולם״ כאן מסמן גם את המשימה, ועובר בסנכרון.</p>
      <details class="sect" style="margin-top:10px"><summary><b>פירוט מלא לפי קטגוריה</b></summary>
        ${cats.map(c => `<div class="line-item" style="border:0;padding-top:14px"><b>${esc(c.label)}</b></div>${c.items.length ? c.items.map(i => `<div class="line-item"><span>${esc(i.label)} ${pill(i.status)}</span><span class="v">${i.approx && i.amount != null ? '~' : ''}${money(i.amount, i.currency)}</span></div>`).join('') : '<p class="small muted">אין עדיין פריטים.</p>'}`).join('')}
        <p class="tiny">${esc(D.hotelsNote)}</p></details></div>`;
  };
  V.more_budget.after = () => {
    const set = (task, on) => { const m = LS.get('tg.done', {}); m[task] = !!on; LS.set('tg.done', m); route(); toast(on ? 'סומן כשולם' : 'הסימון בוטל'); };
    view.querySelectorAll('[data-paid]').forEach(cb => cb.addEventListener('change', () => set(cb.dataset.paid, cb.checked)));
    view.querySelector('[data-paid-btn]')?.addEventListener('click', (e) => set(e.currentTarget.dataset.paidBtn, true));
  };
  V.more_transport = () => {
    const tzn = (tz) => ({ 'Asia/Jerusalem': 'שעון ישראל', 'America/Los_Angeles': 'שעון האוקיינוס השקט', 'America/Edmonton': 'שעון ההרים' }[tz] || tz);
    const c = D.cruise;
    return `${pagehead('תחבורה', 'טיסות, קרוז ורכב', '#/more')}<div class="body" style="padding-top:8px">
      ${D.flights.map(f => `<div class="sect"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="small muted" style="font-weight:600">${esc(fDay(f.date))} · ${esc(f.flight)} · ${esc(f.carrier)}</span>${pill(f.status)}</div>
        <div class="seg-route"><span>${esc(f.from)}</span><i>→</i><span>${esc(f.to)}</span></div>
        <div class="facts" style="margin:8px 0 0"><div class="fact" style="background:var(--bg)"><div class="k">יציאה · ${esc(tzn(f.fromTz))}</div><div class="v num" style="font-size:20px;font-weight:700;text-align:right">${esc(f.dep || 'טרם נקבע')}</div>${f.fromTerminal ? `<div class="tiny">טרמינל ${esc(f.fromTerminal)}</div>` : ''}</div>
          <div class="fact" style="background:var(--bg)"><div class="k">נחיתה · ${esc(tzn(f.toTz))}</div><div class="v num" style="font-size:20px;font-weight:700;text-align:right">${esc(f.arr || 'טרם נקבע')}</div><div class="tiny">${f.toTerminal ? 'טרמינל ' + esc(f.toTerminal) : ''}${f.arrDate && f.arrDate !== f.date ? ' · ' + esc(fDay(f.arrDate)) : ''}</div></div></div>
        ${f.notes ? `<p class="small muted" style="margin-top:6px">${esc(f.notes)}</p>` : ''}</div>`).join('')}
      <div class="sect"><h4>${I('plane')}עלות טיסות אל על</h4>${D.flightsInfo.costPerTraveler.map(x => `<div class="line-item"><span>${esc(x.label)} (לנוסע)</span><span class="v">${money(x.amount, x.currency)}</span></div>`).join('')}<div class="line-item"><b>סה״כ לזוג</b><b class="v">${money(D.flightsInfo.totalCouple.amount, 'USD')}</b></div><p class="small muted">${esc(D.flightsInfo.baggage)}</p></div>
      <div class="h2"><small>הוזמן</small>${esc(c.ship)}</div>
      <div class="sect"><div class="facts"><div class="fact" style="background:var(--bg)"><div class="k">הפלגה</div><div class="v">${esc(fDay(c.embark.date))} · <b class="num">${esc(c.embark.time)}</b></div>${c.embark.note ? `<div class="tiny">${esc(c.embark.note)}</div>` : ''}</div><div class="fact" style="background:var(--bg)"><div class="k">הגעה לסיאטל</div><div class="v">${esc(fDay(c.arrival.date))} · <b class="num">${esc(c.arrival.time)}</b></div></div></div>
        <div class="notice">${esc(c.arrival.note)} ${esc(c.verify)}</div>
        <ul class="timeline">${c.itinerary.map(s => `<li><span class="when">${esc(fDay(s.date))}</span><span>${esc(s.place)}</span></li>`).join('')}</ul>
        <div class="line-item"><span>סה״כ</span><span class="v">${money(c.total.amount, 'ILS')}</span></div><div class="line-item"><span>שולם (${esc(c.paid.note)})</span><span class="v">${money(c.paid.amount, 'ILS')}</span></div>
        <div class="line-item"><b>יתרה עד ${esc(fFull(c.balance.due))}</b><b class="v">${money(c.balance.amount, 'ILS')}</b></div><div class="line-item"><span>דמי שירות (${esc(c.gratuities.note)})</span><span class="v">~${money(c.gratuities.approxTotal, 'USD')}</span></div>
        <p class="small muted">${esc(c.balance.note)}</p></div>
      <div class="h2"><small>לסגור</small>רכב שכור</div>
      ${D.cars.map(r => `<div class="sect"><h4 style="justify-content:space-between"><span>${esc(r.where)}</span>${pill(r.status)}</h4><div class="line-item"><span>איסוף</span><span class="v">${esc(fDay(r.pickup))} · ${esc(r.pickupPlace)}</span></div><div class="line-item"><span>החזרה</span><span class="v">${esc(fDay(r.dropoff))}</span></div><p class="tiny">${esc(r.dropoffPlace)}</p><div class="line-item"><span>מחיר</span><span class="v">${r.price ? money(r.price.amount, r.price.currency) : '<span class="muted">טרם נקבע</span>'}</span></div></div>`).join('')}
    </div>`;
  };
  V.more_hotels = () => `${pagehead('לינה', 'מלונות', '#/more')}<div class="body" style="padding-top:8px">
    ${D.hotels.map(h => { const n = h.checkIn && h.checkOut ? nights(h.checkIn, h.checkOut) : null; return `<div class="sect"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="small muted" style="font-weight:600"><span class="num">${dm(h.checkIn)} → ${h.checkOut ? dm(h.checkOut) : '?'}</span>${n ? ` · ${n} לילות` : ''}</span>${pill(h.status)}</div>
      <h4 style="margin-top:4px">${esc(h.city)}</h4><p class="${/טרם נקבע/.test(h.name) ? 'muted' : ''}" style="font-weight:600;color:var(--ink)">${esc(h.name)}${h.room ? ` <span class="small muted" style="font-weight:400">· ${esc(h.room)}</span>` : ''}</p>
      ${h.checkTimes ? `<div class="line-item"><span>שעות</span><span class="v" style="white-space:normal">${esc(h.checkTimes)}</span></div>` : ''}
      <div class="line-item"><span>מחיר סופי לזוג</span><span class="v">${['cruise', 'plane'].includes(h.id) ? 'כלול' : h.price ? money(h.price.amount, h.price.currency) : '<span class="muted">טרם נקבע</span>'}</span></div>
      ${h.deposit ? `<div class="line-item"><span>מקדמה</span><span class="v">${money(h.deposit.amount, h.deposit.currency)} ${esc(h.deposit.note || '')}</span></div>` : ''}
      ${h.cancelBy ? `<div class="line-item"><span>ביטול</span><span class="v" style="white-space:normal;max-width:65%">${esc(h.cancelBy)}</span></div>` : ''}
      ${h.payment ? `<div class="line-item"><span>תשלום</span><span class="v" style="white-space:normal;max-width:65%">${esc(h.payment)}</span></div>` : ''}
      ${h.notes ? `<p class="tiny" style="margin-top:6px">${esc(h.notes)}</p>` : ''}
      ${h.point && point(h.point) ? `<div class="btns" style="margin-top:8px"><a class="btn" href="${nav(point(h.point)).google}" target="_blank" rel="noopener">${I('pin')}ניווט למלון</a></div>` : ''}</div>`; }).join('')}
    <p class="tiny">${esc(D.hotelsNote)}</p></div>`;
  V.more_offline = () => {
    const on = EDIT(), hasDraft = !!LS.get('tg.draft');
    const li = (href, icon, t, sub) => `<a class="li" href="${href}"><span class="ic">${I(icon)}</span><div class="g"><b>${t}</b><div class="s">${sub}</div></div>${I('chev', 'i chev')}</a>`;
    return `${pagehead('הגדרות', 'אופליין ועריכה', '#/more')}<div class="body" style="padding-top:8px">
    <div class="sect"><h4>${I('download')}שמור הכול לאופליין</h4>
      <p>שומר במכשיר את האתר, הנתונים וכל התמונות. מהמפה נשמרים רק אזורים שכבר הוצגו, לפי מדיניות OpenStreetMap. מפות מלאות לניווט כדאי להוריד ב־Google Maps או Maps.me.</p>
      <button class="btn gold" id="saveOff" style="width:100%;margin-top:12px">שמור הכול לאופליין</button>
      <div class="progress" id="offProg" hidden><i></i></div>
      <p class="small" id="offStatus" style="margin-top:8px">${LS.get('tg.offlineAt') ? 'נשמר לאחרונה ב־' + esc(new Date(LS.get('tg.offlineAt')).toLocaleString('he-IL')) : 'עוד לא נשמר במכשיר הזה.'}</p></div>
    <div class="sect"><h4>${I('doc')}מצב עריכה</h4>
      <p>${on ? 'מצב עריכה פעיל. כל שינוי נשמר כטיוטה במכשיר הזה בלבד.' : 'לעורך בלבד. מאפשר לשנות נקודות, משימות, מלונות ותקציב.'}</p>
      <button class="btn ${on ? '' : 'dark'}" id="editToggle" style="width:100%;margin-top:12px">${on ? 'סיום עריכה' : 'הפעלת מצב עריכה'}</button>
      ${on ? `<div class="list" style="margin-top:12px;background:var(--bg)">
        ${li('#/map', 'map', 'נקודות במפה', 'הוספה, גרירה, שינוי ומחיקה')}
        ${li('#/edit/tasks', 'ticket', 'משימות', 'סטטוס, מועד, הוספה ומחיקה')}
        ${li('#/edit/hotels', 'bed', 'מלונות', 'שם, מחיר, סטטוס וביטול')}
        ${li('#/edit/budget', 'wallet', 'תקציב', 'סכום לכל קטגוריה')}
        ${li('#/edit/json', 'doc', 'עריכה מתקדמת', 'כל הנתונים כ־JSON')}
      </div>
      <div class="btns"><button class="btn dark" id="expBtn">${I('download')}ייצוא trip.json</button><label class="btn" for="impFile">ייבוא trip.json</label><input type="file" id="impFile" accept="application/json,.json" hidden></div>
      ${hasDraft ? '<button class="btn" id="resetDraft" style="width:100%;margin-top:8px;color:var(--alert)">מחיקת הטיוטה וחזרה לגרסה המפורסמת</button>' : ''}` : ''}
    </div>
    <div class="sect warn"><h4>${I('warn')}חשוב לדעת</h4><ul>
      <li><b>עריכה במכשיר הזה לא מגיעה לצופים</b> עד שמפרסמים גרסה חדשה: מייצאים את trip.json, מחליפים אותו בתיקייה data בריפו, והאתר מתעדכן.</li>
      <li><b>מצב עריכה אינו הרשאת אבטחה.</b> כל מי שיש לו את הקישור רואה את כל התוכן.</li></ul></div></div>`;
  };
  V.more_offline.after = () => {
    $('#saveOff').addEventListener('click', saveOffline);
    $('#editToggle').addEventListener('click', () => {
      const on = !EDIT(); LS.set('tg.editMode', on);
      if (!on) { location.reload(); return; }
      if (LS.get('tg.draft')) D = LS.get('tg.draft');
      toast('מצב עריכה הופעל'); route();
    });
    $('#expBtn')?.addEventListener('click', exportTrip);
    $('#impFile')?.addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { try { const j = JSON.parse(r.result); if (!j.meta || !j.days || !j.points) throw new Error('חסרים meta, days או points'); D = j; saveDraft('הקובץ יובא ונשמר כטיוטה'); route(); } catch (err) { toast('הקובץ לא תקין: ' + err.message); } };
      r.readAsText(f);
    });
    let armed = false;
    $('#resetDraft')?.addEventListener('click', (e) => {
      if (!armed) { armed = true; e.target.textContent = 'ללחוץ שוב כדי למחוק את הטיוטה'; return; }
      try { localStorage.removeItem('tg.draft'); } catch { /* ignore */ }
      location.reload();
    });
  };

  V.more_credits = () => `${pagehead('מקורות', 'קרדיטים', '#/more')}<div class="body" style="padding-top:8px">
    <p class="lead" style="margin-top:0">מפות © OpenStreetMap contributors · Leaflet 1.9.4 · מרחקי נסיעה: ${esc(RT.source || 'OSRM')} · תחזית: Open-Meteo · גופן IBM Plex Sans Hebrew (SIL OFL). התמונות מ־Wikimedia Commons ברישיון חופשי.</p>
    ${Object.entries(CR).map(([pid, list]) => `<div class="sect"><h4>${esc(point(pid)?.name || pid)}</h4>${list.map(c => `<p class="small" style="margin-top:4px">${credit(c)}</p>`).join('')}</div>`).join('')}</div>`;

  /* ---------- edit mode ---------- */
  const field = (id, label, value, type = 'text', attrs = '') => `<label class="fld"><span>${label}</span><input id="${id}" type="${type}" value="${esc(value ?? '')}" ${attrs}></label>`;
  const statusSel = (id, val) => `<select id="${id}">${Object.entries(D.statuses).map(([k, v]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select>`;
  V.edit = (kind, id) => {
    if (!EDIT()) return `${pagehead('עריכה', 'מצב עריכה כבוי', '#/more/offline')}<div class="body"><p class="lead">כדי לערוך, הפעילו מצב עריכה בעמוד ״אופליין ועריכה״.</p></div>`;
    if (kind === 'point') {
      const p = point(id); if (!p) return pagehead('עריכה', 'הנקודה לא נמצאה', '#/map');
      return `${pagehead('עריכת נקודה', p.name, '#/map')}<div class="body" style="padding-top:8px"><div class="sect form">
        ${field('e-name', 'שם בעברית', p.name)}${field('e-nameEn', 'שם באנגלית (לניווט)', p.nameEn)}
        <label class="fld"><span>אזור</span><select id="e-region">${D.regions.map(r => `<option value="${r.id}" ${r.id === p.region ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
        ${field('e-days', 'ימים (YYYY-MM-DD, מופרדים בפסיק)', (p.days || []).join(', '))}
        ${field('e-visit', 'זמן שהייה', p.visit)}${field('e-see', 'מה רואים (שורה אחת)', p.see)}${field('e-summary', 'תיאור', p.summary)}
        <div class="row2">${field('e-lat', 'קו רוחב', p.lat, 'number', 'step="0.00001"')}${field('e-lng', 'קו אורך', p.lng, 'number', 'step="0.00001"')}</div>
        <label class="chk"><input type="checkbox" id="e-optional" ${p.optional ? 'checked' : ''}> אופציה (לא חובה)</label>
        <label class="chk"><input type="checkbox" id="e-suggestion" ${p.suggestion ? 'checked' : ''}> הצעה (לא בתוכנית)</label>
        <div class="btns"><button class="btn dark" id="e-save">שמירה</button><button class="btn" id="e-del" style="color:var(--alert)">מחיקה</button></div></div></div>`;
    }
    if (kind === 'tasks') return `${pagehead('עריכה', 'משימות', '#/more/offline')}<div class="body" style="padding-top:8px">
      <div class="btns" style="margin:0 0 12px"><button class="btn" id="t-add">משימה חדשה</button><button class="btn dark" id="t-save">שמירה</button></div>
      ${D.tasks.map((t, i) => `<div class="sect form">${field('t-title-' + i, 'משימה', t.title)}<div class="row2"><label class="fld"><span>סטטוס</span>${statusSel('t-status-' + i, t.status)}</label>${field('t-due-' + i, 'מועד יעד', t.due || '', 'date')}</div>${field('t-notes-' + i, 'הערה', t.notes)}${field('t-url-' + i, 'קישור', t.url, 'url')}<button class="btn" data-del="${i}" style="color:var(--alert)">מחיקת המשימה</button></div>`).join('')}
      <div class="btns"><button class="btn dark" id="t-save2">שמירה</button></div></div>`;
    if (kind === 'hotels') return `${pagehead('עריכה', 'מלונות', '#/more/offline')}<div class="body" style="padding-top:8px">
      ${D.hotels.map((h, i) => `<div class="sect form"><h4>${esc(h.city)} <span class="small muted num">${dm(h.checkIn)}${h.checkOut ? '–' + dm(h.checkOut) : ''}</span></h4>${field('h-name-' + i, 'שם המלון', h.name)}<div class="row2"><label class="fld"><span>סטטוס</span>${statusSel('h-status-' + i, h.status)}</label>${field('h-price-' + i, 'מחיר לזוג', h.price?.amount ?? '', 'number', 'step="0.01"')}</div><div class="row2">${field('h-cur-' + i, 'מטבע', h.price?.currency || 'USD')}${field('h-cancel-' + i, 'ביטול', h.cancelBy)}</div>${field('h-notes-' + i, 'הערות', h.notes)}</div>`).join('')}
      <div class="btns"><button class="btn dark" id="h-save">שמירה</button></div></div>`;
    if (kind === 'budget') return `${pagehead('עריכה', 'תקציב', '#/more/offline')}<div class="body" style="padding-top:8px">
      ${D.budget.categories.map((c, i) => `<div class="sect form"><h4>${esc(c.label)}</h4><div class="row2">${field('b-amt-' + i, 'תקציב', c.budget?.amount ?? '', 'number', 'step="1"')}${field('b-cur-' + i, 'מטבע', c.budget?.currency || 'ILS')}</div></div>`).join('')}
      <div class="btns"><button class="btn dark" id="b-save">שמירה</button></div></div>`;
    if (kind === 'json') return `${pagehead('עריכה מתקדמת', 'כל הנתונים (JSON)', '#/more/offline')}<div class="body" style="padding-top:8px">
      <p class="lead" style="margin-top:0">עריכה ישירה של trip.json. בשמירה נבדק שהקובץ תקין.</p>
      <textarea id="j-text" style="min-height:60vh;direction:ltr;text-align:left;font-family:ui-monospace,monospace;font-size:12.5px">${esc(JSON.stringify(D, null, 2))}</textarea>
      <div class="btns"><button class="btn dark" id="j-save">שמירה</button></div></div>`;
    return pagehead('עריכה', 'לא נמצא', '#/more/offline');
  };
  V.edit.after = (kind, id) => {
    if (!EDIT()) return;
    const val = (x) => ($('#' + x)?.value || '').trim();
    if (kind === 'point') {
      const p = point(id); if (!p) return;
      $('#e-save').addEventListener('click', () => {
        Object.assign(p, { name: val('e-name') || p.name, nameEn: val('e-nameEn'), region: val('e-region'), visit: val('e-visit'), see: val('e-see'), summary: val('e-summary'),
          days: val('e-days').split(',').map(x => x.trim()).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)), lat: +val('e-lat'), lng: +val('e-lng'), optional: $('#e-optional').checked, suggestion: $('#e-suggestion').checked });
        saveDraft('נשמר');
      });
      let armed = false;
      $('#e-del').addEventListener('click', (e) => {
        if (!armed) { armed = true; e.target.textContent = 'ללחוץ שוב כדי למחוק'; return; }
        D.points = D.points.filter(x => x.id !== id); D.days.forEach(d => { d.points = d.points.filter(x => x !== id); });
        saveDraft('הנקודה נמחקה'); location.hash = '#/map';
      });
    }
    if (kind === 'tasks') {
      const read = () => D.tasks.forEach((t, i) => { t.title = val('t-title-' + i) || t.title; t.status = val('t-status-' + i) || t.status; t.due = val('t-due-' + i) || null; t.notes = val('t-notes-' + i) || undefined; t.url = val('t-url-' + i) || undefined; });
      ['#t-save', '#t-save2'].forEach(b => $(b).addEventListener('click', () => { read(); saveDraft('המשימות נשמרו'); }));
      $('#t-add').addEventListener('click', () => { read(); D.tasks.unshift({ id: 't-' + Date.now().toString(36), title: 'משימה חדשה', category: 'כללי', status: 'toclose' }); saveDraft('נוספה משימה'); route(); });
      view.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { read(); D.tasks.splice(+b.dataset.del, 1); saveDraft('המשימה נמחקה'); route(); }));
    }
    if (kind === 'hotels') $('#h-save').addEventListener('click', () => {
      D.hotels.forEach((h, i) => { h.name = val('h-name-' + i) || h.name; h.status = val('h-status-' + i) || h.status; const a = val('h-price-' + i); h.price = a ? { amount: +a, currency: val('h-cur-' + i) || 'USD' } : null; h.cancelBy = val('h-cancel-' + i) || null; h.notes = val('h-notes-' + i); });
      saveDraft('המלונות נשמרו');
    });
    if (kind === 'budget') $('#b-save').addEventListener('click', () => {
      D.budget.categories.forEach((c, i) => { const a = val('b-amt-' + i); c.budget = a ? { amount: +a, currency: val('b-cur-' + i) || 'ILS' } : null; });
      saveDraft('התקציב נשמר');
    });
    if (kind === 'json') $('#j-save').addEventListener('click', () => {
      try { const j = JSON.parse($('#j-text').value); if (!j.meta || !j.days || !j.points) throw new Error('חסרים meta, days או points'); D = j; saveDraft('נשמר'); }
      catch (e) { toast('הקובץ לא תקין: ' + e.message); }
    });
  };
  function exportTrip() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' }));
    a.download = 'trip.json'; a.click();
    toast('trip.json ירד. מחליפים אותו בתיקייה data בריפו, והאתר מתעדכן.');
  }

  async function saveOffline() {
    const prog = $('#offProg'), bar = prog.firstElementChild, st = $('#offStatus');
    if (!('serviceWorker' in navigator)) { st.textContent = 'הדפדפן לא תומך בשמירה לאופליין.'; return; }
    const reg = await navigator.serviceWorker.ready;
    prog.hidden = false; st.textContent = 'שומר…';
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => {
      const { done: n, total, finished, failed } = e.data;
      bar.style.width = Math.round(100 * n / total) + '%';
      if (finished) {
        if (failed) st.textContent = `נשמרו ${n - failed} מתוך ${total}. כדאי לנסות שוב עם חיבור יציב.`;
        else { LS.set('tg.offlineAt', Date.now()); st.textContent = `הכול נשמר (${total} קבצים). אפשר לעבור למצב טיסה.`; toast('השמירה לאופליין הושלמה'); }
      }
    };
    reg.active.postMessage({ type: 'cache-all', extra: Object.values(CR).flat().map(c => c.file) }, [ch.port2]);
  }

  /* ---------- climate averages (Open-Meteo archive, fetched from the viewer's device, cached) ---------- */
  async function climate(lat, lng, date) {
    const key = `tg.clim.${(+lat).toFixed(1)},${(+lng).toFixed(1)}`;
    let rows = LS.get(key);
    if (!rows) {
      try {
        const j = await (await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${(+lat).toFixed(2)}&longitude=${(+lng).toFixed(2)}&start_date=2016-01-01&end_date=2025-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`)).json();
        if (!j.daily) return null;
        rows = j.daily.time.map((t, i) => [t.slice(5), j.daily.temperature_2m_max[i], j.daily.temperature_2m_min[i], j.daily.precipitation_sum[i]])
          .filter(r => r[0] >= '08-10' && r[0] <= '09-25');
        LS.set(key, rows);
      } catch { return null; }
    }
    const md = date.slice(5), d0 = toDate(date);
    const near = rows.filter(r => { const x = toDate('2027-' + r[0]); return Math.abs(x - d0) <= 3 * 864e5; }).filter(r => r[1] != null);
    if (!near.length) return null;
    const avg = (k) => near.reduce((s, r) => s + r[k], 0) / near.length;
    return { max: avg(1), min: avg(2), rainy: Math.round(100 * near.filter(r => (r[3] || 0) >= 1).length / near.length) };
  }

  /* ---------- day timeline (estimated clock times) ---------- */
  function visitMin(s) {
    if (!s) return null;
    s = s.split('(')[0];
    const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    if (!nums.length) return null;
    // mixed units, e.g. "30 דקות–שעה" or "45 דק׳–1.5 שעות": minutes first, hours second
    if (/דק/.test(s) && /שע/.test(s) && s.search(/דק/) < s.search(/שע/)) return Math.round((nums[0] + (nums[1] ?? 1) * 60) / 2);
    const v = nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
    return /שע/.test(s) ? Math.round(v * 60) : /דק/.test(s) ? Math.round(v) : null;
  }
  const clock = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
  function timeline(d) {
    const rt = RT.days[d.date]; if (!rt || !d.drive || !d.start) return null;
    const [h, mm] = d.start.split(':').map(Number);
    let t = h * 60 + mm; const at = {};
    rt.legs.forEach(l => {
      t += Math.round(l.min * 1.15 / 5) * 5;
      const p = point(l.to);
      if (d.points.includes(l.to) && !['transport', 'lodging'].includes(p.kind)) {
        at[l.to] = t; t += Math.round((visitMin(p.visit) ?? 45) / 5) * 5;
        // stops reached on foot or by boat from here (in the day's list but not driven to), e.g. Spirit Island
        for (let i = d.points.indexOf(l.to) + 1; i < d.points.length && !d.drive.includes(d.points[i]); i++) { const q = point(d.points[i]); if (!q || ['transport', 'lodging'].includes(q.kind)) break; at[q.id] = t; t += Math.round((visitMin(q.visit) ?? 45) / 5) * 5; }
      }
      else at[l.to] = t;
    });
    return { start: h * 60 + mm, at, end: t };
  }

  /* ---------- calendar export (.ics) ---------- */
  function exportICS() {
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const ymd = (iso) => iso.slice(0, 10).replace(/-/g, '');
    const next = (iso) => { const x = toDate(iso.slice(0, 10)); x.setDate(x.getDate() + 1); return `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}`; };
    const escI = (s) => String(s).replace(/[\\,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const alarm = (trig, txt) => `BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:${escI(txt)}\r\nTRIGGER:${trig}\r\nEND:VALARM`;
    const ev = [];
    const add = (uid, lines, alarms) => ev.push(`BEGIN:VEVENT\r\nUID:${uid}@usacanada2027\r\nDTSTAMP:${stamp}\r\n${lines.join('\r\n')}\r\n${alarms.join('\r\n')}\r\nEND:VEVENT`);
    D.tasks.forEach(t => {
      if (t.status === 'done') return;
      if (t.opens) { const [dd, tt] = t.opens.split('T'); add(t.id, [`DTSTART;TZID=Asia/Jerusalem:${ymd(dd)}T${tt.replace(':', '')}00`, 'DURATION:PT30M', `SUMMARY:${escI(t.title)}`, `DESCRIPTION:${escI((t.opensNote || '') + (t.url ? '\n' + t.url : ''))}`], [alarm('-P1D', t.title), alarm('-PT1H', t.title)]); }
      else if (t.due) add(t.id, [`DTSTART;VALUE=DATE:${ymd(t.due)}`, `DTEND;VALUE=DATE:${next(t.due)}`, `SUMMARY:${escI(t.title)}`, `DESCRIPTION:${escI(t.notes || '')}`], [alarm('-P7D', t.title), alarm('-P1D', t.title)]);
    });
    D.hotels.forEach(hh => {
      const m = (hh.cancelBy || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); if (!m) return;
      const iso = `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
      add('cancel-' + hh.id, [`DTSTART;VALUE=DATE:${ymd(iso)}`, `DTEND;VALUE=DATE:${next(iso)}`, `SUMMARY:${escI('ביטול חינם אחרון: ' + hh.name)}`, `DESCRIPTION:${escI(hh.cancelBy)}`], [alarm('-P3D', 'ביטול חינם אחרון: ' + hh.name)]);
    });
    D.flights.filter(f => f.dep).forEach(f => add('flight-' + f.id, [`DTSTART;TZID=${f.fromTz}:${ymd(f.date)}T${f.dep.replace(':', '')}00`, 'DURATION:PT2H', `SUMMARY:${escI(`טיסה ${f.flight} ${f.from}→${f.to}`)}`], [alarm('-PT3H', `טיסה ${f.flight}`)]));
    const c = D.cruise;
    add('cruise-embark', [`DTSTART;TZID=America/Los_Angeles:${ymd(c.embark.date)}T${c.embark.time.replace(':', '')}00`, 'DURATION:PT1H', `SUMMARY:${escI('ההפלגה יוצאת: ' + c.ship)}`, `DESCRIPTION:${escI(c.embark.note || '')}`], [alarm('-P1D', 'מחר הפלגה. להגיע לנמל לפי חלון העלייה'), alarm('-PT7H', 'להגיע לנמל לפי חלון העלייה')]);
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//usacanada2027//he\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:${escI(D.meta.title)}\r\n${ev.join('\r\n')}\r\nEND:VCALENDAR\r\n`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'usa-canada-2027.ics'; a.click();
    toast(`${ev.length} מועדים ירדו כקובץ יומן. פותחים אותו כדי להוסיף ליומן.`);
  }

  /* ---------- packing list ---------- */
  V.more_packing = () => {
    const who = LS.get('tg.packWho', 'a'), cat = LS.get('tg.packCat', '');
    const names = { a: LS.get('tg.packNames', {}).a || LS.get('tg.deviceName', '') || 'אני', b: LS.get('tg.packNames', {}).b || 'בן/בת הזוג', s: 'משותף' };
    const got = packGot(), qty = LS.get('tg.packQty', {});
    const mine = (it) => who === 's' ? it.who === 'shared' : it.who !== 'shared';
    const cats = D.packing.map(c => ({ ...c, list: c.items.map((it, i) => ({ ...it, k: `${who}:${c.id}:${i}` })).filter(mine) })).filter(c => c.list.length);
    const all = cats.flatMap(c => c.list), n = all.filter(x => got[x.k]).length, pct = all.length ? Math.round(100 * n / all.length) : 0;
    const row = (x) => { const q = qty[x.k] ?? x.q; return `<div class="pk ${got[x.k] ? 'done' : ''}"><label class="pk-l"><input type="checkbox" data-pack="${x.k}" ${got[x.k] ? 'checked' : ''}><div class="g"><b>${esc(x.t)}</b>${x.tag ? `<span class="tag ${x.tag}">${x.tag === 'buy' ? 'לקנות שם' : 'תיק יד'}</span>` : ''}${x.n ? `<div>${esc(x.n)}</div>` : ''}</div></label>
      ${q != null ? `<div class="qty" data-q="${x.k}" data-base="${x.q ?? ''}"><button type="button" data-d="-1" aria-label="פחות">−</button><span class="num">${q}</span><button type="button" data-d="1" aria-label="יותר">+</button></div>` : ''}</div>`; };
    return `${pagehead('לפני הטיסה', 'אריזה', '#/more')}<div class="body" style="padding-top:8px">
      <div class="sect pk-sum"><div><b id="packSum" style="font-size:17px">ארזת ${n} מתוך ${all.length}</b><div class="small muted">${esc(D.packingNote || '')} מזוודה עד 23 ק״ג.</div></div><span class="ring" id="packRing" style="background:conic-gradient(var(--blue) 0 ${pct}%, var(--line) 0 100%)"><i class="num">${pct}%</i></span></div>
      <div class="who">${['a', 'b', 's'].map(w => `<button type="button" data-who="${w}" class="${w === who ? 'on' : ''}">${esc(names[w])}</button>`).join('')}</div>
      ${who !== 's' ? `<p class="small muted" style="margin:-4px 2px 10px">רשימה של ${esc(names[who])}. <a href="#" class="link" id="packRename">שינוי שם</a></p>` : ''}
      <div class="seg">${[['', 'הכול'], ...cats.map(c => [c.id, c.label])].map(([id, l]) => `<button type="button" data-cat="${id}" class="${id === cat ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
      ${cats.filter(c => !cat || c.id === cat).map(c => { const g = c.list.filter(x => got[x.k]).length; return `<div class="h2 pk-h"><small>${esc(c.hint || '')}</small><span>${esc(c.label)}</span><em data-cnt="${c.id}">${g} מתוך ${c.list.length}</em></div><div class="sect pk-list">${c.list.map(row).join('')}</div>`; }).join('')}
      <button class="btn" id="packReset" style="width:100%;margin-top:12px">ניקוי הסימונים ברשימה הזאת</button></div>`;
  };
  // old keys were "cat:i" (one shared list) – treat them as the first person's
  function packGot() {
    const m = LS.get('tg.pack', {}) || {};
    Object.keys(m).forEach(k => { if (k.split(':').length === 2) { if (m['a:' + k] == null) m['a:' + k] = m[k]; delete m[k]; } });
    return m;
  }
  V.more_packing.after = () => {
    const who = LS.get('tg.packWho', 'a');
    const sync = () => {
      const got = packGot(); const ks = [...view.querySelectorAll('[data-pack]')].map(x => x.dataset.pack); const n = ks.filter(k => got[k]).length, pct = ks.length ? Math.round(100 * n / ks.length) : 0;
      $('#packSum').textContent = `ארזת ${n} מתוך ${ks.length}`; $('#packRing').style.background = `conic-gradient(var(--blue) 0 ${pct}%, var(--line) 0 100%)`; $('#packRing i').textContent = pct + '%';
      view.querySelectorAll('[data-cnt]').forEach(el => { const cks = [...el.closest('.pk-h').nextElementSibling.querySelectorAll('[data-pack]')].map(x => x.dataset.pack); el.textContent = `${cks.filter(k => got[k]).length} מתוך ${cks.length}`; });
    };
    view.querySelectorAll('[data-pack]').forEach(cb => cb.addEventListener('change', () => { const m = packGot(); m[cb.dataset.pack] = cb.checked; LS.set('tg.pack', m); cb.closest('.pk').classList.toggle('done', cb.checked); sync(); }));
    view.querySelectorAll('.qty button').forEach(b => b.addEventListener('click', () => {
      const box = b.closest('.qty'), k = box.dataset.q, m = LS.get('tg.packQty', {}) || {};
      const v = Math.max(0, (m[k] ?? +box.dataset.base) + +b.dataset.d); m[k] = v; LS.set('tg.packQty', m); box.querySelector('span').textContent = v;
    }));
    view.querySelectorAll('[data-who]').forEach(b => b.addEventListener('click', () => { LS.set('tg.packWho', b.dataset.who); LS.set('tg.packCat', ''); route(); }));
    view.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { LS.set('tg.packCat', b.dataset.cat); route(); }));
    $('#packRename')?.addEventListener('click', (e) => { e.preventDefault(); const nm = LS.get('tg.packNames', {}) || {}; const v = prompt('שם לרשימה', nm[who] || ''); if (v != null) { nm[who] = v.trim(); LS.set('tg.packNames', nm); route(); } });
    let armed = false;
    $('#packReset').addEventListener('click', (e) => { if (!armed) { armed = true; e.target.textContent = 'ללחוץ שוב כדי לנקות'; return; } const m = packGot(); Object.keys(m).forEach(k => { if (k.startsWith(who + ':')) m[k] = false; }); LS.set('tg.pack', m); route(); });
  };

  /* ---------- emergency ---------- */
  V.more_emergency = () => {
    const E = window.__EM;
    if (!E) return `${pagehead('בטיחות', 'מידע לחירום', '#/more')}<div class="body"><p class="lead">המידע לא נטען. נסו לרענן.</p></div>`;
    const my = LS.get('tg.insurance', {});
    return `${pagehead('בטיחות', 'מידע לחירום', '#/more')}<div class="body" style="padding-top:8px">
      <div class="sect warn"><h4>${I('warn')}במצב חירום: 911</h4><p>גם בארה״ב וגם בקנדה מחייגים 911 למשטרה, אמבולנס וכיבוי.</p></div>
      <div class="sect"><h4>${I('doc')}הביטוח שלנו</h4><p class="small muted" style="margin-bottom:8px">נשמר רק במכשיר הזה, לא באתר.</p>
        <label class="fld"><span>חברת ביטוח</span><input id="ins-co" value="${esc(my.co || '')}"></label>
        <label class="fld" style="margin-top:8px"><span>טלפון חירום 24/7</span><input id="ins-ph" inputmode="tel" value="${esc(my.ph || '')}"></label>
        <label class="fld" style="margin-top:8px"><span>מספר פוליסה</span><input id="ins-no" value="${esc(my.no || '')}"></label>
        <button class="btn dark" id="ins-save" style="width:100%;margin-top:10px">שמירה במכשיר</button></div>
      <div class="sect"><h4>${I('link')}מספרים חשובים</h4>${E.numbers.map(x => `<div class="line-item"><span>${esc(x.label)}${x.note ? `<br><span class="tiny">${esc(x.note)}</span>` : ''}</span><span class="v num">${esc(x.value)}</span></div>`).join('')}</div>
      <div class="sect"><h4>${I('pin')}נציגויות ישראל</h4>${E.missions.map(m => `<div class="act"><div><b>${esc(m.name)}</b><div class="d">${esc(m.city)}${m.covers ? ' · ' + esc(m.covers) : ''}${m.phone ? ` · <span class="num">${esc(m.phone)}</span>` : ''}</div>${m.url ? `<a class="src" href="${esc(m.url)}" target="_blank" rel="noopener">אתר רשמי ›</a>` : ''}</div></div>`).join('')}</div>
      <div class="sect"><h4>${I('bed')}בית חולים קרוב לכל לינה</h4>${E.hospitals.map(hh => `<div class="act"><div><b>${esc(hh.area)}: ${esc(hh.name)}</b><div class="d">${esc(hh.note || '')}</div>
        <div style="display:flex;gap:14px"><a class="src" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hh.name)}" target="_blank" rel="noopener">ניווט ›</a>${hh.url ? `<a class="src" href="${esc(hh.url)}" target="_blank" rel="noopener">אתר ›</a>` : ''}</div></div></div>`).join('')}</div>
      <div class="sect"><h4>${I('star')}טיפים</h4><ul>${E.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <p class="est">נבדק ב־${esc(fFull(E.checkedOn))}. כדאי לבדוק שוב לפני הטיסה.</p></div>`;
  };
  V.more_emergency.after = () => $('#ins-save')?.addEventListener('click', () => { LS.set('tg.insurance', { co: $('#ins-co').value, ph: $('#ins-ph').value, no: $('#ins-no').value }); toast('נשמר במכשיר'); });

  /* ---------- food ---------- */
  function foodBlock(regionId) {
    const F = window.__FOOD?.areas?.[regionId]; if (!F?.length) return '';
    return `<div class="h2"><small>איפה אוכלים</small>המלצות באזור</div><div class="list">${F.map(f => `<a class="li" href="${esc(f.url || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(f.query || f.name))}" target="_blank" rel="noopener">
      <span class="ic">${I('star')}</span><div class="g"><b>${esc(f.name)} <span class="small muted" style="font-weight:600">${esc(f.price || '')}</span></b><div class="s">${esc(f.type || '')}${f.near ? ' · ' + esc(f.near) : ''}</div>${f.why ? `<div class="s">${esc(f.why)}</div>` : ''}</div>${I('chev', 'i chev')}</a>`).join('')}</div>
      <p class="est">המלצות כלליות. לבדוק שעות פתיחה לפני שהולכים.</p>`;
  }

  /* ---------- journal photos (IndexedDB, this device only) ---------- */
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('tg-journal', 1); r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function jAll(pid) { try { const db = await idb(); return await new Promise(res => { const out = []; const c = db.transaction('photos').objectStore('photos').openCursor(); c.onsuccess = () => { const x = c.result; if (!x) return res(out); if (!pid || x.value.pid === pid) out.push(x.value); x.continue(); }; c.onerror = () => res(out); }); } catch { return []; } }
  async function jPut(rec) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').put(rec); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
  async function jDel(id) { const db = await idb(); return new Promise(res => { const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').delete(id); tx.oncomplete = res; }); }
  function shrink(file) {
    return new Promise((res, rej) => { const img = new Image(); img.onload = () => { const s = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => b ? res(b) : rej(), 'image/jpeg', .82); URL.revokeObjectURL(img.src); }; img.onerror = rej; img.src = URL.createObjectURL(file); });
  }
  const journalBlock = () => `<div class="sect"><h4>${I('image')}התמונות שלנו</h4><div id="jGrid" class="jgrid"></div>
    <label class="btn" for="jFile" style="width:100%;margin-top:8px">${I('image')}הוספת תמונות</label><input type="file" id="jFile" accept="image/*" multiple hidden>
    <p class="tiny" style="margin-top:6px">התמונות נשמרות רק בטלפון הזה, מוקטנות. הן לא עולות לאתר.</p></div>`;
  async function journalInit(pid) {
    const grid = $('#jGrid'); if (!grid) return;
    const draw = async () => { const list = (await jAll(pid)).sort((a, b) => a.ts - b.ts); grid.innerHTML = list.map(x => `<figure><img src="${URL.createObjectURL(x.blob)}" alt=""><button data-jdel="${x.id}" aria-label="מחיקה">×</button></figure>`).join('') || '<p class="small muted">עוד אין תמונות.</p>';
      grid.querySelectorAll('[data-jdel]').forEach(b => b.addEventListener('click', async () => { await jDel(b.dataset.jdel); draw(); })); };
    $('#jFile').addEventListener('change', async (e) => { for (const f of e.target.files) { try { await jPut({ id: pid + '-' + Date.now() + Math.random().toString(36).slice(2, 6), pid, ts: Date.now(), blob: await shrink(f) }); } catch { toast('לא הצלחתי לשמור תמונה'); } } e.target.value = ''; draw(); toast('נשמר'); });
    draw();
  }

  /* ---------- expenses ---------- */
  V.more_expenses = () => {
    const ex = LS.get('tg.expenses', []), rates = LS.get('tg.rates', { USD: '', CAD: '' });
    const cats = [{ id: 'food', label: 'אוכל' }, { id: 'fuel', label: 'דלק' }, { id: 'parking', label: 'חניה' }, { id: 'attractions', label: 'אטרקציות וכניסות' }, { id: 'shopping', label: 'קניות' }, { id: 'transport', label: 'תחבורה ומוניות' }, { id: 'other', label: 'שונות' }];
    const tot = {}; ex.forEach(e => { tot[e.cur] = (tot[e.cur] || 0) + e.amt; });
    const toILS = (a, c) => c === 'ILS' ? a : (+rates[c] ? a * +rates[c] : null);
    const ils = ex.reduce((s, e) => { const v = toILS(e.amt, e.cur); return v == null || s == null ? null : s + v; }, 0);
    const today = new Date().toISOString().slice(0, 10);
    return `${pagehead('בזמן הטיול', 'הוצאות', '#/more')}<div class="body" style="padding-top:8px">
      <div class="tot"><div><b>סה״כ</b>${Object.keys(tot).length ? Object.entries(tot).map(([c, a]) => money(a, c)).join('<br>') : '<span class="muted">—</span>'}</div><div><b>בשקלים</b>${ex.length ? (ils == null ? '<span class="tiny">להזין שערים</span>' : money(ils, 'ILS')) : '<span class="muted">—</span>'}</div><div><b>רשומות</b><span class="num">${ex.length}</span></div></div>
      <div class="sect form"><h4>${I('wallet')}הוצאה חדשה</h4>
        <div class="row2"><label class="fld"><span>סכום</span><input id="x-amt" type="number" step="0.01" inputmode="decimal"></label><label class="fld"><span>מטבע</span><select id="x-cur"><option>USD</option><option>CAD</option><option>ILS</option></select></label></div>
        <div class="row2"><label class="fld"><span>קטגוריה</span><select id="x-cat">${cats.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join('')}</select></label><label class="fld"><span>תאריך</span><input id="x-date" type="date" value="${today}"></label></div>
        <label class="fld"><span>הערה</span><input id="x-note" placeholder="למשל: ארוחת ערב בבאנף"></label>
        <button class="btn dark" id="x-add">הוספה</button></div>
      <div class="sect form"><h4>${I('wallet')}שערי המרה לשקל</h4><p class="small muted">מזינים ידנית. האתר לא מושך שערים.</p>
        <div class="row2"><label class="fld"><span>1 USD =</span><input id="r-USD" type="number" step="0.001" value="${esc(rates.USD)}"></label><label class="fld"><span>1 CAD =</span><input id="r-CAD" type="number" step="0.001" value="${esc(rates.CAD)}"></label></div>
        <button class="btn" id="r-save">שמירת שערים</button></div>
      ${cats.map(c => { const list = ex.filter(e => e.cat === c.id); if (!list.length) return ''; const sum = list.reduce((s, e) => { const v = toILS(e.amt, e.cur); return v == null || s == null ? null : s + v; }, 0); return `<div class="sect"><h4 style="justify-content:space-between"><span>${esc(c.label)}</span><span class="small muted" style="font-weight:600">${sum != null ? money(sum, 'ILS') : ''}</span></h4>
        ${list.slice().reverse().map(e => `<div class="line-item"><span>${esc(e.note || '—')}<br><span class="tiny">${esc(fFull(e.date))}</span></span><span class="v">${money(e.amt, e.cur)} <button class="link" data-xdel="${e.id}" aria-label="מחיקה" style="color:var(--alert)">×</button></span></div>`).join('')}</div>`; }).join('')}
      ${ex.length ? '<button class="btn" id="x-csv" style="width:100%">ייצוא ל־CSV</button>' : ''}
      <p class="tiny" style="margin-top:8px">ההוצאות נשמרות רק במכשיר הזה.</p></div>`;
  };
  V.more_expenses.after = () => {
    $('#x-add').addEventListener('click', () => {
      const amt = parseFloat($('#x-amt').value); if (!(amt > 0)) { toast('צריך להזין סכום'); return; }
      const ex = LS.get('tg.expenses', []); ex.push({ id: Date.now().toString(36), amt, cur: $('#x-cur').value, cat: $('#x-cat').value, date: $('#x-date').value, note: $('#x-note').value.trim() });
      LS.set('tg.expenses', ex); toast('נוסף'); route();
    });
    $('#r-save').addEventListener('click', () => { LS.set('tg.rates', { USD: $('#r-USD').value, CAD: $('#r-CAD').value }); toast('השערים נשמרו'); route(); });
    view.querySelectorAll('[data-xdel]').forEach(b => b.addEventListener('click', () => { LS.set('tg.expenses', LS.get('tg.expenses', []).filter(e => e.id !== b.dataset.xdel)); route(); }));
    $('#x-csv')?.addEventListener('click', () => {
      const rows = [['date', 'category', 'amount', 'currency', 'note'], ...LS.get('tg.expenses', []).map(e => [e.date, e.cat, e.amt, e.cur, (e.note || '').replace(/"/g, '""')])];
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(x => `"${x}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'expenses-2027.csv'; a.click();
    });
  };


  /* ---------- sync between devices (no server, no keys): share a link that merges on the other phone ---------- */
  const SYNC_MAPS = ['tg.done', 'tg.visited', 'tg.notes', 'tg.pack', 'tg.packQty', 'tg.attrDec'];
  const SYNC_OBJ = ['tg.insurance', 'tg.rates', 'tg.packNames'];
  const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  async function pack(obj) {
    const raw = new TextEncoder().encode(JSON.stringify(obj));
    if (typeof CompressionStream === 'undefined') return 'r' + b64u(raw);
    const gz = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    let s = ''; for (let i = 0; i < gz.length; i += 8192) s += String.fromCharCode(...gz.subarray(i, i + 8192));
    return 'g' + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function unpack(code) {
    const bytes = unb64u(code.slice(1));
    const txt = code[0] === 'g' ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text() : new TextDecoder().decode(bytes);
    return JSON.parse(txt);
  }
  function syncSnapshot() {
    const data = {}; SYNC_MAPS.concat(SYNC_OBJ, ['tg.expenses']).forEach(k => { data[k] = LS.get(k, null); });
    return { v: 1, t: Date.now(), name: LS.get('tg.deviceName', ''), data, ts: LS.get('tg.ts', {}), del: LS.get('tg.expDel', []) };
  }
  function mergeSync(inc) {
    const ts = LS.get('tg.ts', {}), its = inc.ts || {}; let changed = 0;
    SYNC_MAPS.forEach(k => {
      const mine = LS.get(k, {}) || {}, theirs = inc.data[k] || {};
      Object.keys(theirs).forEach(id => { const key = k + ':' + id; if ((its[key] || 0) > (ts[key] || 0) || (!(key in ts) && !(id in mine))) { if (mine[id] !== theirs[id]) changed++; mine[id] = theirs[id]; ts[key] = its[key] || inc.t; } });
      localStorage.setItem(k, JSON.stringify(mine));
    });
    SYNC_OBJ.forEach(k => { if (inc.data[k] && (its[k] || 0) > (ts[k] || 0)) { localStorage.setItem(k, JSON.stringify(inc.data[k])); ts[k] = its[k]; changed++; } });
    const del = new Set([...(LS.get('tg.expDel', []) || []), ...(inc.del || [])]);
    const byId = {}; [...(LS.get('tg.expenses', []) || []), ...(inc.data['tg.expenses'] || [])].forEach(e => { if (!del.has(e.id)) { if (!byId[e.id]) changed += (LS.get('tg.expenses', []) || []).some(x => x.id === e.id) ? 0 : 1; byId[e.id] = e; } });
    localStorage.setItem('tg.expenses', JSON.stringify(Object.values(byId).sort((a, b) => a.id < b.id ? -1 : 1)));
    localStorage.setItem('tg.expDel', JSON.stringify([...del]));
    localStorage.setItem('tg.ts', JSON.stringify(ts));
    return changed;
  }
  // stamp every change so merges keep the newest value
  const _set = LS.set;
  LS.set = (k, v) => {
    try {
      const ts = LS.get('tg.ts', {}), now = Date.now();
      if (SYNC_MAPS.includes(k)) { const old = LS.get(k, {}) || {}; new Set([...Object.keys(old), ...Object.keys(v || {})]).forEach(id => { if (old[id] !== (v || {})[id]) ts[k + ':' + id] = now; }); localStorage.setItem('tg.ts', JSON.stringify(ts)); }
      else if (SYNC_OBJ.includes(k)) { ts[k] = now; localStorage.setItem('tg.ts', JSON.stringify(ts)); }
      else if (k === 'tg.expenses') { const ids = new Set((v || []).map(e => e.id)); const gone = (LS.get('tg.expenses', []) || []).filter(e => !ids.has(e.id)).map(e => e.id); if (gone.length) localStorage.setItem('tg.expDel', JSON.stringify([...(LS.get('tg.expDel', []) || []), ...gone])); }
    } catch { /* ignore */ }
    _set(k, v);
  };

  V.more_sync = () => `${pagehead('ביחד', 'סנכרון עם בן/בת הזוג', '#/more')}<div class="body" style="padding-top:8px">
    <div class="sect"><h4>${I('link')}איך זה עובד</h4><ul>
      <li>לוחצים ״שליחת העדכונים שלי״ ושולחים את הקישור בוואטסאפ.</li>
      <li>בצד השני פותחים את הקישור, והאתר ממזג את העדכונים. אם שניכם שיניתם את אותו דבר, נשמר השינוי האחרון.</li>
      <li>אחר כך שולחים חזרה באותה דרך, כדי ששני הטלפונים יהיו זהים.</li></ul>
      <p class="small muted" style="margin-top:8px">מה עובר: משימות שבוצעו, ״ביקרנו״, הערות, רשימת אריזה, הוצאות, שערי המרה ופרטי הביטוח. תמונות לא עוברות כי הן גדולות מדי לקישור.</p></div>
    <div class="sect form"><label class="fld"><span>השם שלי (יופיע אצל השני)</span><input id="s-name" value="${esc(LS.get('tg.deviceName', ''))}" placeholder="למשל: עמרי"></label>
      <button class="btn dark" id="s-share">${I('link')}שליחת העדכונים שלי</button>
      <button class="btn" id="s-copy">העתקת הקישור</button>
      <p class="small" id="s-status"></p></div>
    <div class="sect warn"><h4>${I('warn')}למה לא סנכרון אוטומטי?</h4><p>סנכרון אוטומטי בזמן אמת דורש שרת עם מפתח גישה, ולפי המדיניות אסור לשמור מפתחות באתר. הקישור עובד גם בלי אינטרנט קבוע, והמידע עובר רק דרך הוואטסאפ שלכם.</p></div></div>`;
  V.more_sync.after = () => {
    const make = async () => { LS.set('tg.deviceName', $('#s-name').value.trim()); const code = await pack(syncSnapshot()); return `${location.origin}${location.pathname}#/sync/${code}`; };
    $('#s-share').addEventListener('click', async () => {
      const url = await make();
      if (navigator.share) { try { await navigator.share({ title: 'עדכונים לטיול', text: 'עדכונים מהמדריך שלנו. לפתוח כדי למזג:', url }); return; } catch { /* cancelled */ } }
      try { await navigator.clipboard.writeText(url); $('#s-status').textContent = 'הקישור הועתק. אפשר להדביק בוואטסאפ.'; } catch { $('#s-status').textContent = url; }
    });
    $('#s-copy').addEventListener('click', async () => { const url = await make(); try { await navigator.clipboard.writeText(url); $('#s-status').textContent = `הקישור הועתק (${url.length} תווים).`; } catch { $('#s-status').textContent = url; } });
  };
  V.sync = (code) => {
    queueMicrotask(async () => {
      try {
        const inc = await unpack(code);
        if (inc.v !== 1) throw new Error('גרסה לא מוכרת');
        const n = mergeSync(inc);
        history.replaceState(null, '', location.pathname + '#/journey');
        route(); toast(n ? `מוזגו ${n} עדכונים${inc.name ? ' מ־' + inc.name : ''}` : 'הכול כבר מעודכן');
      } catch (e) { view.innerHTML = `${pagehead('סנכרון', 'הקישור לא תקין')}<div class="body"><p class="lead">לא הצלחתי לקרוא את העדכונים. בקשו קישור חדש.</p></div>`; }
    });
    return `${pagehead('סנכרון', 'ממזג עדכונים…')}`;
  };


  /* ---------- router ---------- */
  function route() {
    const [, name = 'journey', a] = (location.hash || '#/journey').split('/');
    const v = V[name] || V.journey;
    maps.forEach(m => m.remove()); maps = [];
    const b = (location.hash || '').split('/')[3];
    view.innerHTML = (EDIT() ? `<div class="editbar"><span>מצב עריכה · השינויים נשמרים רק במכשיר הזה</span><a href="#/more/offline">ייצוא וסיום</a></div>` : '') + v(a, b);
    const after = name === 'more' && a ? V['more_' + a]?.after : v.after;
    if (after) after(a, b);
    const tab = { region: 'journey', point: 'journey', day: 'today', edit: 'more', sync: 'journey' }[name] || (V[name] ? name : 'journey');
    document.querySelectorAll('#tabs a').forEach(t => { const on = t.dataset.tab === tab; t.classList.toggle('on', on); if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
  }

  async function boot() {
    const net = () => { $('#netBadge').hidden = navigator.onLine; };
    net(); addEventListener('online', net); addEventListener('offline', net);
    try {
      const get = (u) => fetch(u).then(r => r.ok ? r.json() : {}).catch(() => ({}));
      const [trip, credits, routes, em, food] = await Promise.all([fetch('data/trip.json').then(r => r.json()), get('data/credits.json'), get('data/routes.json'), get('data/emergency.json'), get('data/food.json')]);
      window.__EM = em.numbers ? em : null; window.__FOOD = food.areas ? food : null;
      D = (EDIT() && LS.get('tg.draft')) || trip; CR = credits.points || {}; RT = routes.days ? routes : { days: {} };
    } catch { view.innerHTML = '<div class="body"><div class="notice">לא הצלחתי לטעון את נתוני הטיול. נסו לרענן כשיש חיבור.</div></div>'; return; }
    addEventListener('hashchange', route);
    route();
    if ('serviceWorker' in navigator) {
      const hadSW = !!navigator.serviceWorker.controller; let reloaded = false;
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
      // a new version took over: reload once so the screen shows it
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSW && !reloaded) { reloaded = true; location.reload(); } });
    }
  }
  boot();
})();
