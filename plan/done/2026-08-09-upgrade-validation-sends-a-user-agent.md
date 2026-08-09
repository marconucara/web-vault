# The upgrade validator must send a User-Agent, and must not read every failure as "not published"

**Owning ADR(s):** `adr/0039-adopter-upgrade-path.md`
**Dependencies:** None

## Context

Clicking **Update to 0.8.2** in the upgrade notice fails with
`{error: "version 0.8.2 is not published"}` — every time, for every version. The
tag is published: the same URL the endpoint requests answers `200` anonymously,
with the sha this release was pushed at.

The cause is a missing header. GitHub rejects any REST request that carries no
`User-Agent`, with **403** and the body *"Request forbidden by administrative
rules. Please make sure your request has a User-Agent header."*
`isPublishedTag` (`functions/upgrade.js:60-71`) sends only `Accept`:

```js
{ headers: { Accept: 'application/vnd.github+json' } }
```

Every other GitHub call in the file goes through the `gh()` helper
(`functions/upgrade.js:79-89`), which sends `Authorization`, `Accept`,
`User-Agent: web-vault-upgrade` and `X-GitHub-Api-Version`. `isPublishedTag` is
the one call that bypasses it, and the only one missing the UA.

**Why the check works and the upgrade does not.** They are not the same call
made twice; they are two different clients. The notice's check
(`src/lib/upgrade.js:17`) runs in the **browser**, which sets a `User-Agent` of
its own — so the notice correctly reports "0.8.2 is available". The validation
runs in the **Worker**, where `fetch` sets none. Hence a defect that is invisible
in the UI that precedes it and total in the action that follows.

This has never worked from a Worker. `functions/upgrade.js` has exactly one
commit in its history (`444c46a`, the feature itself) and the code is byte-identical
at `v0.8.1`, so the fault shipped with the capability rather than regressing into
it. What made it hard to read is the second defect below.

**The error message asserts something the code cannot know.** Line 67 is
`return res.ok`, so 403 (forbidden), 404 (absent), 5xx and a network failure
(swallowed by the `catch`) all collapse into one `false`, which line 124 renders
as `version X is not published`. Four causes, one message, and it names the only
one that was not happening — pointing the adopter at the release instead of the
request. AC8 requires a failed upgrade to leave "a stated failure"; a stated
falsehood does not satisfy it.

**Why the tests did not catch it.** `isPublishedTag` takes a `fetchImpl` so tests
inject a fake that answers on the URL alone. No test observes the headers, so no
test could fail. The fix has to be tested at the level the bug lives at — what
the request carries — not only at the level of what the response says.

## Scope

1. **`isPublishedTag` sends a `User-Agent`.** Route it through the same header
   set as every other call in the file so the two cannot drift apart again. It
   is deliberately unauthenticated — it reads a public tag of the *framework*
   repo, not the adopter's — so it needs the headers without the `Authorization`.
2. **Distinguish "absent" from "could not tell".** Return an outcome that
   separates a confirmed 404 from a request that failed for any other reason
   (403, 5xx, thrown). Only a confirmed absence may be reported as unpublished.
3. **The endpoint reports the true failure.** A 404 keeps today's
   `version X is not published` (400 — the adopter's target is wrong). Anything
   else says the check could not be completed and returns **502**, not 400: the
   adopter's request was fine, the upstream call was not. Neither writes
   anything — the guard's whole purpose (nothing is written until the target is
   confirmed) is unchanged.
4. **No user-visible string names an ADR** and none claims a fact the code has
   not established.

## Tests

`isPublishedTag` already accepts an injected `fetchImpl`; the gap is that no test
looks at the request. Add:

- the request carries a non-empty `User-Agent` — assert on the `init` the fake
  receives, which is the assertion whose absence let this ship;
- a 404 → unpublished;
- a 403 → not unpublished, but "could not tell";
- a 5xx → "could not tell";
- a thrown/rejected fetch → "could not tell";
- a 200 → published;
- a malformed version short-circuits without any fetch at all.

Then, through `makeUpgradeHandler` with a stubbed fetch: a 403 from the tag
lookup returns 502 and performs **no write**, and the 404 path still returns 400
with the existing message. The no-write assertion is the one that matters: it
states that widening the error handling did not open a path to writing on an
unconfirmed target.

## Out of scope

- **Authenticating the tag lookup.** It reads a public tag and the adopter's
  token has no business reaching the framework repo. The UA fixes the 403; a
  token would mask the real issue behind a broader permission.
- **The 60 req/hour anonymous limit.** Real, and shared across a Worker's egress
  IPs, but not this bug — a rate-limited call will now surface as "could not
  tell" instead of a false "not published", which is the correct handling of it.
- The notice's own check (`src/lib/upgrade.js`), which is browser-side and works.
- Any change to what an upgrade writes, or to the pin format.

## Exit criteria

1. Clicking **Update to …** from a deployed Worker rewrites the pin and reports
   the upgrade as building — the reported defect, verified against a real
   deployment, not only in a test.
2. The tag-lookup request carries a `User-Agent`, asserted by a test.
3. A 403, a 5xx and a network failure each report that the check could not be
   completed, with a 502, and write nothing.
4. A genuinely absent tag still reports `version X is not published` with a 400.
5. No path writes the manifest without a confirmed published tag.
6. `yarn verify` green.

## Notes

- Ships with a patch bump and a tag: the endpoint is adopter-facing and the
  capability is currently broken for every adopter on a Worker, so it is worth
  publishing on its own rather than waiting for the next item.
- ADR `0039` AC5 gains the failure distinction; AC8 is already satisfied in
  wording but was not in behaviour. Revise to r5 (the ADR is already at r4) on the
  implementing commit and keep the status at `Implemented`.

---

**Shipped:** 2026-08-09 · commit `0af571a` · ADR 0039 r5 (stays Implemented).
Released as `v0.8.3` — a patch: the endpoint's contract is unchanged, it merely
works now. Exit criterion 1 (a real Worker completing an upgrade) can only be
met once a deployment runs this version, so it is verified on the first upgrade
away from `v0.8.3` rather than at merge time; the 403 path that caused the
defect is covered by tests that fail without the fix.
