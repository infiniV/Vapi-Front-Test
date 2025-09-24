<!--
  Purpose: Guidance for AI coding agents (Copilot/assistant) working on the VAPI Call Monitor repo.
  Keep this short (20-50 lines) and focused on actionable, repository-specific conventions.
-->

# Copilot instructions — VAPI Call Monitor

This file gives concise, actionable guidance for an AI coding assistant modifying this repository.

- Project type: Next.js (App Router, Next 15) + TypeScript + Tailwind v4 + shadcn/ui. React 19.
- Entry points: `src/app/layout.tsx`, `src/app/page.tsx`. Main interactive UI: `src/components/vapi-call-monitor.tsx`.

Quick, high-value things to read first
- `src/lib/vapi-service.ts` — the canonical HTTP client for ALL VAPI API calls. Centralizes headers, logging, error handling and emits the `vapiApiCall` CustomEvent used by diagnostics/UI.
- `src/components/vapi-diagnostics.tsx` — concrete examples of calling `vapiService` and interpreting results.
- `src/components/vapi-call-monitor.tsx` — WebSocket/monitoring client logic; shows how monitor URLs from VAPI are consumed.
- `src/lib/vapi-webhook-store.ts` + `src/app/api/vapi-webhook/route.ts` — server-side webhook entry + in-memory store (MAX_EVENTS=200).
- `src/lib/utils.ts` — shared helpers (phone formatting, `cn()` class merging).

Important repository-specific patterns & constraints
- All VAPI HTTP calls should use `vapiService`. It dispatches `window.dispatchEvent(new CustomEvent('vapiApiCall', { detail }))` so UIs can subscribe for diagnostics and auditing. Preserve these events when changing API logic.
- Event shape (subscribe example):
  - detail: { request, response?, error?, success: boolean }
  - Example listener: `window.addEventListener('vapiApiCall', e => console.log(e.detail))`
- Environment variables are client-visible by design: `NEXT_PUBLIC_VAPI_API_KEY` and `NEXT_PUBLIC_VAPI_BASE_URL`. Do not move these to server-only without discussing UX/architecture implications — the UI relies on browser-side calls.
- Credential updates are tricky: `vapiService.updateCredential()` tries a PATCH but warns that the VAPI API may require delete+recreate. Keep that behavior or explicitly surface it in the UI.
- Monitoring (WebSocket) behavior: assistants must have monitoring enabled to receive monitor URLs. `vapiService.enableAssistantMonitoring()` and `verifyAssistantMonitoring()` contain the logic and human-friendly recommendations used throughout the UI.
- Webhook store is in-memory and capped at 200 events — used by `server-webhook-monitor.tsx`. This is not durable and intended for local debugging only.

Developer workflows (commands you will actually run)
- Install: `npm install`
- Dev server: `npm run dev` (Next dev with turbopack)
- Production build: `npm run build` && `npm start`
- Lint: `npm run lint` (ESLint)
- Debug: open browser DevTools Console — `vapiService` logs full request/response objects and the `vapiApiCall` CustomEvents.

Conventions to follow when editing
- Respect App Router server/client boundaries: add `'use client'` at the top of client components (see `vapi-diagnostics.tsx`).
- Reuse shadcn/ui primitives in `src/components/ui/*` (Button, Card, Badge, Input) for consistent styling.
- Use `cn()` from `utils.ts` and prefer `tw-merge` semantics for class merging.
- Add defensive try/catch around `vapiService` calls and return safe fallbacks (many components expect arrays or empty lists rather than thrown exceptions).
- Preserve `window.dispatchEvent` calls in `vapiService` to keep diagnostics and monitoring components working.

Examples to copy or reference
- Use `vapiService.getPhoneNumbers()` pattern from `vapi-diagnostics.tsx` for simple checks and handling of empty results.
- Use `vapiService.makeCall(assistantId, phoneNumberId, customerNumber, name?, metadata?)` to initiate calls; note it will try to enable assistant monitoring first.

Notes & questions for maintainers
- The API key is intentionally exposed to the client. Should this remain or should we proxy requests server-side (this would require reworking components and env var names)?
- Are there plans to persist webhooks beyond the in-memory `vapi-webhook-store`?

If you cannot determine expected behavior
- Prefer non-breaking changes: add feature flags, fallbacks, console warnings, and small PRs with clear descriptions linked to `README.md`.
