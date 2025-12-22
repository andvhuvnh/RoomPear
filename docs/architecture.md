# RoomPear Architecture

## Overview
RoomPear is built as a monorepo with a Supabase backend, supporting both mobile (Expo/React Native) and web (Next.js) applications.

## Monorepo Structure

```
roompear/
├── apps/
│   ├── mobile/        # Expo (React Native)
│   └── web/           # Next.js (later)
├── packages/
│   ├── ui/            # Shared UI components (future)
│   └── config/        # Shared config/constants
├── backend/
│   └── supabase/      # Migrations, policies, edge functions
├── docs/              # Documentation
├── .gitignore
└── README.md
```

## Tech Stack

### Backend
- **Supabase**: Backend-as-a-Service
  - PostgreSQL database
  - Authentication (built-in)
  - Real-time subscriptions
  - Storage (for images)
  - Edge Functions (serverless functions)
  - Row Level Security (RLS) policies

### Mobile App
- **Expo**: React Native framework
- **React Native**: Mobile UI framework
- **Supabase JS Client**: For API calls

### Web App (Future)
- **Next.js**: React framework with SSR/SSG
- **Supabase JS Client**: For API calls

### Shared Packages
- **packages/ui**: Shared React/React Native components
- **packages/config**: Shared configuration, constants, types

## Architecture Decisions

### Why Monorepo?
- Shared code between mobile and web
- Single source of truth for types and config
- Easier to maintain consistency
- Simplified dependency management

### Why Supabase?
- Built-in authentication
- Real-time capabilities for chat
- PostgreSQL with RLS for security
- Storage for images
- Edge Functions for serverless logic
- Open source and self-hostable

### Database Schema
See `PROJECT_PLAN.md` for initial schema design.

## Data Flow

1. **Client Apps** (mobile/web) → Supabase JS Client
2. **Supabase JS Client** → Supabase API (REST/GraphQL)
3. **Supabase API** → PostgreSQL (with RLS policies)
4. **Real-time**: Supabase Realtime → Client Apps

## Security

- Row Level Security (RLS) policies on all tables
- JWT-based authentication via Supabase Auth
- API keys stored securely (not in client code)
- Edge Functions for sensitive operations

## Deployment

- **Mobile**: Expo EAS Build
- **Web**: Vercel/Netlify (Next.js)
- **Backend**: Supabase Cloud (or self-hosted)

