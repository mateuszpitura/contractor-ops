# FE↔BE Integration Audit Report

Generated: 2026-05-17T13:07:04.387Z

## Summary

- Active findings: **0** (HIGH 0 / MED 0 / LOW 0)
- Triaged as false positive: **0** (see Appendix B)
- Procedures audited: **416** (appRouter + portalAppRouter + publicApiRouter)
- FE mutation call sites audited: **252**

### By domain

| Domain | HIGH | MED | LOW | Total |
|--------|------|-----|-----|-------|
| core | 0 | 0 | 0 | 0 |
| compliance | 0 | 0 | 0 | 0 |
| equipment | 0 | 0 | 0 | 0 |
| finance | 0 | 0 | 0 | 0 |
| integrations | 0 | 0 | 0 | 0 |
| portal | 0 | 0 | 0 | 0 |
| workflow | 0 | 0 | 0 | 0 |

## HIGH (0)

## MED (0)

## LOW (0)

## Appendix A — Intentional non-UI consumers

These procedures have no FE caller because they are invoked from non-UI consumers (public-api REST routes, background jobs, cron scripts, services). Count: **0**.

