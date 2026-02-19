# CertWall AI Helpdesk — Implementation Spec & Claude Code Prompt

## For: Claude Code Implementation

> **Context**: The existing CertWall spec (Section 13) defines a basic ticket-based support system at `/support` with `cw_support_tickets` and `cw_ticket_messages` tables, manual staff replies, and quick help links. This document upgrades that into an AI-powered helpdesk that can answer questions about the app, ACORD 25 forms, and insurance compliance — gated behind paid subscription tiers.

---

## 1. FEASIBILITY ASSESSMENT

**Can this be added to the current helpdesk? YES.**

The existing spec already defines:
- A