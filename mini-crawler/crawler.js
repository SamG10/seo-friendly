#!/usr/bin/env node
const axios = require("axios"),
  cheerio = require("cheerio"),
  fs = require("fs"),
  path = require("path"),
  url = require("url"),
  minimist = require("minimist"),
  { create: e } = require("xmlbuilder2"),
  argv = minimist(process.argv.slice(2)),
  baseUrl = argv.url || "http://localhost:8080",
  maxDepth = argv.maxDepth || 3,
  visitedUrls = new Set(),
  sitemapUrls = [];
function normalizeUrl(e, r) {
  let t = new URL(e, r);
  return t.href.replace(/\/$/, "").toLowerCase();
}
function isValidUrl(e, r) {
  if (!e) return !1;
  try {
    let t = new URL(e, r.href);
    if (
      t.origin !== r.origin ||
      e.startsWith("#") ||
      [".jpg", ".jpeg", ".png", ".gif", ".pdf", ".zip", ".css", ".js"].some(
        (e) => t.pathname.toLowerCase().endsWith(e)
      )
    )
      return !1;
    return !0;
  } catch (a) {
    return !1;
  }
}
async function crawl(e, r = 0) {
  if (r > maxDepth) return;
  let t = normalizeUrl(e, baseUrl);
  if (!visitedUrls.has(t)) {
    console.log(`Crawling: ${t} (depth: ${r})`),
      visitedUrls.add(t),
      sitemapUrls.push(t);
    try {
      let a = await axios.get(t),
        i = cheerio.load(a.data),
        l = new URL(baseUrl),
        s = i("a[href]")
          .map((e, r) => i(r).attr("href"))
          .get()
          .filter((e) => isValidUrl(e, l))
          .map((e) => normalizeUrl(e, t));
      for (let n of s) await crawl(n, r + 1);
    } catch (m) {
      console.error(`Error crawling ${t}: ${m.message}`);
    }
  }
}
function generateSitemap() {
  console.log("Generating sitemap.xml...");
  let r = {
      urlset: {
        "@xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9",
        url: sitemapUrls.map((e) => ({
          loc: e,
          changefreq: "weekly",
          priority: "0.8",
        })),
      },
    },
    t = e(r).end({ prettyPrint: !0 });
  fs.writeFileSync("sitemap.xml", t),
    console.log(`Sitemap generated with ${sitemapUrls.length} URLs.`);
}
async function main() {
  console.log(`Starting crawler at ${baseUrl} with max depth ${maxDepth}`),
    await crawl(baseUrl),
    generateSitemap();
}
main().catch((e) => {
  console.error("Crawler failed:", e), process.exit(1);
});
