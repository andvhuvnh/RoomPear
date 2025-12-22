// Type definitions for RoomPear
// TODO: Generate these from Supabase schema using: npx supabase gen types typescript

export type User = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  profile_photo_url?: string;
  bio?: string;
  age?: number;
  occupation?: string;
  created_at: string;
  updated_at: string;
};

export type Listing = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude?: number;
  longitude?: number;
  price: number;
  room_type: 'private' | 'shared' | 'entire';
  available_date: string;
  status: 'active' | 'filled' | 'archived';
  created_at: string;
  updated_at: string;
};

export type Preference = {
  user_id: string;
  location?: string;
  min_budget?: number;
  max_budget?: number;
  room_type?: 'private' | 'shared' | 'entire';
  move_in_date?: string;
  pets_allowed?: boolean;
  smoking_allowed?: boolean;
  cleanliness_level?: number;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  listing_id?: string;
  content: string;
  created_at: string;
  read_at?: string;
};

