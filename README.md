# RoomPear

A mobile roommate-matching app built like a dating app. Swipe on profiles, match mutually, and chat. Think Hinge but for finding a compatible roommate — starting at UCR, targeting college students.

## Tech Stack

- **Mobile**: Expo ~54 + React Native + TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Payments**: RevenueCat (subscription management)
- **Maps**: Mapbox (location search)
- **Testing**: Jest + React Native Testing Library

## Project Structure

```
RoomPear/
├── apps/mobile/           # Expo app — all active development here
│   ├── App.tsx            # Root state machine (loading → auth → onboarding → home)
│   ├── screens/           # All screens
│   ├── navigation/        # Tab navigator + stack navigators
│   ├── components/        # Reusable UI components
│   ├── lib/               # Supabase data layer + business logic
│   ├── context/           # React contexts (Purchases, etc.)
│   └── theme/             # Colors, ambient styles
└── package.json           # npm workspaces root
```

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev:mobile
```

The `.env` file lives at `apps/mobile/.env`. You'll need:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `MAPBOX_ACCESS_TOKEN`
- RevenueCat API keys

## What's Built

### Auth
- Email + password signup/login via Supabase Auth
- Auto-creates profile row on signup via DB trigger

### Onboarding (16-step unified flow)
1. Name
2. Age
3. Gender (chip select)
4. Ethnicity + gender preference
5. Location (Mapbox search or manual city/state/zip)
6. Budget (min/max slider)
7. Room type (private / shared / flexible / entire)
8. Move-in date (ASAP / 1–6 months / Flexible)
9. Cleanliness level (1–5 scale)
10. Work schedule (9-to-5 / Night Shift / Flexible / Remote)
11. Social vibe (Quiet / Balanced / Social)
12. Pets & smoking self-report
13. Dealbreakers (hard / soft / none per item — card-style sub-flow)
14. Interests (5-category accordion, up to 5 per category)
15. Personality prompts (pick 2+ from 24 prompts, inline answers)
16. Profile photos (up to 4, minimum 2)
17. Place listing (optional — address, rent, room type, up to 6 photos)

### Discover (Swipe Deck)
- Swipe cards with photos, prompts, interests, listing info
- Like / Pass / Top Pick / Undo actions
- Daily swipe limits for free users (10 swipes, 1 Top Pick)
- 4-layer matching algorithm:
  1. Hard filters — location, budget overlap, hard dealbreakers
  2. Compatibility score — Lifestyle 35% / Interests 30% / Budget 20% / Dealbreakers 15%
  3. Boost factors — premium users, new users (48hr), recently active
  4. Wildcard mix — 80% top scorers + 20% random
- Advanced filters for premium: move-in date window, room type, soft dealbreakers
- Discover filters panel: budget, move-in, lease length, room type, has listing, ethnicity, gender
- Pause profile — hide from discover without deleting account
- Block & report — flag button on cards and in chat; bidirectional filtering from deck

### Likes Tab
- Blurred teaser grid showing who liked you
- Free reveal paths: swipe naturally / complete profile / 1 daily free reveal / invite a friend (referral bonus)
- Premium: see all likers unblurred
- Bonus reveals via referral codes

### Chats
- **Matched** sub-tab: mutual likes not yet messaged (grid with sort chips)
- **Messages** sub-tab: active conversations list with unread counts
- Full 1:1 realtime chat via Supabase Realtime
- Date separators, keyboard handling (iOS + Android)

### Profile Tab
- View own public card with photo carousel
- Edit name, photos, bio, gender, ethnicity, work schedule, social vibe, cleanliness
- Edit interests and personality prompts
- Manage place listing (add/edit/delete, listing photos)
- Pause/unpause profile toggle
- Referral code sharing + applying friend codes
- Settings: display name, place listing, invite friends, account info, subscription management
- Blocked users list with unblock per user
- Sign out

### Premium (RoomPear+)
- RevenueCat integration for subscription management
- Entitlement-based access control
- Perks: unlimited swipes, Top Picks, see all likers, advanced filters, pets/smoking hard filtering

### Push Notifications
- "Someone liked your profile" notification
- Match notifications (simultaneous for both users)
- New message notifications (via Expo Push)

### Monetization
- Free tier: 10 swipes/day, 1 Top Pick/day, 1 free reveal/day
- Paywall triggers: tap blurred like, hit swipe limit, upgrade button in Profile
- Pets/smoking hard dealbreaker filtering is premium-only (free users see them ranked lower)

## Database (Supabase)

### Key Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User identity — name, age, gender, ethnicity, bio, photos, subscription tier |
| `preferences` | Housing prefs — location, budget, room type, lifestyle, dealbreakers, interests |
| `listings` | Place listings — address, rent, photos |
| `swipes` | Like / pass / top_pick records |
| `conversations` + `messages` | Realtime chat |
| `conversation_participants` | Chat access control |
| `blocks` | Blocked user pairs (bidirectional discover filtering) |
| `reports` | User reports with reason + details |

### Key RPC Functions
- `match_peers_without_messages()` — mutual likes with no conversation yet
- `get_or_create_match_conversation(other_user_id)` — idempotent DM thread creation
- `get_unread_counts(conversation_ids[])` — unread count per conversation

## Locked Decisions
- Photos come last in onboarding (reveal moment)
- No user_type branching — `has_listing` boolean handles place listings
- Dealbreakers: hard (removes from deck for premium) / soft (ranks lower) / none
- Matching weights: Lifestyle 35%, Interests 30%, Budget 20%, Dealbreakers 15%
- Match flow is mutual — both users notified simultaneously
- No ads, ever, on any tier
- RevenueCat for all subscription management

## License

_To be determined_
