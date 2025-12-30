# Supabase Backend

This directory contains the Supabase backend configuration, migrations, and policies for RoomPear.

## Structure

```
backend/supabase/
├── supabase/
│   ├── config.toml          # Supabase local development configuration
│   ├── migrations/          # Database migrations (SQL files)
│   └── seed.sql            # Seed data (optional)
└── README.md
```

## Setup

### Prerequisites

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

### Local Development

1. **Start local Supabase:**
   ```bash
   cd backend/supabase
   supabase start
   ```

2. **Apply migrations:**
   ```bash
   supabase db reset  # Resets and applies all migrations
   # OR
   supabase migration up  # Applies pending migrations
   ```

3. **Access Supabase Studio:**
   - Open http://localhost:54323 in your browser
   - This gives you a UI to view tables, run queries, etc.

### Database Schema

#### Tables

- **profiles** - Extended user profiles (extends auth.users)
- **preferences** - User housing preferences
- **listings** - Housing listings (to be created)
- **listing_photos** - Photos for listings (to be created)
- **messages** - Chat messages (to be created)
- **conversations** - Chat conversations (to be created)

#### Authentication

Supabase Auth handles:
- User signup/login
- Email verification
- Password reset
- Session management

The `profiles` table extends `auth.users` with additional user information.

### Row Level Security (RLS)

All tables have RLS enabled with policies that:
- Allow users to read/update their own data
- Allow authenticated users to view public profiles (for browsing)
- Prevent unauthorized access

### Migrations

Migrations are numbered with timestamps and applied in order:
- `20241222000001_create_profiles_table.sql` - Creates profiles table and auth trigger
- `20241222000002_create_preferences_table.sql` - Creates preferences table

### Connecting to Remote Supabase

1. **Link to your project:**
   ```bash
   supabase link --project-ref your-project-ref
   ```

2. **Push migrations:**
   ```bash
   supabase db push
   ```

3. **Pull remote schema changes:**
   ```bash
   supabase db pull
   ```

## Next Steps

- [ ] Create listings table migration
- [ ] Create listing_photos table migration
- [ ] Create messages and conversations tables
- [ ] Set up storage buckets for images
- [ ] Create Edge Functions for serverless logic

