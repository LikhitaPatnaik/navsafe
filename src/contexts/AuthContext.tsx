import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  gender: string | null;
  age: number | null;
  phone: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const getAuthProfileSeed = (authUser: User) => ({
    email: authUser.email ?? null,
    full_name:
      authUser.user_metadata?.full_name ??
      authUser.user_metadata?.name ??
      null,
    avatar_url:
      authUser.user_metadata?.avatar_url ??
      authUser.user_metadata?.picture ??
      null,
  });

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data as Profile | null;
  };

  const createProfile = async (authUser: User) => {
    const seed = getAuthProfileSeed(authUser);

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        user_id: authUser.id,
        ...seed,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating profile:', error);
      return null;
    }

    return data as Profile;
  };

  const syncMissingProfileFields = async (authUser: User, existingProfile: Profile) => {
    const seed = getAuthProfileSeed(authUser);

    const updates: Partial<Profile> = {};
    if (!existingProfile.full_name && seed.full_name) updates.full_name = seed.full_name;
    if (!existingProfile.avatar_url && seed.avatar_url) updates.avatar_url = seed.avatar_url;
    if (!existingProfile.email && seed.email) updates.email = seed.email;

    if (Object.keys(updates).length === 0) {
      return existingProfile;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', authUser.id)
      .select()
      .single();

    if (error) {
      console.error('Error syncing profile fields:', error);
      return existingProfile;
    }

    return data as Profile;
  };

  const ensureProfile = async (authUser: User) => {
    const existingProfile = await fetchProfile(authUser.id);
    if (!existingProfile) {
      return await createProfile(authUser);
    }

    return await syncMissingProfileFields(authUser, existingProfile);
  };

  const refreshProfile = async () => {
    if (!user) return;
    const profileData = await ensureProfile(user);
    setProfile(profileData);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            ensureProfile(session.user).then((profileData) => {
              setProfile(profileData);
              setLoading(false);
            });
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        ensureProfile(session.user).then((profileData) => {
          setProfile(profileData);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
