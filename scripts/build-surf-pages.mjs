/**
 * Build script — MarocSurf Blog
 * Génère les pages statiques SEO pour chaque article surf.
 *
 * Usage: node scripts/build-surf-pages.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const NEWS_JSON = path.join(ROOT, "surf-news.json");
const ARTICLE_TEMPLATE = path.join(ROOT, "article.html");
const OUT_DIR = path.join(ROOT, "articles");
const SITEMAP_OUT = path.join(ROOT, "sitemap.xml");
const FEED_OUT = path.join(ROOT, "feed.xml");

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(s) {
  return String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function clampChars(s, max) {
  const t = stripHtml(s);
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)).replace(/\s+\S*$/, "") + "…";
}

function slugify(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " et ")
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "article";
}

function safeDateIso(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

function prettyDate(d) {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

function canonicalBase(site) {
  return ((site?.canonicalOrigin || "").trim()).replace(/\/+$/, "");
}

function articleCanonicalUrl(site, slug) {
  const base = canonicalBase(site);
  if (!base) return "";
  return `${base}/articles/${encodeURIComponent(slug)}/`;
}

function buildKeywords(article) {
  const kw = [];
  if (article.category) kw.push(article.category);
  const k = String(article.keywords || "").split(",").map(s => s.trim()).filter(Boolean);
  k.forEach(t => kw.push(t));
  return Array.from(new Set(kw.map(x => x.toLowerCase()))).slice(0, 12).join(", ");
}

function relatedArticles(all, article) {
  const seed = (String(article.keywords || "") + "," + String(article.category || "")).toLowerCase();
  const tokens = seed.split(/[, ]+/).map(t => t.trim()).filter(t => t.length >= 3).slice(0, 10);
  return all
    .filter(a => a && a.slug && a.slug !== article.slug)
    .map(a => {
      const hay = (String(a.title || "") + " " + String(a.keywords || "") + " " + String(a.summary || "")).toLowerCase();
      let score = 0;
      tokens.forEach(t => { if (hay.includes(t)) score += 1; });
      const t = new Date(a.publishedAt || 0).getTime() || 0;
      return { a, score, t };
    })
    .sort((x, y) => (y.score !== x.score ? y.score - x.score : y.t - x.t))
    .filter(x => x.score > 0)
    .slice(0, 3)
    .map(x => x.a);
}

function buildJsonLd(site, article, canonicalUrl, ogImage) {
  const base = canonicalBase(site);
  const siteName = site?.name || "MarocSurf";
  const orgId = base ? `${base}/#organization` : "#organization";
  const webId = base ? `${base}/#website` : "#website";
  const pubDate = (article.publishedAt && String(article.publishedAt).slice(0, 10)) || "2026-01-01";
  const desc = clampChars(article.metaDescription || article.description || article.summary || "", 160);

  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": orgId, name: siteName, url: base ? `${base}/` : undefined },
      { "@type": "WebSite", "@id": webId, url: base ? `${base}/` : undefined, name: siteName, inLanguage: "fr", publisher: { "@id": orgId } },
      {
        "@type": "BreadcrumbList",
        "@id": canonicalUrl + "#breadcrumb",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: base ? `${base}/` : "" },
          { "@type": "ListItem", position: 2, name: article.category || "Surf", item: base ? `${base}/?cat=${encodeURIComponent(article.category || "")}` : "" },
          { "@type": "ListItem", position: 3, name: article.title || "Article", item: canonicalUrl },
        ],
      },
      {
        "@type": "BlogPosting",
        "@id": canonicalUrl + "#article",
        mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
        headline: article.title || "",
        description: desc,
        image: ogImage ? [ogImage] : undefined,
        datePublished: pubDate,
        dateModified: pubDate,
        inLanguage: "fr",
        author: { "@type": "Organization", name: siteName, "@id": orgId },
        publisher: { "@id": orgId },
        keywords: buildKeywords(article).split(",").map(k => k.trim()).filter(Boolean),
        isAccessibleForFree: true,
        articleSection: article.category || "Surf",
      },
    ],
  };
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}

function deleteStaleFolders(outDir, keepSlugs) {
  let removed = 0;
  if (!fs.existsSync(outDir)) return 0;
  fs.readdirSync(outDir, { withFileTypes: true }).forEach(e => {
    if (!e.isDirectory()) return;
    if (keepSlugs.has(e.name)) return;
    fs.rmSync(path.join(outDir, e.name), { recursive: true, force: true });
    removed++;
  });
  return removed;
}

function buildBullets(article) {
  const bullets = (article.bullets || []).map(b => String(b || "").trim()).filter(Boolean).slice(0, 6);
  if (!bullets.length) {
    String(article.summary || article.description || "")
      .split(/[.?!]\s+/).map(s => s.trim()).filter(Boolean)
      .slice(0, 4).forEach(s => bullets.push(clampChars(s, 120)));
  }
  return bullets.slice(0, 6);
}

function buildRelatedHtml(site, rel) {
  if (!rel || !rel.length) return "<p style='color:var(--muted);font-size:13px;'>Bientôt d'autres articles similaires.</p>";
  return rel.map(a => {
    const url = `../../articles/${encodeURIComponent(a.slug)}/`;
    return `<a class="related-card" href="${escapeHtml(url)}" role="listitem">
      <div class="related-card__cat">${escapeHtml(a.category || "Surf")}</div>
      <div class="related-card__title">${escapeHtml(a.title)}</div>
    </a>`;
  }).join("");
}

function simpleMarkdownToHtml(md) {
  let html = String(md || "");
  html = html.replace(/^#{4}\s+(.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^#{3}\s+(.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^#{2}\s+(.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^#{1}\s+(.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/([^*]|^)\*(?!\*)(.*?)(?!\*)\*([^*]|$)/g, '$1<em>$2</em>$3');
  html = html.replace(/^\s*>\s+(.*$)/gim, '<blockquote>$1</blockquote>');
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>(\s*<li>.*<\/li>)*)/gim, '<ul>\n$1\n</ul>');
  const blocks = html.split(/\n\s*\n/);
  html = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    if (/^<(h[1-6]|ul|ol|blockquote|li|hr)>.*/i.test(block)) return block;
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('\n\n');
  html = html.replace(/<\/ul>\n*<ul>/g, '\n');
  return html;
}

function buildSitemap(site, articles) {
  const base = canonicalBase(site);
  const now = new Date().toISOString().slice(0, 10);
  const staticPages = base ? [
    `  <url><loc>${escapeXml(base)}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
  ] : [];
  const articleUrls = articles.map(a => {
    const url = base ? `${base}/articles/${encodeURIComponent(a.slug)}/` : "";
    if (!url) return "";
    const lastmod = (a.publishedAt && String(a.publishedAt).slice(0, 10)) || now;
    return `  <url><loc>${escapeXml(url)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
  }).filter(Boolean);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticPages, ...articleUrls].join("\n")}
</urlset>\n`;
}

function buildRssFeed(site, articles) {
  const base = canonicalBase(site);
  const siteName = site?.name || "MarocSurf";
  const desc = site?.description || "Le blog surf au Maroc — spots, saisons, conseils.";
  const items = articles.slice(0, 50).map(a => {
    const url = base ? `${base}/articles/${encodeURIComponent(a.slug)}/` : "";
    const pub = a.publishedAt ? new Date(a.publishedAt).toUTCString() : new Date().toUTCString();
    const summary = clampChars(a.metaDescription || a.summary || a.description || "", 300);
    return `  <item>
    <title>${escapeXml(a.title)}</title>
    <link>${escapeXml(url)}</link>
    <description>${escapeXml(summary)}</description>
    <pubDate>${pub}</pubDate>
    <guid isPermaLink="true">${escapeXml(url)}</guid>
    <category>${escapeXml(a.category || "Surf")}</category>
  </item>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXml(siteName)}</title>
  <link>${escapeXml(base ? base + "/" : "")}</link>
  <description>${escapeXml(desc)}</description>
  <language>fr</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${escapeXml(base ? base + "/feed.xml" : "")}" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>\n`;
}

function buildArticlePages(articles, site, template) {
  const normalized = articles
    .map(a => ({
      ...a,
      title: String(a.title || "").trim(),
      slug: String(a.slug || "").trim() || slugify(String(a.title || "")),
      category: String(a.category || "Surf").trim(),
    }))
    .filter(a => a.title && a.slug);

  normalized.sort((a, b) => {
    const ta = new Date(a.publishedAt || 0).getTime() || 0;
    const tb = new Date(b.publishedAt || 0).getTime() || 0;
    return tb - ta;
  });

  const base = canonicalBase(site);
  const siteName = site.name || "MarocSurf";
  const defaultOg = site.defaultOgImage || "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&h=630&fit=crop&q=80";

  normalized.forEach(a => {
    const canon = articleCanonicalUrl(site, a.slug);
    const ogImage = (a.image && String(a.image).trim()) || defaultOg;
    const desc = clampChars(a.metaDescription || a.description || a.summary || "", 160);
    const dek = clampChars(a.dek || a.summary || a.description || desc, 180);
    const intro = clampChars(a.intro || a.summary || a.description || "", 400);
    const summary = clampChars(a.summary || a.description || "", 50000);
    const why = clampChars(a.whyItMatters || a.impact || a.summary || "", 50000);
    const keywords = buildKeywords(a);
    const imageAlt = clampChars(a.imageAlt || a.title || "Surf Maroc", 120);

    const rawContent = summary + " " + why + " " + intro;
    const wordsCount = rawContent.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.ceil(wordsCount / 200)) + " min";

    const bullets = buildBullets(a).map(b => "<li>" + escapeHtml(clampChars(b, 140)) + "</li>").join("");
    const rel = relatedArticles(normalized, a);
    const relHtml = buildRelatedHtml(site, rel);
    const jsonLd = buildJsonLd(site, a, canon, ogImage);
    const parsedDescription = a.description ? simpleMarkdownToHtml(a.description) : "";
    const fullDescHtml = parsedDescription ? `<div class="article__full-description">${parsedDescription}</div>` : "";

    const out = template
      .replaceAll("{{SITE_NAME}}", escapeHtml(siteName))
      .replaceAll("{{TITLE}}", escapeHtml(a.seoTitle || a.title))
      .replaceAll("{{META_DESCRIPTION}}", escapeHtml(desc))
      .replaceAll("{{CANONICAL_URL}}", escapeHtml(canon || ""))
      .replaceAll("{{OG_IMAGE}}", escapeHtml(ogImage))
      .replaceAll("{{CATEGORY}}", escapeHtml(a.category))
      .replaceAll("{{READING_TIME}}", escapeHtml(readingTime))
      .replaceAll("{{SOURCE}}", escapeHtml(String((a.source && a.source.name) || a.source || "")))
      .replaceAll("{{PUBLISHED_ISO}}", escapeHtml(safeDateIso(a.publishedAt) || ""))
      .replaceAll("{{PUBLISHED_PRETTY}}", escapeHtml(prettyDate(a.publishedAt) || ""))
      .replaceAll("{{DEK}}", escapeHtml(dek))
      .replaceAll("{{IMAGE_URL}}", escapeHtml(ogImage))
      .replaceAll("{{IMAGE_ALT}}", escapeHtml(imageAlt))
      .replaceAll("{{INTRO}}", escapeHtml(intro))
      .replaceAll("{{FULL_DESCRIPTION}}", fullDescHtml)
      .replaceAll("{{SUMMARY}}", escapeHtml(summary))
      .replaceAll("{{BULLETS}}", bullets)
      .replaceAll("{{WHY_IT_MATTERS}}", escapeHtml(why))
      .replaceAll("{{SOURCE_URL}}", escapeHtml(String(a.url || a.sourceUrl || "").trim()))
      .replaceAll("{{KEYWORDS}}", escapeHtml(keywords))
      .replaceAll("{{RELATED}}", relHtml)
      .replace("{{JSON_LD}}", JSON.stringify(jsonLd));

    writeFile(path.join(OUT_DIR, a.slug, "index.html"), out);
  });

  return normalized;
}

function main() {
  if (!fs.existsSync(NEWS_JSON)) throw new Error("Missing surf-news.json");
  const template = fs.readFileSync(ARTICLE_TEMPLATE, "utf8");
  const data = JSON.parse(fs.readFileSync(NEWS_JSON, "utf8"));
  const site = data.site || {};
  const articles = Array.isArray(data.articles) ? data.articles : [];

  if (process.argv.includes("--dry-run")) {
    console.log(`DRY RUN: would generate ${articles.length} surf article pages`);
    process.exit(0);
  }

  ensureDir(OUT_DIR);
  const normalized = buildArticlePages(articles, site, template);

  // Clean stale folders
  const keepSlugs = new Set(normalized.map(a => a.slug));
  const cleaned = deleteStaleFolders(OUT_DIR, keepSlugs);

  // Sitemap
  writeFile(SITEMAP_OUT, buildSitemap(site, normalized));

  // RSS feed
  writeFile(FEED_OUT, buildRssFeed(site, normalized));

  // robots.txt
  const robotsPath = path.join(ROOT, "robots.txt");
  if (!fs.existsSync(robotsPath)) {
    writeFile(robotsPath, `User-agent: *\nAllow: /\n\nSitemap: ${canonicalBase(site)}/sitemap.xml\n`);
  }

  // surf-news-latest.json (last 20 articles for fast load)
  const latestJson = { site: { ...site }, articles: normalized.slice(0, 20) };
  writeFile(path.join(ROOT, "surf-news-latest.json"), JSON.stringify(latestJson, null, 2) + "\n"); // ✅ nom cohérent avec main.js

  // Rewrite surf-news.json (structured)
  writeFile(NEWS_JSON, JSON.stringify({ site, articles: normalized }, null, 2) + "\n");

  console.log(`✓ ${normalized.length} article pages built`);
  console.log(`✓ Sitemap: ${normalized.length + 1} URLs`);
  console.log(`✓ RSS feed: ${normalized.length} items`);
  console.log(`✓ ${cleaned} stale folders removed`);
}

main();
