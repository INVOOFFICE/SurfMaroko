(function () {
  "use strict";

  var PAGE_SIZE = 12;

  function $(sel, root) { return (root || document).querySelector(sel); }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = String(str == null ? "" : str);
    return div.innerHTML;
  }

  function toInt(x, fallback) {
    var n = parseInt(String(x || ""), 10);
    return isNaN(n) ? fallback : n;
  }

  function readingTime(article) {
    var raw = String((article && article.summary) || "") + " " + String((article && article.description) || "");
    var words = raw.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200)) + " min";
  }

  function renderSkeletons() {
    var grid = $("#article-grid");
    if (!grid) return;
    var html = new Array(6).fill(0).map(function () {
      return '<a class="card card--skeleton" aria-hidden="true">' +
        '<div class="card__media skeleton"></div>' +
        '<div class="card__body">' +
        '<div class="skeleton" style="height:12px;width:60%;border-radius:6px;margin-bottom:8px"></div>' +
        '<div class="skeleton" style="height:18px;width:90%;border-radius:6px;margin-bottom:6px"></div>' +
        '<div class="skeleton" style="height:18px;width:75%;border-radius:6px;margin-bottom:12px"></div>' +
        '<div class="skeleton" style="height:13px;width:50%;border-radius:6px"></div>' +
        "</div></a>";
    }).join("");
    grid.classList.remove("stagger-in");
    grid.innerHTML = html;
  }

  function articleUrl(article) {
    var slug = String(article.slug || "").trim();
    if (!slug) return "index.html";
    return "articles/" + encodeURIComponent(slug) + "/";
  }

  function safeDate(d) {
    var raw = d || "";
    if (!raw) return null;
    var dt = new Date(raw);
    if (isNaN(dt.getTime())) return null;
    return dt;
  }

  function timeAgo(d) {
    var dt = safeDate(d);
    if (!dt) return "";
    var seconds = Math.floor((new Date() - dt) / 1000);
    if (seconds < 0) seconds = 0;
    var interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + " year" + (interval === 1 ? "" : "s") + " ago";
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + " month" + (interval === 1 ? "" : "s") + " ago";
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + " day" + (interval === 1 ? "" : "s") + " ago";
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + "h ago";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + " min ago";
    return "Just now";
  }

  function highlightText(text, query) {
    if (!query || typeof query !== "string") return escapeHtml(text);
    var safeText = escapeHtml(text);
    var q = query.trim();
    if (!q) return safeText;
    var pattern = new RegExp('(' + q.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + ')', 'gi');
    return safeText.replace(pattern, "<mark>$1</mark>");
  }

  function canonicalBaseFromSite(site) {
    var c = site && site.canonicalOrigin ? String(site.canonicalOrigin).trim() : "";
    if (!c) return "";
    return c.replace(/\/+$/, "");
  }

  function applyCanonicalHome_(site) {
    var base = canonicalBaseFromSite(site);
    var cl = $("#canonical-link");
    var og = $("#og-url");
    if (cl) cl.href = base ? base + "/" : window.location.href;
    if (og) og.content = base ? base + "/" : window.location.href;
  }

  function getQuery() {
    var p = new URLSearchParams(window.location.search);
    return {
      q: String(p.get("q") || "").trim(),
      cat: String(p.get("cat") || "").trim(),
      page: Math.max(1, toInt(p.get("page"), 1)),
    };
  }

  function setQuery(next) {
    var p = new URLSearchParams(window.location.search);
    if (next.q != null) {
      if (String(next.q).trim()) p.set("q", String(next.q).trim());
      else p.delete("q");
    }
    if (next.cat != null) {
      if (String(next.cat).trim() && String(next.cat).trim() !== "all") p.set("cat", String(next.cat).trim());
      else p.delete("cat");
    }
    if (next.page != null) {
      if (Number(next.page) > 1) p.set("page", String(next.page));
      else p.delete("page");
    }
    var url = window.location.pathname + (p.toString() ? "?" + p.toString() : "");
    window.history.pushState({}, "", url);
  }

  function buildCategorySet(articles, site) {
    var out = new Set();
    var fromSite = (site && site.topics) || [];
    fromSite.forEach(function (t) { if (t) out.add(String(t)); });
    (articles || []).forEach(function (a) { if (a && a.category) out.add(String(a.category)); });
    return Array.prototype.slice.call(out).filter(Boolean);
  }

  function renderPills(categories, active) {
    var wrap = $("#category-pills");
    if (!wrap) return;
    var allBtn = '<button type="button" class="pill" data-cat="all" aria-pressed="' + (active === "all" || !active ? "true" : "false") + '">All</button>';
    var html = [allBtn].concat(categories.map(function (c) {
      return '<button type="button" class="pill" data-cat="' + escapeHtml(c) + '" aria-pressed="' + (String(active || "all") === String(c) ? "true" : "false") + '">' + escapeHtml(c) + "</button>";
    })).join("");
    wrap.innerHTML = html;
    wrap.querySelectorAll("[data-cat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setQuery({ cat: btn.getAttribute("data-cat") || "all", page: 1 });
        hydrate();
      });
    });
  }

  function renderGrid(items, qObj) {
    var grid = $("#article-grid");
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = '<div class="card" style="grid-column: span 12; padding: 28px; text-align:center;">No articles found. Check your spelling or try another search.</div>';
      return;
    }
    var q = qObj ? qObj.q : "";
    grid.innerHTML = items.map(function (a) {
      var url = articleUrl(a);
      var img = a.image || "";
      var title = a.title || "";
      var desc = a.metaDescription || a.description || a.summary || "";
      var cat = a.category || "";
      var ago = timeAgo(a.publishedAt);
      var rt = readingTime(a);
      return '<a class="card" href="' + escapeHtml(url) + '">' +
        (img ? '<div class="card__media"><img src="' + escapeHtml(img) + '" alt="' + escapeHtml(title) + '" loading="lazy" /></div>' :
          '<div class="card__media" style="display:flex;align-items:center;justify-content:center;font-size:48px;">🌊</div>') +
        '<div class="card__body">' +
        '<p class="card__kicker"><span class="badge">' + escapeHtml(cat) + '</span>' +
        (ago ? '<span>' + escapeHtml(ago) + '</span>' : '') +
        '<span class="card__read-time">' + escapeHtml(rt) + '</span></p>' +
        '<h3 class="card__title">' + highlightText(title, q) + '</h3>' +
        '<p class="card__desc">' + highlightText(desc, q) + '</p>' +
        '<span class="card__read">Read article →</span>' +
        '</div></a>';
    }).join("");
    grid.classList.add("stagger-in");
  }

  function renderPager(total, page) {
    var pager = $("#pager");
    if (!pager) return;
    var prev = $("#pager-prev");
    var next = $("#pager-next");
    var label = $("#pager-label");
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    pager.hidden = pages <= 1;
    if (label) label.textContent = "Page " + page + " / " + pages;
    if (prev) { prev.disabled = page <= 1; prev.onclick = function () { setQuery({ page: page - 1 }); hydrate(); window.scrollTo({ top: 0, behavior: "smooth" }); }; }
    if (next) { next.disabled = page >= pages; next.onclick = function () { setQuery({ page: page + 1 }); hydrate(); window.scrollTo({ top: 0, behavior: "smooth" }); }; }
  }

  function filterArticles(articles, qObj) {
    var q = (qObj.q || "").toLowerCase().trim();
    var cat = (qObj.cat || "").trim();
    return articles.filter(function (a) {
      if (cat && cat !== "all" && String(a.category || "") !== cat) return false;
      if (!q) return true;
      var hay = (String(a.title || "") + " " + String(a.category || "") + " " + String(a.summary || "") + " " + String(a.keywords || "")).toLowerCase();
      return hay.includes(q);
    });
  }

  var allArticles = [];
  var allSite = {};
  var fullLoaded = false;

  function hydrate() {
    var qObj = getQuery();
    var source = fullLoaded ? allArticles : allArticles;
    var filtered = filterArticles(source, qObj);
    var meta = $("#latest-meta");
    if (meta) meta.textContent = filtered.length + " article" + (filtered.length !== 1 ? "s" : "");
    var page = qObj.page;
    var start = (page - 1) * PAGE_SIZE;
    renderGrid(filtered.slice(start, start + PAGE_SIZE), qObj);
    renderPager(filtered.length, page);
    renderPills(buildCategorySet(allArticles, allSite), qObj.cat || "all");
  }

  function renderHeroFeatured(articles) {
    var el = $("#hero-featured");
    if (!el || !articles.length) return;
    var top5 = articles.slice(0, 5);
    var html = '<div class="hero__carousel">' +
      top5.map(function (a) {
        return '<a class="hero-card" href="' + escapeHtml(articleUrl(a)) + '">' +
          (a.image ? '<img class="hero-card__img" src="' + escapeHtml(a.image) + '" alt="' + escapeHtml(a.title) + '" loading="lazy" />' :
            '<div class="hero-card__img" style="display:flex;align-items:center;justify-content:center;font-size:56px;background:rgba(14,165,233,0.1);">🌊</div>') +
          '<div class="hero-card__body">' +
          '<span class="hero-card__cat">' + escapeHtml(a.category || "Surf") + '</span>' +
          '<p class="hero-card__title">' + escapeHtml(a.title) + '</p>' +
          '</div></a>';
      }).join("") + '</div>';
    el.innerHTML = html;
  }

  // Surf Weather Widget
  function initSurfWidget() {
    var contentEl = $("#surf-widget-content");
    if (!contentEl) return;

    fetch('https://api.swellcloud.net/v1/status')
      .then(function(r) { 
        if (!r.ok) throw new Error('API down');
        return r.json();
      })
      .then(function(data) {
        var height = data.height || data.waveHeight || 'N/A';
        var swellDir = data.swellDirection || data.direction || 'N/A';
        var wind = data.wind || data.windSpeed || 'N/A';

        contentEl.innerHTML = 
          '<div class="surf-data">' +
            '<div class="surf-data__item"><span>Wave Height</span><strong>' + escapeHtml(height) + '</strong></div>' +
            '<div class="surf-data__item"><span>Swell Dir</span><strong>' + escapeHtml(swellDir) + '</strong></div>' +
            '<div class="surf-data__item"><span>Wind</span><strong>' + escapeHtml(wind) + '</strong></div>' +
          '</div>';
      })
      .catch(function() {
        contentEl.innerHTML = '<div style="color: #f87171; font-size: 13px; text-align: center;">Unable to load surf conditions. API is currently unavailable.</div>';
      });
  }

  // Search form
  function initSearch() {
    var form = $("#search-form");
    var input = $("#search-input");
    if (!form || !input) return;
    var qObj = getQuery();
    if (qObj.q) input.value = qObj.q;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setQuery({ q: input.value, page: 1 });
      hydrate();
    });
    input.addEventListener("input", function () {
      if (!input.value) { setQuery({ q: "", page: 1 }); hydrate(); }
    });
  }

  // Scroll to top
  function initScrollTop() {
    var btn = $("#scroll-top");
    if (!btn) return;
    btn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    window.addEventListener("scroll", function () {
      btn.classList.toggle("is-visible", window.scrollY > 400);
    }, { passive: true });
  }

  function init() {
    renderSkeletons();
    initSearch();
    initScrollTop();
    initSurfWidget();

    // 1. Load surf-news-latest.json first (fast)
    fetch("surf-news-latest.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (data) {
        var site = data.site || {};
        var articles = Array.isArray(data.articles) ? data.articles : [];
        allSite = site;
        articles.sort(function (a, b) {
          var ta = safeDate(a.publishedAt) ? safeDate(a.publishedAt).getTime() : 0;
          var tb = safeDate(b.publishedAt) ? safeDate(b.publishedAt).getTime() : 0;
          return tb - ta;
        });
        allArticles = articles;
        renderHeroFeatured(articles);
        hydrate();
        applyCanonicalHome_(site);

        // 2. Load full surf-news.json in background
        fetch("surf-news.json", { cache: "no-store" })
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
          .then(function (fullData) {
            var fullArticles = Array.isArray(fullData.articles) ? fullData.articles : [];
            fullArticles.sort(function (a, b) {
              var ta = safeDate(a.publishedAt) ? safeDate(a.publishedAt).getTime() : 0;
              var tb = safeDate(b.publishedAt) ? safeDate(b.publishedAt).getTime() : 0;
              return tb - ta;
            });
            allArticles = fullArticles;
            allSite = fullData.site || site;
            fullLoaded = true;
            hydrate();
          })
          .catch(function (err) { console.warn("Full surf-news.json failed:", err); });
      })
      .catch(function () {
        // Fallback: try surf-news.json directly
        fetch("surf-news.json", { cache: "no-store" })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            allSite = data.site || {};
            var articles = Array.isArray(data.articles) ? data.articles : [];
            articles.sort(function (a, b) {
              var ta = safeDate(a.publishedAt) ? safeDate(a.publishedAt).getTime() : 0;
              var tb = safeDate(b.publishedAt) ? safeDate(b.publishedAt).getTime() : 0;
              return tb - ta;
            });
            allArticles = articles;
            renderHeroFeatured(articles);
            hydrate();
            fullLoaded = true;
          })
          .catch(function () {
            var grid = $("#article-grid");
            if (grid) grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">Unable to load articles. Please check your connection.</div>';
          });
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* ── PWA Service Worker ────────────────────────────────── */
(function () {
  "use strict";
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js", { scope: "/" })
        .then(function (reg) {
          reg.addEventListener("updatefound", function () {
            var nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", function () {
              if (nw.state === "installed" && navigator.serviceWorker.controller) {
                showUpdateToast();
              }
            });
          });
        })
        .catch(function (e) { console.warn("[PWA] SW error:", e); });
    });
  }

  var deferredPrompt = null;
  var DISMISSED_KEY = "pwa_banner_dismissed_v1";

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    var dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - parseInt(dismissed, 10) < 7 * 24 * 60 * 60 * 1000) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    setTimeout(showInstallBanner, 2500);
  });

  window.addEventListener("appinstalled", function () { hideBanner(); deferredPrompt = null; });

  function showInstallBanner() {
    if (document.getElementById("pwa-banner")) return;
    var banner = document.createElement("div");
    banner.id = "pwa-banner";
    banner.setAttribute("role", "complementary");
    banner.innerHTML =
      '<div class="pwa-banner__inner">' +
      '<img src="/favicon.svg" class="pwa-banner__icon" alt="" width="40" height="40"/>' +
      '<div class="pwa-banner__text"><strong>Add MoroccoSurf to Home Screen</strong>' +
      '<span>Quick access to the surf blog, even offline.</span></div>' +
      '<div class="pwa-banner__actions">' +
      '<button class="pwa-banner__btn pwa-banner__btn--install" id="pwa-install-btn">Install</button>' +
      '<button class="pwa-banner__btn pwa-banner__btn--dismiss" id="pwa-dismiss-btn" aria-label="Dismiss">✕</button>' +
      '</div></div>';
    document.body.appendChild(banner);
    requestAnimationFrame(function () { requestAnimationFrame(function () { banner.classList.add("pwa-banner--visible"); }); });
    document.getElementById("pwa-install-btn").addEventListener("click", function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (c) {
        if (c.outcome !== "accepted") localStorage.setItem(DISMISSED_KEY, String(Date.now()));
        deferredPrompt = null;
        hideBanner();
      });
    });
    document.getElementById("pwa-dismiss-btn").addEventListener("click", function () {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
      hideBanner();
    });
  }

  function hideBanner() {
    var banner = document.getElementById("pwa-banner");
    if (!banner) return;
    banner.classList.remove("pwa-banner--visible");
    setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 350);
  }

  function showUpdateToast() {
    var toast = document.createElement("div");
    toast.id = "pwa-update-toast";
    toast.innerHTML = '<span>🌊 New version available.</span><button id="pwa-update-btn">Update</button>';
    document.body.appendChild(toast);
    requestAnimationFrame(function () { requestAnimationFrame(function () { toast.classList.add("pwa-toast--visible"); }); });
    document.getElementById("pwa-update-btn").addEventListener("click", function () { window.location.reload(); });
  }
})();
