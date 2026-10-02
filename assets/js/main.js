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
    return { el: card, when: period(job.date), label: job.title + ', ' + job.company, text: (job.bullets || []).join(' ') };
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
  // Everything a skill can point at: the jobs, then the projects.
  var work = jobs.map(function (j) { return { el: j.el, label: j.label, text: j.text }; });
  var big = byId('projects-big'), small = byId('projects-small');
  data.projects.items.forEach(function (proj) {
    // A project without a public link is a plain panel.
    var card = el(proj.href ? 'a' : 'article', 'proj');
    if (proj.href) { card.href = proj.href; card.target = '_blank'; card.rel = 'noopener noreferrer'; }
    else card.classList.add('proj--static');
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
    if (proj.award) body.appendChild(el('div', 'proj__award', proj.award));
    card.appendChild(body);
    (proj.featured ? big : small).appendChild(card);
    work.push({ el: card, label: proj.title, text: proj.tech || '' });
  });

  // ── Skills ─────────────────────────────────
  // A map key: skills grouped by how much I use them, each led by a map symbol. A skill is
  // matched against the tech line of every project and the text of every job, and picking
  // one shows where it was used.
  var keyEl = byId('skills-key'), detail = byId('skills-detail');
  if (keyEl && detail && data.skills && data.skills.groups) {
    var K = window.InkRiver;
    var glyphs = K && K.glyphs ? K.glyphs(K.mulberry32(5)) : null;
    var SVG = 'http://www.w3.org/2000/svg';
    var REST = 'Pick a skill to see where I used it.';
    var chosen = null, lit = [];

    var mentions = function (text, term) {
      var safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Whole terms only, so "C" does not match "C++" or "C#", nor "Java" match "JavaScript".
      return new RegExp('(^|[^A-Za-z0-9+#.])' + safe + '($|[^A-Za-z0-9+#])', term.length > 2 ? 'i' : '').test(text);
    };

    var select = function (entry) {
      lit.forEach(function (node) { node.classList.remove('is-lit'); });
      lit = [];
      if (chosen) chosen.button.setAttribute('aria-pressed', 'false');
      chosen = entry;
      detail.textContent = '';
      if (!entry) { detail.appendChild(el('span', 'key__rest', REST)); return; }
      entry.button.setAttribute('aria-pressed', 'true');
      detail.appendChild(el('span', 'key__name', entry.name));
      if (!entry.uses.length) {
        detail.appendChild(el('span', 'key__rest', 'Nothing on this page uses it yet.'));
      } else {
        detail.appendChild(el('span', 'key__rest', 'used in'));
        entry.uses.forEach(function (use) {
          use.el.classList.add('is-lit');
          lit.push(use.el);
          var go = el('button', 'key__use', use.label);
          go.type = 'button';
          go.addEventListener('click', function () {
            use.el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
          });
          detail.appendChild(go);
        });
      }
      var clear = el('button', 'key__clear', 'Clear');
      clear.type = 'button';
      clear.addEventListener('click', function () { select(null); });
      detail.appendChild(clear);
    };

    data.skills.groups.forEach(function (group) {
      var row = el('div', 'key__row');
      var label = el('div', 'key__label');
      if (glyphs && glyphs[group.symbol]) {
        var icon = document.createElementNS(SVG, 'svg');
        icon.setAttribute('viewBox', '0 0 40 40');
        icon.setAttribute('aria-hidden', 'true');
        var parts = glyphs[group.symbol](20, 37, group.symbol === 'bush' ? 30 : 34);
        ['under', 'body', 'solid', 'over'].forEach(function (part) {
          if (!parts[part]) return;
          var path = document.createElementNS(SVG, 'path');
          path.setAttribute('d', parts[part]);
          if (part === 'body' || part === 'solid') path.setAttribute('class', part);
          icon.appendChild(path);
        });
        label.appendChild(icon);
      }
      label.appendChild(el('span', '', group.title));
      row.appendChild(label);

      var items = el('div', 'key__items');
      (group.items || []).forEach(function (item) {
        var name = typeof item === 'string' ? item : item.name;
        var terms = [name].concat((item && item.also) || []);
        var uses = work.filter(function (w) {
          return terms.some(function (term) { return mentions(w.text, term); });
        });
        var button = el('button', 'skill' + (uses.length ? ' skill--used' : ''));
        button.type = 'button';
        button.setAttribute('aria-pressed', 'false');
        button.appendChild(el('span', '', name));
        if (uses.length) button.appendChild(el('sup', '', String(uses.length)));
        var entry = { name: name, uses: uses, button: button };
        // Chosen by click or keyboard focus only: hover would change the choice as the page
        // scrolls under a resting cursor.
        ['click', 'focus'].forEach(function (type) {
          button.addEventListener(type, function () { if (chosen !== entry) select(entry); });
        });
        items.appendChild(button);
      });
      row.appendChild(items);
      keyEl.appendChild(row);
    });

    var hint = byId('skills-hint');
    if (hint) hint.textContent = data.skills.hint || '';
    select(null);
  }

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
    // Addresses are stored and shown as "name <at> domain" so they are not sitting in the
    // source for scrapers. The real mail link is only put together when someone goes to use it.
    { label: 'Email', links: [contact.email, contact.email2].filter(Boolean).map(function (address) {
      return { text: address, mail: true };
    }) },
    { label: 'GitHub', links: [{ text: 'Dev301203', href: contact.github }] },
    { label: 'LinkedIn', links: [{ text: 'devanshu-singhvi', href: contact.linkedin }] }
  ].forEach(function (item) {
    if (!item.links.length) return;
    var li = el('li', 'contact__group');
    li.appendChild(el('span', 'contact__label', item.label));
    item.links.forEach(function (link) {
      var a = el('a', 'contact__link', link.text);
      if (link.mail) {
        a.tabIndex = 0;
        a.setAttribute('role', 'link');
        var arm = function () {
          if (!a.getAttribute('href')) a.href = 'mail' + 'to:' + link.text.replace(/\s*<at>\s*/i, String.fromCharCode(64));
        };
        ['pointerenter', 'focus', 'touchstart'].forEach(function (type) { a.addEventListener(type, arm, { passive: true }); });
      } else {
        a.href = link.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
      }
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
  ['hero', 'about', 'experience', 'skills', 'projects', 'teaching', 'contact'].forEach(function (id) {
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
