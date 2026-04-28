# RoomPear — Product Spec

## What is RoomPear?

RoomPear is a mobile roommate-matching app built like a dating app. Users swipe on profiles, match mutually, and chat. Think Hinge but for finding a compatible roommate. Launching at UC Riverside, targeting college students.

---

## Free vs Premium (RoomPear+)

### Free Tier
| Feature | Limit |
|---------|-------|
| Swipes per day | 10 |
| Top Picks per day | 1 |
| Free reveals (Likes tab) | 1 per day |
| See who liked you | Blurred grid only |
| Messaging matched users | Unlimited |
| Filters | Basic (location, budget) |
| Pets/smoking hard filter | ❌ — ranked lower instead |
| Advanced deck filters | ❌ |
| Ads | Never |

### RoomPear+ (Premium)
| Feature | Limit |
|---------|-------|
| Swipes per day | Unlimited |
| Top Picks per day | Unlimited |
| See who liked you | Full unblurred grid |
| Pets/smoking hard filter | ✅ — excluded from deck entirely |
| Advanced deck filters | ✅ (move-in date window, room type, soft dealbreakers) |
| Messaging matched users | Unlimited |
| Ads | Never |

### Free Reveal Paths (Likes Tab)
Ways a free user can reveal who liked them without paying:
1. **Swipe naturally** — when you like someone who already liked you, it's a match and both profiles reveal
2. **Complete your profile** — unlock a one-time bonus reveal for filling out bio, photos, and prompts
3. **Daily free reveal** — 1 free reveal resets every day
4. **Invite a friend** — share your referral code; when a friend joins and applies it, you both get +1 bonus reveal

---

## Matching Algorithm

Profiles are scored and ranked through 4 layers:

### Layer 1 — Hard Filters (applied for all users)
Profiles that fail hard filters are removed from the deck entirely.

| Filter | Logic |
|--------|-------|
| Same state | Both users must have the same state set |
| Budget overlap | `max(mine.min, theirs.min) ≤ min(mine.max, theirs.max)` |
| Parties dealbreaker (hard) | Excludes profiles with `social_preference = social` |
| Early bird dealbreaker (hard) | Excludes profiles with `work_schedule = Night Shift` |
| Night owl dealbreaker (hard) | Excludes profiles with `work_schedule = 9-to-5` |
| Messy dealbreaker (hard) | Excludes profiles with `cleanliness_level ≤ 2` |
| Pets dealbreaker (hard) | **Premium only** — excludes profiles with `pets_allowed = true` |
| Smoking dealbreaker (hard) | **Premium only** — excludes profiles with `smoking_allowed = true` |

> Free users with pets/smoking set as hard dealbreakers will still see those profiles — they just rank lower in the deck.

### Layer 2 — Compatibility Score
Each candidate is scored 0–1 across four dimensions, then combined:

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Lifestyle | 35% | Cleanliness, work schedule, social vibe alignment |
| Interests | 30% | Shared interest tags across categories |
| Budget | 20% | How closely rent ranges overlap |
| Dealbreakers | 15% | Soft conflicts (smoking, pets, parties, etc.) |

### Layer 3 — Boost Factors
Applied on top of the compatibility score:

| Boost | Multiplier | Condition |
|-------|-----------|-----------|
| Profile completeness | ×1.0–1.20 | Based on how filled-out the profile is (name, age, bio, photos, prompts) |
| Premium user | ×1.10 | Candidate has RoomPear+ |
| New user | ×1.15 | Account created within the last 48 hours |
| Recently active | ×1.05 | Profile updated within the last 7 days |

### Layer 4 — Wildcard Mix
Final deck composition: **80% top scorers + 20% random** from lower-scored profiles. This prevents the deck from becoming a pure echo chamber and gives lower-compatibility profiles a chance to appear.

---

## Dealbreakers

Each dealbreaker has three states:

| State | Effect |
|-------|--------|
| **Hard** | Removes the profile from the deck entirely (pets/smoking: premium only) |
| **Soft** | Profile stays in the deck but scores lower |
| **None** | No effect — ignored entirely |

### Available Dealbreakers
- Smoking indoors in the unit
- Pets living in the unit
- Frequent house parties
- Noise before 8am (early bird)
- Night owl hours
- Overnight guests regularly

---

## Discover Filters

### Basic Filters (all users)
Available via the filter panel on Discover:
- Budget range (min/max)
- Move-in date
- Lease length
- Room type (private / shared / entire / flexible)
- Has listing only (only show people with a place to offer)
- Ethnicity preference
- Gender preference

### Advanced Filters (premium only)
Applied automatically when premium is active:
- Move-in date window — candidates must be within 60 days of your move-in date
- Room type must be compatible (no mismatched private vs shared)
- Soft dealbreakers also exclude profiles (not just hard ones)

---

## Daily Limits (Free Tier)

Limits reset at midnight local time.

| Action | Free Limit |
|--------|-----------|
| Swipes (like + pass) | 10 |
| Top Picks | 1 |
| Free reveals | 1 |

When a free user hits their swipe limit, a paywall is presented. Premium users have no daily limits.

---

## Paywall Triggers

The upgrade flow is presented when:
1. A free user taps a blurred profile in the Likes tab
2. A free user hits their daily swipe limit
3. A user taps "Upgrade to RoomPear+" in Settings

---

## Onboarding Flow (17 steps)

| Step | Screen | Required |
|------|--------|----------|
| 1 | Name | ✅ |
| 2 | Age | ✅ |
| 3 | Gender | Optional |
| 4 | Ethnicity + gender preference | Optional |
| 5 | Location (city/state/zip or Mapbox search) | ✅ |
| 6 | Budget (min/max slider) | ✅ |
| 7 | Room type | Optional |
| 8 | Move-in date | Optional |
| 9 | Cleanliness level (1–5) | Optional |
| 10 | Work schedule | Optional |
| 11 | Social vibe | Optional |
| 12 | Pets & smoking (self-report) | Optional |
| 13 | Dealbreakers (card sub-flow, hard/soft/none) | Optional |
| 14 | Interests (5 categories, up to 5 each) | Optional |
| 15 | Personality prompts (min 2, max 3) | ✅ (min 2) |
| 16 | Profile photos (min 2, max 4) | ✅ (min 2) |
| 17 | Place listing (add a room if you have one) | Optional |

---

## Profile Visibility

- **Active** — default state; visible in other users' discover decks
- **Paused** — hidden from discover entirely; existing matches and chats still work
  - Toggle in Settings → Visibility
  - Amber banner shown on your own profile tab when paused

---

## Block & Report

### Blocking
- Tap the flag icon on a swipe card or in a chat
- Confirm in the block dialog
- Blocked user is immediately removed from your deck (bidirectional — they won't see you either)
- Manage blocked users: Settings → Privacy & safety → Blocked users
- Unblock anytime from the Blocked Users list

### Reporting
- Same entry point as blocking (flag icon)
- Choose a reason: Fake profile / Inappropriate photos / Harassment / Spam or scam / Underage user / Other
- Optional details field
- Report is logged to the `reports` table for review
- Reporting does not automatically block (but block option is shown alongside)

---

## Referral System

- Every user gets a unique referral code
- Share your code with a friend
- When a friend signs up and applies your code, **both** get +1 bonus reveal on the Likes tab
- A user can only apply one referral code (tracked via `referred_by_user_id`)
- Referral code entry in Settings → Invite friends

---

## Push Notifications

| Event | Recipient | Message |
|-------|-----------|---------|
| Someone liked you | Liked user | "Someone liked your profile! 💚 Open RoomPear to see who it is." |
| Mutual match | Both users | "It's a Match! 🍐 You and [name] both want to be roommates!" |
| New message | Recipient | Standard new message notification |
