import { installToolQuality } from "./tool-quality.js";
/**
 * google-search-console-mcp-server: an open-source MCP server for Google Search Console.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GSCConfig } from "./config.js";
import { registerGSC } from "./platforms/gsc/index.js";
import { logger } from "./core/logger.js";
import { assertSiteAllowed } from "./core/account-scope.js";
import { formatMcpToolError } from "./core/errors.js";

export const PACKAGE_VERSION = "2.1.1";

/**
 * Refuse a `siteUrl` outside GSC_SITE_URLS before the tool runs. A tool called
 * without one uses GSC_SITE_URL, which startup already checked. The client
 * checks each request again.
 */
function installSiteScope(server: McpServer, allowed: readonly string[] | undefined): void {
  if (allowed === undefined) return;
  const register = server.tool.bind(server) as (...args: unknown[]) => unknown;
  server.tool = ((name: string, description: string, schema: unknown, handler: (...args: unknown[]) => unknown) =>
    register(name, description, schema, async (...args: unknown[]) => {
      const siteUrl = (args[0] as Record<string, unknown> | undefined)?.["siteUrl"];
      if (typeof siteUrl === "string" && siteUrl) {
        try {
          assertSiteAllowed(allowed, siteUrl);
        } catch (error) {
          return formatMcpToolError(error);
        }
      }
      return handler(...args);
    })) as unknown as typeof server.tool;
}

export function createServer(config: GSCConfig): McpServer {
  const server = new McpServer(
    { name: "google-search-console-mcp", version: PACKAGE_VERSION, title: "Google Search Console", websiteUrl: "https://www.getmcpads.com/tools/search-console", icons: [{ src: "https://mcp.getmcpads.com/icon.svg", mimeType: "image/svg+xml" }] },
    { capabilities: { tools: { listChanged: true }, resources: { subscribe: false, listChanged: true } } },
  );

  installToolQuality(server);
  installSiteScope(server, config.allowedSiteUrls);
  registerGSC(server, config);

  logger.system(
    `google-search-console-mcp v${PACKAGE_VERSION} ready, read-only` +
      (config.allowedSiteUrls ? `, limited to ${config.allowedSiteUrls.length} propert${config.allowedSiteUrls.length === 1 ? "y" : "ies"}` : ""),
  );
  return server;
}
