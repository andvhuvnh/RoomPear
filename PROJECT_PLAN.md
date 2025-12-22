# RoomPear Project Plan

## Overview
RoomPear is a platform connecting people looking for housing and roommates. Users can post listings, search for compatible roommates, set preferences, and communicate through an in-app chat system.

## Feature Breakdown

### Feature 1: Find Other Users Looking for Apartment/Housing
**User Story:** As a user, I want to browse and search for other users who are looking for housing so I can find potential roommates.

**Requirements:**
- User search/browse interface
- Filter by:
  - Location (city, neighborhood, radius)
  - Budget range
  - Move-in date
  - Preferences (pets, smoking, etc.)
- User profile cards/list view
- Compatibility indicators
- Pagination/infinite scroll

**Technical Considerations:**
- Search algorithm (full-text search, geolocation)
- Database indexing for performance
- Caching for popular searches

---

### Feature 2: Set Preferences for Housing
**User Story:** As a user, I want to set my housing preferences so the system can match me with compatible listings and roommates.

**Requirements:**
- Preference form/settings page
- Fields:
  - Location (address, city, preferred neighborhoods)
  - Budget (min/max rent)
  - Room type (private, shared, entire unit)
  - Move-in date range
  - Lease duration preference
  - Lifestyle preferences:
    - Pets (have/allow)
    - Smoking (smoker/non-smoker)
    - Cleanliness level
    - Social vs quiet
    - Work schedule
  - Must-haves (parking, laundry, etc.)
- Save and update preferences
- Use preferences for matching algorithm

**Technical Considerations:**
- Preference schema in database
- Matching algorithm logic
- Preference validation

---

### Feature 3: Chat with Other Users
**User Story:** As a user, I want to chat with other users who posted listings or are interested in my listing so we can discuss housing details.

**Requirements:**
- Real-time messaging interface
- Chat list/conversations view
- Individual chat threads
- Message notifications
- Read receipts (optional)
- Image/file sharing (optional)
- Block/report user functionality

**Technical Considerations:**
- WebSocket/real-time connection
- Message storage and history
- Notification system (push, email)
- Rate limiting for spam prevention
- Message encryption for privacy

---

### Feature 4: Post Housing for Other Users to See
**User Story:** As a user, I want to post housing listings so others can see available housing and contact me.

**Requirements:**
- Create listing form:
  - Address/location
  - Price/rent
  - Room type
  - Available date
  - Description
  - Photos (multiple)
  - Amenities checklist
  - House rules/preferences
- Edit/delete listings
- Mark listing as filled/available
- Listing visibility settings
- View listing analytics (views, inquiries)

**Technical Considerations:**
- Image upload and storage
- Geocoding for addresses
- Listing search/filter functionality
- Listing moderation (spam, inappropriate content)

---

### Feature 5: Payment Tiers & Restrictions
**User Story:** As a business, I want to offer different subscription tiers so I can monetize the platform while providing value to free users.

**Requirements:**
- Free tier:
  - Basic profile
  - Limited listings (e.g., 1 active listing)
  - Basic search
  - Limited messages per day
- Premium tier:
  - Unlimited listings
  - Advanced search filters
  - Priority in search results
  - Unlimited messages
  - Profile verification badge
  - Analytics dashboard
- Payment integration
- Subscription management
- Feature gating in UI/backend

**Technical Considerations:**
- Payment processor integration (Stripe, PayPal)
- Subscription management system
- Feature flag system
- Billing and invoicing
- Refund handling

---

### Feature 6: User Profile
**User Story:** As a user, I want to create a profile so other users can learn about me and decide if we'd be compatible roommates.

**Requirements:**
- Profile creation/editing:
  - Profile photo
  - Bio/description
  - Age (optional)
  - Occupation
  - Interests/hobbies
  - Social media links (optional)
  - Verification status
- Public profile view
- Privacy settings
- Profile completeness indicator

**Technical Considerations:**
- Image upload and storage
- Profile data validation
- Privacy controls
- Profile search indexing

---

## Database Schema (Initial Draft)

### Users
- id, email, password_hash, name, phone, created_at, updated_at
- profile fields: bio, age, occupation, profile_photo_url
- subscription_tier, subscription_expires_at

### Preferences
- user_id, location, min_budget, max_budget, room_type, move_in_date
- pets_allowed, smoking_allowed, cleanliness_level, etc.

### Listings
- id, user_id, title, description, address, city, state, zip_code
- latitude, longitude, price, room_type, available_date
- created_at, updated_at, status (active/filled/archived)

### Listing_Photos
- id, listing_id, photo_url, order_index

### Messages
- id, sender_id, receiver_id, listing_id (optional), content
- created_at, read_at

### Conversations
- id, user1_id, user2_id, listing_id (optional), last_message_at

---

## API Endpoints (Initial Draft)

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

### Users
- GET /api/users (search/browse)
- GET /api/users/:id
- PUT /api/users/:id
- GET /api/users/:id/preferences
- PUT /api/users/:id/preferences

### Listings
- GET /api/listings (search/filter)
- GET /api/listings/:id
- POST /api/listings
- PUT /api/listings/:id
- DELETE /api/listings/:id

### Messages
- GET /api/conversations
- GET /api/conversations/:id/messages
- POST /api/conversations/:id/messages

### Payments
- POST /api/subscriptions
- GET /api/subscriptions/current
- PUT /api/subscriptions/cancel

---

## Security Considerations
- Password hashing (bcrypt)
- JWT tokens for authentication
- Rate limiting
- Input validation and sanitization
- SQL injection prevention
- XSS prevention
- CSRF protection
- Secure file uploads
- Privacy controls for user data

---

## Next Steps
1. Choose tech stack
2. Set up development environment
3. Design database schema in detail
4. Create API documentation
5. Set up authentication
6. Build MVP with core features
7. Test and iterate

