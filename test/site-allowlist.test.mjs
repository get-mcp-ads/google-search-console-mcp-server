/**
 * GSC_SITE_URLS limits every tool to the listed Search Console properties.
 *
 * The check runs before any request, including URL inspection, where the
 * property travels in the body. Discovery lists only the allowed properties.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { parseSiteUrls, assertUrlSiteAllowed } from "../src/core/account-scope.ts";
import { startupNotices } from "../src/config.ts";
import { createServer } from "../src/server.ts";
import { GSCClient } from "../src/platforms/gsc/gscClient.ts";

const ALLOWED = "sc-domain:example.com";
const OTHER = "https://other.example/";

function stubFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    return handler(String(url), init);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function connect(config, callback) {
  const server = createServer({ accessToken: "access", logLevel: "error", ...config });
  const client = new Client({ name: "allowlist-test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  try {
    await callback(client);
  } finally {
    await client.close();
    await server.close();
  }
}

test("the variable takes properties exactly as Search Console writes them", () => {
  assert.equal(parseSiteUrls(undefined), undefined);
  assert.equal(parseSiteUrls(" "), undefined);
  assert.deepEqual(parseSiteUrls(`${ALLOWED}, https://www.example.com/,${ALLOWED}`), [ALLOWED, "https://www.example.com/"]);
  assert.throws(() => parseSiteUrls("example.com"), /GSC_SITE_URLS/);
  assert.throws(() => parseSiteUrls("ftp://example.com/"), /GSC_SITE_URLS/);
});

test("startup recommends the allowlist only while it is unset", () => {
  assert.match(startupNotices({}).join("\n"), /GSC_SITE_URLS is not set[\s\S]*required in 3\.0\.0/);
  assert.deepEqual(startupNotices({ GSC_SITE_URLS: ALLOWED }), []);
});

test("URLs of another property are refused, the site list passes", () => {
  const encoded = (site) => `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps`;
  assert.throws(() => assertUrlSiteAllowed([ALLOWED], encoded(OTHER)), /not in GSC_SITE_URLS/);
  assertUrlSiteAllowed([ALLOWED], encoded(ALLOWED));
  assertUrlSiteAllowed([ALLOWED], "https://www.googleapis.com/webmasters/v3/sites");
  assertUrlSiteAllowed(undefined, encoded(OTHER));
});

test("a tool naming another property fails before any request", async () => {
  const stub = stubFetch((url) => { throw new Error(`unexpected request ${url}`); });
  try {
    await connect({ allowedSiteUrls: [ALLOWED] }, async (client) => {
      for (const [name, args] of [
        ["gsc_get_site", { siteUrl: OTHER }],
        ["gsc_inspect_url", { siteUrl: OTHER, url: "https://other.example/page" }],
        ["gsc_list_sitemaps", { siteUrl: OTHER }],
      ]) {
        const result = await client.callTool({ name, arguments: args });
        assert.equal(result.isError, true, name);
        assert.match(result.content[0].text, /not in GSC_SITE_URLS/, name);
      }
    });
    assert.equal(stub.calls.length, 0);
  } finally {
    stub.restore();
  }
});

test("the client refuses another property even when called directly, inspection included", async () => {
  const stub = stubFetch((url) => { throw new Error(`unexpected request ${url}`); });
  try {
    const client = new GSCClient("access", [ALLOWED]);
    await assert.rejects(client.inspectUrl("https://other.example/page", OTHER), /not in GSC_SITE_URLS/);
    await assert.rejects(client.listSitemaps(OTHER), /not in GSC_SITE_URLS/);
    assert.equal(stub.calls.length, 0);
  } finally {
    stub.restore();
  }
});

test("discovery lists the allowed properties only", async () => {
  const stub = stubFetch((url) => {
    if (url.endsWith("/webmasters/v3/sites")) {
      return json({ siteEntry: [
        { siteUrl: ALLOWED, permissionLevel: "siteOwner" },
        { siteUrl: OTHER, permissionLevel: "siteFullUser" },
      ] });
    }
    throw new Error(`unexpected request ${url}`);
  });
  try {
    await connect({ allowedSiteUrls: [ALLOWED] }, async (client) => {
      const listed = JSON.parse((await client.callTool({ name: "gsc_list_sites", arguments: {} })).content[0].text);
      assert.doesNotMatch(JSON.stringify(listed), /other\.example/);
      assert.match(JSON.stringify(listed), /sc-domain:example\.com/);
    });
  } finally {
    stub.restore();
  }
});
