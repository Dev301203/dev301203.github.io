(function () {
  'use strict';

  var data = window.__SITE_CONTENT__;
  if (!data) return;

  // ── Hero ───────────────────────────────────
  var hero = data.hero;
  setText('hero-name', hero.name);
  setText('hero-role', hero.role);
  setText('hero-degree', hero.degree + ' · ' + hero.school);
  setText('hero-seal', hero.gpa);

  // ── Nav ────────────────────────────────────
  var sections = ['about', 'experience', 'skills', 'projects', 'teaching', 'contact'];
  var navLinksEl = document.getElementById('nav-links');
  sections.forEach(function (id) {
    var btn = document.createElement('button');
    btn.className = 'nav-link';
    btn.textContent = id.charAt(0).toUpperCase() + id.slice(1);
    btn.setAttribute('data-section', id);
    btn.addEventListener('click', function () {
      document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
    });
    navLinksEl.appendChild(btn);
  });

  // ── About ──────────────────────────────────
  var aboutText = document.getElementById('about-text');
  data.about.paragraphs.forEach(function (text) {
    var p = document.createElement('p');
    p.textContent = text;
    aboutText.appendChild(p);
  });

  // ── Experience ─────────────────────────────
  var exp = data.experience;

  // Education
  var eduList = document.getElementById('education-list');
  exp.education.forEach(function (edu) {
    var div = document.createElement('div');
    div.className = 'edu-entry';
    div.appendChild(el('div', 'edu-entry__title', edu.title));
    div.appendChild(el('div', 'edu-entry__subtitle', edu.subtitle + ' · ' + edu.date));
    if (edu.details && edu.details.length) {
      div.appendChild(el('div', 'edu-entry__details', edu.details.join(' ')));
    }
    eduList.appendChild(div);
  });

  // Work
  var workList = document.getElementById('work-list');
  exp.work.forEach(function (job) {
    var entry = document.createElement('div');
    var hasLogo = job.logo && job.logo.length > 0;
    entry.className = 'work-entry' + (hasLogo ? '' : ' work-entry--no-logo');

    if (hasLogo) {
      var logo = document.createElement('img');
      logo.className = 'work-entry__logo';
      logo.src = job.logo;
      logo.alt = job.company + ' logo';
      logo.width = 44;
      logo.height = 44;
      logo.loading = 'lazy';
      logo.onerror = function () {
        this.style.display = 'none';
        entry.classList.add('work-entry--no-logo');
      };
      entry.appendChild(logo);
    }

    var body = document.createElement('div');
    body.appendChild(el('div', 'work-entry__title', job.title));
    body.appendChild(el('div', 'work-entry__meta', job.company + ' · ' + job.location + ' · ' + job.date));

    if (job.bullets && job.bullets.length) {
      var ul = document.createElement('ul');
      ul.className = 'work-entry__bullets';
      job.bullets.forEach(function (b) {
        var li = document.createElement('li');
        li.textContent = b;
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }
    entry.appendChild(body);
    workList.appendChild(entry);
  });

  // Honours
  var honoursList = document.getElementById('honours-list');
  exp.honours.forEach(function (h) {
    var row = document.createElement('div');
    row.className = 'honour-entry';
    row.appendChild(el('span', 'honour-entry__title', h.title));
    row.appendChild(el('span', 'honour-entry__meta', h.org + ', ' + h.date));
    honoursList.appendChild(row);
  });

  // Resume link
  if (exp.resume && exp.resume.url) {
    var mount = document.getElementById('resume-mount');
    var a = document.createElement('a');
    a.className = 'resume-link';
    a.href = exp.resume.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = exp.resume.linkText || 'Resume';
    mount.appendChild(a);
  }

  // ── Skills ─────────────────────────────────
  var skillsGrid = document.getElementById('skills-grid');
  data.skills.groups.forEach(function (group) {
    var div = document.createElement('div');
    div.appendChild(el('div', 'skill-group__title', group.title));
    var items = document.createElement('div');
    items.className = 'skill-group__items';
    group.items.forEach(function (skill) {
      items.appendChild(el('span', 'skill-tag', skill));
    });
    div.appendChild(items);
    skillsGrid.appendChild(div);
  });

  // ── Projects ───────────────────────────────
  var projGrid = document.getElementById('projects-grid');
  data.projects.items.forEach(function (proj) {
    var card = document.createElement('a');
    card.className = 'project-card';
    card.href = proj.href;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    if (proj.image) {
      var img = document.createElement('img');
      img.className = 'project-card__img';
      img.src = proj.image;
      img.alt = proj.title;
      img.loading = 'lazy';
      img.onerror = function () { this.style.display = 'none'; };
      card.appendChild(img);
    }

    var cardBody = document.createElement('div');
    cardBody.className = 'project-card__body';
    cardBody.appendChild(el('div', 'project-card__title', proj.title));
    cardBody.appendChild(el('div', 'project-card__meta', proj.tech + ' · ' + proj.date));
    cardBody.appendChild(el('div', 'project-card__desc', proj.description));
    card.appendChild(cardBody);
    projGrid.appendChild(card);
  });

  // ── Teaching ───────────────────────────────
  var teachList = document.getElementById('teaching-list');
  data.teaching.items.forEach(function (t) {
    var row = document.createElement('div');
    row.className = 'teaching-entry';
    row.appendChild(el('span', 'teaching-entry__date', t.date));
    row.appendChild(el('span', 'teaching-entry__course', t.course));
    row.appendChild(el('span', 'teaching-entry__campus', t.campus));
    teachList.appendChild(row);
  });

  // ── Contact ────────────────────────────────
  var contactEl = document.getElementById('contact-links');
  var contact = data.contact;
  var contactItems = [
    { label: 'email', text: contact.email, href: 'mailto:' + contact.email },
    { label: 'email', text: contact.email2, href: 'mailto:' + contact.email2 },
    { label: 'github', text: 'Dev301203', href: contact.github },
    { label: 'linkedin', text: 'devanshu-singhvi', href: contact.linkedin }
  ];
  contactItems.forEach(function (item) {
    var link = document.createElement('a');
    link.className = 'contact-link';
    link.href = item.href;
    if (!item.href.startsWith('mailto:')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    link.appendChild(el('span', 'contact-link__label', item.label));
    link.appendChild(document.createTextNode(item.text));
    contactEl.appendChild(link);
  });

  // ── Footer year ────────────────────────────
  setText('footer-year', new Date().getFullYear().toString());

  // ── Nav scroll behaviour ───────────────────
  var nav = document.getElementById('nav');
  var scrollHint = document.getElementById('scroll-hint');
  var heroContent = document.getElementById('hero-content');
  var heroLandscape = document.getElementById('hero-landscape');
  var ticking = false;

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(function () {
        var y = window.scrollY;
        nav.classList.toggle('scrolled', y > 80);
        if (scrollHint) scrollHint.classList.toggle('hidden', y > 200);

        var vh = window.innerHeight;
        if (y < vh) {
          var ratio = y / vh;
          heroContent.style.opacity = Math.max(0, 1 - ratio * 1.8);
          heroLandscape.style.transform = 'translateY(' + (y * 0.35) + 'px)';
        }
        ticking = false;
      });
      ticking = true;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── IntersectionObserver for active nav ────
  var navBtns = document.querySelectorAll('.nav-link');
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        navBtns.forEach(function (btn) {
          btn.classList.toggle('active', btn.getAttribute('data-section') === entry.target.id);
        });
      }
    });
  }, { rootMargin: '-40% 0px -60% 0px' });

  sections.forEach(function (id) {
    var sec = document.getElementById(id);
    if (sec) observer.observe(sec);
  });

  // ── Generate landscape ─────────────────────
  if (window.InkScape) {
    var container = document.getElementById('hero-landscape');
    var seed = Math.floor(Math.random() * 999999);
    window.InkScape.generate(container, window.innerWidth, window.innerHeight, seed);
  }

  // ── Paper texture ──────────────────────────
  if (window.InkScape && window.InkScape.paperTexture) {
    var tex = window.InkScape.paperTexture(512, 512);
    document.body.style.backgroundImage = 'url(' + tex + ')';
    document.body.style.backgroundRepeat = 'repeat';
  }

  // ── Render vignettes ───────────────────────
  if (window.InkVignettes) {
    var holders = document.querySelectorAll('[data-vignette]');
    holders.forEach(function (holder) {
      var type = holder.getAttribute('data-vignette');
      var fn = window.InkVignettes[toCamel(type)];
      if (fn) holder.innerHTML = fn();
    });
  }

  // ── Helpers ────────────────────────────────
  function setText(id, text) {
    var e = document.getElementById(id);
    if (e) e.textContent = text;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function toCamel(str) {
    return str.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }
})();
