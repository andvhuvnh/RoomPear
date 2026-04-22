export const DEALBREAKER_ITEMS = [
  { key: 'smoking', label: 'Smoking indoors' },
  { key: 'pets', label: 'Pets in the unit' },
  { key: 'parties', label: 'Frequent parties' },
  { key: 'early_bird', label: 'Noise before 8 am' },
  { key: 'night_owl', label: 'Noise after 11 pm' },
  { key: 'guests', label: 'Overnight guests' },
  { key: 'messy', label: 'Messy common areas' },
] as const;

export const INTEREST_CATEGORIES = [
  {
    key: 'fitness',
    label: '🏃 Fitness',
    options: ['Running', 'Yoga', 'Gym', 'Hiking', 'Swimming', 'Cycling', 'Rock Climbing'],
  },
  {
    key: 'food',
    label: '🍕 Food & Drink',
    options: ['Cooking', 'Baking', 'Coffee', 'Wine & Cocktails', 'Foodie Adventures', 'Meal Prep'],
  },
  {
    key: 'arts',
    label: '🎨 Arts & Culture',
    options: ['Movies', 'Music', 'Reading', 'Photography', 'Art Galleries', 'Theater'],
  },
  {
    key: 'outdoors',
    label: '🌿 Outdoors',
    options: ['Camping', 'Travel', 'Beach', 'Gardening', 'Road Trips', 'Surfing'],
  },
  {
    key: 'tech',
    label: '🎮 Tech & Gaming',
    options: ['Gaming', 'Coding', 'Podcasts', 'Anime', 'Board Games', 'VR / AR'],
  },
] as const;

export const PROMPTS = [
  'My ideal Saturday morning looks like…',
  "I'm looking for a roommate who…",
  "Don't room with me if you hate…",
  'My morning routine is…',
  "On weeknights you'll find me…",
  'Weekends are for…',
  'I clean the apartment…',
  'My noise level is…',
  'Overnight guests are…',
  'My kitchen rule is…',
  'My sleep schedule is…',
  "I've lived with roommates before and learned…",
  'A quirk about living with me…',
  'My ideal apartment vibe…',
  'After work I usually…',
  'The best thing about me as a roommate…',
] as const;

export const MAX_LISTING_PHOTOS = 6;
export const FILM_STRIP_GAP = 12;
export const FILM_STRIP_HEIGHT_FACTOR = 1.45;
