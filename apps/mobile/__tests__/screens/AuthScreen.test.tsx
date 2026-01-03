/**
 * Component tests for AuthScreen (matches current AuthScreen.tsx)
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AuthScreen from '../../screens/AuthScreen';
import { supabase } from '../../lib/supabase';

// Mock Supabase
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signInWithOAuth: jest.fn(),
    },
  },
}));

// Silence + assert Alerts
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('AuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render sign in form by default', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(<AuthScreen />);

    // Sign-in mode: no name/phone inputs
    expect(getByPlaceholderText('you@example.com')).toBeDefined();
    expect(getByPlaceholderText('••••••••')).toBeDefined();
    expect(getByText('Continue')).toBeDefined();
    expect(getByText('Continue with Google')).toBeDefined();

    expect(queryByText('Your name')).toBeNull();
    expect(queryByText('(555) 123-4567')).toBeNull();
  });

  it('should switch to sign up mode', () => {
    const { getByText, getByPlaceholderText } = render(<AuthScreen />);

    fireEvent.press(getByText("Don't have an account? Sign Up"));

    expect(getByPlaceholderText('Your name')).toBeDefined();
    expect(getByPlaceholderText('(555) 123-4567')).toBeDefined();
    expect(getByPlaceholderText('you@example.com')).toBeDefined();
    expect(getByPlaceholderText('••••••••')).toBeDefined();
    expect(getByText('Create account')).toBeDefined();
  });

  it('should validate required fields on sign in', async () => {
    const { getByText, queryByText } = render(<AuthScreen />);

    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(queryByText('Please fill in all fields')).toBeTruthy();
    });

    expect(Alert.alert).toHaveBeenCalled();
  });

  it('should call signInWithPassword with correct credentials', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: { id: '1', email: 'test@test.com' }, session: {} },
      error: null,
    });

    const { getByPlaceholderText, getByText } = render(<AuthScreen />);

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'password123');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password123',
      });
    });
  });

  it('should display error message on failed sign in', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' },
    });

    const { getByPlaceholderText, getByText, queryByText } = render(<AuthScreen />);

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'wrongpassword');
    fireEvent.press(getByText('Continue'));

    await waitFor(() => {
      expect(queryByText('Invalid credentials')).toBeTruthy();
    });

    expect(Alert.alert).toHaveBeenCalled();
  });

  it('should call signUp with correct data including name and phone', async () => {
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { user: { id: '1', email: 'test@test.com' }, session: null },
      error: null,
    });

    const { getByText, getByPlaceholderText } = render(<AuthScreen />);

    // Switch to sign up
    fireEvent.press(getByText("Don't have an account? Sign Up"));

    fireEvent.changeText(getByPlaceholderText('Your name'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('(555) 123-4567'), '555-123-4567');
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'password123');

    fireEvent.press(getByText('Create account'));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password123',
        options: {
          data: {
            name: 'Test User',
            phone: '555-123-4567',
          },
        },
      });
    });
  });

  it('should validate required fields on sign up', async () => {
    const { getByText, queryByText } = render(<AuthScreen />);

    fireEvent.press(getByText("Don't have an account? Sign Up"));
    fireEvent.press(getByText('Create account'));

    await waitFor(() => {
      expect(queryByText(/Please fill in all required fields:/)).toBeTruthy();
    });

    expect(Alert.alert).toHaveBeenCalled();
  });

  it('should show Google placeholder alert when Google button pressed', async () => {
    const { getByText } = render(<AuthScreen />);

    fireEvent.press(getByText('Continue with Google'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Coming soon',
        'Google sign-in will be available soon.'
      );
    });
  });

  it('should show Apple placeholder alert on iOS when Apple button pressed', async () => {
    // Force Platform to iOS so the Apple button is rendered
    const rn = require('react-native');
    rn.Platform.OS = 'ios';

    const { getByText } = render(<AuthScreen />);

    fireEvent.press(getByText('Continue with Apple'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Coming soon',
        'Apple sign-in will be available soon.'
      );
    });
  });

  it('should show Facebook placeholder alert when Facebook button pressed', async () => {
    const { getByText } = render(<AuthScreen />);

    fireEvent.press(getByText('Continue with Facebook'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Coming soon',
        'Facebook sign-in will be available soon.'
      );
    });
  });

});
