# Security review

A self-review of the code as built, not an independent assessment.

## Checked and passing (automated)

| Control | Evidence |
|---|---|
| Unauthenticated API calls return 401; pages redirect to login | `proxy.ts`; smoke test |
| Client cannot reach recruiter pages or APIs (404) | e2e test, smoke test |
| Client sees only own client's, submitted, non-deleted candidates (404 otherwise) | `getApplicationFor`; integration and smoke tests |
| Client responses carry masked contact only; no resume text or storage key | smoke test greps portal HTML |
| Resume stream requires ownership | smoke test: other client gets 404 |
| Submit and stage moves require `viewedAt` | smoke test |
| Withdrawn consent blocks submit and stage moves | smoke test |
| Deletion removes file, text, profile and evidence; anonymises; keeps aggregate score | integration test |
| Audit entries carry no resume text or contact data | code review of every `audit()` call |
| Uploads: magic bytes, 10 MB, 500 limit | smoke test |
| Zod validation on every body | code review |
| Passwords hashed with bcrypt; JWT sessions | `auth.ts` |
| Secrets not in repo | `.env*` ignored; `.env.example` has names only |

## Known gaps

- No per-user rate limiting on upload, process or login routes (the brief's "rate-limited" login state is not implemented).
- No Content-Security-Policy or other hardening headers set.
- `npm audit` reports moderate advisories in the scaffold's dependency tree; not triaged.
- The demo password is shared and published in the README and login screen by design; production must change it.
- Resume bytes are stored unencrypted in Postgres; rely on database encryption at rest.
- Client "view-only" CV is an iframe of a PDF with the toolbar hidden. A determined client can still save it from the browser. This is a deterrent, not DRM.
- `Cache-Control: private, no-store` is set on file responses; other responses use framework defaults.
- Git history contains a removed `.pgdata` directory from one early commit (local dev database files with synthetic data only). Rewrite history before publishing.

## Privacy

Real personal data is not used anywhere: every candidate is synthetic and uses `example.com` addresses and fictional numbers.
