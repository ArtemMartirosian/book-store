import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const dockerfile = await read("../Dockerfile");
const compose = await read("../../../infra/docker-compose.yml");
const production = await read("../../../infra/docker-compose.production.yml");

test("Docker image builds and runs with the same explicitly supplied indexing flag", () => {
  assert.match(dockerfile, /^ARG SITE_INDEXING_ENABLED=false\n/u);
  for (const stage of ["build", "runtime"]) {
    const section = dockerfile.split(` AS ${stage}\n`)[1]?.split("\nFROM ")[0];
    assert.ok(section, stage);
    assert.match(section, /^ARG SITE_INDEXING_ENABLED$/mu);
    assert.match(section, /^ENV SITE_INDEXING_ENABLED=\$SITE_INDEXING_ENABLED$/mu);
  }
  const buildSection = dockerfile.split(" AS build\n")[1].split("\nFROM ")[0];
  assert.ok(buildSection.indexOf("ENV SITE_INDEXING_ENABLED=") < buildSection.indexOf("RUN npm run build"));
});

test("both Compose profiles pass indexing and canonical origin to build args and runtime", () => {
  for (const content of [compose, production]) {
    assert.equal((content.match(/SITE_INDEXING_ENABLED: \$\{SITE_INDEXING_ENABLED:-false\}/gu) || []).length, 2);
    assert.equal((content.match(/NEXT_PUBLIC_SITE_URL: \$\{NEXT_PUBLIC_SITE_URL:-[^}]+\}/gu) || []).length, 2);
  }
  assert.match(compose, /NEXT_PUBLIC_SITE_URL:-http:\/\/localhost:3000/u);
  assert.match(production, /NEXT_PUBLIC_SITE_URL:-https:\/\/grqaser\.am/u);
  assert.match(compose, /GOOGLE_SITE_VERIFICATION: \$\{GOOGLE_SITE_VERIFICATION:-\}/u);
  assert.match(compose, /YANDEX_SITE_VERIFICATION: \$\{YANDEX_SITE_VERIFICATION:-\}/u);
});

test("production keeps loopback ports, exact trusted proxy, bounded logs and disabled fixture ingestion", () => {
  assert.match(production, /TRUST_PROXY_CIDRS: "172\.18\.0\.1\/32"/u);
  assert.match(production, /subnet: 172\.18\.0\.0\/16/u);
  assert.match(production, /gateway: 172\.18\.0\.1/u);
  assert.match(production, /CORS_ORIGINS: \$\{LUMI_CORS_ORIGINS:-https:\/\/grqaser\.am\}/u);
  assert.match(production, /max-size: "10m"/u);
  assert.match(production, /max-file: "3"/u);
  assert.match(production, /WORKER_ENABLED: "false"/u);
  assert.doesNotMatch(production, /^\s+ports:/mu);
  const publishedPorts = compose.match(/^\s+- "[^"\n]+:\d+"$/gmu) || [];
  assert.equal(publishedPorts.length, 4);
  for (const port of publishedPorts) assert.match(port, /"127\.0\.0\.1:/u);
});

test("example environments disable indexing and leave verification tokens unconfigured", async () => {
  for (const path of ["../.env.example", "../../../.env.example"]) {
    const content = await read(path);
    assert.match(content, /^SITE_INDEXING_ENABLED=false$/mu);
    assert.match(content, /^GOOGLE_SITE_VERIFICATION=$/mu);
    assert.match(content, /^YANDEX_SITE_VERIFICATION=$/mu);
  }
});

test("disabled production worker exits normally without an automatic restart loop", () => {
  const worker = production.split("\n  worker:\n")[1]?.split("\n  web:\n")[0];
  assert.ok(worker);
  assert.match(worker, /WORKER_ENABLED: "false"/u);
  assert.match(worker, /^ {4}restart: "no"$/mu);
});

test("build-time headers protect previews while enabled builds retain private-page noindex", async (t) => {
  const source = await read("../next.config.ts");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  const config = (await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"))).default;
  const previous = process.env.SITE_INDEXING_ENABLED;
  t.after(() => {
    if (previous === undefined) delete process.env.SITE_INDEXING_ENABLED;
    else process.env.SITE_INDEXING_ENABLED = previous;
  });
  process.env.SITE_INDEXING_ENABLED = "false";
  const preview = await config.headers();
  assert.ok(preview.some((rule) => rule.source === "/:path*" && rule.headers.some((header) => header.key === "X-Robots-Tag" && header.value.includes("noindex"))));
  process.env.SITE_INDEXING_ENABLED = "true";
  const launched = await config.headers();
  assert.ok(!launched.some((rule) => rule.source === "/:path*"));
  assert.ok(launched.some((rule) => rule.source === "/admin/:path*"));
  assert.ok(launched.some((rule) => rule.source === "/:locale/cart"));
});
