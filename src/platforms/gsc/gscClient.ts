/**
 * google-search-console-mcp-server: an open-source MCP server for Google Search Console.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// GOOGLE SEARCH CONSOLE API CLIENT
// Client for GSC Search Analytics, URL Inspection, and Sitemaps
// ============================================

import {
  GSCTokenResponse,
  GSCRefreshTokenResponse,
  GSCSite,
  GSCSiteEntry,
  GSCSearchAnalyticsRequest,
  GSCSearchAnalyticsResponse,
  GSCInspectUrlRequest,
  GSCInspectUrlResponse,
  GSCSitemap,
  GSCSitemapListResponse,
  GSCApiException,
  GSC_API_BASE,
  GSC_WEBMASTERS_API_BASE,
  GOOGLE_OAUTH_AUTH_URL,
  GOOGLE_OAUTH_TOKEN_URL,
  GSC_OAUTH_SCOPE,
} from "./types.js";

export { GSCApiException } from "./types.js";

type GoogleOAuthError = {
  error?: string;
  error_description?: string;
};

type GoogleApiErrorBody = {
  error?: {
    message?: string;
    status?: string;
  };
};

function gscRouteClass(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.pathname.endsWith("/searchAnalytics/query")) return "search_analytics";
    if (parsed.pathname.endsWith("/urlInspection/index:inspect")) return "url_inspection";
    if (parsed.pathname.includes("/sitemaps")) return "sitemaps";
    if (parsed.pathname.includes("/sites")) return "sites";
  } catch {
    // The caller uses code-owned API URLs; keep even malformed-url diagnostics generic.
  }
  return "gsc_api";
}

function codeOwnedApiFailure(status: number): { message: string; status: string } {
  if (status === 401 || status === 403) {
    return { message: "GSC API authorization failed.", status: "AUTHORIZATION_FAILED" };
  }
  if (status === 429) {
    return { message: "GSC API rate limit was reached.", status: "RATE_LIMITED" };
  }
  if (status >= 500) {
    return { message: "GSC API is temporarily unavailable.", status: "UPSTREAM_UNAVAILABLE" };
  }
  return { message: "GSC API rejected the request.", status: "REQUEST_REJECTED" };
}

export const GSC_AUTO_PAGINATION_MAX_PAGES = 4;
export const GSC_AUTO_PAGINATION_MAX_ROWS = 100_000;
export const GSC_AUTO_PAGINATION_DEADLINE_MS = 30_000;
const GSC_SINGLE_REQUEST_TIMEOUT_MS = 90_000;

// ============================================
// STATIC METHODS (OAuth Flow)
// ============================================

/**
 * Generate Google OAuth2 authorization URL for GSC
 */
export function getAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GSC_OAUTH_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${GOOGLE_OAUTH_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<GSCTokenResponse> {
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as GoogleOAuthError;
    throw new GSCApiException(
      error.error_description || error.error || "Failed to exchange code for token",
      response.status,
      error.error
    );
  }

  return response.json() as Promise<GSCTokenResponse>;
}

/**
 * Refresh access token using refresh token
 * Note: Google refresh tokens never expire
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<GSCRefreshTokenResponse> {
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as GoogleOAuthError;
    throw new GSCApiException(
      error.error_description || error.error || "Failed to refresh token",
      response.status,
      error.error
    );
  }

  return response.json() as Promise<GSCRefreshTokenResponse>;
}

// ============================================
// GSC CLIENT CLASS
// ============================================

export class GSCClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // Static methods
  static getAuthorizationUrl = getAuthorizationUrl;
  static exchangeCodeForToken = exchangeCodeForToken;
  static refreshAccessToken = refreshAccessToken;

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async request<T>(
    url: string,
    options: RequestInit = {},
    timeoutMs: number = GSC_SINGLE_REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
      throw new GSCApiException("GSC request deadline expired before dispatch", 408, "TIMEOUT");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        redirect: "error",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const failure = codeOwnedApiFailure(response.status);
        console.error("[GSCClient] API error", {
          status: response.status,
          route: gscRouteClass(url),
        });

        throw new GSCApiException(
          failure.message,
          response.status,
          failure.status,
        );
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new GSCApiException(
          "GSC API request exceeded its bounded deadline",
          408,
          "TIMEOUT"
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ============================================
  // SITE MANAGEMENT
  // ============================================

  /**
   * List all verified sites accessible to the authenticated user
   * GET https://www.googleapis.com/webmasters/v3/sites
   */
  async listSites(): Promise<GSCSite[]> {
    const response = await this.request<{ siteEntry?: GSCSiteEntry[] }>(
      `${GSC_WEBMASTERS_API_BASE}/sites`
    );

    return (response.siteEntry || []).map((entry) => ({
      siteUrl: entry.siteUrl,
      permissionLevel: entry.permissionLevel as GSCSite["permissionLevel"],
    }));
  }

  /** Get a single Search Console property and its permission level. */
  async getSite(siteUrl: string): Promise<GSCSite> {
    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const entry = await this.request<GSCSiteEntry>(
      `${GSC_WEBMASTERS_API_BASE}/sites/${encodedSiteUrl}`
    );
    return {
      siteUrl: entry.siteUrl,
      permissionLevel: entry.permissionLevel as GSCSite["permissionLevel"],
    };
  }

  // ============================================
  // SEARCH ANALYTICS
  // ============================================

  /**
   * Query search analytics data with automatic pagination
   * POST https://searchconsole.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query
   * Max 25,000 rows per request
   */
  async querySearchAnalytics(
    siteUrl: string,
    request: GSCSearchAnalyticsRequest
  ): Promise<GSCSearchAnalyticsResponse> {
    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const url = `${GSC_API_BASE}/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

    const MAX_ROWS_PER_REQUEST = 25000;
    const rowLimit = request.rowLimit ?? MAX_ROWS_PER_REQUEST;
    const autoPaginate = request.rowLimit === undefined;
    const paginationDeadline = Date.now() + GSC_AUTO_PAGINATION_DEADLINE_MS;
    const remainingPaginationMs = (): number => {
      const remaining = paginationDeadline - Date.now();
      if (remaining < 1) {
        throw new GSCApiException(
          "GSC auto-pagination exceeded its 30-second total deadline",
          408,
          "PAGINATION_DEADLINE",
        );
      }
      return remaining;
    };

    // First request
    const firstResponse = await this.request<GSCSearchAnalyticsResponse>(url, {
      method: "POST",
      body: JSON.stringify({
        ...request,
        rowLimit: Math.min(rowLimit, MAX_ROWS_PER_REQUEST),
        startRow: request.startRow ?? 0,
      }),
    }, autoPaginate ? remainingPaginationMs() : GSC_SINGLE_REQUEST_TIMEOUT_MS);
    if (autoPaginate) remainingPaginationMs();

    const returnedRows = firstResponse.rows?.length ?? 0;

    // If user specified a limit or all rows returned, no auto-pagination
    if (request.rowLimit || returnedRows < MAX_ROWS_PER_REQUEST) {
      return {
        ...firstResponse,
        pagination: {
          mode: autoPaginate ? "bounded_auto" : "single_page",
          pageCount: 1,
          rowCount: returnedRows,
          maximumPages: autoPaginate ? GSC_AUTO_PAGINATION_MAX_PAGES : 1,
          maximumRows: autoPaginate ? GSC_AUTO_PAGINATION_MAX_ROWS : rowLimit,
          deadlineMs: autoPaginate ? GSC_AUTO_PAGINATION_DEADLINE_MS : GSC_SINGLE_REQUEST_TIMEOUT_MS,
          truncated: false,
        },
      };
    }

    // Auto-paginate to collect all rows
    const allRows = [...(firstResponse.rows ?? [])];
    let currentOffset = (request.startRow ?? 0) + returnedRows;
    let pageCount = 1;
    let lastPageWasFull = returnedRows === MAX_ROWS_PER_REQUEST;

    while (
      pageCount < GSC_AUTO_PAGINATION_MAX_PAGES
      && allRows.length < GSC_AUTO_PAGINATION_MAX_ROWS
    ) {
      const remainingRows = GSC_AUTO_PAGINATION_MAX_ROWS - allRows.length;
      const requestedRows = Math.min(MAX_ROWS_PER_REQUEST, remainingRows);
      const pageResponse = await this.request<GSCSearchAnalyticsResponse>(url, {
        method: "POST",
        body: JSON.stringify({
          ...request,
          rowLimit: requestedRows,
          startRow: currentOffset,
        }),
      }, remainingPaginationMs());
      remainingPaginationMs();

      const pageRows = pageResponse.rows?.length ?? 0;
      pageCount += 1;
      lastPageWasFull = pageRows === requestedRows;
      if (pageRows === 0) break;

      allRows.push(...(pageResponse.rows ?? []).slice(0, remainingRows));
      currentOffset += pageRows;

      if (pageRows < requestedRows) break; // Last page
    }

    remainingPaginationMs();
    return {
      ...firstResponse,
      rows: allRows.slice(0, GSC_AUTO_PAGINATION_MAX_ROWS),
      pagination: {
        mode: "bounded_auto",
        pageCount,
        rowCount: Math.min(allRows.length, GSC_AUTO_PAGINATION_MAX_ROWS),
        maximumPages: GSC_AUTO_PAGINATION_MAX_PAGES,
        maximumRows: GSC_AUTO_PAGINATION_MAX_ROWS,
        deadlineMs: GSC_AUTO_PAGINATION_DEADLINE_MS,
        truncated: lastPageWasFull && (
          pageCount >= GSC_AUTO_PAGINATION_MAX_PAGES
          || allRows.length >= GSC_AUTO_PAGINATION_MAX_ROWS
        ),
      },
    };
  }

  // ============================================
  // URL INSPECTION
  // ============================================

  /**
   * Inspect a URL for indexing status
   * POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect
   * Quota: 2000 requests/day/property
   */
  async inspectUrl(
    inspectionUrl: string,
    siteUrl: string,
    languageCode?: string
  ): Promise<GSCInspectUrlResponse> {
    const url = `${GSC_API_BASE}/v1/urlInspection/index:inspect`;

    const body: GSCInspectUrlRequest = {
      inspectionUrl,
      siteUrl,
      ...(languageCode && { languageCode }),
    };

    return this.request<GSCInspectUrlResponse>(url, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  // ============================================
  // SITEMAPS
  // ============================================

  /**
   * List sitemaps for a site
   * GET https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/sitemaps
   */
  async listSitemaps(siteUrl: string, sitemapIndex?: string): Promise<GSCSitemapListResponse> {
    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const params = sitemapIndex ? `?sitemapIndex=${encodeURIComponent(sitemapIndex)}` : "";
    const url = `${GSC_WEBMASTERS_API_BASE}/sites/${encodedSiteUrl}/sitemaps${params}`;

    return this.request<GSCSitemapListResponse>(url);
  }

  /** Get one submitted sitemap by its full feed path. */
  async getSitemap(siteUrl: string, feedpath: string): Promise<GSCSitemap> {
    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const encodedFeedpath = encodeURIComponent(feedpath);
    return this.request<GSCSitemap>(
      `${GSC_WEBMASTERS_API_BASE}/sites/${encodedSiteUrl}/sitemaps/${encodedFeedpath}`
    );
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createGSCClient(accessToken: string): GSCClient {
  return new GSCClient(accessToken);
}
