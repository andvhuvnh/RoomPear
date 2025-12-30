/**
 * Integration tests for authentication flow
 * 
 * These tests require a valid Supabase instance.
 * Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
 * 
 * Run with: npm test -- auth.test.ts
 */

import { supabase } from '../../lib/supabase';

// Test user credentials (use a test email that you can verify)
const TEST_EMAIL = `test-${Date.now()}@roompear.test`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Test User';
const TEST_PHONE = '555-123-4567';

describe('Authentication Flow', () => {
  // Clean up: delete test user after tests
  afterAll(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Sign Up', () => {
    it('should create a new user account with name and phone', async () => {
      const { data, error } = await supabase.auth.signUp({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        options: {
          data: {
            name: TEST_NAME,
            phone: TEST_PHONE,
          },
        },
      });

      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user?.email).toBe(TEST_EMAIL);
    }, 10000); // 10 second timeout

    it('should reject duplicate email signup', async () => {
      const { error } = await supabase.auth.signUp({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        options: {
          data: {
            name: TEST_NAME,
            phone: TEST_PHONE,
          },
        },
      });

      // Should fail because email already exists
      expect(error).toBeDefined();
      expect(error?.message).toContain('already registered');
    }, 10000);

    it('should reject weak passwords', async () => {
      const { error } = await supabase.auth.signUp({
        email: `test-weak-${Date.now()}@roompear.test`,
        password: '123', // Too short
      });

      expect(error).toBeDefined();
    }, 10000);
  });

  describe('Sign In', () => {
    it('should sign in with valid credentials', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      expect(error).toBeNull();
      expect(data.session).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.user?.email).toBe(TEST_EMAIL);
    }, 10000);

    it('should reject invalid email', async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'nonexistent@roompear.test',
        password: TEST_PASSWORD,
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('Invalid login');
    }, 10000);

    it('should reject invalid password', async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: 'WrongPassword123!',
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('Invalid login');
    }, 10000);
  });

  describe('Session Management', () => {
    it('should retrieve current session', async () => {
      // First sign in
      await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      const { data, error } = await supabase.auth.getSession();

      expect(error).toBeNull();
      expect(data.session).toBeDefined();
      expect(data.session?.user.email).toBe(TEST_EMAIL);
    }, 10000);

    it('should sign out successfully', async () => {
      const { error } = await supabase.auth.signOut();

      expect(error).toBeNull();

      // Verify session is cleared
      const { data } = await supabase.auth.getSession();
      expect(data.session).toBeNull();
    }, 10000);
  });
});

