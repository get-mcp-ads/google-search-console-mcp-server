# Source synchronization

Reviewed on 2026-10-23 against getmcpads source revision `3e1c2c8`. The previous review used `41cc1ca`.

## Synchronized

- The handling of a refused refresh token (commit `210e1f6`, the only change to the gateway's Search Console source since `41cc1ca`). The gateway marks the connection expired and asks the person to reconnect. This server has no stored connection, so it remembers the refusal for the life of the process, answers every later call with one re-authorization message naming `GSC_REFRESH_TOKEN`, and sends no further token request. As in the gateway, only `invalid_grant` and `admin_policy_enforced` are treated as final. `invalid_client` and `unauthorized_client` stay ordinary errors.

## Reviewed and not synchronized

- Commit `210e1f6` also adds a second OAuth client per connection and its storage. Both are hosted connection management. This server uses the one client given in `GSC_CLIENT_ID`, or a static `GSC_ACCESS_TOKEN`.

## Differences from the gateway

- **Two more tools.** `gsc_get_site` and `gsc_get_sitemap` exist here and not in the gateway's inventory at `3e1c2c8`. Both are read-only `sites.get` and `sitemaps.get` calls and stay. The other 18 tools match the gateway.
- **Property allowlist.** The gateway receives the selected properties from its database. This server reads them from the optional `GSC_SITE_URLS`.
- **No authorization-code helpers.** The gateway's client file carries authorization-code helpers. They were never wired to a tool here and are removed.
- **Bounded reporting.** Automatic pagination stays capped at four pages, 100,000 rows and a 30-second total deadline, and provider error bodies stay out of logs and errors.

The public server remains self-contained. Hosted billing, workspaces, account-selection storage, creative galleries, alerts, Google Sheets exports, client memory, Launcher files and MCP Apps UI are outside this synchronization.

Validation uses synthetic data and a mocked `fetch`. The generated server-card.json is the source of truth for this revision's tool schemas.

Maintainer: Emmanuel, getmcpads. Contact: hello@getmcpads.com.
