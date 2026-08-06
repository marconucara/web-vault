// What the RUNNING deployment can do, answered at request time.
//
// The only capability today is whether commits can succeed, which is exactly
// "is a GitHub token configured" (adr/0018-*.md, adr/0040-*.md). The client
// needs this BEFORE it offers an action: choosing which affordance to render
// cannot be done by attempting a commit and reading the failure.
//
// Runtime, deliberately, not baked into the build. The token is a host secret
// an adopter adds AFTER deploying — the welcome note tells them to — so a
// build-time flag would report `false` on a deployment that writes perfectly
// well, until the next rebuild. See adr/0034-*.md, whose open question this
// answers.
//
// Host-agnostic on purpose: it takes `env` and returns data, so the Workers
// wiring (functions/worker.js) and the dev server (scripts/capabilities-dev.mjs)
// share one definition of the answer.

// The token itself NEVER leaves the server — only the boolean derived from it.
//
// `frameworkVersion` is build-injected (generate-worker.mjs) and reports the
// version this deployment SERVES. It duplicates a number already in the bundle,
// which is the point: after an upgrade commit the client has to observe the
// rebuild landing, and it cannot see its own bundle being replaced. A fetch can
// see this (adr/0039-*.md).
export function getCapabilities(env = {}, config = {}) {
  return {
    canWrite: !!env.GITHUB_TOKEN,
    frameworkVersion: config.frameworkVersion || '',
  };
}
