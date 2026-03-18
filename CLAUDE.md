# Engineering & Product Guidelines

## UI / Design

- Use the `frontend-design` plugin for all UI-related work.
- Always aim for high-quality, polished, visually consistent, and production-ready interfaces.
- Prioritize excellent UX, strong visual hierarchy, responsiveness, accessibility, and design consistency across the entire app.
- Avoid generic or low-effort UI output.

## Architecture

- Build the project as a monorepo using Turborepo.
- Follow clean architecture principles and keep clear boundaries between apps, packages, domains, and infrastructure.
- Apply SOLID, DRY, separation of concerns, and appropriate design patterns where they improve maintainability.
- Prefer scalable, modular, and extensible solutions over short-term hacks.
- Keep the codebase easy to navigate, predictable, and senior-level in quality.

## Libraries / Documentation / Freshness

- Always use `ctx7` CLI when gathering library documentation, usage patterns, or implementation details.
- Always rely on the most up-to-date stable library versions and current best practices.
- Avoid outdated patterns, deprecated APIs, or legacy approaches unless explicitly required.

## Code Quality

- Write clean, readable, maintainable, and well-structured code.
- Use strong typing and avoid unsafe shortcuts.
- Prefer explicitness over magic.
- Keep abstractions justified and avoid overengineering.
- Ensure naming is consistent and meaningful across the codebase.

## Validation & Data Safety

- Use schema validation for all external inputs, forms, API payloads, env variables, and critical boundaries.
- Never trust client input.
- Validate and sanitize data at every important boundary.
- Keep contracts between frontend, backend, and database explicit and type-safe.

## Security

- Apply security best practices by default.
- Do not expose secrets, internal implementation details, or sensitive data.
- Follow least-privilege access principles.
- Use rate limiting, authorization, secure defaults, and defensive programming.
- Prefer RLS and database-level protections where relevant.
- Consider common web security risks (XSS, CSRF, SSRF, injection, auth bypass, insecure direct object references, etc.).

## Performance

- Always consider performance, caching, and efficiency from the start.
- Avoid unnecessary re-renders, overfetching, duplicated computations, and oversized bundles.
- Use appropriate caching strategies at API, database, and frontend levels.
- Optimize for both developer experience and runtime efficiency.

## Accessibility

- Follow WCAG and accessibility best practices by default.
- Ensure keyboard navigation, focus states, semantic HTML, screen-reader friendliness, and sufficient contrast.
- Treat accessibility as a core requirement, not a polish step.

## Environment / Developer Experience

- Keep `.env.example` always up to date.
- Make local setup fast and predictable.
- Prefer conventions that improve onboarding speed and reduce configuration confusion.
- Ensure scripts, package boundaries, and developer workflows are clear and consistent.

## Delivery Standard

- Deliver production-grade code, not demo-grade shortcuts.
- Think like a senior engineer, architect, and product-minded builder.
- Every implementation should balance maintainability, scalability, performance, UX quality, and security.

## Observability

- Include proper logging, error handling, and monitoring hooks where relevant.
- Make failures debuggable.
- Avoid silent failures.
- Structure logs and error flows so production issues can be diagnosed efficiently.

## API & Contracts

- Keep APIs consistent, predictable, and well-structured.
- Use clear request/response contracts.
- Design for maintainability and future evolution.
- Avoid breaking changes unless explicitly intended.

## Database

- Design schemas carefully with maintainability, indexing, and query performance in mind.
- Add migrations safely and keep them reversible when possible.
- Avoid leaking business logic into random places when it belongs in the domain or database layer.

## Product Thinking

- Do not implement features mechanically.
- Consider user goals, edge cases, failure states, empty states, and realistic product flows.
- Prefer solutions that are useful in real production scenarios.
