# RoomPear Mobile App

Expo (React Native) mobile application for RoomPear.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in this directory with your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your-supabase-project-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
   
   Get these values from your Supabase project settings: https://app.supabase.com/project/_/settings/api

3. **Start the development server:**
   ```bash
   npm start
   ```

## Available Scripts

- `npm start` - Start Expo dev server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS device/simulator
- `npm run web` - Run in web browser

## Project Structure

```
apps/mobile/
├── lib/
│   ├── supabase.ts    # Supabase client configuration
│   └── types.ts       # TypeScript type definitions
├── App.tsx            # Main app component
├── app.config.js      # Expo configuration
└── package.json
```

## Supabase Integration

The Supabase client is configured in `lib/supabase.ts`. Import it in your components:

```typescript
import { supabase } from './lib/supabase';
```

## Development

This app uses:
- **Expo** - React Native framework
- **TypeScript** - Type safety
- **Supabase** - Backend (database, auth, storage)

