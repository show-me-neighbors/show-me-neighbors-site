// Show-Me Neighbors: "Good Days Out" (statewide page + every county page).
// Data (built by setup/build-good-days-out.py):
//   /good-days-out/data/places.json  { items:[{id,name,category,county,town,address,website,what,access,cost,schedule,months,lat,lon,approx}], regions:[{name,counties:[...]}], live:[...] }
//   /good-days-out/data/towns.json   [[town, county, lat, lon], ...]  every Missouri town and place (US Census 2024)
//   /good-days-out/data/zips.json    { "65802":[lat,lon], ... }        Missouri ZIP code centers (US Census 2024)
// County pages set window.GDO = { county: "Barry" } before this script.
(function () {
  'use strict';
  var CFG = window.GDO || {};
  var BASE = '/good-days-out/';
  var ICONS = '/assets/gdo-icons.svg';
  var CATS = {
    'senior-center':      { label: 'Senior centers',        icon: 'i-handshake',   color: '#2a5677' },
    'library':            { label: 'Libraries',             icon: 'i-book',        color: '#376d93' },
    'park-garden':        { label: 'Parks & nature',        icon: 'i-sprout',      color: '#3c7d55' },
    'museum-history':     { label: 'Museums & history',     icon: 'i-compass',     color: '#9a5f0e' },
    'arts-music-classes': { label: 'Music, arts & shows',   icon: 'i-music',       color: '#6b4b94' },
    'exercise':           { label: 'Staying active',        icon: 'i-strength',    color: '#1f6f84' },
    'events-seasonal':    { label: 'Festivals & events',    icon: 'i-calendar',    color: '#b4472a' },
    'everyday':           { label: 'Markets, main streets & treats', icon: 'i-bag', color: '#4f5e78' },
    'volunteering':       { label: 'Giving back',           icon: 'i-heart-honey', color: '#a26c0c' }
  };
  var INTERESTS = [
    { key: 'friends',  label: 'Good company',       cats: ['senior-center', 'arts-music-classes'] },
    { key: 'nature',   label: 'Fresh air & nature', cats: ['park-garden'] },
    { key: 'history',  label: 'History & stories',  cats: ['museum-history'] },
    { key: 'books',    label: 'Books & learning',   cats: ['library'] },
    { key: 'arts',     label: 'Music & shows',      cats: ['arts-music-classes'] },
    { key: 'active',   label: 'Moving more',        cats: ['exercise', 'park-garden'] },
    { key: 'treats',   label: 'Shops, markets & pie', cats: ['everyday'] },
    { key: 'giving',   label: 'Giving back',        cats: ['volunteering'] },
    { key: 'events',   label: 'Festivals',          cats: ['events-seasonal'] }
  ];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var PAGE = 24;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function icon(id, cls) { return '<svg class="' + (cls || 'gdo-ic') + '" aria-hidden="true"><use href="' + ICONS + '#' + id + '"/></svg>'; }
  function miles(a, b) {
    var R = 3958.8, t = Math.PI / 180, dLa = (b[0] - a[0]) * t, dLo = (b[1] - a[1]) * t;
    var h = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function slug(county) { return county.toLowerCase().replace(/\./g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + (/city$/i.test(county) ? '' : '-county'); }
  function countyName(c) { return /city$/i.test(c) ? c : c + ' County'; }
  function vague(s) { return !s || /not stated|not confirmed|^unknown|^n\/a/i.test(s); }
  function from(code) { return '?from=' + code; }

  var DATA = [], TOWNS = [], ZIPS = {}, REGIONS = [], LIVE = [];
  var map, cluster, markers = {}, hereMarker;
  var state = { cat: 'all', county: CFG.county || 'all', q: '', radius: 0, where: null, shown: PAGE };

  /* ---------- Where are you? (town or ZIP) ---------- */
  function townLabel(t) { return t[0] + ', ' + countyName(t[1]); }
  function findPlace(text) {
    text = (text || '').trim();
    if (!text) return null;
    var zip = text.match(/\b(\d{5})\b/);
    if (zip) {
      var z = ZIPS[zip[1]];
      if (!z) return { error: 'We could not find ZIP ' + zip[1] + ' in Missouri.' };
      var best = null, bd = 1e9;
      TOWNS.forEach(function (t) { var d = miles(z, [t[2], t[3]]); if (d < bd) { bd = d; best = t; } });
      return { pt: z, label: 'ZIP ' + zip[1], county: best ? best[1] : '', town: best ? best[0] : '' };
    }
    var low = text.toLowerCase().replace(/,?\s*(mo|missouri)$/, '').trim();
    var exact = TOWNS.filter(function (t) { return townLabel(t).toLowerCase() === low; })[0] ||
      TOWNS.filter(function (t) { return t[0].toLowerCase() === low; })[0] ||
      TOWNS.filter(function (t) { return t[0].toLowerCase().indexOf(low) === 0; })[0];
    if (!exact) return { error: 'We could not find "' + text + '". Try a nearby town or your ZIP code.' };
    return { pt: [exact[2], exact[3]], label: exact[0], county: exact[1], town: exact[0] };
  }
  function fillTownList() {
    var dl = $('gdo-townlist'); if (!dl) return;
    dl.innerHTML = TOWNS.map(function (t) { return '<option value="' + esc(townLabel(t)) + '">'; }).join('');
  }
  function nearMessage(w) {
    var el = $('gdo-near'); if (!el) return;
    var live = LIVE.indexOf(w.county) > -1;
    var n = DATA.filter(function (it) { return it.lat != null && miles(w.pt, [it.lat, it.lon]) <= 25; }).length;
    el.innerHTML = '<b>' + n + ' good days out within 25 miles of ' + esc(w.label) + '.</b> ' +
      (live ? 'Neighbors are getting started in ' + esc(countyName(w.county)) + ' now. <a href="/family/' + from('gdo-near') + '">Make a free family account</a>.'
            : 'Show-Me Neighbors is growing across Missouri. <a href="/family/' + from('gdo-near') + '">Join free</a> and we will tell you when Neighbors reach ' + esc(countyName(w.county || 'your county')) + ', or <a href="/apply/' + from('gdo-near') + '">become one of the first Neighbors there</a>.');
    el.classList.add('on');
  }
  function setWhere(w, opts) {
    state.where = w; state.shown = PAGE;
    if (!CFG.county) { state.county = 'all'; var cs = $('gdo-county'); if (cs) cs.value = 'all'; }
    if (!state.radius && !CFG.county) state.radius = 25;
    var rs = $('gdo-radius'); if (rs) rs.value = String(state.radius);
    nearMessage(w);
    var bw = $('gdo-bwhere'); if (bw && (!bw.value || (opts && opts.fromHero))) bw.value = w.town ? w.town + ', ' + countyName(w.county) : w.label;
    renderExplorer(true); buildDay(); renderCalendar();
    try { localStorage.setItem('smn-gdo-where', JSON.stringify(w)); } catch (e) {}
  }
  function setupFind() {
    var f = $('gdo-find'); if (!f) return;
    var input = $('gdo-where'), err = $('gdo-find-err');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var w = findPlace(input.value);
      if (!w) { input.focus(); return; }
      if (w.error) { err.textContent = w.error; err.hidden = false; return; }
      err.hidden = true; setWhere(w, { fromHero: true });
      var ex = $('gdo-explore'); if (ex) ex.scrollIntoView({ behavior: 'smooth' });
    });
    var me = $('gdo-locate');
    if (me && navigator.geolocation) {
      me.hidden = false;
      me.addEventListener('click', function () {
        me.textContent = 'Finding you...';
        navigator.geolocation.getCurrentPosition(function (p) {
          var pt = [p.coords.latitude, p.coords.longitude], best = null, bd = 1e9;
          TOWNS.forEach(function (t) { var d = miles(pt, [t[2], t[3]]); if (d < bd) { bd = d; best = t; } });
          me.textContent = 'Use my location';
          if (!best || bd > 40) { err.textContent = 'You look to be outside Missouri. Type a Missouri town instead.'; err.hidden = false; return; }
          input.value = townLabel(best);
          setWhere({ pt: pt, label: best[0], county: best[1], town: best[0] }, { fromHero: true });
          var ex = $('gdo-explore'); if (ex) ex.scrollIntoView({ behavior: 'smooth' });
        }, function () { me.textContent = 'Use my location'; err.textContent = 'We could not get your location. Type your town instead.'; err.hidden = false; }, { timeout: 10000 });
      });
    }
  }

  /* ---------- Cards ---------- */
  function cardHtml(it) {
    var c = CATS[it.category] || CATS.everyday, meta = [];
    if (!vague(it.schedule)) meta.push('<span>' + icon('i-calendar', 'gdo-mi') + esc(it.schedule) + '</span>');
    if (!vague(it.cost)) meta.push('<span>' + icon('i-money', 'gdo-mi') + esc(it.cost) + '</span>');
    var d = state.where && !state.where.auto && it.lat != null ? Math.max(1, Math.round(miles(state.where.pt, [it.lat, it.lon]))) : null;
    return '<article class="gdo-card" style="--c:' + c.color + '">' +
      '<div class="gdo-card-top"><span class="gdo-tag">' + icon(c.icon, 'gdo-tag-ic') + esc(c.label) + '</span><span class="gdo-town">' + esc(it.town) + '</span></div>' +
      '<h3>' + esc(it.name) + '</h3>' +
      '<p>' + esc(it.what) + '</p>' +
      (it.access ? '<p class="gdo-access">' + icon('i-check', 'gdo-mi') + esc(it.access) + '</p>' : '') +
      (meta.length ? '<div class="gdo-meta">' + meta.join('') + '</div>' : '') +
      '<div class="gdo-links">' +
        (d != null ? '<span class="gdo-dist">About ' + d + (d === 1 ? ' mile' : ' miles') + ' away</span>' : (it.lat != null ? '<button type="button" class="gdo-show" data-id="' + it.id + '">Show on map</button>' : '<span></span>')) +
        (it.website ? '<a href="' + esc(it.website) + '" target="_blank" rel="noopener">' + esc(hostOf(it.website)) + ' &rarr;</a>' : '') +
      '</div></article>';
  }

  /* ---------- Explorer ---------- */
  function filtered() {
    var q = state.q.toLowerCase();
    var list = DATA.filter(function (it) {
      if (state.cat !== 'all' && it.category !== state.cat) return false;
      if (state.county !== 'all' && it.county !== state.county) {
        // On a county page, "nearby" distance widens beyond the county line
        if (!(CFG.county && state.radius && state.where && it.lat != null && miles(state.where.pt, [it.lat, it.lon]) <= state.radius)) return false;
      }
      if (!CFG.county && state.where && state.radius && (it.lat == null || miles(state.where.pt, [it.lat, it.lon]) > state.radius)) return false;
      if (q && (it.name + ' ' + it.what + ' ' + it.town + ' ' + it.county).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    if (state.where) {
      list.forEach(function (it) { it._d = it.lat != null ? miles(state.where.pt, [it.lat, it.lon]) : 9999; });
      list.sort(function (a, b) { return a._d - b._d; });
    }
    // No town typed yet: mix the types so the first cards show a park, a museum, a senior center, a festival...
    if ((!state.where || state.where.auto) && state.cat === 'all' && !state.q) {
      var MIX = ['park-garden', 'museum-history', 'senior-center', 'events-seasonal', 'arts-music-classes', 'everyday', 'library', 'exercise', 'volunteering'], by = {}, out = [];
      list.forEach(function (it) { (by[it.category] = by[it.category] || []).push(it); });
      for (var i = 0; out.length < list.length; i++) MIX.forEach(function (k) { if (by[k] && by[k][i]) out.push(by[k][i]); });
      if (!state.where) { var seedN = new Date().getDate(); out = out.slice(seedN % 9).concat(out.slice(0, seedN % 9)); }
      list = out;
    }
    return list;
  }
  function renderExplorer(fit) {
    var grid = $('gdo-grid'); if (!grid) return;
    var list = filtered(), count = $('gdo-count'), more = $('gdo-more');
    var shown = list.slice(0, state.shown);
    grid.innerHTML = shown.length ? shown.map(cardHtml).join('') :
      '<p class="gdo-empty">Nothing matches yet. Try a wider distance, another type of outing, or clear the search.</p>';
    count.textContent = list.length.toLocaleString() + (list.length === 1 ? ' place' : ' places');
    if (more) { more.hidden = list.length <= state.shown; more.querySelector('button').textContent = 'Show ' + Math.min(PAGE, list.length - state.shown) + ' more of ' + (list.length - state.shown).toLocaleString(); }
    if (map && cluster) {
      cluster.clearLayers();
      var pts = [];
      list.forEach(function (it) { var m = markers[it.id]; if (m) { cluster.addLayer(m); pts.push(m.getLatLng()); } });
      if (hereMarker) { map.removeLayer(hereMarker); hereMarker = null; }
      if (state.where) {
        hereMarker = L.marker(state.where.pt, { zIndexOffset: 1000, title: state.where.label,
          icon: L.divIcon({ className: 'gdo-here', iconSize: [22, 22], iconAnchor: [11, 11], html: '<span></span>' }) }).addTo(map);
        pts.push(L.latLng(state.where.pt[0], state.where.pt[1]));
      }
      if (fit && pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 12 });
    }
  }
  function setupFilters() {
    var cats = $('gdo-cats'); if (!cats) return;
    var base = CFG.county ? DATA.filter(function (it) { return it.county === CFG.county; }) : DATA;
    var present = {}; base.forEach(function (it) { present[it.category] = (present[it.category] || 0) + 1; });
    var html = '<button type="button" data-cat="all" aria-pressed="true">Everything <b>' + base.length.toLocaleString() + '</b></button>';
    Object.keys(CATS).forEach(function (k) {
      if (present[k]) html += '<button type="button" data-cat="' + k + '" aria-pressed="false" style="--c:' + CATS[k].color + '">' + icon(CATS[k].icon, 'gdo-chip-ic') + CATS[k].label + ' <b>' + present[k] + '</b></button>';
    });
    cats.innerHTML = html;
    cats.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      cats.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true'); state.cat = b.getAttribute('data-cat'); state.shown = PAGE; renderExplorer(true);
    });
    var cs = $('gdo-county');
    if (cs) {
      var counts = {}; DATA.forEach(function (it) { counts[it.county] = (counts[it.county] || 0) + 1; });
      Object.keys(counts).sort().forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = countyName(c) + ' (' + counts[c] + ')'; cs.appendChild(o); });
      cs.addEventListener('change', function () {
        state.county = cs.value; state.shown = PAGE;
        if (cs.value !== 'all') { state.radius = 0; var rs = $('gdo-radius'); if (rs) rs.value = '0'; }
        renderExplorer(true);
      });
    }
    var rs = $('gdo-radius');
    if (rs) rs.addEventListener('change', function () {
      state.radius = +rs.value; state.shown = PAGE;
      if (state.radius && !state.where) {
        var w = $('gdo-where'); if (w) { w.focus(); var err = $('gdo-find-err'); if (err) { err.textContent = 'Type your town or ZIP first, then we can measure the distance.'; err.hidden = false; } w.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }
      if (state.radius && !CFG.county) { state.county = 'all'; if (cs) cs.value = 'all'; }
      renderExplorer(true);
    });
    var q = $('gdo-q');
    q.addEventListener('input', function () { clearTimeout(q._t); q._t = setTimeout(function () { state.q = q.value.trim(); state.shown = PAGE; renderExplorer(true); }, 200); });
    $('gdo-grid').addEventListener('click', function (e) {
      var b = e.target.closest('.gdo-show'); if (!b || !map) return;
      var m = markers[b.getAttribute('data-id')]; if (!m) return;
      $('gdo-map').scrollIntoView({ behavior: 'smooth', block: 'center' });
      cluster.zoomToShowLayer(m, function () { m.openPopup(); });
    });
    var more = $('gdo-more');
    if (more) more.querySelector('button').addEventListener('click', function () { state.shown += PAGE; renderExplorer(false); });
  }

  /* ---------- Map ---------- */
  function setupMap() {
    var el = $('gdo-map');
    if (!el) return;
    if (!window.L || !L.markerClusterGroup) { el.classList.add('failed'); return; }
    var mobile = window.matchMedia('(max-width: 720px)').matches;
    map = L.map(el, { scrollWheelZoom: false, tap: false, zoomSnap: 0.25 });
    if (mobile) map.dragging.disable();
    var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
    L.tileLayer(ESRI + 'World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, attribution: 'Basemap &copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; OpenStreetMap contributors' }).addTo(map);
    map.createPane('labels'); map.getPane('labels').style.zIndex = 650; map.getPane('labels').style.pointerEvents = 'none';
    L.tileLayer(ESRI + 'World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, pane: 'labels' }).addTo(map);
    cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 46, spiderfyOnMaxZoom: true });
    DATA.forEach(function (it) {
      if (it.lat == null) return;
      var c = CATS[it.category] || CATS.everyday;
      markers[it.id] = L.marker([it.lat, it.lon], {
        title: it.name,
        icon: L.divIcon({ className: 'gdo-pin', iconSize: [34, 34], iconAnchor: [17, 17], html: '<span style="--c:' + c.color + '">' + icon(c.icon, 'gdo-pin-ic') + '</span>' })
      }).bindPopup('<div class="gdo-pop"><p class="gdo-pop-cat" style="color:' + c.color + '">' + esc(c.label) + '</p><p class="gdo-pop-name">' + esc(it.name) + '</p><p class="gdo-pop-town">' + esc(it.town) + ', ' + esc(countyName(it.county)) + '</p>' + (it.website ? '<a href="' + esc(it.website) + '" target="_blank" rel="noopener">Visit their website &rarr;</a>' : '') + '</div>', { className: 'gdo-popup', maxWidth: 260 });
    });
    map.addLayer(cluster);
    map.setView([38.4, -92.4], 6.5);
    window.addEventListener('resize', function () { map.invalidateSize(); });
  }

  /* ---------- Plan a good day ---------- */
  var seed = 0;
  function setupBuilder() {
    var wrap = $('gdo-builder'); if (!wrap) return;
    var chips = $('gdo-interests');
    chips.innerHTML = INTERESTS.map(function (i, n) {
      return '<button type="button" data-k="' + i.key + '" aria-pressed="' + (n < 2 ? 'true' : 'false') + '">' + i.label + '</button>';
    }).join('');
    chips.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); buildDay();
    });
    ['gdo-hours', 'gdo-when'].forEach(function (id) { $(id).addEventListener('change', buildDay); });
    var bw = $('gdo-bwhere');
    bw.addEventListener('change', buildDay);
    var nm = $('gdo-name'); nm.addEventListener('input', function () { clearTimeout(nm._t); nm._t = setTimeout(buildDay, 250); });
    $('gdo-again').addEventListener('click', function () { seed++; buildDay(); });
    buildDay();
  }
  function buildDay() {
    var out = $('gdo-day'); if (!out) return;
    var chips = $('gdo-interests');
    var picked = [].slice.call(chips.querySelectorAll('[aria-pressed="true"]')).map(function (b) { return b.getAttribute('data-k'); });
    var w = findPlace($('gdo-bwhere').value);
    if (!w || w.error) {
      out.innerHTML = '<p class="gdo-day-title">Where do they live?</p><p class="gdo-day-sub">' + (w && w.error ? esc(w.error) : 'Type their town or ZIP code and we will sketch a good day out with real places close to home.') + '</p>';
      return;
    }
    if (!picked.length) { out.innerHTML = '<p class="gdo-day-title">What do they enjoy?</p><p class="gdo-day-sub">Pick at least one thing and we will sketch a day.</p>'; return; }
    var hours = +$('gdo-hours').value, when = $('gdo-when').value, who = ($('gdo-name').value || '').trim() || 'your loved one';
    var cats = []; picked.forEach(function (k) { INTERESTS.forEach(function (i) { if (i.key === k) cats = cats.concat(i.cats); }); });
    var maxMi = hours <= 2 ? 15 : hours === 3 ? 25 : 35;
    function pool(catList, center, lim) {
      return DATA.filter(function (it) { return it.lat != null && catList.indexOf(it.category) > -1; })
        .map(function (it) { return { it: it, d: miles(center, [it.lat, it.lon]) }; })
        .filter(function (x) { return x.d <= lim; })
        .sort(function (a, b) { return a.d - b.d; });
    }
    var main = pool(cats, w.pt, maxMi);
    // Prefer something happening this month for festivals; skip festivals not in season
    var month = new Date().getMonth() + 1;
    main = main.filter(function (x) { return x.it.category !== 'events-seasonal' || !(x.it.months || []).length || x.it.months.indexOf(month) > -1 || x.it.months.indexOf(month % 12 + 1) > -1; });
    if (!main.length) {
      out.innerHTML = '<p class="gdo-day-title">Nothing close enough yet</p><p class="gdo-day-sub">We have not listed a place like that within ' + maxMi + ' miles of ' + esc(w.label) + '. Try more interests or a longer outing.</p>';
      return;
    }
    var top = main.slice(0, 8), pick = top[seed % top.length], p = pick.it, c = CATS[p.category];
    var second = null;
    if (hours >= 3) {
      var treat = pool(['everyday', 'park-garden', 'library'], [p.lat, p.lon], 8).filter(function (x) { return x.it.id !== p.id && x.it.category !== p.category; });
      if (treat.length) second = treat[seed % Math.min(4, treat.length)];
    }
    var d = Math.max(1, Math.round(pick.d));
    var start = when === 'morning' ? 9 : when === 'midday' ? 11 : 13;
    function t(h) { var hh = Math.floor(h), mm = Math.round((h - hh) * 60); return ((hh + 11) % 12 + 1) + ':' + (mm < 10 ? '0' : '') + mm + (hh < 12 ? ' am' : ' pm'); }
    var driveH = Math.max(0.25, Math.round((d / 35) * 4) / 4);
    var html = '<p class="gdo-day-title">A good day out for ' + esc(who) + '</p>' +
      '<p class="gdo-day-sub">About ' + hours + ' hours with a Neighbor, starting near ' + esc(w.label) + '.</p><ol class="gdo-steps">';
    html += step(t(start), 'i-home', '#376d93', 'Your Neighbor knocks on the door', 'A friendly hello, coats and keys, and off you go together.');
    html += step(t(start + driveH), c.icon, c.color, '<a href="' + esc(p.website) + '" target="_blank" rel="noopener">' + esc(p.name) + '</a>', esc(p.town) + ', about ' + d + (d === 1 ? ' mile' : ' miles') + ' away. ' + esc(p.what));
    if (second) {
      var s = second.it, sc = CATS[s.category];
      html += step(t(start + driveH + (hours >= 4 ? 1.75 : 1.25)), sc.icon, sc.color, '<a href="' + esc(s.website) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a>', esc(s.what));
    }
    html += step(t(start + hours), 'i-car', '#376d93', 'Home again', 'Back in their favorite chair with something to tell the family about.');
    html += '</ol><div class="gdo-day-cta"><a class="btn btn-primary" href="/family/' + from('gdo-plan') + '">Book a day like this</a><button type="button" class="btn btn-ghost btn-small" id="gdo-again2">Show me another idea</button></div>' +
      '<p class="gdo-day-note">A sketch, not a booking. Times are a guess. Admission, meals and tickets are paid by the family, and mileage goes to your Neighbor. Check the place\'s own website before you go, since hours change.</p>';
    out.innerHTML = html;
    $('gdo-again2').addEventListener('click', function () { seed++; buildDay(); });
    function step(time, ic, color, title, text) {
      return '<li style="--c:' + color + '"><span class="dot">' + icon(ic) + '</span><div><span class="time">' + time + '</span><b>' + title + '</b><small>' + text + '</small></div></li>';
    }
  }

  /* ---------- Through the year ---------- */
  function renderCalendar() {
    var el = $('gdo-cal'); if (!el) return;
    var by = {}, src = DATA;
    if (CFG.county) src = DATA.filter(function (it) { return it.county === CFG.county || (it.lat != null && state.where && miles(state.where.pt, [it.lat, it.lon]) <= 50); });
    else if (state.where) src = DATA.filter(function (it) { return it.lat != null && miles(state.where.pt, [it.lat, it.lon]) <= 60; });
    src.forEach(function (it) { (it.months || []).forEach(function (m) { (by[m] = by[m] || []).push(it); }); });
    var lab = $('gdo-cal-where');
    if (lab) lab.textContent = CFG.county ? 'in and around ' + countyName(CFG.county) : state.where ? 'within an hour or so of ' + state.where.label : 'across Missouri';
    var now = new Date().getMonth() + 1, order = [];
    for (var i = 0; i < 12; i++) order.push((now - 1 + i) % 12 + 1);
    el.innerHTML = order.map(function (m, i) {
      var list = (by[m] || []).slice();
      if (state.where) list.sort(function (a, b) { return miles(state.where.pt, [a.lat, a.lon]) - miles(state.where.pt, [b.lat, b.lon]); });
      var show = list.slice(0, 6);
      return '<div class="gdo-month' + (i === 0 ? ' now' : '') + '"><p class="gdo-mname">' + MONTHS[m - 1] + (i === 0 ? '<small>This month</small>' : '') + '</p>' +
        (show.length ? show.map(function (it) { return '<a href="' + esc(it.website || '#') + '" target="_blank" rel="noopener">' + esc(it.name) + '<small>' + esc(it.town) + '</small></a>'; }).join('') +
          (list.length > show.length ? '<p class="more">and ' + (list.length - show.length) + ' more</p>' : '')
          : '<span class="gdo-quiet">Libraries, senior centers and parks all year round</span>') +
        '</div>';
    }).join('');
  }

  /* ---------- Browse by county ---------- */
  function renderRegions() {
    var el = $('gdo-regions'); if (!el) return;
    var counts = {}; DATA.forEach(function (it) { counts[it.county] = (counts[it.county] || 0) + 1; });
    el.innerHTML = REGIONS.map(function (r) {
      return '<div class="gdo-region"><h3>' + esc(r.name) + '</h3><ul>' + r.counties.slice().sort().map(function (c) {
        return '<li' + (LIVE.indexOf(c) > -1 ? ' class="live"' : '') + '><a href="' + BASE + slug(c) + '/">' + esc(c) + '</a> <small>' + (counts[c] || 0) + '</small></li>';
      }).join('') + '</ul></div>';
    }).join('');
  }

  /* ---------- Start ---------- */
  function boot(places, towns, zips) {
    DATA = (places.items || []).map(function (it, i) { it.id = it.id || 'p' + i; return it; });
    REGIONS = places.regions || []; LIVE = places.live || [];
    TOWNS = towns; ZIPS = zips;
    var total = $('gdo-total'); if (total) total.textContent = DATA.length.toLocaleString();
    var tt = $('gdo-towns-n'); if (tt) tt.textContent = TOWNS.length.toLocaleString();
    fillTownList(); setupFind(); setupMap(); setupFilters(); setupBuilder(); renderRegions();
    if (CFG.county && CFG.center) {
      state.where = { pt: CFG.center, label: countyName(CFG.county), county: CFG.county, town: '', auto: true };
    }
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('smn-gdo-where') || 'null'); } catch (e) {}
    var qs = new URLSearchParams(location.search).get('near');
    var w = qs ? findPlace(qs) : null;
    if (w && !w.error) { $('gdo-where') && ($('gdo-where').value = qs); setWhere(w, { fromHero: true }); }
    else if (!CFG.county && saved && saved.pt) { var wi = $('gdo-where'); if (wi) wi.value = saved.town ? saved.town + ', ' + countyName(saved.county) : saved.label; setWhere(saved, { fromHero: true }); }
    else {
      if (CFG.county && CFG.seat) { var bw = $('gdo-bwhere'); if (bw && !bw.value) bw.value = CFG.seat + ', ' + countyName(CFG.county); }
      renderExplorer(true); buildDay(); renderCalendar();
    }
  }
  function get(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); }
  Promise.all([get(BASE + 'data/places.json'), get(BASE + 'data/towns.json'), get(BASE + 'data/zips.json')])
    .then(function (r) { boot(r[0], r[1], r[2]); })
    .catch(function () {
      var g = $('gdo-grid'); if (g && !g.children.length) g.innerHTML = '<p class="gdo-empty">The list could not load. Please refresh the page.</p>';
    });
})();
