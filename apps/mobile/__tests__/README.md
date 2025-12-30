# Authentication Tests

This directory contains tests to validate the authentication setup before pushing to production.

## Test Structure

### Unit Tests
- `lib/supabase.test.ts` - Tests Supabase client initialization and configuration

### Integration Tests
- `auth/auth.test.ts` - Tests authentication flow (sign up, sign in, sign out)
- `auth/profile.test.ts` - Tests profile creation and management

### Component Tests
- `screens/AuthScreen.test.tsx` - Tests the authentication UI component

## Running Tests

### Run all tests:
```bash
npm test
```

### Run tests in watch mode:
```bash
npm run test:watch
```

### Run with coverage:
```bash
npm run test:coverage
```

### Run specific test file:
```bash
npm test -- auth.test.ts
```

## Test Requirements

### For Unit Tests (supabase.test.ts)
- No setup required
- Tests Supabase client initialization with different configurations

### For Integration Tests (auth.test.ts, profile.test.ts)
- **Requires valid Supabase credentials** in `.env` file
- **Requires database migrations** to be applied
- Creates test users (cleaned up after tests)
- These tests make actual API calls to Supabase

### For Component Tests (AuthScreen.test.tsx)
- No setup required
- Uses mocked Supabase client

## Before Pushing

Run these tests to validate:

1. ✅ Supabase client initializes correctly
2. ✅ Users can sign up
3. ✅ Users can sign in
4. ✅ Profiles are automatically created
5. ✅ Authentication UI works correctly

## Important Notes

- Integration tests create real users in your Supabase database
- Test users use timestamps to avoid conflicts
- Tests clean up after themselves, but check your database if tests fail
- Make sure your `.env` file has valid Supabase credentials before running integration tests

