export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      chats: {
        Row: {
          id: string
          name: string | null
          type: string
          created_at: string
          created_by: string
          is_demo: boolean
          is_internal: boolean
          is_signup: boolean
          is_content: boolean
          last_message_at: string | null
        }
        Insert: {
          id?: string
          name?: string | null
          type: string
          created_at?: string
          created_by: string
          is_demo?: boolean
          is_internal?: boolean
          is_signup?: boolean
          is_content?: boolean
          last_message_at?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          type?: string
          created_at?: string
          created_by?: string
          is_demo?: boolean
          is_internal?: boolean
          is_signup?: boolean
          is_content?: boolean
          last_message_at?: string | null
        }
      }
      chat_participants: {
        Row: {
          id: string
          chat_id: string
          user_id: string
          joined_at: string
          role: string
          is_muted: boolean
          is_pinned: boolean
        }
        Insert: {
          id?: string
          chat_id: string
          user_id: string
          joined_at?: string
          role?: string
          is_muted?: boolean
          is_pinned?: boolean
        }
        Update: {
          id?: string
          chat_id?: string
          user_id?: string
          joined_at?: string
          role?: string
          is_muted?: boolean
          is_pinned?: boolean
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          user_id: string
          content: string
          created_at: string
          is_read: boolean
          read_at: string | null
          type: string
        }
        Insert: {
          id?: string
          chat_id: string
          user_id: string
          content: string
          created_at?: string
          is_read?: boolean
          read_at?: string | null
          type?: string
        }
        Update: {
          id?: string
          chat_id?: string
          user_id?: string
          content?: string
          created_at?: string
          is_read?: boolean
          read_at?: string | null
          type?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          phone_number: string | null
          created_at: string
          last_seen: string | null
        }
        Insert: {
          id: string
          email: string
          full_name: string
          avatar_url?: string | null
          phone_number?: string | null
          created_at?: string
          last_seen?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          phone_number?: string | null
          created_at?: string
          last_seen?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}