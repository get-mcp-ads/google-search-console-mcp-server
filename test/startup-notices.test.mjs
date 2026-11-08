/**
 * Startup notices go to stderr. stdout carries the MCP protocol, and a single
 * stray line there breaks the client's handshake.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const credentials = { GSC_ACCESS_TOKEN: "a", LOG_LEVEL: "error" };

function start(env) {
  return new Promise((resolve, reject) => {
    const base = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GSC_")));
    const child = spawn(process.execPath, ["dist/cli.js"], {
      cwd: new URL("..", import.meta.url),
      env: { ...base, ...credentials, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    // The server waits for a client; give it time to print its notices, then stop it.
    setTimeout(() => child.kill(), 1500);
    child.on("close", () => resolve({ stdout, stderr }));
  });
}

test("a missing allowlist is announced on stderr only", async () => {
  const { stdout, stderr } = await start({});
  assert.equal(stdout, "", "nothing may reach stdout before the client speaks");
  assert.match(stderr, /GSC_SITE_URLS is not set[^\n]*required in 3\.0\.0/);
});

test("a configuration ready for 3.0.0 starts without notices", async () => {
  const { stdout, stderr } = await start({ GSC_SITE_URLS: "sc-domain:example.com", GSC_SITE_URL: "sc-domain:example.com" });
  assert.equal(stdout, "");
  assert.doesNotMatch(stderr, /3\.0\.0/);
});

test("a default property outside the allowlist stops the server with a clear message", async () => {
  const { stdout, stderr } = await start({ GSC_SITE_URLS: "sc-domain:example.com", GSC_SITE_URL: "https://other.example/" });
  assert.equal(stdout, "");
  assert.match(stderr, /GSC_SITE_URL must be one of the properties listed in GSC_SITE_URLS/);
});

test("the CLI writes the Node.js runtime warning to stderr", () => {
  const cli = readFileSync(new URL("../src/cli.ts", import.meta.url), "utf8");
  assert.match(cli, /nodeRuntimeWarning\(\)/);
  assert.match(cli, /process\.stderr\.write\(`\$\{runtimeWarning\}\\n`\)/);
  assert.doesNotMatch(cli, /process\.stdout|console\.log/);
  const doctor = readFileSync(new URL("../scripts/doctor.mjs", import.meta.url), "utf8");
  assert.match(doctor, /nodeRuntimeWarning\(\)/);
});
