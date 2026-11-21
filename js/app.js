/* מדריך המסע שלנו – static PWA, no build step, no API keys. */
(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const view = $('#view');
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
  };
  let D = null, CR = {}, mapInstance = null;

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toDate = (iso) => { if (!iso) return null; const [d, t] = iso.split('T'); const [y, m, dd] = d.split('-').map(Number); const [hh, mm] = (t || '00:00').split(':').map(Number); return new Date(y, m - 1, dd, hh, mm); };
  const fmt = (iso, o) => iso ? new Intl.DateTimeFormat('he-IL', o).format(toDate(iso)) : 'טרם נקבע';
  const fDay = (iso) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'numeric' });
  const fLong = (iso) => fmt(iso, { day: 'numeric', month: 'long' });
  const fFull = (iso) => fmt(iso, { day: 'numeric', month: 'numeric', year: 'numeric' });
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const daysTo = (iso) => Math.round((toDate(iso.split('T')[0]) - today()) / 86400000);
  const nights = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
  const money = (amount, cur) => amount == null ? '<span class="muted">טרם נקבע</span>' : `<span class="num">${esc(new Intl.NumberFormat('he-IL', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(amount))}</span>`;
  const ST = (key, label) => `<span class="st ${key}">${esc(label || D.statuses[key]?.label || key)}</span>`;
  const region = (id) => D.regions.find(r => r.id === id);
  const point = (id) => D.points.find(p => p.id === id);
  const imgs = (pid) => CR[pid] || [];
  const firstImg = (pid) => imgs(pid)[0];
  const regionImg = (r) => firstImg(r.image) || D.points.filter(p => p.region === r.id).map(p => firstImg(p.id)).find(Boolean);
  const imgTag = (c, cls = 'img', alt = '') => c ? `<img class="${cls}" src="${esc(c.file)}" alt="${esc(alt)}" loading="lazy">` : `<div class="${cls} noimg">תמונה תתווסף</div>`;
  const creditLine = (c, label) => c ? `${label ? esc(label) + ' · ' : ''}<a href="${esc(c.source)}" target="_blank" rel="noopener">${esc(c.author)} / Wikimedia Commons</a> · ${esc(c.license)}` : '';
  const nav = (p) => ({
    google: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`,
    apple: `https://maps.apple.com/?ll=${p.lat},${p.lng}&q=${encodeURIComponent(p.nameEn || p.name)}`,
    photos: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p.nameEn || p.name)}`,
    embed: `https://maps.google.com/maps?q=${p.lat},${p.lng}&z=13&output=embed`
  });
  const dayRoute = (pts) => {
    const s = pts.filter(p => p.kind !== 'transport' || pts.length <= 2);
    if (s.length < 2) return s[0] ? nav(s[0]).google : null;
    const ll = (p) => `${p.lat},${p.lng}`;
    const mid = s.slice(1, -1).slice(0, 8).map(ll).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${ll(s[0])}&destination=${ll(s[s.length - 1])}${mid ? '&waypoints=' + encodeURIComponent(mid) : ''}&travelmode=driving`;
  };
  const hasAttr = (p) => D.attractions.some(a => a.point === p.id) ? ' 🎟️' : '';
  const pointStatus = (p) => p.suggestion ? ST('option', 'הצעה') : p.optional ? ST('option', 'אופציה') : (p.region === 'cruise' && p.kind !== 'transport') ? ST('booked', 'בתוכנית הקרוז') : ST('planning', 'בתוכנית');
  const countBox = (iso) => { const n = daysTo(iso); return `<div class="days ${n > 180 ? 'amber' : ''}"><b class="num">${n}</b><span>ימים</span></div>`; };
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }
  const done = () => LS.get('tg.done', {});

  /* ---------- weather (Open-Meteo, no key) ---------- */
  const WMO = (c) => c == null ? ['·', ''] : c === 0 ? ['☀️', 'בהיר'] : c <= 2 ? ['🌤️', 'מעונן חלקית'] : c === 3 ? ['☁️', 'מעונן'] : c <= 48 ? ['🌫️', 'ערפל'] : c <= 57 ? ['🌦️', 'טפטוף'] : c <= 67 ? ['🌧️', 'גשם'] : c <= 77 ? ['🌨️', 'שלג'] : c <= 82 ? ['🌧️', 'ממטרים'] : c <= 86 ? ['🌨️', 'ממטרי שלג'] : ['⛈️', 'סופות רעמים'];
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
      el.innerHTML = w.pending ? `<span class="ico">🗓️</span><span>תחזית אמיתית תופיע כאן מ־${esc(new Intl.DateTimeFormat('he-IL').format(w.from))}</span>`
        : w.error ? `<span class="ico">📡</span><span>אין חיבור. התחזית תתעדכן כשתהיה קליטה.</span>`
        : `<span class="ico">${WMO(w.code)[0]}</span><span><b class="num">${Math.round(w.min)}°–${Math.round(w.max)}°</b> · ${WMO(w.code)[1]} · משקעים ${w.pop ?? '–'}%${w.stale ? ' (שמור)' : ''}</span>`;
    });
    return `<div class="wx" id="${id}"><span class="ico">⏳</span><span>טוען…</span></div>`;
  }

  /* ---------- urgent list ---------- */
  function datedItems() {
    const dn = done(), out = [];
    D.tasks.forEach(t => { if (!dn[t.id] && (t.opens || t.due)) out.push({ id: t.id, title: t.title, date: t.opens || t.due, sub: t.opensNote ? `נפתח ${fFull(t.opens)} · ${t.opensNote}` : `עד ${fFull(t.due)}${t.notes ? ' · ' + t.notes : ''}`, url: t.url }); });
    return out.sort((a, b) => toDate(a.date) - toDate(b.date));
  }

  /* ---------- views ---------- */
  const V = {};

  V.journey = () => {
    const c = firstImg(D.meta.heroImage);
    hero(`<div class="hero" style="background-image:url('${c ? esc(c.file) : ''}')"><div class="in">
      <div class="date">19 באוגוסט – 15 בספטמבר 2027 · עוד ${Math.max(0, daysTo(D.meta.start))} ימים</div>
      <h1>${esc(D.meta.title)}</h1><p>${esc(D.meta.subtitle)}</p>
      <div class="pills"><span>ארה״ב</span><span>קרוז אלסקה</span><span>הרוקיז</span></div>
      <div class="credit">${creditLine(c, 'אגם מוריין')}</div></div></div>`);
    const urgent = datedItems().slice(0, 3);
    const openCount = D.tasks.filter(t => !done()[t.id] && t.status !== 'done').length + D.entry.items.filter(i => i.status !== 'done' && !done()[i.id]).length;
    return `
      <section class="urgent" aria-label="הכי דחוף">
        <div class="h">● הכי דחוף עכשיו</div>
        ${urgent.map(u => `<a class="u-row" href="#/tasks">${countBox(u.date)}<div><div class="t">${esc(u.title)}</div><div class="s">${esc(u.sub)}</div></div></a>`).join('')}
        <a class="lnk" href="#/tasks" style="display:inline-block;margin-top:6px">כל המשימות (${openCount} פתוחות) ›</a>
      </section>
      <h2 class="sec">המסע לפי אזורים</h2>
      <p class="lead">לחצו על אזור כדי לראות לאן מגיעים, איפה ישנים ומה עושים בכל יום.</p>
      <div class="cards-2">${D.regions.map(r => regionCard(r)).join('')}</div>
      <h3 class="sub">מועדים חשובים</h3>
      <div class="card"><div class="bd"><ul class="timeline">${D.milestones.slice().sort((a, b) => toDate(a.date) - toDate(b.date)).map(m => `<li><span class="when">${esc(fFull(m.date.split('T')[0]))}</span><span>${esc(m.label)}</span></li>`).join('')}</ul></div></div>`;
  };

  function regionCard(r) {
    const n = nights(r.from, r.to);
    const places = D.points.filter(p => p.region === r.id && p.kind !== 'transport').slice(0, 4);
    return `<article class="card">
      <a href="#/region/${r.id}">${imgTag(regionImg(r), 'img', r.name)}</a>
      <div class="bd">
        <div class="meta">${esc(fLong(r.from))} – ${esc(fLong(r.to))} · ${n} ${n === 1 ? 'לילה' : 'לילות'}</div>
        <div class="ttl"><h3>${esc(r.name)}</h3>${ST(r.lodgingStatus, r.lodgingStatus === 'toclose' ? 'לינה לסגור' : undefined)}</div>
        <p class="desc">${esc(r.arrive)}</p>
        ${places.length ? `<div class="chips">${places.map(p => `<a class="${p.optional ? 'opt' : ''}" href="#/point/${p.id}">${esc(p.name)}</a>`).join('')}</div>` : ''}
        <div class="foot"><a class="btn dark" href="#/region/${r.id}">לאזור ›</a><span class="tiny">${esc(r.tzLabel)}</span></div>
      </div></article>`;
  }

  V.region = (id, sub) => {
    const r = region(id); if (!r) return '<p>האזור לא נמצא.</p>';
    const c = regionImg(r), n = nights(r.from, r.to);
    const pts = D.points.filter(p => p.region === r.id);
    const subs = [...new Set(pts.map(p => p.sub).filter(Boolean))];
    hero(`<div class="hero region" style="background-image:url('${c ? esc(c.file) : ''}')"><div class="in">
      <div class="date">${esc(fLong(r.from))} – ${esc(fLong(r.to))} · ${n} ${n === 1 ? 'לילה' : 'לילות'}</div>
      <h1>${esc(r.name)}</h1>${subs.length ? `<div class="pills">${subs.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
      <div class="credit">${creditLine(c)}</div></div></div>`);
    $('#brandText').textContent = '› ' + r.name;
    const days = D.days.filter(d => d.region === r.id);
    const tab = sub === 'places' ? 'places' : 'days';
    return `
      <p class="lead">${esc(r.summary)}</p>
      <div class="facts" style="margin-bottom:16px">
        <div class="fact"><b>✈️ מגיעים</b><span>${esc(r.arrive)}</span></div>
        <div class="fact"><b>🛏️ לינה ${ST(r.lodgingStatus)}</b><span>${esc(r.lodging)}</span></div>
        <div class="fact"><b>🧥 ביגוד (הערכה)</b><span>${esc(r.clothing.summary)}</span></div>
        <div class="fact"><b>⚠️ לסגור לפני שיוצאים</b><ul>${r.beforeYouGo.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="fact wide"><b>🎒 לקחת</b><div class="chips" style="margin-top:4px">${r.clothing.bring.map(b => `<span>${esc(b)}</span>`).join('')}</div></div>
      </div>
      ${(() => { const at = D.attractions.filter(a => a.region === r.id); return at.length ? `<h3 class="sub" style="margin-top:0">🎟️ אטרקציות באזור ומה צריך להזמין</h3>${at.map(attrMini).join('')}<div style="height:12px"></div>` : ''; })()}
      <div class="tabs" style="position:static;border:1px solid var(--line);border-radius:12px;margin-bottom:14px">
        <a href="#/region/${r.id}" class="${tab === 'days' ? 'on' : ''}">יום אחר יום</a>
        <a href="#/region/${r.id}/places" class="${tab === 'places' ? 'on' : ''}">כל המקומות (${pts.filter(p => p.kind !== 'transport').length})</a>
      </div>
      ${tab === 'days' ? `
        <div class="filters"><div class="full"><label for="dayF">יום</label><select id="dayF"><option value="">כל הימים</option>${days.map(d => `<option value="${d.date}">${esc(fDay(d.date))} · ${esc(d.title)}</option>`).join('')}</select></div></div>
        <div id="dayList">${days.map(d => dayCard(d, r)).join('')}</div>`
        : `<div class="cards-2">${pts.filter(p => p.kind !== 'transport').map(p => placeCard(p)).join('')}</div>`}`;
  };
  V.region.after = () => {
    const f = $('#dayF'); if (!f) return;
    f.addEventListener('change', () => document.querySelectorAll('#dayList > article').forEach(a => { a.hidden = f.value && a.dataset.date !== f.value; }));
  };

  function dayCard(d, r) {
    const pts = d.points.map(point).filter(Boolean);
    const sights = pts.filter(p => p.kind !== 'transport');
    const pic = sights.map(p => firstImg(p.id)).find(Boolean);
    const guide = sights.find(p => p.guide) || sights[0];
    const route = dayRoute(pts);
    const anchor = sights[0] || pts[0] || D.points.find(p => p.region === r.id && p.kind !== 'transport');
    const sugg = d.type === 'free' ? D.points.filter(p => p.region === r.id && p.suggestion) : [];
    const typeLbl = { transit: 'יום מעבר', explore: 'יום טיול', cruise: 'קרוז', free: 'יום פתוח' }[d.type];
    return `<article class="card" data-date="${d.date}">
      ${pic ? imgTag(pic, 'img short', d.title) : ''}
      <div class="bd">
        <div class="meta">${esc(fDay(d.date))} · ${typeLbl}${d.estTime ? ' · ' + esc(d.estTime) : ''}</div>
        <div class="ttl"><h3><a href="#/day/${d.date}" style="color:inherit;text-decoration:none">${esc(d.title)}</a></h3></div>
        ${d.summary ? `<p class="desc">${esc(d.summary)}</p>` : ''}
        ${d.notes ? `<div class="notice">${esc(d.notes)}</div>` : ''}
        ${sights.length ? `<div class="chips">${sights.map(p => `<a class="${p.optional ? 'opt' : ''}" href="#/point/${p.id}">${esc(p.name)}${p.suggestion ? ' · הצעה' : p.optional ? ' · אופציה' : ''}${hasAttr(p)}</a>`).join('')}</div>` : ''}
        ${sugg.length ? `<div class="tiny" style="margin:4px 0">הצעות באזור:</div><div class="chips">${sugg.map(p => `<a class="opt" href="#/point/${p.id}">${esc(p.name)}</a>`).join('')}</div>` : ''}
        <div class="facts" style="margin-top:10px">
          ${anchor ? `<div class="fact"><b>🌡️ תחזית</b>${wx(anchor.lat, anchor.lng, d.date)}</div>` : ''}
          ${d.weatherAlt ? `<div class="fact"><b>🌧️ אם מזג האוויר לא טוב</b><span>${esc(d.weatherAlt)}</span></div>` : `<div class="fact"><b>🧥 ביגוד</b><span>${esc(r.clothing.summary.split('.')[0])}.</span></div>`}
        </div>
        <div class="foot">
          <a class="btn dark" href="#/day/${d.date}">למסלול היום ›</a>
          ${route ? `<a class="lnk" href="${route}" target="_blank" rel="noopener">מסלול היום בגוגל מפות</a>` : ''}
        </div>
      </div></article>`;
  }

  function placeCard(p) {
    return `<article class="card"><a href="#/point/${p.id}">${imgTag(firstImg(p.id), 'img short', p.name)}</a><div class="bd">
      <div class="meta">${p.days?.length ? esc(p.days.map(fDay).join(', ')) : 'לא שובץ ליום'}${p.sub ? ' · ' + esc(p.sub) : ''}</div>
      <div class="ttl"><h3>${esc(p.name)}${hasAttr(p)}</h3>${pointStatus(p)}</div>
      ${p.summary ? `<p class="desc">${esc(p.summary)}</p>` : ''}
      <div class="foot"><a class="btn" href="#/point/${p.id}">למדריך ›</a><a class="lnk" href="${nav(p).google}" target="_blank" rel="noopener">נווט</a></div></div></article>`;
  }

  V.point = (id) => {
    const p = point(id); if (!p) return '<p>המקום לא נמצא.</p>';
    const r = region(p.region), g = p.guide, n = nav(p), list = imgs(p.id);
    const vis = LS.get('tg.visited', {}), notes = LS.get('tg.notes', {});
    $('#brandText').textContent = '› ' + p.name;
    const att = D.attractions.filter(a => a.point === p.id);
    return `<article class="sheet">
      <div class="top"><span>${p.days?.length ? esc(p.days.map(fLong).join(', ')) + ' · ' : ''}${esc(r.name)}${p.sub ? ' · ' + esc(p.sub) : ''}</span><a class="ghost" href="#/region/${r.id}">לאזור ›</a></div>
      ${list.length ? `<div class="gallery" id="gal">${list.map(c => `<figure><img src="${esc(c.file)}" alt="${esc(p.name)}" loading="lazy"><figcaption>${creditLine(c)}</figcaption></figure>`).join('')}</div>
        ${list.length > 1 ? `<div class="gal-dots" id="dots">${list.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}` : `<div class="noimg">תמונה תתווסף</div>`}
      <div class="bd" style="padding:12px 14px 16px">
        <div class="ttl"><h3 style="font-size:26px">${esc(p.name)}</h3>${pointStatus(p)}</div>
        <div class="tiny ltr" style="text-align:right">${esc(p.nameEn || '')}</div>
        ${p.summary ? `<p class="desc" style="margin-top:6px">${esc(p.summary)}</p>` : ''}
        ${att.length ? `<h3 class="sub" style="font-size:16px;margin-top:8px">🎟️ אטרקציות במקום</h3>${att.map(attrMini).join('')}` : ''}
        <div class="btn-row" style="margin:6px 0 14px"><a class="btn dark" href="${n.google}" target="_blank" rel="noopener">נווט · Google</a><a class="btn" href="${n.apple}" target="_blank" rel="noopener">Apple</a><a class="btn" href="${n.photos}" target="_blank" rel="noopener">עוד תמונות בגוגל</a></div>
        ${g ? guideBlocks(g) : `<div class="facts">
            <div class="fact wide"><b>🧥 ביגוד וציוד באזור (הערכה)</b><span>${esc(r.clothing.summary)}</span></div>
            ${p.days?.[0] ? `<div class="fact wide"><b>🌡️ תחזית</b>${wx(p.lat, p.lng, p.days[0])}</div>` : ''}
          </div><p class="est">מדריך מלא (מה עושים, משך, מה מצפה ומידע חשוב) יתווסף בשלב הבא.</p>`}
        <h3 class="sub" style="margin-top:18px">מפת Google</h3>
        <div id="gmap"><button class="btn block" id="gmapBtn">הצג מפת Google של המקום</button></div>
        ${p.approx ? '<p class="tiny" style="margin-top:6px">המיקום משוער. לפני ניווט כדאי לחפש לפי השם באנגלית.</p>' : ''}
      </div></article>
      <section class="card"><div class="bd">
        <label class="visited"><input type="checkbox" id="visBox" ${vis[p.id] ? 'checked' : ''}> ביקרנו ✓</label>
        <h3 class="sub" style="font-size:16px;margin-top:12px">הערה אישית</h3>
        <textarea id="noteBox" placeholder="מה היה, מה כדאי לזכור…">${esc(notes[p.id] || '')}</textarea>
        <p class="tiny">הסימון וההערה נשמרים רק במכשיר הזה.</p>
      </div></section>`;

    function guideBlocks(g) {
      return `<div class="facts">
        <div class="fact wide"><b>🥾 מה עושים</b>${g.activities.map(a => `<div class="act">${a.required ? ST('must', 'חובה') : ST('option', 'אופציה')}<span><b style="display:inline;font-size:14px">${esc(a.name)}</b> – ${esc(a.note)}</span></div>`).join('')}</div>
        <div class="fact"><b>⏱️ משך</b><span>מינימום: ${esc(g.duration.min)}<br>מומלץ: ${esc(g.duration.recommended)}</span></div>
        <div class="fact"><b>🕗 מתי כדאי</b><span>${esc(g.bestTime || '')}</span></div>
        ${g.duration.trails?.length ? `<div class="fact wide"><b>🗺️ שבילים</b><table class="plain"><tr><th>שביל</th><th>אורך</th><th>עלייה</th></tr>${g.duration.trails.map(t => `<tr><td>${esc(t.name)}</td><td>${esc(t.length)}</td><td>${esc(t.gain)}</td></tr>`).join('')}</table></div>` : ''}
        <div class="fact wide"><b>🧥 לבוש וציוד</b><ul>${g.clothing.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
        <div class="fact wide"><b>👀 מה מצפה לנו</b><ul>${[['עומס', g.expect.crowds], ['הגעה', g.expect.parking], ['שירותים', g.expect.toilets], ['קליטה', g.expect.signal], ['בטיחות', g.expect.safety], ['טיפ', g.expect.tips]].filter(x => x[1]).map(([k, v]) => `<li><b style="display:inline;font-size:14px">${k}:</b> ${esc(v)}</li>`).join('')}</ul></div>
        ${g.important?.length ? `<div class="fact wide" style="background:#fffbeb;border-color:#fde68a"><b>⚠️ מידע חשוב על המקום</b><ul>${g.important.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        <div class="fact wide"><b>🌧️ אם מזג האוויר לא טוב</b><span>${esc(g.weatherAlt)}</span></div>
        ${p.days?.[0] ? `<div class="fact wide"><b>🌡️ תחזית ל־${esc(fLong(p.days[0]))}</b>${wx(p.lat, p.lng, p.days[0])}</div>` : ''}
        <div class="fact wide"><b>🔗 קישורים רשמיים</b>${g.links.map(l => `<a class="src" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ›</a>`).join('')}</div>
      </div>
      ${g.verified ? '' : '<p class="est">ⓘ משך, ביגוד, מתי כדאי ומה מצפה הם הערכה. לאמת לפני הטיול.</p>'}`;
    }
  };
  V.point.after = (id) => {
    const p = point(id); if (!p) return;
    const gal = $('#gal'), dots = $('#dots');
    if (gal && dots) gal.addEventListener('scroll', () => { const i = Math.round(Math.abs(gal.scrollLeft) / gal.clientWidth); [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i)); }, { passive: true });
    $('#gmapBtn')?.addEventListener('click', () => {
      if (!navigator.onLine) { toast('מפת Google דורשת חיבור. אפשר להשתמש בכפתור הניווט עם מפות אופליין.'); return; }
      $('#gmap').innerHTML = `<iframe class="gframe" src="${nav(p).embed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="מפת Google – ${esc(p.name)}"></iframe>`;
    });
    $('#visBox').addEventListener('change', e => { const v = LS.get('tg.visited', {}); v[id] = e.target.checked; LS.set('tg.visited', v); toast(e.target.checked ? 'סומן ״ביקרנו״' : 'הסימון בוטל'); });
    $('#noteBox').addEventListener('input', e => { const n = LS.get('tg.notes', {}); n[id] = e.target.value; LS.set('tg.notes', n); });
  };

  V.day = (date) => {
    const d = D.days.find(x => x.date === date); if (!d) return '<p>היום לא נמצא.</p>';
    const r = region(d.region) || { name: '', clothing: { summary: '', bring: [] }, id: '' };
    const idx = D.days.indexOf(d), prev = D.days[idx - 1], next = D.days[idx + 1];
    const stops = d.points.map(point).filter(Boolean);
    const sights = stops.filter(p => p.kind !== 'transport');
    const pic = sights.map(p => firstImg(p.id)).find(Boolean) || regionImg(r);
    const sugg = d.type === 'free' ? D.points.filter(p => p.region === r.id && p.suggestion) : [];
    const lodge = D.hotels.find(h => h.id === d.lodging);
    const route = dayRoute(stops);
    const typeLbl = { transit: 'יום מעבר', explore: 'יום טיול', cruise: 'קרוז', free: 'יום פתוח' }[d.type];
    const anchor = sights[0] || stops[0] || D.points.find(p => p.region === r.id && p.kind !== 'transport');
    $('#brandText').textContent = '› ' + fDay(d.date);
    hero(`<div class="hero region" style="background-image:url('${pic ? esc(pic.file) : ''}')"><div class="in">
      <div class="date">${esc(fmt(d.date, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${typeLbl}${r.name ? ' · ' + esc(r.name) : ''}</div>
      <h1>${esc(d.title)}</h1><div class="credit">${creditLine(pic)}</div></div></div>`);
    const leg = (a, b) => `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=driving`;
    const stopCard = (p, i, list) => {
      const g = p.guide, prevStop = list[i - 1];
      return `${prevStop ? `<div class="leg"><span>⬇</span><a href="${leg(prevStop, p)}" target="_blank" rel="noopener">נסיעה מ${esc(prevStop.name)} – זמן ומסלול בגוגל</a></div>` : ''}
      <article class="card stopcard">
        <a href="#/point/${p.id}">${imgTag(firstImg(p.id), 'img', p.name)}</a>
        <div class="bd">
          <div class="ttl"><h3><span class="snum">${i + 1}</span>${esc(p.name)}${hasAttr(p)}</h3>${pointStatus(p)}</div>
          <div class="meta">⏱️ ${esc(p.visit || (g ? g.duration.recommended : 'טרם הוערך'))}${p.sub ? ' · ' + esc(p.sub) : ''}</div>
          <p class="desc" style="margin-top:6px">${esc(p.see || p.summary || '')}</p>
          <details class="more"><summary class="btn block">מה רואים, ציוד ומזג אוויר</summary>
            <div class="facts" style="margin-top:10px">
              ${g ? `<div class="fact wide"><b>🥾 מה עושים</b>${g.activities.map(a => `<div class="act">${a.required ? ST('must', 'חובה') : ST('option', 'אופציה')}<span>${esc(a.name)}</span></div>`).join('')}</div>` : (p.summary && p.see ? `<div class="fact wide"><b>📍 על המקום</b><span>${esc(p.summary)}</span></div>` : '')}
              <div class="fact wide"><b>🧥 ציוד וביגוד</b><span>${g ? esc(g.clothing.slice(0, 3).join(' · ')) : esc(r.clothing.summary)}</span></div>
              ${g?.important?.length ? `<div class="fact wide" style="background:#fffbeb;border-color:#fde68a"><b>⚠️ חשוב</b><span>${esc(g.important[0])}</span></div>` : ''}
              <div class="fact wide"><b>🌡️ מזג אוויר</b>${wx(p.lat, p.lng, d.date)}</div>
            </div>
            <p class="est">ⓘ זמני השהייה והציוד הם הערכה.</p>
          </details>
          <div class="foot"><a class="btn dark" href="#/point/${p.id}">למדריך המלא ›</a><a class="lnk" href="${nav(p).google}" target="_blank" rel="noopener">נווט</a></div>
        </div></article>`;
    };
    return `
      <article class="card"><div class="bd">
        <div class="ttl"><span class="meta">${esc(r.name)}</span>${lodge ? ST(lodge.status) : ''}</div>
        ${d.summary ? `<p class="desc">${esc(d.summary)}</p>` : ''}
        ${d.notes ? `<div class="notice">${esc(d.notes)}</div>` : ''}
        <div class="facts">
          <div class="fact wide"><b>⏱️ כמה זמן?</b><span>${esc(d.estTime || (d.type === 'free' ? 'יום פתוח' : 'טרם הוערך'))}</span></div>
          <div class="fact wide"><b>🎒 מה ללבוש או לקחת?</b><span>${esc([...(d.bring || []), ...r.clothing.bring].slice(0, 6).join(', '))}</span></div>
          ${d.weatherAlt ? `<div class="fact wide"><b>🌧️ אם מזג האוויר לא טוב</b><span>${esc(d.weatherAlt)}</span></div>` : ''}
          ${anchor ? `<div class="fact wide"><b>🌡️ תחזית</b>${wx(anchor.lat, anchor.lng, d.date)}</div>` : ''}
        </div>
        <div class="btn-row" style="margin-top:12px">${route ? `<a class="btn dark" href="${route}" target="_blank" rel="noopener">מסלול היום בגוגל מפות</a>` : ''}<a class="btn" href="#/region/${r.id}">לאזור ${esc(r.name)}</a></div>
      </div></article>
      <h2 class="sec" style="margin-top:22px">עצירות ביום הזה</h2>
      ${stops.length ? stops.map(stopCard).join('') : `<p class="lead">${d.type === 'cruise' ? 'יום שיט – אין עצירות בחוף.' : 'אין עדיין עצירות קבועות ליום הזה.'}</p>`}
      ${sugg.length ? `<h3 class="sub">הצעות לאזור (לא בתוכנית)</h3><div class="cards-2">${sugg.map(p => placeCard(p)).join('')}</div>` : ''}
      <h2 class="sec" style="margin-top:22px">איפה ישנים?</h2>
      <article class="card"><div class="bd">${lodge ? `<div class="ttl"><h3>${esc(lodge.city)}</h3>${ST(lodge.status)}</div><p class="desc ${/טרם נקבע/.test(lodge.name) ? 'muted' : ''}">${esc(lodge.name)}</p>${lodge.notes ? `<p class="small muted">${esc(lodge.notes)}</p>` : ''}` : '<p class="muted">אין לינה (סוף הטיול).</p>'}
        <div class="foot"><a class="btn" href="#/hotels">כל המלונות</a></div></div></article>
      <div class="btn-row" style="margin-top:8px">
        ${prev ? `<a class="btn" href="#/day/${prev.date}">› ${esc(fDay(prev.date))}</a>` : ''}
        ${next ? `<a class="btn" href="#/day/${next.date}">${esc(fDay(next.date))} ‹</a>` : ''}
      </div>`;
  };

  V.today = () => {
    const t = today(), first = toDate(D.days[0].date), last = toDate(D.days[D.days.length - 1].date);
    if (t >= first && t <= last) { const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; return V.day(iso); }
    const before = t < first;
    return `<h2 class="sec">היום בטיול</h2>
      <p class="lead">${before ? `הטיול מתחיל בעוד ${daysTo(D.days[0].date)} ימים. מ־19/8/2027 יופיע כאן מסלול היום אוטומטית.` : 'הטיול הסתיים.'}</p>
      <h3 class="sub">כל הימים</h3>
      ${D.days.map(d => `<a class="stop" href="#/day/${d.date}"><span class="n" style="background:${region(d.region)?.color || '#64748b'}">${esc(String(toDate(d.date).getDate()))}</span>
        ${(() => { const c = d.points.map(point).filter(p => p && p.kind !== 'transport').map(p => firstImg(p.id)).find(Boolean); return c ? `<img src="${esc(c.file)}" alt="" loading="lazy">` : '<span class="ph"></span>'; })()}
        <span class="g"><b>${esc(d.title)}</b><span class="s" style="display:block">${esc(fDay(d.date))} · ${esc(region(d.region)?.name || '')}</span></span></a>`).join('')}`;
  };

  V.map = () => {
    const embed = D.meta.googleMyMapsEmbed;
    let i = 0;
    return `<h2 class="sec">מפת הטיול</h2>
      <p class="lead">${embed ? 'מפת Google My Maps של כל המסלול.' : 'כל התחנות לפי הסדר. לחצו על נקודה כדי לפתוח את המדריך או לנווט.'}</p>
      <div class="filters"><div><label for="regF">אזור</label><select id="regF"><option value="">כל המסע</option>${D.regions.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></div>
        <div><label for="kindF">להציג</label><select id="kindF"><option value="">הכול</option><option value="plan">רק מה שבתוכנית</option></select></div></div>
      ${embed ? `<iframe class="gframe" src="${esc(embed)}" loading="lazy" title="מפת Google My Maps"></iframe>` : '<div id="map" role="application" aria-label="מפה"></div>'}
      <div class="btn-row" style="margin:12px 0 18px">
        <button class="btn" id="kmlBtn">ייצוא ל־Google My Maps (KML)</button>
        <button class="btn" id="listBtn">רשימה לאופליין</button>
      </div>
      <div id="stops">${D.regions.map(r => `<h3 class="sub" style="margin-top:8px">${esc(r.name)} <span class="tiny">${esc(fLong(r.from))}–${esc(fLong(r.to))}</span></h3>` +
        D.points.filter(p => p.region === r.id).map(p => `<a class="stop" href="#/point/${p.id}" data-region="${r.id}" data-plan="${p.optional ? 0 : 1}">
          <span class="n" style="background:${r.color}">${++i}</span>${firstImg(p.id) ? `<img src="${esc(firstImg(p.id).file)}" alt="" loading="lazy">` : '<span class="ph"></span>'}
          <span class="g"><b>${esc(p.name)}</b><span class="s" style="display:block">${p.days?.length ? esc(p.days.map(fDay).join(', ')) : 'לא שובץ'}${p.suggestion ? ' · הצעה' : p.optional ? ' · אופציה' : ''}</span>
          <span class="s num" style="display:block;text-align:right">${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</span></span></a>`).join('')).join('')}</div>`;
  };
  V.map.after = () => {
    const rf = $('#regF'), kf = $('#kindF');
    const visible = () => D.points.filter(p => (!rf.value || p.region === rf.value) && (!kf.value || !p.optional));
    const filterList = () => document.querySelectorAll('#stops .stop').forEach(s => { s.hidden = (rf.value && s.dataset.region !== rf.value) || (kf.value && s.dataset.plan === '0'); });
    $('#listBtn').addEventListener('click', () => $('#stops').scrollIntoView({ behavior: 'smooth' }));
    $('#kmlBtn').addEventListener('click', exportKML);
    let layer;
    if (!D.meta.googleMyMapsEmbed && typeof L !== 'undefined' && $('#map')) {
      mapInstance = L.map('map');
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(mapInstance);
      layer = L.layerGroup().addTo(mapInstance);
    }
    const draw = () => {
      filterList(); if (!layer) return;
      layer.clearLayers();
      const pts = visible();
      pts.forEach(p => {
        const r = region(p.region);
        L.circleMarker([p.lat, p.lng], { radius: p.optional ? 7 : 9, color: '#fff', weight: 2, fillColor: r.color, fillOpacity: p.optional ? .65 : 1 })
          .bindPopup(`<b>${esc(p.name)}</b><br>${esc(r.name)}${p.days?.length ? ' · ' + esc(p.days.map(fDay).join(', ')) : ''}<br><a href="#/point/${p.id}">למדריך</a> · <a href="${nav(p).google}" target="_blank" rel="noopener">נווט</a>`).addTo(layer);
      });
      if (pts.length) mapInstance.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])).pad(.12), { maxZoom: 12 });
    };
    rf.addEventListener('change', draw); kf.addEventListener('change', draw);
    draw();
  };
  function exportKML() {
    const pm = D.points.map(p => `<Placemark><name>${esc(p.nameEn || p.name)}</name><description>${esc(p.name)} · ${esc(region(p.region).name)}${p.days?.length ? ' · ' + p.days.join(', ') : ''}</description><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>`).join('');
    const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(D.meta.title)}</name>${pm}</Document></kml>`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' })); a.download = 'trip-2027.kml'; a.click();
    toast('הקובץ ירד. ב־Google My Maps: יצירת מפה ← ייבוא.');
  }

  function attrMini(a) {
    const p = point(a.point);
    return `<div class="task ${a.booking === 'required' ? 'hot' : ''}"><div class="g">
      <div class="t">${esc(a.name)}</div>
      <div class="s"><b>${bookingLabel(a.booking)}</b>${a.opens ? ` · נפתח ${esc(fFull(a.opens))} (${esc(a.opensNote)})` : ''}${a.date ? ' · ' + esc(fDay(a.date)) : ''}</div>
      ${a.notes ? `<div class="s">${esc(a.notes)}</div>` : ''}
      <div class="btn-row" style="margin-top:6px">${a.url ? `<a class="lnk" href="${esc(a.url)}" target="_blank" rel="noopener">להזמנה / אתר רשמי ›</a>` : ''}${p ? `<a class="lnk" href="#/point/${p.id}">${esc(p.name)} ›</a>` : ''}</div>
    </div>${ST(a.status, a.status === 'option' && p?.suggestion ? 'הצעה' : undefined)}</div>`;
  }
  const bookingLabel = (b) => ({ required: 'חובה להזמין מראש', recommended: 'מומלץ להזמין מראש', check: 'לבדוק אם צריך להזמין', optional: 'אפשר להזמין מראש', none: 'לא נדרשת הזמנה (לבדוק)' }[b] || '');

  V.tasks = () => {
    const dn = done();
    const dated = datedItems();
    const datedIds = new Set(dated.map(x => x.id));
    const row = (id, title, sub, right, url, hot) => `<div class="task ${dn[id] ? 'done' : ''} ${hot ? 'hot' : ''}">
        <input type="checkbox" data-done="${id}" ${dn[id] ? 'checked' : ''} aria-label="בוצע: ${esc(title)}">
        <div class="g"><div class="t">${esc(title)}</div>${sub ? `<div class="s">${sub}</div>` : ''}${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">קישור ›</a>` : ''}</div>${right || ''}</div>`;
    const toclose = D.tasks.filter(t => !datedIds.has(t.id) && t.status === 'toclose' && !dn[t.id]);
    const planning = D.tasks.filter(t => !datedIds.has(t.id) && ['planning', 'option'].includes(t.status) && !dn[t.id]);
    const entry = D.entry.items.filter(i => i.status !== 'done').sort((a, b) => a.order - b.order);
    const finished = [...D.tasks, ...D.entry.items, ...D.attractions].filter(t => dn[t.id]);
    return `<h2 class="sec">משימות</h2>
      <p class="lead">${dated.length + toclose.length + planning.length + entry.filter(e => !dn[e.id]).length} פתוחות · ממוינות לפי מה שהכי דחוף.</p>
      <div class="grp red">● יש תאריך קבוע</div>
      ${dated.map((u, k) => row(u.id, u.title, esc(u.sub), countBox(u.date), u.url, k === 0)).join('')}
      <div class="grp amber">● לסגור</div>
      ${toclose.map(t => row(t.id, t.title, esc([t.category, t.notes].filter(Boolean).join(' · ')), ST('toclose'), t.url)).join('')}
      <div class="grp blue">● מסמכים, כניסה ובריאות</div>
      <div class="notice">נבדק במקורות רשמיים ב־${esc(fFull(D.entry.checkedOn))}. ${esc(D.entry.disclaimer)}</div>
      ${entry.map(i => row(i.id, i.title, (i.deadline ? `<b>מתי:</b> ${esc(i.deadline)}` : '') + `<details><summary class="lnk" style="font-size:13.5px;cursor:pointer">פרטים ומקורות רשמיים</summary><p class="s" style="margin-top:6px">${esc(i.what)}</p>${i.tip ? `<p class="s">💡 ${esc(i.tip)}</p>` : ''}${i.facts.map(f => `<a class="src" href="${esc(f.source)}" target="_blank" rel="noopener">${esc(f.text)} · ${esc(new URL(f.source).hostname.replace(/^www\./, ''))} ›</a>`).join('')}</details>`, ST(i.status))).join('')}
      <div class="grp gray">● בתכנון ולבדוק</div>
      ${planning.map(t => row(t.id, t.title, esc([t.category, t.notes].filter(Boolean).join(' · ')), ST(t.status), t.url)).join('')}
      ${finished.length ? `<details><summary class="grp gray" style="cursor:pointer">✓ בוצעו (${finished.length})</summary>${finished.map(t => row(t.id, t.title || t.name, '', ST('done'))).join('')}</details>` : ''}
      <p class="tiny" style="margin-top:12px">הסימון ״בוצע״ נשמר במכשיר הזה. כדי שכולם יראו אותו, צריך לעדכן במצב עריכה ולפרסם.</p>`;
  };
  V.tasks.after = () => view.querySelectorAll('[data-done]').forEach(cb => cb.addEventListener('change', () => { const m = done(); m[cb.dataset.done] = cb.checked; LS.set('tg.done', m); toast(cb.checked ? 'סומן כבוצע ✓' : 'הוחזר לפתוחות'); route(); }));

  V.attractions = () => `<h2 class="sec">אטרקציות</h2>
      <p class="lead">מה צריך להזמין, מתי ההזמנה נפתחת, ומה רק אופציה.</p>
      <div class="filters"><div><label for="aReg">אזור</label><select id="aReg"><option value="">הכול</option>${D.regions.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></div>
        <div><label for="aBook">הזמנה</label><select id="aBook"><option value="">הכול</option><option value="required">חובה להזמין</option><option value="recommended">מומלץ להזמין</option></select></div></div>
      <div class="cards-2" id="aList">${D.attractions.slice().sort((a, b) => (a.booking === 'required' ? 0 : 1) - (b.booking === 'required' ? 0 : 1)).map(a => {
        const p = point(a.point), r = region(a.region);
        return `<article class="card" data-region="${a.region}" data-booking="${a.booking}">${p ? `<a href="#/point/${p.id}">${imgTag(firstImg(p.id), 'img short', a.name)}</a>` : ''}<div class="bd">
          <div class="meta">${esc(r?.name || '')}${a.date ? ' · ' + esc(fDay(a.date)) : ''}</div>
          <div class="ttl"><h3>${esc(a.name)}</h3>${ST(a.status, a.status === 'option' && p?.suggestion ? 'הצעה' : undefined)}</div>
          <p class="desc"><b>${bookingLabel(a.booking)}</b>${a.opens ? ` · נפתח ${esc(fFull(a.opens))} (${esc(a.opensNote)})` : ''}</p>
          ${a.notes ? `<p class="small muted">${esc(a.notes)}</p>` : ''}
          <p class="small">עלות: ${a.cost ? money(a.cost.amount, a.cost.currency) : '<span class="muted">טרם אומתה</span>'}</p>
          <div class="foot">${a.url ? `<a class="btn dark" href="${esc(a.url)}" target="_blank" rel="noopener">להזמנה / אתר רשמי</a>` : '<span class="tiny">אין עדיין קישור</span>'}${p ? `<a class="lnk" href="#/point/${p.id}">למדריך</a>` : ''}</div>
        </div></article>`; }).join('')}</div>`;
  V.attractions.after = () => {
    const r = $('#aReg'), b = $('#aBook');
    const f = () => document.querySelectorAll('#aList > article').forEach(a => { a.hidden = (r.value && a.dataset.region !== r.value) || (b.value && a.dataset.booking !== b.value); });
    r.addEventListener('change', f); b.addEventListener('change', f);
  };

  V.budget = () => {
    const tot = { booked: {}, option: {}, due: {} };
    D.budget.categories.forEach(c => c.items.forEach(i => {
      if (i.amount == null) return;
      const bucket = i.status === 'booked' ? 'booked' : 'option';
      tot[bucket][i.currency] = (tot[bucket][i.currency] || 0) + i.amount;
      if (i.paid != null) tot.due[i.currency] = (tot.due[i.currency] || 0) + (i.amount - i.paid);
    }));
    const list = (o) => Object.keys(o).length ? Object.entries(o).map(([c, a]) => money(a, c)).join('<br>') : '<span class="muted">—</span>';
    return `<h2 class="sec">תקציב מול הזמנות</h2>
      <p class="lead">${esc(D.budget.note)} כל סכום מוצג במטבע המקורי, בלי המרה.</p>
      <div class="tot"><div><b>הוזמן</b><span>${list(tot.booked)}</span></div><div><b>נשאר לשלם</b><span>${list(tot.due)}</span></div><div><b>אופציות</b><span>${list(tot.option)}</span></div></div>
      ${D.budget.categories.map(c => {
        const paidItem = c.items.find(i => i.paid != null);
        return `<article class="card"><div class="bd">
          <div class="ttl"><h3>${c.icon} ${esc(c.label)}</h3><span class="small">תקציב: ${c.budget != null ? money(c.budget.amount, c.budget.currency) : '<span class="muted">להזין</span>'}</span></div>
          ${c.items.length ? c.items.map(i => `<div class="line-item"><span>${esc(i.label)} ${ST(i.status)}${i.paid != null ? `<br><span class="tiny">שולם ${money(i.paid, i.currency)} · יתרה ${money(i.amount - i.paid, i.currency)} עד ${esc(fFull(i.due))}</span>` : ''}</span><span class="v">${i.approx && i.amount != null ? '~' : ''}${money(i.amount, i.currency)}</span></div>`).join('') : '<p class="small muted">אין עדיין פריטים.</p>'}
          ${paidItem ? `<div class="bar" aria-label="שולם מול יתרה"><i style="width:${(100 * paidItem.paid / paidItem.amount).toFixed(1)}%;background:var(--green)"></i><i style="width:${(100 - 100 * paidItem.paid / paidItem.amount).toFixed(1)}%;background:var(--amberfill)"></i></div><p class="tiny" style="margin-top:4px">ירוק = שולם · כתום = יתרה</p>` : ''}
        </div></article>`; }).join('')}
      <p class="tiny">${esc(D.hotelsNote)} מחירי האופציות נבדקו בעבר ואינם מובטחים.</p>`;
  };

  V.transport = () => {
    const tzn = (tz) => ({ 'Asia/Jerusalem': 'שעון ישראל', 'America/Los_Angeles': 'שעון האוקיינוס השקט', 'America/Edmonton': 'שעון ההרים' }[tz] || tz);
    const c = D.cruise;
    return `<h2 class="sec">טיסות, קרוז ורכב</h2><p class="lead">כל השעות מקומיות.</p>
      ${D.flights.map(f => `<article class="card"><div class="bd">
        <div class="ttl"><span class="meta">${esc(fDay(f.date))} · ${esc(f.flight)} · ${esc(f.carrier)}</span>${ST(f.status)}</div>
        <div class="seg-route"><span>${esc(f.from)}</span><i>→</i><span>${esc(f.to)}</span></div>
        <div class="facts" style="margin-top:8px">
          <div class="fact"><b>יציאה · ${esc(tzn(f.fromTz))}</b><span class="num" style="font-size:20px;font-weight:800">${esc(f.dep || 'טרם נקבע')}</span>${f.fromTerminal ? `<div class="tiny">טרמינל ${esc(f.fromTerminal)}</div>` : ''}</div>
          <div class="fact"><b>נחיתה · ${esc(tzn(f.toTz))}</b><span class="num" style="font-size:20px;font-weight:800">${esc(f.arr || 'טרם נקבע')}</span><div class="tiny">${f.toTerminal ? 'טרמינל ' + esc(f.toTerminal) : ''}${f.arrDate && f.arrDate !== f.date ? ' · ' + esc(fDay(f.arrDate)) : ''}</div></div>
        </div>${f.notes ? `<p class="small muted" style="margin-top:6px">${esc(f.notes)}</p>` : ''}</div></article>`).join('')}
      <article class="card"><div class="bd"><h3 class="sub" style="margin-top:0">עלות טיסות אל על</h3>
        ${D.flightsInfo.costPerTraveler.map(x => `<div class="line-item"><span>${esc(x.label)} (לנוסע)</span><span class="v">${money(x.amount, x.currency)}</span></div>`).join('')}
        <div class="line-item"><b>סה״כ לזוג</b><b class="v">${money(D.flightsInfo.totalCouple.amount, 'USD')}</b></div>
        <p class="small muted">${esc(D.flightsInfo.baggage)}</p></div></article>
      <h3 class="sub">🚢 ${esc(c.ship)} ${ST(c.status)}</h3>
      <article class="card"><div class="bd">
        <div class="facts"><div class="fact"><b>עלייה</b><span>${esc(fDay(c.embark.date))} · <b class="num" style="display:inline">${esc(c.embark.time)}</b> · ${esc(c.embark.place)}</span></div>
          <div class="fact"><b>הגעה לסיאטל</b><span>${esc(fDay(c.arrival.date))} · <b class="num" style="display:inline">${esc(c.arrival.time)}</b></span></div></div>
        <div class="notice" style="margin-top:10px">${esc(c.arrival.note)} ${esc(c.verify)}</div>
        <ul class="timeline">${c.itinerary.map(s => `<li><span class="when">${esc(fDay(s.date))}</span><span>${esc(s.place)}</span></li>`).join('')}</ul>
        <div class="line-item"><span>סה״כ</span><span class="v">${money(c.total.amount, 'ILS')}</span></div>
        <div class="line-item"><span>שולם (${esc(c.paid.note)})</span><span class="v">${money(c.paid.amount, 'ILS')}</span></div>
        <div class="line-item"><b>יתרה עד ${esc(fFull(c.balance.due))}</b><b class="v">${money(c.balance.amount, 'ILS')}</b></div>
        <div class="line-item"><span>דמי שירות (${esc(c.gratuities.note)})</span><span class="v">~${money(c.gratuities.approxTotal, 'USD')}</span></div>
        <p class="small muted">${esc(c.balance.note)}</p></div></article>
      <h3 class="sub">🚗 רכב</h3>
      ${D.cars.map(r => `<article class="card"><div class="bd"><div class="ttl"><h3>${esc(r.where)}</h3>${ST(r.status)}</div>
        <div class="facts"><div class="fact"><b>איסוף</b><span>${esc(fDay(r.pickup))} · ${esc(r.pickupPlace)}</span></div><div class="fact"><b>החזרה</b><span>${esc(fDay(r.dropoff))} · ${esc(r.dropoffPlace)}</span></div></div>
        <p class="small" style="margin-top:6px">מחיר: ${r.price ? money(r.price.amount, r.price.currency) : '<span class="muted">טרם נקבע</span>'}</p></div></article>`).join('')}`;
  };

  V.hotels = () => `<h2 class="sec">מלונות</h2><p class="lead">לפי לילות. ״טרם נקבע״ = עוד לא הוזמן.</p>
    ${D.hotels.map(h => { const n = h.checkIn && h.checkOut ? nights(h.checkIn, h.checkOut) : null; return `<article class="card"><div class="bd">
      <div class="meta">${esc(fDay(h.checkIn))} → ${h.checkOut ? esc(fDay(h.checkOut)) : 'טרם נקבע'}${n ? ` · ${n} לילות` : ''}</div>
      <div class="ttl"><h3>${esc(h.city)}</h3>${ST(h.status)}</div>
      <p class="desc ${/טרם נקבע/.test(h.name) ? 'muted' : ''}">${esc(h.name)}</p>
      <div class="facts"><div class="fact"><b>מחיר סופי לזוג</b><span>${['cruise', 'plane'].includes(h.id) ? 'כלול' : h.price ? money(h.price.amount, h.price.currency) : '<span class="muted">טרם נקבע</span>'}</span></div>
        <div class="fact"><b>מקדמה</b><span>${h.deposit ? money(h.deposit.amount, h.deposit.currency) + ' ' + esc(h.deposit.note || '') : '<span class="muted">—</span>'}</span></div>
        <div class="fact"><b>ביטול</b><span>${h.cancelBy ? esc(h.cancelBy) : '<span class="muted">—</span>'}</span></div>
        <div class="fact"><b>קישור</b><span>${h.url ? `<a href="${esc(h.url)}" target="_blank" rel="noopener">לאתר ›</a>` : '<span class="muted">—</span>'}</span></div></div>
      ${h.notes ? `<p class="small muted" style="margin-top:8px">${esc(h.notes)}</p>` : ''}</div></article>`; }).join('')}
    <p class="tiny">${esc(D.hotelsNote)}</p>`;

  V.more = () => `<h2 class="sec">מצב עריכה ואופליין</h2>
    <article class="card"><div class="bd"><h3 class="sub" style="margin-top:0">📶 שמור הכול לאופליין</h3>
      <p class="small">האפשרות שומרת במכשיר את האתר, את הנתונים ואת כל התמונות. מהמפה נשמרים רק אזורים שכבר הוצגו, לפי מדיניות OpenStreetMap. מפות מלאות לניווט כדאי להוריד ב־Google Maps או ב־Maps.me.</p>
      <button class="btn dark block" id="saveOff" style="margin-top:10px">שמור הכול לאופליין</button>
      <div class="progress" id="offProg" hidden><i></i></div>
      <p class="small" id="offStatus" style="margin-top:8px">${LS.get('tg.offlineAt') ? '✓ נשמר לאחרונה ב־' + esc(new Date(LS.get('tg.offlineAt')).toLocaleString('he-IL')) : 'עוד לא נשמר במכשיר הזה.'}</p></div></article>
    <article class="card"><div class="bd"><h3 class="sub" style="margin-top:0">✏️ מצב עריכה</h3>
      <div class="notice"><b>עריכה במכשיר הזה לא מגיעה לצופים</b> עד שמפרסמים גרסה חדשה של <span class="ltr">trip.json</span>.<br><b>מצב עריכה אינו הרשאת אבטחה.</b> כל מי שיש לו את הקישור רואה את כל התוכן.</div>
      <p class="small muted">עריכה, ייצוא וייבוא ייבנו בשלב הבא.</p></div></article>`;
  V.more.after = () => $('#saveOff').addEventListener('click', saveOffline);

  V.credits = () => `<h2 class="sec">קרדיטים</h2>
    <p class="lead">מפה © OpenStreetMap contributors · Leaflet 1.9.4 (BSD-2) · תחזית Open-Meteo · גופן Heebo (SIL OFL). כל התמונות מ־Wikimedia Commons ברישיון חופשי.</p>
    ${Object.entries(CR).map(([pid, list]) => `<article class="card"><div class="bd"><b>${esc(point(pid)?.name || pid)}</b>${list.map(c => `<div class="small" style="margin-top:4px">${creditLine(c)} · <span class="tiny">${esc(c.title)}</span></div>`).join('')}</div></article>`).join('') || '<p>אין עדיין תמונות.</p>'}`;

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
        else { LS.set('tg.offlineAt', Date.now()); st.textContent = `✓ הכול נשמר (${total} קבצים). אפשר לעבור למצב טיסה.`; toast('השמירה לאופליין הושלמה ✓'); }
      }
    };
    reg.active.postMessage({ type: 'cache-all', extra: Object.values(CR).flat().map(c => c.file) }, [ch.port2]);
  }

  /* ---------- router ---------- */
  function hero(html) { $('#heroSlot').innerHTML = html; }
  function route() {
    const [, name = 'journey', a, b] = (location.hash || '#/journey').split('/');
    const v = V[name] || V.journey;
    if (mapInstance) { mapInstance.remove(); mapInstance = null; }
    hero(''); $('#brandText').textContent = D.meta.title;
    view.innerHTML = v(a, b);
    v.after && v.after(a, b);
    const tab = { region: 'journey', point: 'journey', day: 'today' }[name] || name;
    document.querySelectorAll('#tabs a').forEach(t => { const on = t.dataset.tab === tab; t.classList.toggle('on', on); if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
  }

  async function boot() {
    const net = () => { $('#netBadge').hidden = navigator.onLine; };
    net(); addEventListener('online', net); addEventListener('offline', net);
    try {
      const [trip, credits] = await Promise.all([
        fetch('data/trip.json').then(r => r.json()),
        fetch('data/credits.json').then(r => r.ok ? r.json() : {}).catch(() => ({}))
      ]);
      D = trip; CR = credits.points || {};
    } catch { view.innerHTML = '<div class="notice">לא הצלחתי לטעון את נתוני הטיול. נסו לרענן כשיש חיבור.</div>'; return; }
    addEventListener('hashchange', route);
    route();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  boot();
})();
