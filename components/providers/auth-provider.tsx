"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Session, User } from "@supabase/supabase-js";
import { userDataDAO } from "@/lib/user-data-dao";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, avatarUrl?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const createProfile = async (user: User, fullName?: string, avatarUrl?: string | null) => {
    try {
      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existingProfile) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: fullName || user.user_metadata?.full_name || 'User',
            avatar_url: avatarUrl || null,
            created_at: new Date().toISOString(),
          });

        if (profileError) {
          console.error("Error creating profile:", profileError);
          return false;
        }
        console.log("Profile created successfully for user:", user.id);
        return true;
      }
      return true;
    } catch (error) {
      console.error("Error in createProfile:", error);
      return false;
    }
  };

  useEffect(() => {
    const fetchSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Error fetching session:", error);
      }
      
      setSession(data.session);
      setUser(data.session?.user || null);
      
      // Initialize user session with DAO if user exists
      if (data.session?.user) {
        try {
          await userDataDAO.initializeUserSession(data.session.user.id);
        } catch (error) {
          console.error("Error initializing user session with DAO:", error);
        }
      }
      
      setIsLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth event:", event, "Session:", !!session);
        setSession(session);
        setUser(session?.user || null);
        
        // Handle data clearing and session management with DAO
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            // Initialize user session and clear previous data
            await userDataDAO.initializeUserSession(session.user.id);
            // Handle profile creation for signed in users
            await createProfile(session.user);
          } catch (error) {
            console.error("Error during sign in with DAO:", error);
          }
        } else if (event === 'SIGNED_OUT') {
          try {
            // Terminate user session and clear all data
            await userDataDAO.terminateUserSession();
          } catch (error) {
            console.error("Error during sign out with DAO:", error);
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Token refresh shouldn't clear data, just update user tracking
          try {
            const currentUserId = userDataDAO.getCurrentUserId();
            if (currentUserId !== session.user.id) {
              // Different user somehow, reinitialize
              await userDataDAO.initializeUserSession(session.user.id);
            }
          } catch (error) {
            console.error("Error during token refresh with DAO:", error);
          }
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      // Don't navigate immediately, let the auth state change handle it
      if (data.session) {
        router.push("/chat");
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, avatarUrl?: string | null) => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) {
        throw error;
      }

      // If user is immediately available (no email confirmation required)
      if (data.user && data.session) {
        // Wait a bit for the session to be established
        setTimeout(async () => {
          await createProfile(data.user!, fullName, avatarUrl);
        }, 1000);
        router.push("/chat");
      } else {
        router.push("/login");
      }

    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      // The auth state change will handle the DAO cleanup
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error during sign out:", error);
      // Force cleanup even if signOut fails
      try {
        await userDataDAO.terminateUserSession();
      } catch (daoError) {
        console.error("Error during DAO cleanup after failed signOut:", daoError);
      }
      router.push("/login");
    }
  };

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};