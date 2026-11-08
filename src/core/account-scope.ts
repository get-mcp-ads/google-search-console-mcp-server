/**
 * google-search-console-mcp-server: an open-source MCP server for Google Search Console.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */

export const SITE_URLS_ENV = "GSC_SITE_URLS";

/**
 * Search Console identifies a property by its exact string: a URL-prefix
 * property such as `https://example.com/`, or a domain property such as
 * `sc-domain:example.com`. Entries are compared exactly, as Google does.
 */
function isSiteUrl(value: string): boolean {
  if (/^sc-domain:[a-z0-9.-]+$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Parse GSC_SITE_URLS. Unset or blank means no allowlist. A value that is set
 * but malformed is an error: silently ignoring it would widen access.
 */
export function parseSiteUrls(raw: string | undefined): string[] | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const sites = [...new Set(raw.split(",").map(value => value.trim()).filter(Boolean))];
  if (sites.length === 0 || sites.length > 200 || sites.some(site => !isSiteUrl(site))) {
    throw new Error(
      `${SITE_URLS_ENV} must list 1 to 200 Search Console properties, separated by commas, ` +
        "each written exactly as Search Console shows it, such as https://example.com/ or sc-domain:example.com.",
    );
  }
  return sites;
}

/** Undefined allowlist: every property the credentials reach. */
export function siteIsAllowed(allowed: readonly string[] | undefined, siteUrl: string): boolean {
  return allowed === undefined || allowed.includes(siteUrl);
}

export class SiteNotAllowedError extends Error {
  readonly code = 403;
  readonly status = "SITE_NOT_ALLOWED";
  readonly suggestion = `Add the property to ${SITE_URLS_ENV} exactly as Search Console writes it and restart the server.`;
  constructor(siteUrl: string) {
    super(`Search Console property ${siteUrl} is not in ${SITE_URLS_ENV}. Nothing was sent to Google.`);
    this.name = "SiteNotAllowedError";
  }
}

export function assertSiteAllowed(allowed: readonly string[] | undefined, siteUrl: string): void {
  if (!siteIsAllowed(allowed, siteUrl)) throw new SiteNotAllowedError(siteUrl);
}

/**
 * Check the property a Search Console URL addresses, before credentials are
 * attached. `sites/{siteUrl}` carries it URL-encoded. The site list names none.
 */
export function assertUrlSiteAllowed(allowed: readonly string[] | undefined, url: string): void {
  if (allowed === undefined) return;
  const encoded = new URL(url).pathname.match(/\/sites\/([^/]+)/)?.[1];
  if (encoded !== undefined) assertSiteAllowed(allowed, decodeURIComponent(encoded));
}
