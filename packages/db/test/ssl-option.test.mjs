import assert from "node:assert/strict";
import test from "node:test";

const { resolveSslOption } = await import("../dist/index.js");

const REMOTE = "postgres://user:pw@db.example.com:5432/ragtime";

function withEnv(env, fn) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
  }
  try {
    return fn();
  } finally {
    process.env = saved;
  }
}

test("remote connections verify the server certificate by default", () => {
  const ssl = withEnv(
    { DATABASE_SSL_MODE: undefined, DATABASE_CA_CERT: undefined },
    () => resolveSslOption(REMOTE)
  );
  assert.deepEqual(ssl, { rejectUnauthorized: true });
});

test("a supplied CA is trusted instead of the system store", () => {
  const ssl = withEnv(
    { DATABASE_SSL_MODE: undefined, DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----" },
    () => resolveSslOption(REMOTE)
  );
  assert.deepEqual(ssl, {
    rejectUnauthorized: true,
    ca: "-----BEGIN CERTIFICATE-----",
  });
});

test("loopback skips TLS but a loopback-looking password does not", () => {
  const off = withEnv({ DATABASE_SSL_MODE: undefined }, () =>
    resolveSslOption("postgres://user:pw@127.0.0.1:5432/ragtime")
  );
  assert.equal(off, false);

  // The old substring check treated any URL containing "localhost" as local.
  const on = withEnv({ DATABASE_SSL_MODE: undefined }, () =>
    resolveSslOption("postgres://user:localhost@db.example.com:5432/ragtime")
  );
  assert.deepEqual(on, { rejectUnauthorized: true });
});

test("verification is only skipped when asked for explicitly", () => {
  const ssl = withEnv({ DATABASE_SSL_MODE: "no-verify" }, () =>
    resolveSslOption(REMOTE)
  );
  assert.deepEqual(ssl, { rejectUnauthorized: false });
});

test("a private-network host is encrypted but not verifiable", () => {
  // Render's internal Postgres host is a bare name with a self-signed cert.
  const ssl = withEnv({ DATABASE_SSL_MODE: undefined }, () =>
    resolveSslOption("postgres://user:pw@dpg-d96abc123-a/ragtime")
  );
  assert.deepEqual(ssl, { rejectUnauthorized: false });
});

test("the external form of the same database is verified", () => {
  const ssl = withEnv({ DATABASE_SSL_MODE: undefined }, () =>
    resolveSslOption(
      "postgres://user:pw@dpg-d96abc123-a.oregon-postgres.render.com/ragtime"
    )
  );
  assert.deepEqual(ssl, { rejectUnauthorized: true });
});

test("an unrecognized mode fails loudly rather than falling back", () => {
  assert.throws(
    () => withEnv({ DATABASE_SSL_MODE: "prefer" }, () => resolveSslOption(REMOTE)),
    /DATABASE_SSL_MODE must be verify, no-verify, or disable/
  );
});
