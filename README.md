# RoomPear

A platform for finding roommates and housing. Connect with other users looking for apartments/housing, set preferences, chat, and post listings.

## Features

### Feature 1: Find Other Users Looking for Apartment/Housing
- Browse/search for users seeking housing
- Filter by location, budget, preferences
- View user profiles and compatibility

### Feature 2: Set Preferences for Housing
- Location preferences (neighborhood, city, radius)
- Budget range (min/max rent)
- Room type preferences (private room, shared, entire unit)
- Move-in date
- Lifestyle preferences (pets, smoking, etc.)

### Feature 3: Chat with Other Users
- Real-time messaging system
- In-app chat interface
- Message notifications
- Chat history

### Feature 4: Post Housing for Other Users to See
- Create housing listings
- Upload photos
- Set listing details (price, location, amenities, etc.)
- Manage listings (edit, delete, mark as filled)

### Feature 5: Payment Tiers & Restrictions
- Free tier: Basic features
- Premium tier: Enhanced visibility, advanced filters
- Subscription management
- Feature restrictions based on tier

### Feature 6: User Profile
- Profile creation and editing
- Profile photos
- Bio and preferences display
- Verification badges
- Social links

## Tech Stack

- **Backend**: Supabase (PostgreSQL, Auth, Real-time, Storage, Edge Functions)
- **Mobile**: Expo (React Native)
- **Web**: Next.js (planned)
- **Shared**: Monorepo with shared packages for UI and config
- **Payment**: Stripe (planned)

## Project Structure

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
├── docs/
│   ├── architecture.md
│   ├── decisions.md
│   └── PROJECT_PLAN.md
├── .gitignore
└── README.md
```

## Getting Started

_Instructions to be added once tech stack is decided_

## Development Roadmap

### Phase 1: Foundation
- [x] Set up project structure (monorepo)
- [x] Choose and set up tech stack (Supabase)
- [ ] Initialize Supabase project
- [ ] Database schema design and migrations
- [ ] Set up Expo mobile app
- [ ] Authentication system (Supabase Auth)

### Phase 2: Core Features
- [ ] User profiles (Feature 6)
- [ ] Housing preferences (Feature 2)
- [ ] Housing listings (Feature 4)
- [ ] User search/browse (Feature 1)

### Phase 3: Communication
- [ ] Chat system (Feature 3)
- [ ] Notifications

### Phase 4: Monetization
- [ ] Payment integration
- [ ] Tier system (Feature 5)
- [ ] Feature restrictions

### Phase 5: Polish & Launch
- [ ] Testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Deployment

## License

_To be determined_

