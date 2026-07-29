import assert from "node:assert/strict";
import test from "node:test";

import {
  checkRunAdmission,
  RunAdmissionError,
} from "../dist/run-admission.js";

const LIMITS = { maxActiveRunsPerSession: 1, maxActiveRunsTotal: 5 };

test("admits a run when nothing is in flight", () => {
  assert.equal(checkRunAdmission({ total: 0, session: 0 }, LIMITS), null);
  assert.equal(checkRunAdmission({ total: 4, session: 0 }, LIMITS), null);
});

test("blocks a session that already holds an active run", () => {
  const rejection = checkRunAdmission({ total: 1, session: 1 }, LIMITS);
  assert.ok(rejection instanceof RunAdmissionError);
  assert.equal(rejection.code, "session_run_limit");
  assert.equal(rejection.statusCode, 429);
  assert.ok(rejection.retryAfterSeconds > 0);
  assert.match(rejection.message, /cancel it/);
});

test("blocks a new session once the deployment is at its concurrent limit", () => {
  const rejection = checkRunAdmission({ total: 5, session: 0 }, LIMITS);
  assert.ok(rejection instanceof RunAdmissionError);
  assert.equal(rejection.code, "global_run_limit");
  assert.match(rejection.message, /5 comparisons/);
});

test("reports the session limit first so the message names the closer cause", () => {
  const rejection = checkRunAdmission({ total: 9, session: 3 }, {
    maxActiveRunsPerSession: 2,
    maxActiveRunsTotal: 5,
  });
  assert.equal(rejection?.code, "session_run_limit");
  assert.match(rejection.message, /2 runs in progress/);
});

test("treats non-positive limits as unlimited", () => {
  const unlimited = { maxActiveRunsPerSession: 0, maxActiveRunsTotal: 0 };
  assert.equal(checkRunAdmission({ total: 500, session: 40 }, unlimited), null);
});
