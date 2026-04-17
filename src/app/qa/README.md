# QA Surfaces

This directory contains QA-only fixture and playground routes.

- These pages are **not production surfaces**.
- They exist to validate layout, interaction, fixture rendering, and component behavior against real app code.
- They may reuse production components directly, but they must not become an alternate product flow.

Boundary rules:

- Keep QA pages under `src/app/qa/`.
- Guard them with `NODE_ENV === "production"` and `notFound()` so they disappear in production.
- Treat them as fixture, preview, and playground surfaces only.
- Do not grow feature logic here that should live in product routes or shared modules.
