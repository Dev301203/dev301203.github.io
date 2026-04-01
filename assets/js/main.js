(function () {
  "use strict";

  var CONTENT_URL = "./assets/data/content.json";

  var prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var animeOk = typeof anime !== "undefined" && !prefersReduced;

  var siteData = null;
  var fullTagline = "";

  function escapeAttr(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function escapeHtml(s) {
    if (s == null) return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function applyMeta(meta) {
    if (!meta) return;
    if (meta.title) document.title = meta.title;
    var desc = document.querySelector('meta[name="description"]');
    if (desc && meta.description) desc.setAttribute("content", meta.description);
    var icon = document.querySelector('link[rel="shortcut icon"], link[rel="icon"]');
    if (icon && meta.favicon) icon.setAttribute("href", meta.favicon);
  }

  function renderHeader(h) {
    if (!h) return;
    var logoMount = document.getElementById("mount-logo");
    var navMenu = document.getElementById("nav-menu");
    if (logoMount && h.logoMark) {
      logoMount.innerHTML =
        '<a href="' +
        escapeAttr(h.logoHref || "#hero") +
        '" class="logo-mark">' +
        escapeHtml(h.logoMark.text || "") +
        "<span>" +
        escapeHtml(h.logoMark.accent || "") +
        "</span></a>";
    }
    if (navMenu && h.nav && h.nav.length) {
      navMenu.innerHTML = h.nav
        .map(function (item) {
          return (
            "<li><a href=\"" +
            escapeAttr(item.href) +
            '">' +
            escapeHtml(item.label) +
            "</a></li>"
          );
        })
        .join("");
    }
  }

  function renderHero(hero) {
    var mount = document.getElementById("mount-hero");
    if (!hero || !mount) return;
    fullTagline = hero.tagline || "";
    mount.innerHTML =
      '<p class="hero-badge" data-hero-badge>' +
      escapeHtml(hero.badge || "") +
      "</p>" +
      '<h1 class="hero-title" id="hero-name">' +
      escapeHtml(hero.name || "") +
      "</h1>" +
      '<p class="hero-tagline" id="hero-tagline"></p>' +
      '<button type="button" class="hero-cta" data-scroll-to="' +
      escapeAttr(hero.ctaTarget || "#about") +
      '">' +
      escapeHtml(hero.ctaLabel || "") +
      "</button>";
  }

  function renderAbout(a) {
    var el = document.getElementById("mount-about");
    if (!a || !el) return;
    var paras = (a.paragraphs || [])
      .map(function (p) {
        return "<p>" + p + "</p>";
      })
      .join("");
    var logos = (a.logos || [])
      .map(function (logo) {
        var matte = logo.matte ? " logo-slot--matte" : "";
        var w = logo.width != null ? logo.width : 280;
        var h = logo.height != null ? logo.height : 120;
        return (
          '<div class="logo-slot' +
          matte +
          '"><img src="' +
          escapeAttr(logo.src) +
          '" alt="' +
          escapeAttr(logo.alt) +
          '" width="' +
          w +
          '" height="' +
          h +
          '" data-animate="logo" /></div>'
        );
      })
      .join("");
    el.innerHTML =
      '<header class="section-header">' +
      '<p class="section-kicker">' +
      escapeHtml(a.kicker || "") +
      "</p>" +
      '<h2 class="section-title">' +
      escapeHtml(a.title || "") +
      "</h2>" +
      '<span class="section-slash"></span></header>' +
      '<div class="about-grid">' +
      '<div class="about-portrait" data-animate="about-left">' +
      '<img src="' +
      escapeAttr(a.portrait && a.portrait.src) +
      '" alt="' +
      escapeAttr(a.portrait && a.portrait.alt) +
      '" width="320" height="320" />' +
      "</div>" +
      '<div class="about-copy" data-animate="about-right">' +
      paras +
      '<div class="worked-with">' +
      "<h3>" +
      escapeHtml(a.workedWithTitle || "Worked with") +
      "</h3>" +
      '<div class="logo-row">' +
      logos +
      "</div></div></div></div>";
  }

  function renderSkills(sk) {
    var el = document.getElementById("mount-skills");
    if (!sk || !el) return;
    var groups = (sk.groups || [])
      .map(function (g) {
        var chips = (g.items || [])
          .map(function (item) {
            return '<span class="skill-chip" data-skill>' + escapeHtml(item) + "</span>";
          })
          .join("");
        return (
          '<div class="skill-group">' +
          "<h3>" +
          escapeHtml(g.title || "") +
          "</h3>" +
          '<div class="skill-chips">' +
          chips +
          "</div></div>"
        );
      })
      .join("");
    el.innerHTML =
      '<header class="section-header">' +
      '<p class="section-kicker">' +
      escapeHtml(sk.kicker || "") +
      "</p>" +
      '<h2 class="section-title">' +
      escapeHtml(sk.title || "") +
      "</h2>" +
      '<span class="section-slash"></span></header>' +
      groups;
  }

  function timelineCardHtml(entry) {
    var h = '<div class="timeline-card">';
    h += "<h4>" + escapeHtml(entry.title || "") + "</h4>";
    if (entry.location) {
      h += '<p class="timeline-loc">' + escapeHtml(entry.location) + "</p>";
    }
    if (entry.date) {
      h += '<p class="timeline-date">' + escapeHtml(entry.date) + "</p>";
    }
    if (entry.subtitle) {
      h += '<p class="timeline-subtitle">' + escapeHtml(entry.subtitle) + "</p>";
    }
    (entry.paragraphs || []).forEach(function (p) {
      h += "<p>" + p + "</p>";
    });
    h += "</div>";
    return h;
  }

  function renderTimelineEntries(entries) {
    return (entries || [])
      .map(function (entry, i) {
        var side = i % 2 === 0 ? "left" : "right";
        return (
          '<article class="timeline-block timeline-block--' +
          side +
          '" data-timeline>' +
          timelineCardHtml(entry) +
          "</article>"
        );
      })
      .join("");
  }

  function renderExperience(ex) {
    var el = document.getElementById("mount-experience");
    if (!ex || !el) return;
    var resume = ex.resume || {};
    el.innerHTML =
      '<header class="section-header">' +
      '<p class="section-kicker">' +
      escapeHtml(ex.kicker || "") +
      "</p>" +
      '<h2 class="section-title">' +
      escapeHtml(ex.title || "") +
      "</h2>" +
      '<span class="section-slash"></span></header>' +
      '<div class="resume-cta" data-animate="resume-cta">' +
      '<ion-icon name="document-text-outline" aria-hidden="true"></ion-icon>' +
      "<div>" +
      '<p style="margin: 0 0 0.35rem; color: var(--text-muted); font-size: 0.9rem">' +
      escapeHtml(resume.description || "") +
      "</p>" +
      '<a href="' +
      escapeAttr(resume.url) +
      '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(resume.linkText || "") +
      "</a></div></div>" +
      '<h3 class="section-kicker" style="margin-bottom: 1.5rem">' +
      escapeHtml(ex.educationTitle || "Education") +
      "</h3>" +
      '<div class="timeline">' +
      renderTimelineEntries(ex.education) +
      "</div>" +
      '<h3 class="section-kicker" style="margin: 3rem 0 1.5rem">' +
      escapeHtml(ex.workTitle || "Experience") +
      "</h3>" +
      '<div class="timeline">' +
      renderTimelineEntries(ex.work) +
      "</div>" +
      '<h3 class="section-kicker" style="margin: 3rem 0 1.5rem">' +
      escapeHtml(ex.honoursTitle || "Honours & awards") +
      "</h3>" +
      '<div class="timeline">' +
      renderTimelineEntries(ex.honours) +
      "</div>";
  }

  function renderProjects(p) {
    var el = document.getElementById("mount-projects");
    if (!p || !el) return;
    var filters = (p.filters || [])
      .map(function (f) {
        var active = f.value === "all" ? " is-active" : "";
        return (
          '<button type="button" class="filter-btn' +
          active +
          '" data-filter="' +
          escapeAttr(f.value) +
          '">' +
          escapeHtml(f.label) +
          "</button>"
        );
      })
      .join("");
    var cards = (p.items || [])
      .map(function (item) {
        return (
          '<article class="project-card" data-category="' +
          escapeAttr(item.category) +
          '" data-project-card>' +
          '<a class="project-card__link" href="' +
          escapeAttr(item.href) +
          '" target="_blank" rel="noopener noreferrer">' +
          '<div class="project-card__media">' +
          '<img src="' +
          escapeAttr(item.image) +
          '" alt="' +
          escapeAttr(item.alt) +
          '" width="640" height="400" />' +
          "</div>" +
          '<div class="project-card__body">' +
          '<p class="project-card__cat">' +
          escapeHtml(item.category) +
          "</p>" +
          '<h3 class="project-card__title">' +
          escapeHtml(item.title) +
          "</h3></div></a></article>"
        );
      })
      .join("");
    el.innerHTML =
      '<header class="section-header">' +
      '<p class="section-kicker">' +
      escapeHtml(p.kicker || "") +
      "</p>" +
      '<h2 class="section-title">' +
      escapeHtml(p.title || "") +
      "</h2>" +
      '<span class="section-slash"></span></header>' +
      '<div class="filter-bar" role="group" aria-label="Filter projects">' +
      filters +
      "</div>" +
      '<div class="project-grid" id="project-grid">' +
      cards +
      "</div>";
  }

  function renderContact(c) {
    var el = document.getElementById("mount-contact");
    if (!c || !el) return;
    var links = (c.links || [])
      .map(function (link) {
        var ext = link.external ? ' target="_blank" rel="noopener noreferrer"' : "";
        return (
          '<a class="contact-pill" href="' +
          escapeAttr(link.href) +
          '" data-contact-link' +
          ext +
          "><ion-icon name=\"" +
          escapeAttr(link.icon) +
          '"></ion-icon>' +
          escapeHtml(link.label) +
          "</a>"
        );
      })
      .join("");
    el.innerHTML =
      '<header class="section-header">' +
      '<p class="section-kicker">' +
      escapeHtml(c.kicker || "") +
      "</p>" +
      '<h2 class="section-title">' +
      escapeHtml(c.title || "") +
      "</h2>" +
      '<span class="section-slash"></span></header>' +
      '<p class="contact-lead" data-contact-lead>' +
      escapeHtml(c.lead || "") +
      "</p>" +
      '<div class="contact-links">' +
      links +
      "</div>";
  }

  function renderFooter(f) {
    var el = document.getElementById("mount-footer");
    if (!el) return;
    var name = f && f.name ? f.name : "";
    var note = f && f.note ? f.note : "";
    el.innerHTML =
      "<p>© <span id=\"year\"></span> " + escapeHtml(name) + ". " + escapeHtml(note) + "</p>";
  }

  /* ---------- Hero animation ---------- */
  function splitHeroName() {
    var heroName = document.getElementById("hero-name");
    if (!heroName) return;
    var text = heroName.textContent.trim();
    heroName.textContent = "";
    text.split("").forEach(function (ch) {
      var span = document.createElement("span");
      span.className = "hero-char" + (ch === " " ? " hero-char-space" : "");
      span.textContent = ch === " " ? "\u00a0" : ch;
      heroName.appendChild(span);
    });
  }

  function runTypewriter() {
    var taglineEl = document.getElementById("hero-tagline");
    if (!taglineEl) return;
    var i = 0;
    function tick() {
      if (i <= fullTagline.length) {
        taglineEl.textContent = fullTagline.slice(0, i);
        i += 1;
        setTimeout(tick, prefersReduced ? 0 : 28);
      } else if (animeOk) {
        anime({
          targets: taglineEl,
          skewX: [0, -3, 3, 0],
          duration: 280,
          easing: "easeInOutQuad",
        });
      }
    }
    setTimeout(tick, prefersReduced ? 0 : 900);
  }

  function initHero() {
    var heroName = document.getElementById("hero-name");
    splitHeroName();

    if (!animeOk) {
      if (heroName && siteData && siteData.hero) {
        var chars = heroName.querySelectorAll(".hero-char");
        if (chars.length) {
          heroName.textContent = siteData.hero.name || "";
        }
      }
      var taglineEl = document.getElementById("hero-tagline");
      if (taglineEl) taglineEl.textContent = fullTagline;
      document.querySelectorAll(".hero-badge, .hero-tagline, .hero-cta, .scroll-cue").forEach(function (el) {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }

    anime.set(".hero-char", {
      opacity: 0,
      translateY: 56,
      rotate: -14,
    });

    anime({
      targets: ".hero-char",
      opacity: 1,
      translateY: 0,
      rotate: 0,
      delay: anime.stagger(42, { start: 220 }),
      duration: 720,
      easing: "easeOutElastic(1, .6)",
    });

    anime({
      targets: "[data-hero-badge]",
      opacity: 1,
      scale: [0.85, 1],
      duration: 500,
      delay: 80,
      easing: "easeOutBack(1.4)",
    });

    anime({
      targets: ".hero-tagline",
      opacity: 1,
      duration: 400,
      delay: 600,
      easing: "easeOutQuad",
    });
    runTypewriter();

    anime({
      targets: ".hero-cta",
      opacity: 1,
      scale: [0.88, 1],
      duration: 560,
      delay: 1400,
      easing: "easeOutBack(1.25)",
    });

    anime({
      targets: ".scroll-cue",
      opacity: 1,
      duration: 500,
      delay: 2000,
      easing: "easeOutQuad",
    });

    anime({
      targets: ".scroll-cue ion-icon",
      translateY: [0, 12, 0],
      loop: true,
      duration: 1400,
      easing: "easeInOutSine",
      delay: 2200,
    });
  }

  function observeSection(selector, onEnter) {
    var el = document.querySelector(selector);
    if (!el) return;
    var done = false;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || done) return;
          done = true;
          onEnter();
          io.disconnect();
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
  }

  function setupScrollAnimations() {
    observeSection("#about", function () {
      var portrait = document.querySelector(".about-portrait");
      var copy = document.querySelector(".about-copy");
      var logos = document.querySelectorAll(".logo-row img[data-animate='logo']");

      if (animeOk) {
        if (portrait) {
          anime.set(portrait, { opacity: 0, translateX: -70 });
          anime({
            targets: portrait,
            opacity: 1,
            translateX: 0,
            duration: 800,
            easing: "easeOutCubic",
          });
        }
        if (copy) {
          anime.set(copy, { opacity: 0, translateX: 70 });
          anime({
            targets: copy,
            opacity: 1,
            translateX: 0,
            duration: 800,
            delay: 120,
            easing: "easeOutCubic",
          });
        }
        if (logos.length) {
          anime.set(logos, { opacity: 0, scale: 0.85, rotate: -4 });
          anime({
            targets: logos,
            opacity: 1,
            scale: 1,
            rotate: 0,
            delay: anime.stagger(100, { start: 280 }),
            duration: 600,
            easing: "easeOutBack(1.1)",
          });
        }
      } else {
        if (portrait) portrait.style.opacity = "1";
        if (copy) copy.style.opacity = "1";
        logos.forEach(function (img) {
          img.style.opacity = "1";
        });
      }
    });

    observeSection("#skills", function () {
      var chips = document.querySelectorAll("[data-skill]");
      if (animeOk && chips.length) {
        anime.set(chips, { opacity: 0, scale: 0.65, rotate: -6 });
        anime({
          targets: chips,
          opacity: 1,
          scale: 1,
          rotate: 0,
          delay: anime.stagger(28, { start: 100 }),
          duration: 520,
          easing: "easeOutElastic(1, .7)",
        });
      } else {
        chips.forEach(function (c) {
          c.style.opacity = "1";
        });
      }
    });

    observeSection("#experience", function () {
      var resumeCta = document.querySelector("[data-animate='resume-cta']");
      var blocks = document.querySelectorAll("[data-timeline]");

      if (animeOk) {
        if (resumeCta) {
          anime.set(resumeCta, { opacity: 0, translateY: 36 });
          anime({
            targets: resumeCta,
            opacity: 1,
            translateY: 0,
            duration: 600,
            easing: "easeOutCubic",
          });
        }
        blocks.forEach(function (block, index) {
          var fromLeft = block.classList.contains("timeline-block--left");
          anime.set(block, {
            opacity: 0,
            translateX: fromLeft ? -80 : 80,
          });
          anime({
            targets: block,
            opacity: 1,
            translateX: 0,
            duration: 750,
            delay: index * 90,
            easing: "easeOutCubic",
          });
        });
      } else {
        if (resumeCta) resumeCta.style.opacity = "1";
        blocks.forEach(function (b) {
          b.style.opacity = "1";
        });
      }
    });

    observeSection("#projects", function () {
      animateVisibleProjectCards();
    });

    observeSection("#contact", function () {
      var lead = document.querySelector("[data-contact-lead]");
      var pills = document.querySelectorAll("[data-contact-link]");

      if (animeOk) {
        if (lead) {
          anime.set(lead, { opacity: 0, translateY: 24 });
          anime({
            targets: lead,
            opacity: 1,
            translateY: 0,
            duration: 550,
            easing: "easeOutCubic",
          });
        }
        if (pills.length) {
          anime.set(pills, { opacity: 0, scale: 0.9 });
          anime({
            targets: pills,
            opacity: 1,
            scale: 1,
            delay: anime.stagger(120, { start: 200 }),
            duration: 550,
            easing: "easeOutBack(1.15)",
          });
        }
      } else {
        if (lead) lead.style.opacity = "1";
        pills.forEach(function (p) {
          p.style.opacity = "1";
        });
      }
    });
  }

  function animateVisibleProjectCards() {
    var cards = document.querySelectorAll("[data-project-card]:not(.is-hidden)");
    if (animeOk && cards.length) {
      anime.set(cards, { opacity: 0, translateY: 56, scale: 0.94 });
      anime({
        targets: cards,
        opacity: 1,
        translateY: 0,
        scale: 1,
        delay: anime.stagger(85, { start: 80 }),
        duration: 680,
        easing: "easeOutElastic(1, .72)",
      });
    } else {
      cards.forEach(function (c) {
        c.style.opacity = "1";
      });
    }
  }

  function bindProjectFilters() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-bar .filter-btn[data-filter]");
      if (!btn) return;

      var cat = btn.getAttribute("data-filter");
      var bar = btn.closest(".filter-bar");
      if (!bar) return;

      bar.querySelectorAll(".filter-btn[data-filter]").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });

      var projectCards = document.querySelectorAll("[data-project-card]");
      projectCards.forEach(function (card) {
        var show = cat === "all" || card.getAttribute("data-category") === cat;

        if (show) {
          card.classList.remove("is-hidden");
          if (animeOk) {
            anime({
              targets: card,
              opacity: [0, 1],
              scale: [0.9, 1],
              duration: 480,
              easing: "easeOutQuad",
            });
          } else {
            card.style.opacity = "1";
          }
        } else {
          if (animeOk) {
            anime({
              targets: card,
              opacity: 0,
              scale: 0.92,
              duration: 320,
              easing: "easeInQuad",
              complete: function () {
                card.classList.add("is-hidden");
              },
            });
          } else {
            card.classList.add("is-hidden");
          }
        }
      });
    });
  }

  function bindContactHover() {
    if (!animeOk) return;
    document.querySelectorAll("[data-contact-link]").forEach(function (pill) {
      pill.addEventListener("mouseenter", function () {
        anime.remove(pill);
        anime({
          targets: pill,
          scale: [1, 1.08, 1.04],
          duration: 480,
          easing: "easeOutElastic(1, .6)",
        });
      });
      pill.addEventListener("mouseleave", function () {
        anime({
          targets: pill,
          scale: 1,
          duration: 380,
          easing: "easeOutQuad",
        });
      });
    });
  }

  /* ---------- Mobile nav ---------- */
  var siteNav = document.getElementById("site-nav");
  var navToggle = document.getElementById("nav-toggle");

  function setNavOpen(open) {
    if (!siteNav || !navToggle) return;
    siteNav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      setNavOpen(!siteNav.classList.contains("is-open"));
    });
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest("#nav-menu a[href^='#']")) {
      setNavOpen(false);
    }
    var scrollBtn = e.target.closest("[data-scroll-to]");
    if (scrollBtn) {
      var sel = scrollBtn.getAttribute("data-scroll-to");
      var scrollEl = sel ? document.querySelector(sel) : null;
      if (scrollEl) {
        scrollEl.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth" });
      }
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setNavOpen(false);
  });

  /* ---------- Parallax ---------- */
  var layers = document.querySelectorAll(".parallax-layer");
  var parallaxTicking = false;

  function updateParallax() {
    var y = window.scrollY || window.pageYOffset;
    var i = 0;
    layers.forEach(function (layer) {
      var mult = i === 0 ? 0.06 : 0.1;
      i += 1;
      if (animeOk) {
        anime.set(layer, { translateY: y * mult });
      } else {
        layer.style.transform = "translateY(" + y * mult + "px)";
      }
    });
    parallaxTicking = false;
  }

  if (layers.length && !prefersReduced) {
    window.addEventListener("scroll", function () {
      if (!parallaxTicking) {
        window.requestAnimationFrame(updateParallax);
        parallaxTicking = true;
      }
    });
    updateParallax();
  }

  function start(data) {
    siteData = data;
    applyMeta(data.meta);
    renderHeader(data.header);
    renderHero(data.hero);
    renderAbout(data.about);
    renderSkills(data.skills);
    renderExperience(data.experience);
    renderProjects(data.projects);
    renderContact(data.contact);
    renderFooter(data.footer);

    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    initHero();
    setupScrollAnimations();
    bindContactHover();
  }

  bindProjectFilters();

  function embeddedContent() {
    return typeof window.__SITE_CONTENT__ !== "undefined" ? window.__SITE_CONTENT__ : null;
  }

  function loadContent() {
    var fallback = embeddedContent();
    var isHttp = /^https?:$/i.test(window.location.protocol);

    if (isHttp) {
      return fetch(CONTENT_URL, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("Content fetch failed: " + r.status);
          return r.json();
        })
        .catch(function (err) {
          console.warn(err);
          if (fallback) return fallback;
          throw err;
        });
    }

    if (fallback) return Promise.resolve(fallback);

    return Promise.reject(
      new Error("No embedded data. Run: node tools/sync-site-data.js")
    );
  }

  loadContent()
    .then(start)
    .catch(function (err) {
      console.error(err);
      var main = document.querySelector("main");
      if (main) {
        main.innerHTML =
          '<section class="section"><div class="container"><p style="color:var(--text-muted)">Could not load site content. Ensure <code>assets/data/site-data.js</code> exists (run <code>node tools/sync-site-data.js</code> after editing <code>content.json</code>) or open the site over HTTP.</p></div></section>';
      }
    });
})();
