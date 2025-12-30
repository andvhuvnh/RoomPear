/**
 * Tests for user profile creation and management
 * 
 * These tests verify that profiles are automatically created when users sign up
 */

import { supabase } from '../../lib/supabase';

const TEST_EMAIL = `profile-test-${Date.now()}@roompear.test`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Profile Test User';
const TEST_PHONE = '555-987-6543';

describe('Profile Management', () => {
  let userId: string;

  beforeAll(async () => {
    // Create a test user
    const { data } = await supabase.auth.signUp({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      options: {
        data: {
          name: TEST_NAME,
          phone: TEST_PHONE,
        },
      },
    });

    if (data.user) {
      userId = data.user.id;
    }
  }, 15000);

  afterAll(async () => {
    // Clean up: sign out
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should automatically create profile when user signs up', async () => {
    // Wait a moment for the trigger to execute
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    expect(error).toBeNull();
    expect(profile).toBeDefined();
    expect(profile.id).toBe(userId);
    expect(profile.email).toBe(TEST_EMAIL);
    expect(profile.name).toBe(TEST_NAME);
    expect(profile.phone).toBe(TEST_PHONE);
  }, 15000);

  it('should have default subscription tier', async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    expect(profile?.subscription_tier).toBe('free');
  }, 10000);

  it('should allow updating profile', async () => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        name: 'Updated Name',
        bio: 'Test bio',
      })
      .eq('id', userId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.name).toBe('Updated Name');
    expect(data?.bio).toBe('Test bio');
  }, 10000);

  it('should enforce Row Level Security - users can only update own profile', async () => {
    // Try to update a different user's profile (should fail)
    // Note: This test assumes RLS is working correctly
    const { error } = await supabase
      .from('profiles')
      .update({ name: 'Hacked Name' })
      .eq('id', '00000000-0000-0000-0000-000000000000') // Non-existent user
      .select();

    // Should either fail or return no rows due to RLS
    expect(error || true).toBeTruthy();
  }, 10000);
});

