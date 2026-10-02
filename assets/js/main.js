(function () {
  'use strict';

  var data = window.__SITE_CONTENT__;
  if (!data) return;

  var A = window.anime;
  var params = new URLSearchParams(window.location.search);
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canAnimate = !!A && !reduceMotion && !params.has('static') && 'IntersectionObserver' in window;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function meta(parts) {
    var m = el('div', 'meta');
    parts.forEach(function (p) { if (p) m.appendChild(el('span', '', p)); });
    return m;
  }

  function byId(id) { return document.getElementById(id); }

  // ── About ──────────────────────────────────
  var aboutText = byId('about-text');
  data.about.paragraphs.forEach(function (text) { aboutText.appendChild(el('p', '', text)); });

  // ── Experience ─────────────────────────────
  var exp = data.experience;

  // Work sits on the right bank and education on the left, newest first. Each degree
  // lines up beside the jobs held during it.
  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function monthIndex(text, isEnd) {
    if (/present/i.test(text)) return Infinity;
    var m = /([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/.exec(text);
    if (m && MONTHS[m[1].toLowerCase()] !== undefined) return +m[2] * 12 + MONTHS[m[1].toLowerCase()];
    var y = /(\d{4})/.exec(text);
    return y ? +y[1] * 12 + (isEnd ? 11 : 0) : NaN;
  }
  function period(date) {
    var parts = String(date || '').split(/\s*[–—]\s*|\s+-\s+/);
    var start = monthIndex(parts[0], false);
    return { start: start, end: parts.length > 1 ? monthIndex(parts[1], true) : start };
  }

  function folded(items) {
    var more = el('details', 'more');
    var summary = el('summary', '', 'More');
    more.appendChild(summary);
    var ul = el('ul');
    items.forEach(function (b) { ul.appendChild(el('li', '', b)); });
    more.appendChild(ul);
    more.addEventListener('toggle', function () { summary.textContent = more.open ? 'Less' : 'More'; });
    return more;
  }

  // First row of a panel: the logo, with when and where beside it.
  function topRow(logoSrc, name, date, location) {
    var top = el('div', 'job__top');
    var logo = el('img', 'job__logo');
    logo.src = logoSrc; logo.alt = name + ' logo'; logo.loading = 'lazy';
    logo.onerror = function () { this.remove(); };
    top.appendChild(logo);
    var when = meta([date, location]);
    when.classList.add('job__when');
    top.appendChild(when);
    return top;
  }

  function panel(kind) {
    var card = el('article', 'card job job--' + kind);
    card.setAttribute('data-reveal', '');
    card.setAttribute('data-dock', '');
    return card;
  }

  var jobs = exp.work.map(function (job) {
    var card = panel('work');
    if (job.logo) card.appendChild(topRow(job.logo, job.company, job.date, job.location));
    var body = el('div', 'job__body');
    if (!job.logo) body.appendChild(meta([job.date, job.location]));
    body.appendChild(el('h3', 'job__title', job.title));
    body.appendChild(el('div', 'job__company', job.company));
    // What the work involved stays folded away until asked for.
    if (job.bullets && job.bullets.length) body.appendChild(folded(job.bullets));
    card.appendChild(body);
    return { el: card, when: period(job.date) };
  });

  var schools = exp.education.map(function (edu) {
    var card = panel('edu');
    var details = edu.details || [];
    var grades = details.filter(function (d) { return /^C?GPA/i.test(d); });
    var rest = details.filter(function (d) { return !/^C?GPA/i.test(d); });
    var body = el('div', 'job__body');
    if (edu.logo) {
      card.appendChild(topRow(edu.logo, edu.title, edu.date, edu.location));
      body.appendChild(el('h3', 'job__title', edu.subtitle));
      body.appendChild(el('div', 'job__company', edu.title));
      grades.forEach(function (g) { body.appendChild(el('div', 'job__stat', g)); });
    } else {
      // No logo: a single-line panel.
      card.classList.add('job--line');
      body.appendChild(el('h3', 'job__company', edu.title));
      body.appendChild(meta([edu.subtitle, edu.date, edu.location]));
    }
    if (rest.length) body.appendChild(folded(rest));
    card.appendChild(body);
    return { el: card, body: body, when: period(edu.date), title: edu.title };
  });

  // Honours become seals on the school they were awarded at.
  var honoursBySchool = [];
  (exp.honours || []).forEach(function (h) {
    var at = period(h.date).start;
    var home = null, nearest = Infinity;
    schools.forEach(function (s) {
      if (s.title !== h.org) return;
      var gap = at >= s.when.start && at <= s.when.end ? 0 : Math.abs(at - s.when.start);
      if (!home || gap < nearest) { home = s; nearest = gap; }
    });
    home = home || schools[0];
    if (!home) return;
    var group = null;
    honoursBySchool.forEach(function (g) { if (g.school === home) group = g; });
    if (!group) { group = { school: home, items: [] }; honoursBySchool.push(group); }
    group.items.push(h);
  });
  honoursBySchool.forEach(function (group) {
    var wrap = el('div', 'honours');
    var row = el('div', 'honours__row');
    var detail = el('div', 'honours__detail');
    detail.setAttribute('aria-live', 'polite');
    detail.hidden = true;
    var buttons = group.items.map(function (h, i) {
      var b = el('button', 'honour', h.title);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.style.setProperty('--tilt', [-3, 2, -2, 3][i % 4] + 'deg');
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') !== 'true';
        buttons.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', String(on));
        detail.hidden = !on;
        detail.textContent = '';
        if (on) {
          detail.appendChild(meta([h.org, h.date]));
          detail.appendChild(el('p', '', h.description || ''));
        }
      });
      row.appendChild(b);
      return b;
    });
    wrap.appendChild(row);
    wrap.appendChild(detail);
    group.school.body.appendChild(wrap);
  });

  // Rows: one per job; a school spans the rows of the jobs it overlaps.
  var FIRST_ROW = 3;
  var spans = schools.map(function () { return []; });
  jobs.forEach(function (job, row) {
    job.el.style.setProperty('--row', String(FIRST_ROW + row));
    var best = -1, bestOverlap = 0;
    schools.forEach(function (s, si) {
      var overlap = Math.min(job.when.end, s.when.end) - Math.max(job.when.start, s.when.start);
      if (overlap >= 0 && overlap + 1 > bestOverlap) { bestOverlap = overlap + 1; best = si; }
    });
    if (best >= 0) spans[best].push(row);
  });
  var spare = FIRST_ROW + jobs.length;
  schools.forEach(function (s, si) {
    if (spans[si].length) {
      var first = Math.min.apply(null, spans[si]), last = Math.max.apply(null, spans[si]);
      s.el.style.setProperty('--row', (FIRST_ROW + first) + ' / span ' + (last - first + 1));
    } else {
      s.el.style.setProperty('--row', String(spare++));
    }
  });

  // Document order is plain newest-first, which is what a single column shows.
  var timeline = byId('timeline');
  jobs.concat(schools)
    .sort(function (a, b) { return (b.when.start || 0) - (a.when.start || 0); })
    .forEach(function (item) { timeline.appendChild(item.el); });

  if (exp.resume && exp.resume.url) {
    var resume = el('a', 'resume', 'Resume');
    resume.href = exp.resume.url; resume.target = '_blank'; resume.rel = 'noopener noreferrer';
    byId('resume-mount').appendChild(resume);
  }

  // ── Projects ───────────────────────────────
  var big = byId('projects-big'), small = byId('projects-small');
  data.projects.items.forEach(function (proj) {
    var card = el('a', 'proj');
    card.href = proj.href; card.target = '_blank'; card.rel = 'noopener noreferrer';
    card.setAttribute('data-reveal', '');
    if (proj.image) {
      var img = el('img', 'proj__img');
      img.src = proj.image; img.alt = ''; img.loading = 'lazy';
      img.onerror = function () { this.remove(); };
      card.appendChild(img);
    }
    var body = el('div', 'proj__body');
    body.appendChild(el('h3', 'proj__title', proj.title));
    body.appendChild(meta([proj.tech, proj.date]));
    body.appendChild(el('p', 'proj__desc', proj.description));
    card.appendChild(body);
    (proj.featured ? big : small).appendChild(card);
  });

  // ── Teaching ───────────────────────────────
  // One seal per course; repeat offerings are listed under the same seal.
  var courses = [], byCode = {};
  data.teaching.items.forEach(function (t) {
    var split = t.course.split(':');
    var code = split[0].trim(), name = split.slice(1).join(':').trim();
    if (!byCode[code]) { byCode[code] = { code: code, name: name, runs: [] }; courses.push(byCode[code]); }
    byCode[code].runs.push(t.campus + ', ' + t.date);
  });
  byId('teaching-note').textContent =
    'Teaching assistant at the University of Toronto for ' + data.teaching.items.length +
    ' course offerings across ' + courses.length + ' courses.';

  var stamps = byId('teaching-list');
  courses.forEach(function (c, i) {
    var li = el('li', 'stamp');
    var seal = el('div', 'stamp__seal');
    seal.style.setProperty('--tilt', [-4, 3, -2, 5, -5, 2, -3][i % 7] + 'deg');
    var match = /^([A-Za-z]+)\s*(\d+.*)$/.exec(c.code);
    var inner = el('div');
    if (match) { inner.appendChild(el('small', '', match[1])); inner.appendChild(el('b', '', match[2])); }
    else inner.appendChild(el('b', '', c.code));
    seal.appendChild(inner);
    seal.setAttribute('data-stamp', '');
    li.appendChild(seal);
    li.appendChild(el('div', 'stamp__name', c.name));
    li.appendChild(meta(c.runs));
    stamps.appendChild(li);
  });

  // ── Contact ────────────────────────────────
  var contact = data.contact, contactEl = byId('contact-links');
  [
    { label: 'Email', links: [contact.email, contact.email2].filter(Boolean).map(function (address) {
      return { text: address, href: 'mailto:' + address };
    }) },
    { label: 'GitHub', links: [{ text: 'Dev301203', href: contact.github }] },
    { label: 'LinkedIn', links: [{ text: 'devanshu-singhvi', href: contact.linkedin }] }
  ].forEach(function (item) {
    if (!item.links.length) return;
    var li = el('li', 'contact__group');
    li.appendChild(el('span', 'contact__label', item.label));
    item.links.forEach(function (link) {
      var a = el('a', 'contact__link', link.text);
      a.href = link.href;
      if (link.href.indexOf('mailto:') !== 0) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      li.appendChild(a);
    });
    contactEl.appendChild(li);
  });

  byId('footer-year').textContent = String(new Date().getFullYear());

  if (!('IntersectionObserver' in window)) return;

  // ── Active nav link ────────────────────────
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
  var navObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      links.forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
      });
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  ['hero', 'about', 'experience', 'projects', 'teaching', 'contact'].forEach(function (id) {
    var s = byId(id);
    if (s) navObserver.observe(s);
  });

  // ── Panels ink in as they enter ────────────
  if (!canAnimate) return;

  var panels = document.querySelectorAll('[data-reveal]');
  var seals = document.querySelectorAll('[data-stamp]');
  Array.prototype.forEach.call(panels, function (p) { p.style.opacity = '0'; });
  Array.prototype.forEach.call(seals, function (s) { s.style.opacity = '0'; });

  var revealObserver = new IntersectionObserver(function (entries) {
    var batch = entries.filter(function (e) { return e.isIntersecting; }).map(function (e) { return e.target; });
    if (!batch.length) return;
    batch.forEach(function (t) { revealObserver.unobserve(t); });
    A.animate(batch, {
      opacity: [0, 1], y: [22, 0],
      duration: 650, delay: A.stagger(70), ease: 'outExpo'
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  Array.prototype.forEach.call(panels, function (p) { revealObserver.observe(p); });

  var stampObserver = new IntersectionObserver(function (entries) {
    if (!entries.some(function (e) { return e.isIntersecting; })) return;
    stampObserver.disconnect();
    A.animate(seals, {
      opacity: [0, 1], scale: [1.8, 1],
      duration: 480, delay: A.stagger(90), ease: 'outBack(2.4)'
    });
  }, { threshold: 0.2 });
  stampObserver.observe(stamps);
})();
