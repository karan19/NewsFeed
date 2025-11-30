'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Amplify } from 'aws-amplify';
import { getCurrentUser, signIn, signOut, fetchAuthSession } from 'aws-amplify/auth';

// Configure Amplify
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'us-west-2_wudnFpd2a',
      userPoolClientId: '1c7psmuc5fguvrubvg2fbdu230',
    },
  },
};

// Only configure on client side
if (typeof window !== 'undefined') {
  Amplify.configure(amplifyConfig, { ssr: true });
}

interface User {
  username: string;
  userId: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  getAccessToken: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const currentUser = await getCurrentUser();
      setUser({
        username: currentUser.username,
        userId: currentUser.userId,
      });
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(username: string, password: string) {
    const result = await signIn({ username, password });
    if (result.isSignedIn) {
      await checkAuth();
    } else {
      throw new Error('Sign in not complete');
    }
  }

  async function logout() {
    await signOut();
    setUser(null);
  }

  async function getAccessToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString() ?? null;
    } catch {
      return null;
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
