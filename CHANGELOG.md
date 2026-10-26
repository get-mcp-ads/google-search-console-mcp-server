# Changelog

## 2.1.1 - 2026-10-26 - Zod 4 security update
- Update `zod` to 4.6.7. Every Zod release before 4.6.6 is covered by the high-severity advisory GHSA-mrhx-c7xc-m3w5: validating an oversized constrained collection can exhaust memory, and no Zod 3 release carries the fix. `npm audit --omit=dev` reports no vulnerability again.
- Keep the Zod 3 validation behaviour. A parameter default is still validated and completed before use, so an omitted object must still supply its required fields.
- Keep each parameter's own description when the parameter is optional or has a default. Zod 4 stores a description on the wrapped schema only, so the shared fallback description could otherwise replace it.
- Tool names, parameters and descriptions published over MCP are unchanged. `server-card.json` is regenerated with Zod 4's JSON Schema output, which spells some constraints differently.

## 2.1.0 - 2026-10-23 - Site allowlist and revoked-token handling
- Add the optional `GSC_SITE_URLS` allowlist, checked before every request, including URL Inspection where the property travels in the body. `gsc_list_sites` and `gsc_health_check` list only the allowed properties. Unset, the server prints a recommendation on stderr. It becomes required in 3.0.0.
- Refuse a `GSC_SITE_URL` outside `GSC_SITE_URLS` at startup, when both are set.
- Port the gateway's handling of a refused refresh token (`invalid_grant`, `admin_policy_enforced`): one re-authorization message naming `GSC_REFRESH_TOKEN`, and no further token requests until restart. A static `GSC_ACCESS_TOKEN` keeps working as before.
- Remove the unused authorization-code helpers. The server never ran an OAuth browser flow, and `accounts.google.com` is no longer in the source.
- Give the token request a deadline and bound every response body. Pagination limits are unchanged.
- Require Node.js `^22.23.4 || ^24.22.1 || >=26.12.1`, warn on stderr at startup and in `npm run doctor` on older releases, and test Node 22, 24 and 26 in CI.
- Update `@modelcontextprotocol/sdk` to 1.32.1 and regenerate the lockfile.
- Publish from version tags with `release.yml`, which replaces `publish-mcp.yml`. Add Dependabot.
- No tool is added or removed: 20 read tools, no write tools.

## 2.0.1 - 2026-09-23 - Public repository restored

- Restore public source hosting under the get-mcp-ads GitHub organization.
- Update repository and support links while preserving npm package and MCP registry names.
- No changes to platform tools or credential requirements.

## 2.0.0 - 2026-09-20 - Gateway sync and security fixes
- Bound automatic pagination to four pages, 100,000 rows and a 30-second total deadline.
- Expose pagination and truncation diagnostics while preserving hourly data and native metadata.
- Remove provider error bodies from logs and errors; bound search-type comparison fan-out.
- Require Node.js 22.12 or newer and check Node 22/24 in CI.
- Update vulnerable dependencies and regenerate the MCP catalog.
- No hosted creative UI or MCP Apps integrations.


## 1.1.0 - 2026-09-13 - Platform capability sync and quality contracts
- Synchronize applicable platform features with GetMCPAds commit b1471be while retaining local read-only exploration tools and credential configuration.
- Expose 20 read tools.
- Add MCP annotations, parameter descriptions, structured results, server identity and an offline-generated discovery card.
- Preserve preview/confirmation boundaries; test provider request construction and errors with mocked APIs.
- Refuse credential-bearing redirects and document provider-specific limitations.

No live advertiser mutation is performed by the release tests.

## 1.0.2 - 2026-08-30

- Announce the package version over MCP. Version 1.0.1 still reported 1.0.0 in the handshake.

## 1.0.1 - 2026-08-30

- Add `server.json` and `mcpName` for the official MCP Registry, under `com.getmcpads/google-search-console`.
- Skip registry publication when a version is already listed.

## 1.0.0 - 2026-08-29 - First open-source release

- Publish the server as open source under the Apache-2.0 license.
