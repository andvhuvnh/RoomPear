# Quick Start - Remote Supabase (No Docker Needed)

## Step 1: Get Your Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. You'll see:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## Step 2: Connect Supabase to local 

```bash
cd backend/supabase
supabase login
# Follow the prompts to authenticate

# Link your project (you'll need your project reference ID)
# Find it in your project settings or URL
supabase link --project-ref <your-project-ref>

```

## Step 3: Create .env File

Create `apps/mobile/.env`:
```env
EXPO_PUBLIC_SUPABASE_URL= *fill in values from supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY= *fill in values from supabase
```

## Step 4: Restart Expo

```bash
cd apps/mobile
# Stop current Expo if running (Ctrl+C)
npm start
# Then press 'w' for web
```