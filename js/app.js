/* יומן מסע 2027 – static PWA, no build step. */
(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const view = $('#view');
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
  };

  let D = null;           // trip data
  let mapInstance = null;

  /* ---------- formatting ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toDate = (iso) => { if (!iso) return null; const [d, t] = iso.split('T'); const [y, m, dd] = d.split('-').map(Number); const [hh, mm] = (t || '00:00').split(':').map(Number); return new Date(y, m - 1, dd, hh, mm); };
  const fmt = (iso, opts) => iso ? new Intl.DateTimeFormat('he-IL', opts).format(toDate(iso)) : 'טרם נקבע';
  const fmtDay = (iso) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'numeric' });
  const fmtLong = (iso) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtShort = (iso) => fmt(iso, { day: 'numeric', month: 'numeric', year: '2-digit' });
  const money = (m) => {
    if (!m || m.amount == null) return '<span class="muted">טרם נקבע</span>';
    const s = new Intl.NumberFormat('he-IL', { style: 'currency', currency: m.currency, maximumFractionDigits: 2 }).format(m.amount);
    return `<span class="ltr num">${esc(s)}</span>`;
  };
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const daysBetween = (a, b) => Math.round((b - a) / 86400000);
  const statusChip = (key) => { const s = D.statuses[key]; return s ? `<span class="chip" style="background:${s.color}">${esc(s.label)}</span>` : ''; };
  const EST = '<span class="estimate-flag" title="הערכה ולא עובדה בדוקה">הערכה – לאמת לפני הטיול</span>';
  const region = (id) => D.regions.find(r => r.id === id);
  const point = (id) => D.points.find(p => p.id === id);
  const navLinks = (p) => {
    const q = encodeURIComponent(p.nameEn || p.name);
    return {
      google: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`,
      apple: `https://maps.apple.com/?ll=${p.lat},${p.lng}&q=${q}`
    };
  };

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); }

  /* ---------- per-viewer state (this device only) ---------- */
  const visited = () => LS.get('tg.visited', {});
  const notes = () => LS.get('tg.notes', {});
  const doneMap = () => LS.get('tg.done', {});

  /* ---------- weather (Open-Meteo, no key) ---------- */
  const WMO = (c) => c == null ? ['·', ''] : c === 0 ? ['☀️', 'בהיר'] : c <= 2 ? ['🌤️', 'מעונן חלקית'] : c === 3 ? ['☁️', 'מעונן'] : c <= 48 ? ['🌫️', 'ערפל'] : c <= 57 ? ['🌦️', 'טפטוף'] : c <= 67 ? ['🌧️', 'גשם'] : c <= 77 ? ['🌨️', 'שלג'] : c <= 82 ? ['🌧️', 'ממטרים'] : c <= 86 ? ['🌨️', 'ממטרי שלג'] : ['⛈️', 'סופות רעמים'];
  async function forecast(lat, lng, date) {
    const diff = daysBetween(today(), toDate(date));
    if (diff < 0 || diff > 15) return { pending: true, from: new Date(toDate(date).getTime() - 15 * 86400000) };
    const key = `tg.wx.${lat},${lng},${date}`;
    const cached = LS.get(key);
    if (cached && Date.now() - cached.t < 3 * 3600e3) return cached.v;
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${date}&end_date=${date}`;
      const r = await fetch(u); const j = await r.json();
      const v = { code: j.daily.weather_code[0], max: j.daily.temperature_2m_max[0], min: j.daily.temperature_2m_min[0], pop: j.daily.precipitation_probability_max[0] };
      LS.set(key, { t: Date.now(), v }); return v;
    } catch { return cached ? { ...cached.v, stale: true } : { error: true }; }
  }
  function wxSlot(lat, lng, date) {
    const id = 'wx' + Math.random().toString(36).slice(2);
    queueMicrotask(async () => {
      const el = document.getElementById(id); if (!el) return;
      const w = await forecast(lat, lng, date);
      if (w.pending) el.innerHTML = `<span class="ico">🗓️</span><span class="small muted">תחזית אמיתית (Open-Meteo) תופיע כאן החל מ־${esc(new Intl.DateTimeFormat('he-IL').format(w.from))}. עד אז – ראו ביגוד משוער.</span>`;
      else if (w.error) el.innerHTML = `<span class="ico">📡</span><span class="small muted">אין חיבור – התחזית תתעדכן כשתהיה קליטה.</span>`;
      else { const [ic, lbl] = WMO(w.code); el.innerHTML = `<span class="ico">${ic}</span><span><b class="num">${Math.round(w.min)}°–${Math.round(w.max)}°</b> · ${lbl} · סיכוי משקעים ${w.pop ?? '–'}%${w.stale ? ' <span class="tiny">(שמור)</span>' : ''}<br><span class="tiny">תחזית Open-Meteo</span></span>`; }
    });
    return `<div class="wx" id="${id}"><span class="ico">⏳</span><span class="small muted">טוען תחזית…</span></div>`;
  }

  /* ---------- views ---------- */
  const VIEWS = {};

  VIEWS.overview = () => {
    const start = toDate(D.meta.start + 'T01:05');
    const left = daysBetween(today(), toDate(D.meta.start));
    const now = new Date();
    const upcoming = D.milestones.filter(m => toDate(m.date) >= now).sort((a, b) => toDate(a.date) - toDate(b.date));
    const next = upcoming[0];
    const done = doneMap();
    const toClose = D.tasks.filter(t => t.status === 'toclose' && !done[t.id])
      .sort((a, b) => (a.due ? toDate(a.due) : 9e15) - (b.due ? toDate(b.due) : 9e15));
    const entryOpen = D.entry.items.filter(i => i.status !== 'done' && !done[i.id]).length;
    const booked = [
      ...D.flights.filter(f => f.status === 'booked').map(f => `טיסה ${f.flight} · ${f.from}→${f.to} · ${fmtDay(f.date)}`),
      `קרוז ${D.cruise.ship} · ${D.cruise.nights} לילות · מ־${fmtDay(D.cruise.embark.date)}`
    ];
    // cost summary by status, per currency (no conversion – rates would be invented)
    const byStatus = {};
    D.costs.forEach(c => { (byStatus[c.status] ??= {}); byStatus[c.status][c.currency] = (byStatus[c.status][c.currency] || 0) + c.amount; });

    return `
      <section class="hero">
        <div class="count num">${left > 0 ? left : 0}<small>ימים לטיסה</small></div>
        <p>${esc(fmtLong(D.meta.start))} – ${esc(fmtLong(D.meta.end))}</p>
        <div class="route">סן פרנסיסקו · סיאטל · אלסקה · ויקטוריה · באנף · ג׳ספר · לוס אנג׳לס</div>
      </section>

      ${next ? `<section class="card">
        <h2>📌 התאריך החשוב הבא</h2>
        <div class="next-date">
          <div class="datebox"><b class="num">${toDate(next.date).getDate()}</b><span>${esc(fmt(next.date, { month: 'short' }))}</span></div>
          <div><div class="title"><b>${esc(next.label)}</b></div>
          <div class="small muted">בעוד ${daysBetween(today(), toDate(next.date.split('T')[0]))} ימים · ${esc(fmtLong(next.date.split('T')[0]))}</div></div>
        </div>
      </section>` : ''}

      <section class="card">
        <h2>⚠️ מה צריך לסגור עכשיו</h2>
        <ul class="rows">
          ${toClose.slice(0, 6).map(t => `<li><div class="grow"><div class="title">${esc(t.title)}</div>
            <div class="small muted">${t.due ? 'עד ' + esc(fmtShort(t.due)) : 'ללא מועד יעד'}${t.opensNote ? ' · ' + esc(t.opensNote) : ''}</div></div>${statusChip(t.status)}</li>`).join('')}
        </ul>
        <div class="btn-row" style="margin-top:10px">
          <a class="btn" href="#/tasks">כל המשימות (${toClose.length})</a>
          <a class="btn" href="#/tasks/entry">כניסה ומסמכים (${entryOpen})</a>
        </div>
      </section>

      <section class="card">
        <h2>✅ מה הוזמן</h2>
        <ul class="rows">${booked.map(b => `<li><div class="grow">${esc(b)}</div>${statusChip('booked')}</li>`).join('')}</ul>
      </section>

      <section class="card">
        <h2>🗓️ ציר מועדים</h2>
        <ol class="timeline">
          ${D.milestones.slice().sort((a, b) => toDate(a.date) - toDate(b.date)).map(m => {
            const dt = toDate(m.date); const past = dt < now; const urgent = !past && daysBetween(today(), dt) < 60;
            return `<li class="${past ? 'past' : ''} ${urgent ? 'urgent' : ''}"><div class="when">${esc(fmtLong(m.date.split('T')[0]))}</div><div>${esc(m.label)}</div></li>`;
          }).join('')}
        </ol>
      </section>

      <section class="card">
        <h2>💰 עלויות לפי סטטוס</h2>
        <div class="cost-grid">
          ${Object.entries(byStatus).map(([st, cur]) => `<div class="cost-tile" style="border-color:${D.statuses[st].color}">
            <div class="lbl">${esc(D.statuses[st].label)}</div>
            ${Object.entries(cur).map(([c, a]) => `<div class="val">${money({ amount: a, currency: c })}</div>`).join('')}
          </div>`).join('')}
        </div>
        <ul class="rows" style="margin-top:10px">
          ${D.costs.map(c => `<li><div class="grow"><div>${esc(c.label)}</div>${c.note ? `<div class="tiny">${esc(c.note)}</div>` : ''}</div><div style="text-align:left">${c.approx ? '~' : ''}${money(c)}<br>${statusChip(c.status)}</div></li>`).join('')}
        </ul>
        <p class="tiny">הסכומים מוצגים במטבע המקורי, בלי המרה. מחירי המלונות ״אופציה״ נבדקו בעבר ואינם מובטחים.</p>
      </section>

      <section class="card">
        <h2>📶 אופליין</h2>
        <p class="small muted">כדאי לשמור לפני הטיסה, כשיש Wi-Fi.</p>
        <a class="btn primary block" href="#/more">שמור הכול לאופליין</a>
      </section>`;
  };

  VIEWS.itinerary = () => {
    const vis = visited();
    return `<p class="small muted" style="margin:0 4px 12px">ימי מעבר מסומנים ברקע מפוספס. ימים בקו מקווקו עדיין לא תוכננו.</p>` +
      D.days.map(d => dayCard(d, vis)).join('');
  };

  function dayCard(d, vis) {
    const r = region(d.region) || {};
    const lodging = D.hotels.find(h => h.id === d.lodging);
    const pts = d.points.map(point).filter(Boolean);
    const anchor = pts.find(p => p.kind !== 'transport') || pts[0];
    const typeLbl = { transit: 'יום מעבר', explore: 'יום טיול', cruise: 'קרוז', tbd: 'טרם נקבע' }[d.type] || '';
    const clothing = r.clothing;
    return `<article class="card day ${d.type}" style="--region:${r.color || '#999'}" id="d-${d.date}">
      <div class="day-head">
        <div><div class="day-date">${esc(fmtDay(d.date))}${r.name ? ' · ' + esc(r.name) : ''}</div><h3>${esc(d.title)}</h3></div>
        <span class="chip outline">${typeLbl}</span>
      </div>
      ${d.summary ? `<p class="small" style="margin:4px 0 0">${esc(d.summary)}</p>` : ''}
      ${d.notes ? `<div class="notice">${esc(d.notes)}</div>` : ''}
      ${pts.length ? `<div class="point-pills">${pts.map(p => `<a href="#/point/${p.id}" class="${p.optional ? 'optional' : ''} ${p.guide ? 'has-guide' : ''}">${vis[p.id] ? '✓ ' : ''}${esc(p.name)}${p.optional ? ' · אופציה' : ''}</a>`).join('')}</div>` : ''}
      <dl class="kv">
        <dt>לינה</dt><dd>${lodging ? `${esc(lodging.name)} ${statusChip(lodging.status)}` : '<span class="muted">טרם נקבע</span>'}</dd>
        ${d.estTime ? `<dt>זמן משוער</dt><dd>${esc(d.estTime)}</dd>` : ''}
        ${d.weatherAlt ? `<dt>חלופה</dt><dd>${esc(d.weatherAlt)}</dd>` : ''}
      </dl>
      ${d.type !== 'tbd' || anchor ? `<details class="more"><summary>ביגוד, ״לקחת היום״ ותחזית ›</summary>
        ${clothing ? `<h4 style="margin:10px 0 4px">ביגוד ${EST}</h4><p class="small" style="margin:0">${esc(clothing.summary)}</p>` : ''}
        ${(d.bring || clothing?.bring) ? `<h4 style="margin:10px 0 4px">לקחת היום</h4><div class="chips">${[...(d.bring || []), ...(clothing?.bring || [])].map(b => `<span class="chip outline">${esc(b)}</span>`).join('')}</div>` : ''}
        ${anchor ? wxSlot(anchor.lat, anchor.lng, d.date) : ''}
      </details>` : ''}
    </article>`;
  }

  VIEWS.point = (id) => {
    const p = point(id);
    if (!p) return `<div class="card">הנקודה לא נמצאה.</div>`;
    const r = region(p.region) || {};
    const g = p.guide;
    const nav = navLinks(p);
    const vis = visited(); const nt = notes();
    const credits = (window.__credits || {})[p.id] || [];
    const days = (p.days || []).map(fmtDay).join(', ');
    setTitle(p.name, `${r.name || ''} · ${days}`);

    const gallery = credits.length
      ? credits.map(c => `<figure><img src="${esc(c.file)}" alt="${esc(p.name)}" loading="lazy"><figcaption>${esc(c.author)} · ${esc(c.license)}</figcaption></figure>`).join('')
      : [1, 2, 3].map(i => `<figure><div class="ph"><div>${mountainSvg(i)}<div style="margin-top:8px">תמונה ${i} – תגיע משלב 2 (Wikimedia Commons)</div></div></div></figure>`).join('');
    const count = credits.length || 3;

    return `
      <article class="card">
        <div class="gallery" id="gal">${gallery}</div>
        <div class="dots" id="dots">${Array.from({ length: count }, (_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
        <div class="point-head">
          <div><h2>${esc(p.name)}</h2><div class="en">${esc(p.nameEn || '')}</div></div>
          ${p.optional ? '<span class="chip opt">אופציה</span>' : ''}
        </div>
        <div class="chips" style="margin-top:8px">
          <span class="chip" style="background:${r.color}">${esc(r.name || '')}</span>
          <span class="chip outline">${esc(days)}</span>
          <span class="chip outline">${esc(r.tzLabel || '')}</span>
        </div>
        ${p.summary ? `<p style="margin:12px 0 0">${esc(p.summary)}</p>` : ''}
        <div class="btn-row" style="margin-top:12px">
          <a class="btn primary" href="${nav.google}" target="_blank" rel="noopener">ניווט · Google</a>
          <a class="btn" href="${nav.apple}" target="_blank" rel="noopener">ניווט · Apple</a>
        </div>
        ${p.approx ? '<p class="tiny" style="margin-top:6px">הקואורדינטות משוערות. לפני ניווט כדאי לחפש לפי השם באנגלית.</p>' : ''}
      </article>

      ${g ? `
      ${g.verified ? '' : `<div class="notice info">תוכן המדריך (משך, ביגוד, מה מצפה) הוא <b>הערכה</b>. לבדוק מול הקישורים הרשמיים לפני הטיול.</div>`}

      <section class="card">
        <h2>🥾 מה עושים שם</h2>
        ${g.activities.map(a => `<div class="activity"><span class="chip ${a.required ? 'req' : 'opt'}">${a.required ? 'חובה' : 'אופציה'}</span><div><b>${esc(a.name)}</b><div class="small muted">${esc(a.note)}</div></div></div>`).join('')}
      </section>

      <section class="card">
        <h2>⏱️ משך זמן ${EST}</h2>
        <dl class="kv"><dt>מינימום</dt><dd>${esc(g.duration.min)}</dd><dt>מומלץ</dt><dd>${esc(g.duration.recommended)}</dd></dl>
        ${g.duration.trails?.length ? `<table class="trail-table"><thead><tr><th>שביל</th><th>אורך</th><th>עלייה</th></tr></thead><tbody>
          ${g.duration.trails.map(t => `<tr><td>${esc(t.name)}</td><td>${esc(t.length)}</td><td>${esc(t.gain)}</td></tr>`).join('')}</tbody></table>` : ''}
      </section>

      <section class="card">
        <h2>🧥 ביגוד וציוד ${EST}</h2>
        <ul class="clean">${g.clothing.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
        ${(p.days || [])[0] ? wxSlot(p.lat, p.lng, p.days[0]) : ''}
      </section>

      <section class="card">
        <h2>👀 מה מצפה לנו ${EST}</h2>
        <div class="expect">
          ${[['👥', 'עומס', g.expect.crowds], ['🅿️', 'חניה והגעה', g.expect.parking], ['🚻', 'שירותים', g.expect.toilets], ['📶', 'קליטה', g.expect.signal], ['🐻', 'בטיחות', g.expect.safety], ['💡', 'טיפים', g.expect.tips]]
            .filter(x => x[2]).map(([ic, t, v]) => `<div class="item"><div class="ic">${ic}</div><div><b>${t}</b><span class="small">${esc(v)}</span></div></div>`).join('')}
        </div>
      </section>

      <section class="card">
        <h2>🌧️ חלופה למזג אוויר</h2>
        <p class="small" style="margin:0">${esc(g.weatherAlt)}</p>
      </section>

      <section class="card">
        <h2>🔗 קישורים רשמיים</h2>
        <ul class="rows">${g.links.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`).join('')}</ul>
      </section>` : `<div class="card"><p class="muted" style="margin:0">דף המדריך המלא לנקודה הזו ייבנה בשלב 3.</p></div>`}

      <section class="card">
        <label class="visited"><input type="checkbox" id="visitedBox" ${vis[p.id] ? 'checked' : ''}> ביקרנו ✓</label>
        <h3>הערה אישית</h3>
        <textarea id="noteBox" placeholder="מה היה, מה כדאי לזכור…">${esc(nt[p.id] || '')}</textarea>
        <p class="tiny">הסימון וההערה נשמרים רק במכשיר הזה.</p>
      </section>`;
  };
  VIEWS.point.after = (id) => {
    const gal = $('#gal'), dots = $('#dots');
    if (gal && dots) gal.addEventListener('scroll', () => {
      const i = Math.round(Math.abs(gal.scrollLeft) / gal.clientWidth);
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    }, { passive: true });
    $('#visitedBox')?.addEventListener('change', e => { const v = visited(); v[id] = e.target.checked; LS.set('tg.visited', v); toast(e.target.checked ? 'סומן כ״ביקרנו״' : 'הסימון בוטל'); });
    $('#noteBox')?.addEventListener('input', e => { const n = notes(); n[id] = e.target.value; LS.set('tg.notes', n); });
  };

  function mountainSvg(i) {
    const peaks = ['M0 90 L40 40 L60 60 L95 15 L130 55 L150 35 L200 90Z', 'M0 90 L30 55 L70 20 L100 50 L120 35 L160 70 L200 30 L200 90Z', 'M0 90 L50 30 L80 55 L110 25 L150 60 L200 45 L200 90Z'][(i - 1) % 3];
    return `<svg viewBox="0 0 200 100" aria-hidden="true"><path d="${peaks}" fill="rgba(255,255,255,.25)"/><path d="M0 92 Q100 80 200 92 L200 100 L0 100Z" fill="rgba(160,230,230,.5)"/></svg>`;
  }

  VIEWS.map = () => {
    const days = [...new Set(D.points.flatMap(p => p.days || []))].sort();
    return `<div class="map-bar">
        <select id="dayFilter" aria-label="סינון לפי יום"><option value="">כל הימים</option>${days.map(d => `<option value="${d}">${esc(fmtDay(d))}</option>`).join('')}</select>
        <button class="btn" id="listToggle">רשימה</button>
      </div>
      <div id="map"></div>
      <div id="mapList" hidden style="padding:12px 16px"></div>
      <div class="legend">${D.regions.map(r => `<span><i style="background:${r.color}"></i>${esc(r.name)}</span>`).join('')}</div>`;
  };
  VIEWS.map.after = () => {
    const sel = $('#dayFilter'), listEl = $('#mapList'), mapEl = $('#map');
    const renderList = (pts) => {
      listEl.innerHTML = `<div class="notice info">אין מפה? הנה כל הנקודות עם קואורדינטות. כפתור הניווט יעבוד במפות אופליין שהורדו מראש.</div>
        <ul class="rows card">${pts.map(p => { const n = navLinks(p); return `<li><div class="grow"><a class="rowlink title" href="#/point/${p.id}">${esc(p.name)}</a>
          <div class="tiny ltr">${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}${p.approx ? ' (approx.)' : ''}</div></div><a class="btn" href="${n.google}" target="_blank" rel="noopener">ניווט</a></li>`; }).join('')}</ul>`;
    };
    const filtered = () => D.points.filter(p => !sel.value || (p.days || []).includes(sel.value));
    const showList = (on) => { listEl.hidden = !on; mapEl.hidden = on; $('#listToggle').textContent = on ? 'מפה' : 'רשימה'; if (on) renderList(filtered()); else mapInstance?.invalidateSize(); };

    if (typeof L === 'undefined') { showList(true); return; }
    mapInstance = L.map(mapEl, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(mapInstance);
    const layer = L.layerGroup().addTo(mapInstance);
    const draw = () => {
      layer.clearLayers();
      const pts = filtered();
      pts.forEach(p => {
        const r = region(p.region) || {}; const n = navLinks(p);
        L.circleMarker([p.lat, p.lng], { radius: p.optional ? 7 : 9, color: '#fff', weight: 2, fillColor: r.color, fillOpacity: p.optional ? .6 : .95, dashArray: p.optional ? '3' : null })
          .bindPopup(`<h4>${esc(p.name)}</h4><div style="font-size:12px;color:#667">${esc(r.name || '')} · ${(p.days || []).map(fmtDay).join(', ')}${p.optional ? ' · אופציה' : ''}</div>
            ${p.summary ? `<div style="font-size:13px;margin-top:4px">${esc(p.summary)}</div>` : ''}
            <div class="pop-actions"><a href="#/point/${p.id}">דף המדריך</a><a href="${n.google}" target="_blank" rel="noopener">Google</a><a href="${n.apple}" target="_blank" rel="noopener">Apple</a></div>`)
          .addTo(layer);
      });
      if (pts.length) mapInstance.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])).pad(0.15), { maxZoom: 12 });
      if (!listEl.hidden) renderList(pts);
    };
    sel.addEventListener('change', draw);
    $('#listToggle').addEventListener('click', () => showList(listEl.hidden));
    draw();
    if (!navigator.onLine) showList(true);
  };

  VIEWS.transport = () => {
    const tzName = (tz) => ({ 'Asia/Jerusalem': 'שעון ישראל', 'America/Los_Angeles': 'שעון האוקיינוס השקט', 'America/Edmonton': 'שעון ההרים' }[tz] || tz);
    const c = D.cruise;
    return `<section class="card"><h2>✈️ טיסות</h2>
      ${D.flights.map(f => `<div class="seg">
        <div class="day-head"><div><div class="day-date">${esc(fmtDay(f.date))}</div><b>${esc(f.flight)}</b> <span class="small muted">${esc(f.carrier)}</span></div>${statusChip(f.status)}</div>
        <div class="seg-route"><span>${esc(f.from)}</span><span class="arrow">→</span><span>${esc(f.to)}</span></div>
        <div class="seg-times">
          <div><div class="tiny">יציאה · ${esc(tzName(f.fromTz))}</div><div class="t num">${esc(f.dep || 'טרם נקבע')}</div><div class="tiny">${f.fromTerminal ? 'טרמינל ' + esc(f.fromTerminal) : ''}</div></div>
          <div><div class="tiny">נחיתה · ${esc(tzName(f.toTz))}</div><div class="t num">${esc(f.arr || 'טרם נקבע')}</div><div class="tiny">${f.toTerminal ? 'טרמינל ' + esc(f.toTerminal) : ''}${f.arrDate && f.arrDate !== f.date ? ' · ' + esc(fmtDay(f.arrDate)) : ''}</div></div>
        </div>
        ${f.notes ? `<div class="small muted" style="margin-top:4px">${esc(f.notes)}</div>` : ''}
      </div>`).join('')}
      <h3>עלות טיסות אל על</h3>
      <dl class="kv">${D.flightsInfo.costPerTraveler.map(x => `<dt>${esc(x.label)}</dt><dd>${money(x)} לנוסע</dd>`).join('')}
        <dt>סה״כ לנוסע</dt><dd>${money(D.flightsInfo.totalPerTraveler)}</dd><dt>סה״כ לזוג</dt><dd><b>${money(D.flightsInfo.totalCouple)}</b></dd></dl>
      <p class="small muted">${esc(D.flightsInfo.baggage)}</p>
    </section>

    <section class="card"><h2>🚢 קרוז ${esc(c.ship)} ${statusChip(c.status)}</h2>
      <dl class="kv"><dt>עלייה</dt><dd>${esc(fmtDay(c.embark.date))} · <b class="num">${esc(c.embark.time)}</b> · ${esc(c.embark.place)}</dd>
        <dt>הגעה</dt><dd>${esc(fmtDay(c.arrival.date))} · <b class="num">${esc(c.arrival.time)}</b> · ${esc(c.arrival.place)}</dd>
        <dt>לילות</dt><dd>${c.nights}</dd><dt>הוזמן דרך</dt><dd>${esc(c.bookedVia)}</dd></dl>
      <div class="notice">${esc(c.arrival.note)}</div>
      <ol class="timeline" style="margin-top:12px">${c.itinerary.map(s => `<li><div class="when">${esc(fmtDay(s.date))}</div><div>${esc(s.place)}</div></li>`).join('')}</ol>
      <h3>תשלומים</h3>
      <dl class="kv"><dt>סה״כ</dt><dd>${money(c.total)}</dd><dt>שולם</dt><dd>${money(c.paid)} <span class="tiny">${esc(c.paid.note)}</span></dd>
        <dt>יתרה</dt><dd><b>${money(c.balance)}</b> עד ${esc(fmtShort(c.balance.due))}</dd>
        <dt>דמי שירות</dt><dd>${money({ amount: c.gratuities.perPersonPerNight, currency: 'USD' })} לאדם ללילה · כ־${money({ amount: c.gratuities.approxTotal, currency: 'USD' })} לזוג</dd></dl>
      <div class="notice">${esc(c.balance.note)}</div>
      <h3>אופציות (לא הוזמנו)</h3><ul class="clean small">${c.options.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
      <div class="notice info">${esc(c.verify)}</div>
    </section>`;
  };

  VIEWS.hotels = () => `<section class="card"><h2>🛏️ לינה לפי לילות</h2>
      ${D.hotels.map(h => {
        const nights = h.checkIn && h.checkOut ? daysBetween(toDate(h.checkIn), toDate(h.checkOut)) : null;
        return `<div class="seg"><div class="day-head"><div><div class="day-date">${esc(fmtDay(h.checkIn))} → ${h.checkOut ? esc(fmtDay(h.checkOut)) : 'טרם נקבע'}${nights ? ` · ${nights} לילות` : ''}</div>
          <b>${esc(h.city)}</b> · <span class="${/טרם נקבע/.test(h.name) ? 'muted' : ''}">${esc(h.name)}</span></div>${statusChip(h.status)}</div>
          <dl class="kv"><dt>מחיר לזוג</dt><dd>${h.id === 'cruise' || h.id === 'plane' ? 'כלול' : money(h.price)}</dd>
          ${h.deposit ? `<dt>מקדמה</dt><dd>${money(h.deposit)} ${esc(h.deposit.note || '')}</dd>` : ''}
          ${h.cancelBy ? `<dt>ביטול</dt><dd>${esc(h.cancelBy)}</dd>` : ''}</dl>
          ${h.notes ? `<div class="small muted">${esc(h.notes)}</div>` : ''}</div>`;
      }).join('')}
      <p class="tiny">${esc(D.hotelsNote)}</p>
      <p class="tiny">טבלת מלונות מלאה (מקדמה, מועד ביטול, קישור) – שלב 4.</p></section>`;

  VIEWS.tasks = (sub) => {
    const done = doneMap();
    const tab = sub === 'entry' ? 'entry' : 'tasks';
    const tasksHtml = D.tasks.map(t => `<li class="task ${done[t.id] ? 'done' : ''}"><input type="checkbox" data-done="${t.id}" ${done[t.id] ? 'checked' : ''} aria-label="בוצע">
        <div class="grow"><div class="title">${esc(t.title)}</div>
        <div class="small muted">${esc(t.category)}${t.due ? ' · יעד ' + esc(fmtShort(t.due)) : ''}${t.opensNote ? ' · נפתח: ' + esc(t.opensNote) : ''}</div>
        ${t.cost ? `<div class="small">${money(t.cost)} ${t.cost.note ? '<span class="tiny">' + esc(t.cost.note) + '</span>' : ''}</div>` : ''}
        ${t.notes ? `<div class="tiny">${esc(t.notes)}</div>` : ''}
        ${t.url ? `<a class="small" href="${esc(t.url)}" target="_blank" rel="noopener">קישור ›</a>` : ''}</div>${statusChip(done[t.id] ? 'done' : t.status)}</li>`).join('');
    const entryHtml = D.entry.items.slice().sort((a, b) => a.order - b.order).map(i => `<section class="card"><div class="task ${done[i.id] ? 'done' : ''}">
        <input type="checkbox" data-done="${i.id}" ${done[i.id] ? 'checked' : ''} aria-label="בוצע">
        <div class="grow"><div class="day-head"><h3 class="title" style="margin:0">${esc(i.title)}</h3>${statusChip(done[i.id] ? 'done' : i.status)}</div>
        <p class="small" style="margin:6px 0 0">${esc(i.what)}</p>
        ${i.tip ? `<p class="tiny" style="margin:6px 0 0">💡 ${esc(i.tip)}</p>` : ''}
        ${i.deadline ? `<p class="small" style="margin:6px 0 0"><b>מתי:</b> ${esc(i.deadline)}</p>` : ''}
        ${i.facts.length ? `<ul class="facts">${i.facts.map(f => `<li>${esc(f.text)}<br><a href="${esc(f.source)}" target="_blank" rel="noopener">מקור רשמי: ${esc(new URL(f.source).hostname.replace(/^www\./, ''))} ›</a></li>`).join('')}</ul>` : ''}
        </div></div></section>`).join('');
    return `<div class="tabs" role="tablist">
        <button class="${tab === 'tasks' ? 'on' : ''}" data-go="#/tasks">משימות</button>
        <button class="${tab === 'entry' ? 'on' : ''}" data-go="#/tasks/entry">כניסה ומסמכים</button></div>
      ${tab === 'tasks' ? `<section class="card"><ul class="rows">${tasksHtml}</ul><p class="tiny">הסימון ״בוצע״ נשמר במכשיר הזה. לעדכן לכולם – דרך מצב עריכה ופרסום (שלב 4).</p></section>`
        : `<div class="notice"><b>נבדק במקורות רשמיים ב־${esc(fmtShort(D.entry.checkedOn))}.</b> ${esc(D.entry.disclaimer)}</div>${entryHtml}`}`;
  };
  VIEWS.tasks.after = () => {
    view.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { location.hash = b.dataset.go; }));
    view.querySelectorAll('[data-done]').forEach(cb => cb.addEventListener('change', () => { const m = doneMap(); m[cb.dataset.done] = cb.checked; LS.set('tg.done', m); route(); }));
  };

  VIEWS.more = () => `
    <section class="card"><h2>📶 שמירה לאופליין</h2>
      <p class="small">שומר במכשיר את האתר, הנתונים ואת כל התמונות. אריחי מפה נשמרים רק לאזורים שכבר נצפו (לפי מדיניות OpenStreetMap). למפות מלאות, להוריד מפות אופליין ב־Google Maps או Maps.me.</p>
      <button class="btn primary block" id="saveOffline">שמור הכול לאופליין</button>
      <div class="progress" id="offProg" hidden><i></i></div>
      <p class="small" id="offStatus">${LS.get('tg.offlineAt') ? '✓ נשמר לאחרונה: ' + esc(new Date(LS.get('tg.offlineAt')).toLocaleString('he-IL')) : 'עוד לא נשמר.'}</p>
    </section>
    <section class="card"><h2>🔒 חשוב לדעת</h2>
      <ul class="clean small">
        <li><b>עריכה מקומית לא מגיעה לצופים</b> עד שמפרסמים גרסה חדשה של <span class="ltr">trip.json</span>.</li>
        <li><b>מצב עריכה אינו הרשאת אבטחה.</b> כל מי שיש לו את הקישור רואה את כל התוכן.</li>
        <li>אין באתר מספרי הזמנה, פרטי דרכון, שמות נוסעים או אמצעי תשלום.</li>
      </ul>
      <p class="tiny">מצב עריכה, ייצוא וייבוא – שלב 4.</p>
    </section>
    <section class="card"><h2>🎨 תצוגה</h2>
      <div class="btn-row"><button class="btn" data-theme-set="">אוטומטי</button><button class="btn" data-theme-set="light">בהיר</button><button class="btn" data-theme-set="dark">כהה</button></div>
    </section>
    <section class="card"><h2>©️ קרדיטים</h2>
      <p class="small">מפה: © OpenStreetMap contributors · Leaflet 1.9.4 (BSD-2). תחזית: Open-Meteo. תמונות: Wikimedia Commons – רשימה מלאה תתווסף בשלב 2.</p>
    </section>`;
  VIEWS.more.after = () => {
    view.querySelectorAll('[data-theme-set]').forEach(b => b.addEventListener('click', () => { const t = b.dataset.themeSet; LS.set('tg.theme', t); applyTheme(); }));
    $('#saveOffline').addEventListener('click', saveOffline);
  };

  /* ---------- offline ---------- */
  async function saveOffline() {
    const prog = $('#offProg'), bar = prog.firstElementChild, st = $('#offStatus');
    if (!('serviceWorker' in navigator)) { st.textContent = 'הדפדפן לא תומך בשמירה לאופליין.'; return; }
    const reg = await navigator.serviceWorker.ready;
    const imgs = Object.values(window.__credits || {}).flat().map(c => c.file);
    prog.hidden = false; st.textContent = 'שומר…';
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => {
      const { done, total, finished, failed } = e.data;
      bar.style.width = Math.round(100 * done / total) + '%';
      if (finished) {
        if (failed) st.textContent = `נשמרו ${done - failed} מתוך ${total}. נסו שוב עם חיבור יציב.`;
        else { LS.set('tg.offlineAt', Date.now()); st.textContent = `✓ הכול נשמר (${total} קבצים). אפשר לעבור למצב טיסה.`; toast('השמירה לאופליין הושלמה ✓'); }
      }
    };
    reg.active.postMessage({ type: 'cache-all', extra: imgs }, [ch.port2]);
  }

  /* ---------- router ---------- */
  const TITLES = { overview: ['יומן מסע 2027', 'ארה״ב · קרוז אלסקה · הרוקיז'], map: ['מפה', 'צבע לפי אזור'], itinerary: ['מסלול', '19/8 – 15/9/2027'], transport: ['טיסות וקרוז', 'שעות מקומיות'], hotels: ['מלונות', 'לפי לילה'], tasks: ['משימות', 'מה להזמין ומה לבדוק'], more: ['הגדרות ואופליין', ''] };
  function setTitle(t, s) { $('#pageTitle').textContent = t; $('#pageSub').textContent = s || ''; }

  function route() {
    const [, name = 'overview', arg] = (location.hash || '#/overview').split('/');
    const v = VIEWS[name] || VIEWS.overview;
    if (mapInstance) { mapInstance.remove(); mapInstance = null; }
    if (TITLES[name]) setTitle(...TITLES[name]);
    view.className = name === 'map' ? 'full' : '';
    view.innerHTML = v(arg);
    v.after && v.after(arg);
    const tab = name === 'point' ? null : (name === 'more' ? null : name);
    document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
    $('#backBtn').hidden = !(name === 'point' || name === 'more');
    if (name !== 'map') window.scrollTo(0, 0);
  }

  function applyTheme() { const t = LS.get('tg.theme', ''); if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
  function netState() { $('#netBadge').hidden = navigator.onLine; }

  async function boot() {
    applyTheme(); netState();
    addEventListener('online', netState); addEventListener('offline', netState);
    $('#backBtn').addEventListener('click', () => history.length > 1 ? history.back() : (location.hash = '#/overview'));
    try {
      const [trip, credits] = await Promise.all([
        fetch('data/trip.json').then(r => r.json()),
        fetch('data/credits.json').then(r => r.ok ? r.json() : {}).catch(() => ({}))
      ]);
      D = LS.get('tg.draft') && LS.get('tg.editMode') ? LS.get('tg.draft') : trip;
      window.__credits = credits.points || {};
    } catch (e) {
      view.innerHTML = '<div class="card">לא הצלחתי לטעון את נתוני הטיול. נסו לרענן כשיש חיבור.</div>'; return;
    }
    addEventListener('hashchange', route);
    route();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  boot();
})();
