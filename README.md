<div align="center">

# Google Search Console MCP server

### Bring your search performance into the conversation.

Investigate queries, pages, indexing and sitemaps through a read-only MCP server.

[![Release](https://img.shields.io/github/v/release/get-mcp-ads/google-search-console-mcp-server?color=2448e5)](https://github.com/get-mcp-ads/google-search-console-mcp-server/releases/latest)
[![CI](https://github.com/get-mcp-ads/google-search-console-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/get-mcp-ads/google-search-console-mcp-server/actions/workflows/ci.yml)
[![Smithery](https://smithery.ai/badge/getmcpads/getmcpads-google-search-console)](https://smithery.ai/servers/getmcpads/getmcpads-google-search-console)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-22.23.4%20%7C%2024.22.1%20%7C%20%E2%89%A526.12.1-brightgreen.svg)](package.json)

[Watch the film](https://www.getmcpads.com/home/film/get-mcp-ads-brand-film-1080p.mp4) · [What's new](#whats-new) · [Install](#install-this-release) · [Tool reference](#tools) · [Try hosted getmcpads](https://www.getmcpads.com/tools/search-console?utm_source=github&utm_medium=readme&utm_campaign=google-search-console)

[![Watch the getmcpads film: every ad account in one conversation with your AI assistant](https://www.getmcpads.com/home/film/brand-film-poster-promise.webp)](https://www.getmcpads.com/home/film/get-mcp-ads-brand-film-1080p.mp4)

**[Play the 45-second film](https://www.getmcpads.com/home/film/get-mcp-ads-brand-film-1080p.mp4)**

</div>

The film shows hosted getmcpads with sample data. Its MCP Apps, from creative galleries and alerts to Google Sheets exports and bulk launches, belong to the hosted product. This repository provides the standalone native API tools.

**20 read tools** · Read-only by design.

Run locally with your own platform credentials and a client that supports stdio MCP, such as Claude Desktop, Claude Code or Cursor. Your requests go directly to the platform. For managed connections, including supported ChatGPT setups, use the hosted option.

## What's new

**[v2.1.0: Property allowlist and revoked-token handling](https://github.com/get-mcp-ads/google-search-console-mcp-server/releases/tag/v2.1.0) · October 23, 2026**

- Limit every tool to the properties listed in the optional `GSC_SITE_URLS`, URL Inspection included. `gsc_list_sites` lists only those properties.
- Report a revoked refresh token (`invalid_grant`) once, with the steps to authorize again, and stop asking Google for a new token.
- Remove the unused OAuth browser-flow helpers, so `accounts.google.com` is no longer in the source. Bound every response body and give the token request a deadline.
- Require a Node.js release that carries the October 2026 security fixes, and test Node 22, 24 and 26 in CI.

[Full changelog](CHANGELOG.md) · [Source synchronization details](SOURCE_SYNC.md) · [All releases](https://github.com/get-mcp-ads/google-search-console-mcp-server/releases)

### Upgrade notes

Requires **Node.js 22.23.4, 24.22.1 or 26.12.1**, or a newer release of one of these lines. Older releases lack the October 2026 security fixes, and the server prints a warning on stderr when it starts on one. CI covers Node 22, 24 and 26.

This release makes no breaking change to the configuration. One change is announced for 3.0.0: `GSC_SITE_URLS` is optional in 2.x and becomes required. When set, every tool is limited to the listed properties, and `GSC_SITE_URL` must be one of them. When unset, the server starts as before and prints one line on stderr recommending it. The 20 tools, their schemas and the bounded reporting limits are unchanged.

## Install this release

This is a GitHub source release. npm and MCP Registry versions are published separately. The commands below select this exact version; unpinned `npx` examples later in this document select the version currently available on npm.

```bash
git clone --branch v2.1.0 --depth 1 https://github.com/get-mcp-ads/google-search-console-mcp-server.git
cd google-search-console-mcp-server
npm ci
npm run build
```

Configure your MCP client to run `node` with the absolute path to `dist/cli.js` and the platform credentials documented below.

> **Prefer a managed connection?** [Use Google Search Console with hosted getmcpads](https://www.getmcpads.com/tools/search-console?utm_source=github&utm_medium=readme&utm_campaign=google-search-console). Connect your account, select the data your assistant may access and use the hosted MCP connection. See the site for current features and plans.

## What you get

| | |
|---|---|
| **20 read tools** | Search Analytics, sites, sitemaps, URL Inspection, and analyses built on top of them |
| **SEO analyses, not just an API wrapper** | Cannibalisation detection, query clustering, wins and losses between periods, indexation watchlists, large-site sampling plans |
| **7 resources** | Live catalogues the model can read: metrics, dimensions, filters, compatibility rules, 8 workflow recipes, read-only playbooks |
| **Quota guardrails** | Every URL Inspection call is capped at 10 URLs, so one exploratory question cannot burn a day of quota |
| **No writes at all** | Not a flag, a property of the code. See below |

### What it does beyond fetching rows

Search Console answers questions about rows. Most real questions are about **change**: which
queries did we lose, which pages compete for the same term, is indexing drifting.

These tools do that work rather than leaving it to the model:

| Tool | Question it answers |
|---|---|
| `gsc_detect_cannibalization` | Which pages compete for the same query |
| `gsc_find_losses_gains` | What we won and lost between two periods |
| `gsc_cluster_queries` | Which queries belong to the same intent |
| `gsc_compare_search_types` | How web, image, video and news differ |
| `gsc_analyze_search_appearance_trends` | How rich results evolve |
| `gsc_indexation_watchlist` | Which URLs changed indexing verdict |
| `gsc_plan_large_site_sampling` | Which URLs to inspect, when you cannot inspect them all |

---

## One thing to know before you trust a number

**Search Console returns a top N, not a site total.**

When you query with a dimension such as `query` or `page`, the API returns the highest
ranked rows up to your row limit, ordered by clicks. Summing the clicks of those rows does
**not** give you the site total: the long tail is missing, and on a large site it can be most
of the traffic.

To get a real total, query **without dimensions**. To compare periods, compare like with
like: same dimensions, same row limit, same search type.

`gsc_query_search_analytics` reports what it actually returned, and `gsc_validate_query`
checks a combination before it runs. But the arithmetic mistake is yours to avoid, and it is
the most common one in Search Console analysis.

Two other limits worth carrying in your head:

- **Roughly 16 months of history.** Anything older is gone, not slow.
- **Data settles over about three days.** `gsc_get_data_freshness` tells you what is final.

---

## Read-only, and why it stays that way

There are no write tools, and no environment variable that adds any. The Search Console API
can submit and delete sitemaps, add and remove properties, and request indexing. **This
server exposes none of that.**

The scope it asks for reflects that: `webmasters.readonly`, not `webmasters`. Even if the
model tried, the token cannot write.

Our ad platform servers, where writes make sense, do have them, guarded by a mandatory
preview:
[Meta Ads](https://github.com/get-mcp-ads/meta-ads-mcp-server) ·
[Google Ads](https://github.com/get-mcp-ads/google-ads-mcp-server) ·
[TikTok Ads](https://github.com/get-mcp-ads/tiktok-ads-mcp-server)

The hosted version at [getmcpads.com](https://www.getmcpads.com) keeps the same rule: Search
Console stays read-only there too.

---

## Getting credentials

Three values, obtained once.

### 1. OAuth client

In a [Google Cloud project](https://console.cloud.google.com/), enable the **Google Search
Console API**, then create an OAuth client under **APIs & Services → Credentials**. Choose
**Desktop app** for local use. Note the **client ID** and **client secret**.

### 2. Refresh token

Run the OAuth consent flow once, signed in as a Google account that owns or can read your
properties, and keep the **refresh token**. Request `webmasters.readonly` and nothing more.

📖 [Google OAuth for installed apps](https://developers.google.com/identity/protocols/oauth2/native-app)

**The refresh token does not expire.** Use an OAuth client dedicated to this server so you
can revoke it on its own.

For a quick trial you can set `GSC_ACCESS_TOKEN` to a short-lived token instead, but it
expires within the hour and is useless for daily work.

If setting up an OAuth client is more than you want to do for one property,
[getmcpads.com](https://www.getmcpads.com) handles the consent flow for you and gives you the
same tools behind a hosted endpoint.

### 3. Site URL, optional

Set `GSC_SITE_URL` to avoid passing it on every call. Both property forms work:

| Property type | Value |
|---|---|
| URL-prefix | `https://example.com/` (the trailing slash matters) |
| Domain | `sc-domain:example.com` |

List what you can reach with `gsc_list_sites`, and run **`gsc_health_check`** as your first
call. It verifies the credentials without printing any secret.

---

## Setup

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "search-console": {
      "command": "npx",
      "args": ["-y", "@getmcpads/google-search-console-mcp-server"],
      "env": {
        "GSC_CLIENT_ID": "your-client-id",
        "GSC_CLIENT_SECRET": "your-client-secret",
        "GSC_REFRESH_TOKEN": "your-refresh-token",
        "GSC_SITE_URLS": "sc-domain:example.com"
      }
    }
  }
}
```

Restart Claude Desktop. Ask it: *"which queries did we lose last month?"*.

### Claude Code

```bash
claude mcp add search-console --env GSC_CLIENT_ID=... --env GSC_CLIENT_SECRET=... --env GSC_REFRESH_TOKEN=... -- npx -y @getmcpads/google-search-console-mcp-server
```

### Cursor

`.cursor/mcp.json` in your project, same shape as the Claude Desktop config above.

### From source

```bash
git clone https://github.com/get-mcp-ads/google-search-console-mcp-server.git
cd google-search-console-mcp-server
npm install && npm run build
cp .env.example .env   # then fill in your credentials
npm start
```

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `GSC_CLIENT_ID` | none | OAuth client ID |
| `GSC_CLIENT_SECRET` | none | OAuth client secret |
| `GSC_REFRESH_TOKEN` | none | From the consent flow |
| `GSC_ACCESS_TOKEN` | none | Alternative to the three above, expires within the hour |
| `GSC_SITE_URL` | none | Optional default property |
| `GSC_SITE_URLS` | *unset* | Recommended. Comma-separated properties every tool is limited to, written exactly as Search Console shows them. Unset, every property the credentials reach is available. Required in 3.0.0 |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

Either the three OAuth values, or `GSC_ACCESS_TOKEN`. The server refuses to start with neither.

```bash
npm run doctor
```

---

## Tools

Every tool is listed below. See [server-card.json](server-card.json) for complete parameter and output schemas.

<details>
<summary><b>20 read tools</b></summary>

| Tool | Purpose |
| --- | --- |
| `gsc_list_sites` | List all Google Search Console properties accessible with the current credentials. |
| `gsc_get_site` | Get one Search Console property and its exact permission level (read-only sites.get). |
| `gsc_health_check` | Verify Google Search Console read-only authentication, visible properties, configured default site, and permission levels without exposing tokens. |
| `gsc_query_search_analytics` | Query Google Search Console Search Analytics. |
| `gsc_inspect_url` | Inspect a URL for Google indexing status, crawl info, mobile usability, AMP, and rich results. |
| `gsc_bulk_inspect_urls` | Inspect multiple URLs with a conservative sequential limit and normalized URL Inspection results. |
| `gsc_list_sitemaps` | List sitemaps submitted for a Search Console property, including processing status and submitted/indexed counts. |
| `gsc_get_sitemap` | Get one submitted sitemap by full feed path, including type, fetch state, warnings/errors, and submitted/indexed content totals. |
| `gsc_get_sitemap_health` | Return an enriched read-only sitemap health summary with status totals, submitted/indexed content counts, warnings, and errors. |
| `gsc_compare_search_types` | Compare performance across Search Console search types: web, image, video, news, discover, and Google News. |
| `gsc_get_data_freshness` | Detect the most recent date with Search Analytics data by querying recent daily rows. |
| `gsc_monitor_indexation_freshness` | Read-only monitoring snapshot for Search Analytics freshness, sitemap indexation totals, and an optional small URL Inspection sample. |
| `gsc_track_sitemap_deltas` | Read-only sitemap delta tracker. |
| `gsc_analyze_search_appearance_trends` | Analyze structured data and rich-result trend signals via the Search Analytics searchAppearance dimension when GSC exposes it. |
| `gsc_plan_large_site_sampling` | Build a read-only URL Inspection sampling plan for large sites from sitemap risk signals and Search Analytics page performance. |
| `gsc_indexation_watchlist` | Read-only URL Inspection watchlist for critical URLs. |
| `gsc_find_losses_gains` | Compare two periods for query or page performance and return click/impression/CTR/position deltas. |
| `gsc_cluster_queries` | Cluster Search Console queries by simple tokens and intent signals: brand/non-brand, question, category, and topic tokens. |
| `gsc_detect_cannibalization` | Detect queries where multiple pages compete for clicks/impressions in Search Analytics query-page rows. |
| `gsc_validate_query` | Validate a Search Console metric/dimension/search type combination before executing it. |

</details>

<details>
<summary><b>7 resources</b></summary>

| URI | Contents |
|---|---|
| `gsc://manifest` | What this server exposes, and which tool to run first |
| `gsc://metrics` | The 8 Search Analytics metrics, raw and derived |
| `gsc://dimensions` | The 7 dimensions and where they are valid |
| `gsc://filters` | The 5 filter operators and their accepted values |
| `gsc://compatibility` | Which dimensions work with which search types and data states |
| `gsc://recipes` | 8 step-by-step workflows |
| `gsc://p2-readonly-playbooks` | Monitoring playbooks and their invariants |

</details>

---

## Security

- **The client secret and refresh token are never logged**, at any log level, or written to disk.
- **A revoked refresh token is reported once.** When Google answers `invalid_grant`, every
  later call returns the same message with the steps to authorize again, and the server stops
  asking Google for a token until it restarts.
- **Properties can be limited.** With `GSC_SITE_URLS` set, a call naming another property is
  refused before any request, and `gsc_list_sites` lists only the allowed properties.
- **Three hosts are contacted, and only three**: `searchconsole.googleapis.com` and
  `www.googleapis.com` for the API, `oauth2.googleapis.com` for the token refresh. *A test
  fails the build if a fourth host appears in the source.*
- **No fetch follows a redirect.** Every outbound call sets `redirect: "error"`, so a redirect
  cannot forward a bearer token or client secret to another host. *A test fails the build if
  any fetch omits this.*
- **The scope is `webmasters.readonly`.** The token itself cannot write.
- **No telemetry.** The server makes no network call other than to Google.

Full policy: [SECURITY.md](SECURITY.md).

---

## Looking for a managed, multi-platform version?

[Try hosted Search Console](https://www.getmcpads.com/tools/search-console?utm_source=github&utm_medium=readme&utm_campaign=search_console_hosted) if you want to use this source without operating a local server.
getmcpads also connects advertising, Search Console and GA4 through one MCP URL.
Source availability and plan limits are listed on the site; connecting an account is still required.

1. Follow the [Search Console connection guide](https://www.getmcpads.com/guides/sources/search-console).
2. Select the account or property your assistant may read.
3. Connect [Claude](https://www.getmcpads.com/guides/setup/claude),
   [ChatGPT](https://www.getmcpads.com/guides/setup/chatgpt) or
   [Codex](https://www.getmcpads.com/guides/setup/codex).
4. Try a read-only review: “Find which pages and queries account for a change in organic clicks. State missing data and do not change anything.”

See the [current hosted tool catalogue](https://www.getmcpads.com/tools/search-console)
and [pricing](https://www.getmcpads.com/pricing) before choosing a paid plan.
This Apache 2.0 adapter remains independently useful with your own credentials.

---

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).
Please read [SECURITY.md](SECURITY.md) before reporting anything security-related.

## Licence

[Apache License 2.0](LICENSE). See also [NOTICE](NOTICE).

Google and Google Search Console are trademarks of Google LLC.
**This project is not affiliated with, endorsed by, or sponsored by Google LLC.**
It is an independent client of a public API.

## MCP contracts and desktop bundle

Every tool declares read/write annotations, parameter descriptions and a structured output schema. Successful calls expose the payload as `structuredContent.result`; errors retain `isError: true`. The generated [server card](server-card.json) contains definitions only.

Run `npm run bundle -- /path/to/output` to build a `.mcpb` desktop bundle from the current catalog. Credentials are entered locally during installation. This server remains read-only.

## More from getmcpads

[Meta Ads](https://github.com/get-mcp-ads/meta-ads-mcp-server) · [Google Ads](https://github.com/get-mcp-ads/google-ads-mcp-server) · [Google Analytics 4](https://github.com/get-mcp-ads/google-analytics-mcp-server) · [TikTok Ads](https://github.com/get-mcp-ads/tiktok-ads-mcp-server) · [Pinterest Ads](https://github.com/get-mcp-ads/pinterest-ads-mcp-server) · [X Ads](https://github.com/get-mcp-ads/x-ads-mcp-server)

Maintained by **Emmanuel** at [getmcpads](https://www.getmcpads.com). Questions: [hello@getmcpads.com](mailto:hello@getmcpads.com).
