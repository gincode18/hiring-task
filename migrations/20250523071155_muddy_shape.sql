/*
  # Seed data for chat application

  1. Demo Data
    - Create sample users
    - Create sample chats with different types
    - Add users to chats
    - Add sample messages
*/

-- Insert sample profiles (these UUIDs need to be manually inserted into auth.users table in Supabase dashboard)
INSERT INTO profiles (id, email, full_name, phone_number, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'user1@example.com', 'Periskope', '+91 99719 44008', now()),
  ('00000000-0000-0000-0000-000000000002', 'user2@example.com', 'Roshnag Airtel', '+91 63646 47925', now()),
  ('00000000-0000-0000-0000-000000000003', 'user3@example.com', 'Test El Centro', NULL, now()),
  ('00000000-0000-0000-0000-000000000004', 'user4@example.com', 'Bharat Kumar Ramesh', NULL, now()),
  ('00000000-0000-0000-0000-000000000005', 'user5@example.com', 'Swapnika', '+91 92896 65999', now());

-- Create chats
INSERT INTO chats (id, name, type, created_by, is_demo, is_internal, is_signup, is_content, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'Test El Centro', 'group', '00000000-0000-0000-0000-000000000001', true, false, false, false, now()),
  ('00000000-0000-0000-0000-000000000102', 'Test Skope Final 5', 'group', '00000000-0000-0000-0000-000000000002', true, false, false, false, now()),
  ('00000000-0000-0000-0000-000000000103', 'Periskope Team Chat', 'group', '00000000-0000-0000-0000-000000000001', true, true, false, false, now()),
  ('00000000-0000-0000-0000-000000000104', NULL, 'direct', '00000000-0000-0000-0000-000000000001', true, false, true, false, now()),
  ('00000000-0000-0000-0000-000000000105', 'Test Demo17', 'group', '00000000-0000-0000-0000-000000000003', true, false, false, true, now()),
  ('00000000-0000-0000-0000-000000000106', 'Testing group', 'group', '00000000-0000-0000-0000-000000000004', true, false, false, false, now());

-- Add participants to chats
INSERT INTO chat_participants (chat_id, user_id, joined_at, role)
VALUES
  -- Test El Centro group
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', now(), 'admin'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', now(), 'member'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000003', now(), 'member'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000004', now(), 'member'),
  
  -- Test Skope Final 5 group
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', now(), 'member'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000002', now(), 'admin'),
  
  -- Periskope Team Chat
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', now(), 'admin'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000004', now(), 'member'),
  
  -- Direct chat with Swapnika
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', now(), 'member'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000005', now(), 'member'),
  
  -- Test Demo17
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', now(), 'member'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000003', now(), 'admin'),
  
  -- Testing group
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001', now(), 'member'),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000004', now(), 'admin');

-- Add sample messages
INSERT INTO messages (chat_id, user_id, content, created_at, is_read)
VALUES
  -- Test El Centro group messages
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', 'CDERT', now() - interval '2 hours', true),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', 'CVFER', now() - interval '2.5 hours', true),
  
  -- Periskope Team Chat messages
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Periskope: Test message', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'hello', now() - interval '2 hours', true),
  
  -- Direct chat with Swapnika
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000005', 'Hi there, I''m Swapnika, Co-Founder of...', now() - interval '1 day', true),
  
  -- Test Demo17
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000003', 'Rohosen: 123', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000002', 'Hello, South Euna!', now() - interval '15 hours', true),
  
  -- Test El Centro (additional)
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000003', 'Roshnag: Hello, Ahmadport!', now() - interval '3 days', true),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', 'Hello, Livonia!', now() - interval '1 day', true),
  
  -- Testing group
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000004', 'Testing 12345', now() - interval '4 days', true),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001', 'test el centro', now() - interval '10 hours', false),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001', 'testing', now() - interval '5 hours', false);

-- Update last_message_at in chats
UPDATE chats
SET last_message_at = (
  SELECT MAX(created_at) 
  FROM messages 
  WHERE messages.chat_id = chats.id
);