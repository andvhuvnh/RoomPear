# RoomPear — Claude Code Context

## What this app is
RoomPear is a mobile roommate-matching app built like a dating app. Users swipe on profiles, match mutually, and chat. Think Hinge but for finding a compatible roommate. Starting at UCR, targeting college students.

## Tech stack
- Frontend: Expo (~54) + React Native + TypeScript
- Backend: Supabase (auth, postgres, realtime, storage)
- Testing: Jest + React Native Testing Library (Supabase mocked)
- Dev: VSCode + Claude Code (MCP connected to Supabase)

## Monorepo structure
```
RoomPear/
├── apps/mobile/          # Expo app — all active development here
│   ├── App.tsx           # Root state machine (loading→auth→onboarding→home)
│   ├── index.ts          # Expo entry point
│   ├── app.config.js     # Expo config, loads .env via dotenv
│   ├── screens/          # All screens
│   ├── navigation/       # MainTabNavigator + MessagesStack
│   ├── components/       # PublicProfileCard, ProfileDetailsForm
│   └── lib/              # Supabase data layer
└── package.json          # npm workspaces root
```

The `.env` file lives at `apps/mobile/.env` (not the repo root).
Run expo from `apps/mobile/` or via `npm run dev:mobile` from root.

---

## Locked decisions — do not change without discussion
- Photos come last in onboarding (step 9) as the "reveal moment"
- No user_type branching — one unified profile, `has_listing` boolean handles place listings
- Dealbreakers have 3 states: hard (removes from deck), soft (ranks lower), none (ignored)
- Matching weights: Lifestyle 35%, Interests 30%, Budget 20%, Dealbreakers 15%
- Match flow is Hinge-style mutual — both notified simultaneously
- Pear icon used in match modal, not a heart
- No ads in any free tier, ever
- RevenueCat for subscription management
- Tappable chips only in onboarding — no typed forms except personality prompt answers

---

## Current database (Supabase — project ref: vppjzlyncbpkdarnqdwl)

### Tables
- **profiles** — id (FK auth.users), email, name, phone, age, gender, ethnicity, bio, occupation, hobbies[], profile_photo_url, subscription_tier (free/premium), created_at, updated_at
- **preferences** — user_id, city, state, zip_code, location, min_budget, max_budget, room_type, move_in_date, lease_duration_months, pets_allowed, smoking_allowed, cleanliness_level (1–5), social_preference, work_schedule, must_haves[], created_at, updated_at
- **swipes** — id, swiper_id, swiped_id, direction (like/pass), created_at
- **conversations** — id, last_message_at, last_message_preview, created_at
- **conversation_participants** — conversation_id + user_id (composite PK), joined_at, last_read_at
- **messages** — id, conversation_id, sender_id, body, created_at

### Database functions
- `handle_new_user` — trigger: auto-creates profiles row on auth signup
- `handle_updated_at` — trigger: auto-updates updated_at
- `handle_new_message` — trigger: updates conversation last_message_at + preview
- `user_in_conversation(id)` — RLS helper: is current user a participant?
- `match_peers_without_messages()` — RPC: mutual likes with no conversation yet
- `get_or_create_match_conversation(other_user_id)` — RPC: idempotent DM thread creation
- `get_unread_counts(conversation_ids[])` — RPC: unread count per conversation

### RLS summary
- profiles: any authenticated user can SELECT (public discovery); own row for INSERT/UPDATE
- preferences: own row only
- swipes: own inserts; SELECT where swiper or swiped
- conversations/participants/messages: participants only

### New columns added (migrations applied 2026-04-12)
- `profiles.has_listing` — boolean, default false ✅
- `profiles.prompts` — jsonb, default [] (array of {question, answer}, max 3) ✅
- `preferences.interests` — jsonb, default {} (grouped by category e.g. {lifestyle: ["Early bird"]}) ✅
- `preferences.dealbreakers` — jsonb, default {} (e.g. {smoking: "hard", pets: "soft"}) ✅
- `listings` table — id, user_id, rent, room_type, address, city, state, zip_code, move_in_date, listing_photos (jsonb), created_at, updated_at. RLS enabled (authenticated can view all, owner can insert/update/delete) ✅

### Note on brief vs actual schema
The original brief described a `matches` table (user1_id, user2_id, status). This does NOT exist — match logic is handled via the `swipes` table + `match_peers_without_messages()` RPC. The `messages` schema also differs from the brief (uses conversation_id, not match_id; column is `body` not `message`).

---

## What's built and working

### Auth
- Email + password signup/login via Supabase
- OAuth buttons (Google/Apple/Facebook) exist in UI but are NOT wired up

### Onboarding (current — does not match final spec)
Currently split across 3 separate screens, not a unified 10-step flow:
1. `OnboardingScreen` — 7 steps: about-you, location, budget, room-type, move-in-date, lifestyle, must-haves. Uses a mix of tappable chips (gender, room type, lifestyle) and TextInput fields (age, ethnicity, city/state/zip, budget numbers). The `must-haves` step is a placeholder — renders "this can be added later" text and immediately calls complete.
2. `ProfileCompletionScreen` — bio, occupation, hobbies (text forms, skippable)
3. `ProfileCardScreen` — photo upload (3–5 required)

### App state gating (App.tsx)
- No session → `auth`
- No preferences row → `onboarding`
- ≥3 photos → `home` (profile-completion/profile-card skipped entirely)
- <3 photos AND no bio/occupation/hobbies → `profile-completion`
- <3 photos AND has any profile detail → `profile-card`

### Navigation (current — does not match final spec)
4 bottom tabs: **Discover / Matches / Messages / Profile**

### Discover
- Card stack, like/pass buttons, match celebration modal (minimal — no pear icon, no shared interests)
- No filtering by location, budget, or dealbreakers
- No scoring or algorithm — returns any profile with a photo, excludes already-swiped

### Matches
- Lists mutual likes with no conversation yet
- Inline first-message UI that creates a DM thread

### Messages
- Conversation list with unread counts
- Full 1:1 realtime chat via Supabase Realtime

### Profile
- View own public card
- Edit name, bio, occupation, hobbies
- Manage photos (add/remove — no reorder, order is insertion order)
- Sign out
- No upgrade/paywall button

---

## What still needs to be built (priority order)

### ✅ 1. New DB columns + listings table — DONE
`has_listing`, `prompts`, `interests`, `dealbreakers` added. `listings` table created.

### 2. Full 10-step onboarding flow (redesign)
Replace the current 3-screen split with a single unified flow. One question per screen, progress bar, chips only.
1. Name, age, gender, ethnicity
2. Location (city, state, zip)
3. Budget (min/max slider)
4. Room type + move-in date
5. Lifestyle (cleanliness, schedule, social vibe)
6. Dealbreakers (hard/soft/none per item)
7. Interests (5-category accordion, up to 5 per category, custom input)
8. Personality prompts (pick 2 required + 1 optional from 24 prompts, inline answers)
9. Photos (up to 4, framed as the reveal moment)
10. Place listing (optional — has_listing toggle, address, up to 6 photos)

### 3. Redesigned swipe card
Split photo panel design (mockup exists). Pass / Like / Top Pick / Undo actions. Swipe counter.

### 4. Matching algorithm
4 layers:
1. Hard filters — location overlap, budget overlap, hard dealbreakers
2. Compatibility score — Lifestyle 35%, Interests 30%, Budget 20%, Dealbreakers 15%
3. Boost factors — premium users, new users (48hr boost), recently active
4. Wild card injection — 80% high scorers, 20% random lower-scored profiles

### 5. Dopamine loop + Likes tab
- "Someone liked your profile" notification
- Blurred teaser grid (photo blurred, interests visible)
- 4 free reveal paths: swipe naturally / complete profile / 1 daily free reveal / invite a friend
- Match modal: pear icon, both avatars, shared interests, send message CTA
- Premium: see all likers unblurred

### 6. Redesigned Chats tab
Replace current Matches + Messages separate tabs with a single **Chats** tab containing:
- Sub-tab: Matched (mutual likes, not yet messaged) — grid with sort chips
- Sub-tab: Messages (active conversations) — list view

### 7. Paywall + monetization
- Enforce: 10 swipes/day free, 1 Top Pick/day, 1 free reveal/day
- Paywall screen: 3 tiers ($7.99 / $12.99 / $19.99), like count banner, free escape link
- Paywall triggers: tap blurred like, hit swipe limit, upgrade button in Profile
- RevenueCat integration for subscription management

### 8. Push notifications
- "Someone liked your profile"
- Match notifications (simultaneous for both users)
- New message notifications

---

## Key files reference

| Path | Purpose |
|------|---------|
| `apps/mobile/App.tsx` | Root state machine + auth listener |
| `apps/mobile/lib/supabase.ts` | Supabase client init |
| `apps/mobile/lib/discover.ts` | Fetch profiles, record swipes, detect matches |
| `apps/mobile/lib/matches.ts` | Fetch mutual matches via RPC |
| `apps/mobile/lib/messaging.ts` | Conversations, messages, unread counts, realtime |
| `apps/mobile/lib/preferences.ts` | Read/write housing preferences |
| `apps/mobile/lib/storage.ts` | Photo upload/delete/signed URLs |
| `apps/mobile/lib/profilePhotos.ts` | Photo array management (3–5 limit) |
| `apps/mobile/lib/profileDisplay.ts` | Normalize location strings + photo paths |
| `apps/mobile/lib/types.ts` | Core TypeScript types — mostly stale/unused. `Listing` type doesn't match planned schema. `Preference` type is missing city/state/zip/work_schedule/must_haves. `Message` type uses old receiver_id/listing_id/content fields, not the actual schema. |
| `apps/mobile/navigation/MainTabNavigator.tsx` | 4-tab root navigator |
| `apps/mobile/navigation/MessagesStack.tsx` | Messages stack (list + chat) |
| `apps/mobile/components/PublicProfileCard.tsx` | Reusable profile card with photo carousel |
| `apps/mobile/components/ProfileDetailsForm.tsx` | Reusable bio/occupation/hobbies form |

## Security notes (known issues to fix)
- `handle_new_user` and `handle_updated_at` DB functions have mutable search_path (SQL injection risk)
- Leaked password protection disabled in Supabase Auth settings
