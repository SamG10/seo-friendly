#!/usr/bin/env node

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const url = require("url");
const minimist = require("minimist");
const { create } = require("xmlbuilder2");

// Parse command-line arguments
const argv = minimist(process.argv.slice(2));
const baseUrl = argv.url || "http://localhost:8080";
const maxDepth = argv.maxDepth || 3;

// Set to track visited URLs
const visitedUrls = new Set();
// Array to store valid URLs for sitemap
const sitemapUrls = [];

/**
 * Normalize URL to prevent duplicates
 */
function normalizeUrl(urlString, base) {
  // Parse the URL
  const parsedUrl = new URL(urlString, base);
  // Remove trailing slash and normalize to lowercase
  return parsedUrl.href.replace(/\/$/, "").toLowerCase();
}

/**
 * Check if URL is valid for crawling
 */
function isValidUrl(urlString, baseUrlObj) {
  // Skip if null or empty
  if (!urlString) return false;

  try {
    // Parse URL
    const parsedUrl = new URL(urlString, baseUrlObj.href);

    // Check if it's from the same origin
    if (parsedUrl.origin !== baseUrlObj.origin) return false;

    // Skip anchors that point to the same page
    if (urlString.startsWith("#")) return false;

    // Skip file extensions to ignore
    const extensionsToIgnore = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".pdf",
      ".zip",
      ".css",
      ".js",
    ];
    if (
      extensionsToIgnore.some((ext) =>
        parsedUrl.pathname.toLowerCase().endsWith(ext)
      )
    )
      return false;

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Crawl a URL and its links recursively
 */
async function crawl(urlToCrawl, currentDepth = 0) {
  // Stop if we've reached max depth
  if (currentDepth > maxDepth) {
    return;
  }

  // Skip if already visited
  const normalizedUrl = normalizeUrl(urlToCrawl, baseUrl);
  if (visitedUrls.has(normalizedUrl)) {
    return;
  }

  console.log(`Crawling: ${normalizedUrl} (depth: ${currentDepth})`);

  // Mark as visited
  visitedUrls.add(normalizedUrl);
  sitemapUrls.push(normalizedUrl);

  try {
    // Fetch the page
    const response = await axios.get(normalizedUrl);
    const $ = cheerio.load(response.data);

    // Get base URL object
    const baseUrlObj = new URL(baseUrl);

    // Find all links
    const links = $("a[href]")
      .map((i, el) => $(el).attr("href"))
      .get()
      .filter((href) => isValidUrl(href, baseUrlObj))
      .map((href) => normalizeUrl(href, normalizedUrl));

    // Crawl each valid link recursively
    for (const link of links) {
      await crawl(link, currentDepth + 1);
    }
  } catch (error) {
    console.error(`Error crawling ${normalizedUrl}: ${error.message}`);
  }
}

/**
 * Generate sitemap.xml file
 */
function generateSitemap() {
  console.log("Generating sitemap.xml...");

  const xmlObj = {
    urlset: {
      "@xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9",
      url: sitemapUrls.map((url) => ({
        loc: url,
        changefreq: "weekly",
        priority: "0.8",
      })),
    },
  };

  const xml = create(xmlObj).end({ prettyPrint: true });

  fs.writeFileSync("sitemap.xml", xml);
  console.log(`Sitemap generated with ${sitemapUrls.length} URLs.`);
}

/**
 * Main function
 */
async function main() {
  console.log(`Starting crawler at ${baseUrl} with max depth ${maxDepth}`);
  await crawl(baseUrl);
  generateSitemap();
}

// Start the crawler
main().catch((error) => {
  console.error("Crawler failed:", error);
  process.exit(1);
});
