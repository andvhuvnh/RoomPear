# Quick Setup Guide

## Option 1: Local Supabase (Recommended for Development)

### Step 1: Install Supabase CLI
```bash
npm install -g supabase
```

### Step 2: Start Local Supabase
```bash
cd backend/supabase
supabase start
```

This will:
- Start a local PostgreSQL database
- Start Supabase API server
- Apply all migrations automatically
- Give you local credentials

### Step 3: Get Local Credentials
After `supabase start`, you'll see output like:
```
API URL: http://127.0.0.1:54321
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 4: Create .env file in apps/mobile/
```bash
cd ../../apps/mobile
```

Create `.env` file with:
```env
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<the-anon-key-from-step-3>
```

### Step 5: Restart Expo
```bash
npm start
# Then press 'w' for web or run: npm run web
```

---

## Option 2: Remote Supabase (Cloud)

### Step 1: Create Supabase Project
1. Go to https://app.supabase.com
2. Create a new project
3. Wait for it to finish setting up

### Step 2: Get Credentials
1. Go to Settings → API
2. Copy:
   - Project URL
   - anon public key

### Step 3: Link and Push Migrations
```bash
cd backend/supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

### Step 4: Create .env file in apps/mobile/
```env
EXPO_PUBLIC_SUPABASE_URL=<your-project-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### Step 5: Restart Expo
```bash
cd apps/mobile
npm start
```

---

## Troubleshooting

**"Failed to fetch" error:**
- Make sure Supabase is running (local) or project is active (cloud)
- Check that .env file has correct credentials
- Restart Expo after changing .env

**Migrations not applied:**
- Local: `supabase db reset` in backend/supabase/
- Remote: `supabase db push` in backend/supabase/

