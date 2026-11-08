// Show-Me Neighbors site: menu toggle + sign-up forms -> Supabase (office portal Sign-ups)
(function () {
  // Where sign-ups go. If this is ever empty, forms show an error instead of pretending to save.
  var SIGNUP_URL = 'https://ubsupoboukcpbklvdkkq.supabase.co/functions/v1/signup'; // Supabase "signup" function -> office portal Sign-ups

  // Remember a recruiting post code (?from=CODE) so the application can say which post brought someone, even if they browse first.
  try { var fc = (new URLSearchParams(location.search).get('from') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40); if (fc) localStorage.setItem('smn-from', JSON.stringify({ c: fc, t: Date.now() })); } catch (e) {}

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Dropdown menus: click to open on touch screens, close when clicking elsewhere.
  document.querySelectorAll('.dd-btn').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var dd = b.parentNode, open = !dd.classList.contains('open');
      document.querySelectorAll('.dd.open').forEach(function (d) { d.classList.remove('open'); d.firstElementChild.setAttribute('aria-expanded', 'false'); });
      if (open) { dd.classList.add('open'); b.setAttribute('aria-expanded', 'true'); }
    });
  });
  document.addEventListener('click', function () {
    document.querySelectorAll('.dd.open').forEach(function (d) { d.classList.remove('open'); d.firstElementChild.setAttribute('aria-expanded', 'false'); });
  });

  // Question topic buttons (Naborforce idea): show only questions in the chosen topic.
  document.querySelectorAll('.faq-filters button').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-f');
      b.parentNode.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      document.querySelectorAll('.faq details[data-cat]').forEach(function (d) { d.hidden = f !== 'all' && d.getAttribute('data-cat') !== f; });
    });
  });

  // Hero help picker: carries the ZIP and chosen help down to the sign-up form.
  // Launch areas (11-07): Springfield area = Greene County (658xx) plus Christian County and nearby towns;
  // Branson / Table Rock Lake = Taney and Stone County towns; St. Charles County area added 11-07. Draft list: trim or add ZIPs before launch.
  var AREAS = {
    'Springfield area': ['65619', '65714', '65721', '65738', '65742', '65757', '65781', '65610', '65753', '65631', '65669', '65754'],
    'Branson and Table Rock Lake area': ['65616', '65672', '65726', '65739', '65740', '65679', '65680', '65731', '65759', '65653',
      '65737', '65686', '65611', '65624', '65633', '65656', '65681', '65747'],
    'St. Charles County area': ['63301', '63303', '63304', '63366', '63368', '63376', '63385', '63367', '63348', '63341', '63373', '63386', '63332']
  };
  function areaFor(zip) {
    if (zip.indexOf('658') === 0) return 'Springfield area';
    for (var a in AREAS) { if (AREAS[a].indexOf(zip) !== -1) return a; }
    return '';
  }
  var picker = document.getElementById('picker');
  if (picker) {
    picker.addEventListener('submit', function (e) {
      e.preventDefault();
      var zipEl = document.getElementById('pick-zip');
      var zip = zipEl.value.trim();
      if (!/^\d{5}$/.test(zip)) { zipEl.focus(); zipEl.style.borderColor = '#c4553a'; return; }
      var help = Array.prototype.map.call(picker.querySelectorAll('input[name=help]:checked'), function (c) { return c.value; });
      var cta = document.getElementById('family-cta'); if (cta) cta.href = 'family/?zip=' + zip;
      var msg = document.getElementById('area-msg');
      if (msg) {
        var area = areaFor(zip), near = !!area;
        msg.hidden = false;
        msg.className = 'area-msg' + (near ? '' : ' far');
        msg.textContent = near
          ? 'Good news! ' + zip + ' is in our first ' + area + '. Make your free account and you will be one of the first families to book.'
          : 'We are not near ' + zip + ' yet. Make your free account and we will tell you the moment Neighbors are available there.';
      }
      document.getElementById('signup').scrollIntoView({ behavior: 'smooth' });
      if (cta) setTimeout(function () { cta.focus({ preventScroll: true }); }, 500);
    });
  }

  // Fit quiz (Naborforce idea, shorter): one question at a time, then an honest result.
  var quiz = document.getElementById('quiz-form');
  if (quiz) {
    var steps = Array.prototype.slice.call(quiz.querySelectorAll('.qstep'));
    var cur = 0, back = document.getElementById('q-back'), next = document.getElementById('q-next');
    var fill = document.getElementById('qbar-fill');
    function show(i) {
      cur = i;
      steps.forEach(function (st, k) { st.hidden = k !== i; });
      back.hidden = i === 0;
      next.hidden = i === steps.length - 1;
      fill.style.width = ((i + 1) / steps.length * 100) + '%';
    }
    function picked(name) {
      return Array.prototype.map.call(quiz.querySelectorAll('input[name="' + name + '"]:checked'), function (c) { return c.value; });
    }
    quiz.addEventListener('change', function (e) {
      if (e.target.name === 'q_matters' && picked('q_matters').length > 2) e.target.checked = false;
    });
    next.addEventListener('click', function () {
      var st = steps[cur];
      if (!st.querySelector('input:checked')) { st.classList.add('need'); return; }
      st.classList.remove('need');
      show(cur + 1);
    });
    back.addEventListener('click', function () { show(cur - 1); });
    show(0);

    function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    // Runs before the shared send code, so the result is saved with the answers.
    quiz.addEventListener('submit', function () {
      var zip = (document.getElementById('q-zip').value || '').trim();
      var email = (document.getElementById('q-email').value || '').trim();
      if (!/^\d{5}$/.test(zip) || !email) return;
      var help = picked('q_help'), matters = picked('q_matters');
      var dist = picked('q_distance')[0] || '', social = picked('q_social')[0] || '';
      var hands = help.indexOf('Help with bathing, dressing or the bathroom') !== -1 || matters.indexOf('Hands-on care like bathing and dressing') !== -1;
      var other = help.filter(function (h) { return h !== 'Help with bathing, dressing or the bathroom' && h !== 'Something else'; });
      var area = areaFor(zip), near = !!area;
      var lines = [];
      if (hands) {
        lines.push('Neighbors never help with bathing, dressing or the bathroom. For that kind of care, a licensed home care agency is the right call.');
        if (other.length) lines.push('A Neighbor can still help with: ' + other.join(', ').toLowerCase() + '.');
      } else if (other.length) {
        lines.push('A Neighbor can help with: ' + other.join(', ').toLowerCase() + '.');
      }
      if (/drive there|far away/.test(dist)) lines.push('Since you are not close by, you will get a short note after every visit, so you know how the day went.');
      if (/lonely|isolated/.test(social)) lines.push('A weekly visit with a favorite Neighbor gives them someone to look forward to.');
      lines.push(near ? 'Good news: ' + zip + ' is in our first ' + area + ', and you are on the list to book first.' : 'We are not in ' + zip + ' yet, but you are on the list and we will tell you the moment we open there.');
      document.getElementById('q-result').value = hands ? 'Needs hands-on care (Neighbor fits only part)' : 'Good fit';
      var box = document.getElementById('quiz-result');
      box.innerHTML = '<h3>' + (hands ? 'A Neighbor can help with part of this' : 'Show-Me Neighbors looks like a great fit') + '</h3>' +
        lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('');
      box.hidden = false;
    });
  }

  document.querySelectorAll('form[data-form]').forEach(function (form) {
    var msg = form.querySelector('.form-msg');
    var btn = form.querySelector('button[type=submit]');
    var okText = msg ? msg.textContent : 'Thank you!';

    function show(text, isError) {
      if (!msg) return;
      msg.textContent = text;
      msg.classList.add('show');
      msg.classList.toggle('error', !!isError);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var missing = Array.prototype.filter.call(form.querySelectorAll('[required]'), function (el) { return !el.value.trim(); });
      if (missing.length) { missing[0].focus(); missing[0].style.borderColor = '#c4553a'; return; }

      var data = new URLSearchParams(new FormData(form));
      // Join checkbox groups (like times of day) into one value so the Sheet gets all of them.
      Array.from(new Set(Array.from(data.keys()))).forEach(function (k) {
        var all = data.getAll(k);
        if (all.length > 1) data.set(k, all.join(', '));
      });
      data.set('form', form.getAttribute('data-form'));
      data.set('page', location.pathname);

      if (!SIGNUP_URL) { show('Sorry, sign-ups are not switched on yet. Please try again soon.', true); return; } // never pretend a sign-up was saved

      btn.disabled = true;
      var oldLabel = btn.textContent;
      btn.textContent = 'Sending...';
      fetch(SIGNUP_URL, { method: 'POST', body: data })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (!res || !res.ok) throw new Error('not saved');
          btn.textContent = oldLabel;
          show(okText);
          if (form.id === 'quiz-form') form.hidden = true;
          form.reset();
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = oldLabel;
          show('Sorry, that did not go through. Please try again in a minute.', true);
        });
    });
  });
})();
