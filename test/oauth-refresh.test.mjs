/**
 * A revoked refresh token is detected once and reported as such.
 *
 * Google answers `invalid_grant` when a refresh token was revoked or expired.
 * Nothing this process does can make it work again, so every later call must
 * fail with the same re-authorization message instead of asking Google again.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { GoogleTokenSource, GoogleReauthorizationRequired } from "../src/core/google-oauth.ts";
import { createServer } from "../src/server.ts";

const credentials = { clientId: "client-id", clientSecret: "client-secret-value", refreshToken: "refresh-token-value" };

function stubFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("invalid_grant becomes a re-authorization error and stops further refreshes", async () => {
  const stub = stubFetch(() => json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400));
  try {
    const source = new GoogleTokenSource(credentials, "GSC_REFRESH_TOKEN");
    await assert.rejects(source.getAccessToken(), (error) => {
      assert.ok(error instanceof GoogleReauthorizationRequired);
      assert.match(error.message, /invalid_grant/);
      assert.match(error.message, /GSC_REFRESH_TOKEN/);
      assert.ok(!error.message.includes("client-secret-value"));
      assert.ok(!error.message.includes("refresh-token-value"));
      return true;
    });
    await assert.rejects(source.getAccessToken(), GoogleReauthorizationRequired);
    assert.equal(stub.calls.length, 1, "a revoked token must not be retried");
  } finally {
    stub.restore();
  }
});

test("a wrong client secret stays an ordinary error, and the next call asks again", async () => {
  const stub = stubFetch(() => json({ error: "invalid_client" }, 401));
  try {
    const source = new GoogleTokenSource(credentials, "GSC_REFRESH_TOKEN");
    await assert.rejects(source.getAccessToken(), (error) => !(error instanceof GoogleReauthorizationRequired));
    await assert.rejects(source.getAccessToken(), /invalid_client/);
    assert.equal(stub.calls.length, 2);
  } finally {
    stub.restore();
  }
});

test("the token request refuses redirects, has a deadline and is cached", async () => {
  const stub = stubFetch(() => json({ access_token: "access-1", expires_in: 3600 }));
  try {
    const source = new GoogleTokenSource(credentials, "GSC_REFRESH_TOKEN");
    assert.equal(await source.getAccessToken(), "access-1");
    assert.equal(await source.getAccessToken(), "access-1");
    assert.equal(stub.calls.length, 1);
    assert.equal(stub.calls[0].init.redirect, "error");
    assert.ok(stub.calls[0].init.signal instanceof AbortSignal);
  } finally {
    stub.restore();
  }
});

test("every tool of the process meets a revoked token once", async () => {
  const stub = stubFetch((url) => {
    if (url.includes("oauth2")) return json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400);
    throw new Error(`No Search Console request may follow a revoked token: ${url}`);
  });
  const server = createServer({ ...credentials, logLevel: "error" });
  const client = new Client({ name: "oauth-test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  try {
    for (const [name, args] of [
      ["gsc_list_sites", {}],
      ["gsc_get_site", { siteUrl: "sc-domain:example.com" }],
    ]) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, true, name);
      assert.match(result.content[0].text, /authorization must be renewed/, name);
      assert.match(result.content[0].text, /GSC_REFRESH_TOKEN/, name);
    }
    assert.equal(stub.calls.length, 1, "one token request for the whole process");
  } finally {
    await client.close();
    await server.close();
    stub.restore();
  }
});
