# Architecture Decision Records (ADR)

This document tracks important architectural decisions made during the development of RoomPear.

## ADR-001: Monorepo Structure

**Status**: Accepted  
**Date**: 2024

**Context**: Need to support both mobile and web applications with shared code.

**Decision**: Use a monorepo structure with separate apps/ and packages/ directories.

**Consequences**:
- ✅ Shared code between mobile and web
- ✅ Single source of truth for types/config
- ✅ Easier maintenance
- ⚠️ Requires monorepo tooling (npm workspaces, yarn workspaces, or pnpm)

---

## ADR-002: Supabase as Backend

**Status**: Accepted  
**Date**: 2024

**Context**: Need a backend solution that provides database, authentication, real-time, and storage.

**Decision**: Use Supabase as the backend platform.

**Consequences**:
- ✅ Built-in authentication
- ✅ Real-time subscriptions for chat
- ✅ PostgreSQL with RLS
- ✅ Storage for images
- ✅ Edge Functions for serverless logic
- ✅ Open source and self-hostable
- ⚠️ Vendor lock-in (mitigated by open source)

---

## ADR-003: Expo for Mobile

**Status**: Accepted  
**Date**: 2024

**Context**: Need to build a mobile app for iOS and Android.

**Decision**: Use Expo (React Native) for mobile development.

**Consequences**:
- ✅ Cross-platform (iOS + Android)
- ✅ Over-the-air updates
- ✅ Easy development workflow
- ✅ Good Supabase integration
- ⚠️ Some native module limitations (can use custom dev client if needed)

---

## ADR-004: Next.js for Web (Future)

**Status**: Planned  
**Date**: 2024

**Context**: Will need a web application later.

**Decision**: Use Next.js for the web application.

**Consequences**:
- ✅ SSR/SSG capabilities
- ✅ Great developer experience
- ✅ Good performance
- ✅ Easy deployment (Vercel)

---

## ADR-005: Shared UI Package

**Status**: Planned  
**Date**: 2024

**Context**: Want to share UI components between mobile and web.

**Decision**: Create a shared UI package, but start mobile-first.

**Consequences**:
- ✅ Code reuse
- ⚠️ React Native and React web have different component APIs
- ⚠️ May need separate implementations for some components

---

## Future Decisions to Document

- Payment processor choice (Stripe vs PayPal)
- Image optimization strategy
- Push notification service
- Analytics platform
- Error tracking service

