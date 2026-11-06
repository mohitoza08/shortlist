# API contract

Skeleton. Conventions:

- Timestamps: UTC ISO 8601. Money: LPA number. Scores 0-100 (1 dp). Confidence 0-1 (2 dp).
- Pagination: `?page=1&pageSize=25` -> `{ items, page, pageSize, total }`.
- Errors: `{ error: { code, message, details? } }`; 404 for cross-tenant access.
- `POST /api/applications/[id]/process` returns PARSED | NEEDS_REVIEW | QUEUED | FAILED envelopes.
- Client responses never contain resumeBlobKey, resumeText, email, phone.
