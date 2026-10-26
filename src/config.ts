/**
 * google-search-console-mcp-server: an open-source MCP server for Google Search Console.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from "zod";
import { logger } from "./core/logger.js";
import { SITE_URLS_ENV, parseSiteUrls, siteIsAllowed } from "./core/account-scope.js";

const configSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  refreshToken: z.string().optional(),
  accessToken: z.string().optional(),
  defaultSiteUrl: z.string().optional(),
  /** Search Console properties every tool is limited to. Undefined: every property the credentials reach. */
  allowedSiteUrls: z.array(z.string()).optional(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).prefault("info"),
});

export type GSCConfig = z.infer<typeof configSchema>;

export function loadConfig(): GSCConfig {
  const raw = {
    clientId: process.env["GSC_CLIENT_ID"] || undefined,
    clientSecret: process.env["GSC_CLIENT_SECRET"] || undefined,
    refreshToken: process.env["GSC_REFRESH_TOKEN"] || undefined,
    accessToken: process.env["GSC_ACCESS_TOKEN"] || undefined,
    defaultSiteUrl: process.env["GSC_SITE_URL"] || undefined,
    allowedSiteUrls: parseSiteUrls(process.env[SITE_URLS_ENV]),
    logLevel: process.env["LOG_LEVEL"] ?? "info",
  };

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.message).join(", ");
    logger.error("config", `Invalid GSC config: ${missing}`);
    throw new Error(`Invalid GSC config: ${missing}`);
  }

  const config = result.data;
  const canRefresh = Boolean(config.refreshToken && config.clientId && config.clientSecret);
  if (!config.accessToken && !canRefresh) {
    throw new Error(
      "Missing GSC credentials: set GSC_ACCESS_TOKEN, or set GSC_CLIENT_ID, GSC_CLIENT_SECRET, and GSC_REFRESH_TOKEN.",
    );
  }

  // Both variables are explicit together, so refusing a mismatch breaks no existing setup.
  if (config.defaultSiteUrl && !siteIsAllowed(config.allowedSiteUrls, config.defaultSiteUrl)) {
    throw new Error(`GSC_SITE_URL must be one of the properties listed in ${SITE_URLS_ENV}.`);
  }

  return config;
}

/**
 * Lines the CLI writes to stderr at startup, never to stdout, which carries the
 * MCP protocol. Nothing here changes what the server does.
 */
export function startupNotices(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env[SITE_URLS_ENV]?.trim()) return [];
  return [
    `${SITE_URLS_ENV} is not set, so every Search Console property these credentials reach is available. ` +
      "List the properties this server may use. The variable becomes required in 3.0.0.",
  ];
}
