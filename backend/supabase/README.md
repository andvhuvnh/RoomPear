# Supabase Backend

This directory contains the Supabase backend configuration, migrations, and policies for RoomPear.

## Structure

```
backend/supabase/
├── config.toml              # Supabase local development configuration
├── migrations/              # Database migrations (SQL files)
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
- **conversations** — DM threads (`last_message_at`, `last_message_preview`)
- **conversation_participants** — who is in each thread (two users per DM)
- **messages** — individual messages (body, `sender_id`, `created_at`)

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

### Messaging (manual test data)

Apply the migration, then in the **SQL Editor** (runs with privileges that bypass RLS), create a conversation between two real users and add messages. Replace the UUIDs with values from **Authentication → Users** (and ensure both have rows in `public.profiles`).

```sql
-- 1) Create a conversation
INSERT INTO public.conversations (id)
VALUES (gen_random_uuid())
RETURNING id;

-- Copy the returned id into :conv below, and set :you and :them to two user UUIDs.

-- 2) Add both participants (example — run after substituting UUIDs)
INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES
  ('CONVERSATION_UUID'::uuid, 'YOUR_USER_UUID'::uuid),
  ('CONVERSATION_UUID'::uuid, 'OTHER_USER_UUID'::uuid);

-- 3) Insert a message (sender must be one of the participants)
INSERT INTO public.messages (conversation_id, sender_id, body)
VALUES ('CONVERSATION_UUID'::uuid, 'YOUR_USER_UUID'::uuid, 'Hello from SQL — you should see this in the app.');

-- The trigger updates conversations.last_message_at and last_message_preview.
```

In the mobile app, open **Messages**: threads sort by `last_message_at` (newest first). Open a thread to read and send (RLS allows participants to `SELECT`/`INSERT` messages).

**Realtime (optional):** In the Supabase dashboard, enable **Replication** for `public.messages` if you want live inserts while a chat is open.

## Next Steps

- [ ] Create listings table migration
- [ ] Create listing_photos table migration
- [x] Create messages and conversations tables (`20260408100000_create_messaging.sql`)
- [ ] Set up storage buckets for images
- [ ] Create Edge Functions for serverless logic

