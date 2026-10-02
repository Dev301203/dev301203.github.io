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

  var workList = byId('work-list');
  exp.work.forEach(function (job) {
    var card = el('article', 'card job');
    card.setAttribute('data-reveal', '');

    // First row: the logo, with when and where beside it.
    var top = el('div', 'job__top');
    if (job.logo) {
      var logo = el('img', 'job__logo');
      logo.src = job.logo; logo.alt = job.company + ' logo'; logo.loading = 'lazy';
      logo.onerror = function () { this.remove(); };
      top.appendChild(logo);
    }
    var when = meta([job.date, job.location]);
    when.classList.add('job__when');
    top.appendChild(when);
    card.appendChild(top);

    var body = el('div', 'job__body');
    body.appendChild(el('h3', 'job__title', job.title));
    body.appendChild(el('div', 'job__company', job.company));

    // What the work involved stays folded away until asked for.
    var bullets = job.bullets || [];
    if (bullets.length) {
      var more = el('details', 'more');
      var summary = el('summary', '', 'More');
      more.appendChild(summary);
      var ul = el('ul');
      bullets.forEach(function (b) { ul.appendChild(el('li', '', b)); });
      more.appendChild(ul);
      more.addEventListener('toggle', function () { summary.textContent = more.open ? 'Less' : 'More'; });
      body.appendChild(more);
    }
    card.appendChild(body);
    workList.appendChild(card);
  });

  var eduList = byId('education-list');
  exp.education.forEach(function (edu) {
    var entry = el('div', 'entry');
    entry.appendChild(el('div', 'entry__title', edu.title));
    entry.appendChild(el('div', 'entry__sub', edu.subtitle));
    entry.appendChild(meta([edu.date, edu.location]));
    if (edu.details && edu.details.length) entry.appendChild(el('div', 'entry__body', edu.details.join(' ')));
    eduList.appendChild(entry);
  });

  var honoursList = byId('honours-list');
  exp.honours.forEach(function (h) {
    var entry = el('div', 'entry');
    entry.appendChild(el('div', 'entry__title', h.title));
    entry.appendChild(meta([h.org, h.date]));
    if (h.description) entry.appendChild(el('div', 'entry__body', h.description));
    honoursList.appendChild(entry);
  });

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
