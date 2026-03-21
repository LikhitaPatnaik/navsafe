import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';

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
      .maybeSingle();

    if (error) {
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
      if (error.code === '23505') {
        return await fetchProfile(authUser.id);
      }

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
    let profileData: Profile | null = null;

    try {
      profileData = await ensureProfile(user);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }

    setProfile(profileData);
  };

  const loadProfileForUser = async (authUser: User) => {
    try {
      const profileData = await ensureProfile(authUser);
      setProfile(profileData);
    } catch (error) {
      console.error('Error ensuring profile:', error);
      setProfile(null);
    }
  };

  const applySessionState = (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(false);
    void loadProfileForUser(nextSession.user);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        applySessionState(nextSession);
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        applySessionState(session);
      })
      .catch((error) => {
        console.error('Error restoring session:', error);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const isLovableCloud = supabaseUrl.includes('dkkgnyakaygahndoipte');

    if (isLovableCloud) {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      return { error: result?.error ?? null };
    } else {
      // For personal Supabase instances, use standard OAuth
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      return { error };
    }
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
