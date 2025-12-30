/**
 * Component tests for AuthScreen
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AuthScreen from '../../screens/AuthScreen';
import { supabase } from '../../lib/supabase';

// Mock Supabase
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
    },
  },
}));

describe('AuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render sign in form by default', () => {
    const { getByPlaceholderText, getByText } = render(<AuthScreen />);
    
    expect(getByPlaceholderText('Email')).toBeDefined();
    expect(getByPlaceholderText('Password')).toBeDefined();
    expect(getByText('Sign In')).toBeDefined();
  });

  it('should switch to sign up mode', () => {
    const { getByText, getByPlaceholderText } = render(<AuthScreen />);
    
    fireEvent.press(getByText("Don't have an account? Sign Up"));
    
    expect(getByPlaceholderText('Name (optional)')).toBeDefined();
    expect(getByText('Sign Up')).toBeDefined();
  });

  it('should validate required fields on sign in', async () => {
    const { getByText, getByPlaceholderText } = render(<AuthScreen />);
    
    const signInButton = getByText('Sign In');
    fireEvent.press(signInButton);

    await waitFor(() => {
      expect(getByText('Please fill in all fields')).toBeDefined();
    });
  });

  it('should call signInWithPassword with correct credentials', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: { id: '1', email: 'test@test.com' }, session: {} },
      error: null,
    });

    const { getByPlaceholderText, getByText } = render(<AuthScreen />);
    
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@test.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password123',
      });
    });
  });

  it('should call signUp with correct data including name and phone', async () => {
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { user: { id: '1', email: 'test@test.com' }, session: null },
      error: null,
    });

    const { getByPlaceholderText, getByText } = render(<AuthScreen />);
    
    // Switch to sign up
    fireEvent.press(getByText("Don't have an account? Sign Up"));
    
    fireEvent.changeText(getByPlaceholderText('Name *'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('Phone Number *'), '555-123-4567');
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@test.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign Up'));

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
    const { getByText, getByPlaceholderText } = render(<AuthScreen />);
    
    // Switch to sign up
    fireEvent.press(getByText("Don't have an account? Sign Up"));
    
    const signUpButton = getByText('Sign Up');
    fireEvent.press(signUpButton);

    await waitFor(() => {
      expect(getByText(/Please fill in all required fields/)).toBeDefined();
    });
  });

  it('should display error message on failed sign in', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' },
    });

    const { getByPlaceholderText, getByText } = render(<AuthScreen />);
    
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@test.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'wrongpassword');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(getByText('Invalid credentials')).toBeDefined();
    });
  });
});

