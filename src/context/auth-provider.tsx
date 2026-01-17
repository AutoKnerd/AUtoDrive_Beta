
'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserById, authenticateUser } from '@/lib/data';
import type { User } from '@/lib/definitions';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // In a real app, you'd fetch the user profile from your backend
        // For this demo, we'll use our mock data function
        const userProfile = await getUserById(firebaseUser.uid);
        setUser(userProfile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const loggedInUser = await authenticateUser(email, password);
    if (loggedInUser) {
      setUser(loggedInUser);
      // Simulate onAuthStateChanged trigger
      // In a real app with Firebase Auth, this would happen automatically
    } else {
      throw new Error("Invalid credentials");
    }
  };

  const logout = async () => {
    // In a real app, you would sign out from Firebase
    // await signOut(auth);
    setUser(null);
    router.push('/login');
  };

  const value = { user, loading, login, logout, setUser };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
