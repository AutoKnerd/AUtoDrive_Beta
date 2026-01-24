

'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth as useFirebaseAuth } from '@/firebase'; // Using alias to avoid naming conflict
import { getUserById, authenticateUser, createUserProfile } from '@/lib/data';
import type { User, UserRole } from '@/lib/definitions';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isTouring: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (name: string, email: string, password: string, brand: string, role: UserRole) => Promise<void>;
  setUser: (user: User | null) => void;
  switchTourRole: (role: UserRole) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const demoUserEmails = [
    'consultant.demo@autodrive.com',
    'service.writer.demo@autodrive.com',
    'owner.demo@autodrive.com',
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTouring, setIsTouring] = useState(false);
  const router = useRouter();
  const auth = useFirebaseAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userProfile = await getUserById(firebaseUser.uid);
        setUser(userProfile);
        // This logic is for the tour, which we are keeping for now.
        if(userProfile?.email) {
            setIsTouring(demoUserEmails.includes(userProfile.email));
        }
      } else {
        setUser(null);
        setIsTouring(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  const login = async (email: string, password: string) => {
    await authenticateUser(email, password);
    // The onAuthStateChanged listener will handle setting the user state
  };

  const register = async (name: string, email: string, password: string, brand: string, role: UserRole) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await createUserProfile(userCredential.user.uid, name, email, role, brand);
    // onAuthStateChanged will automatically sign the user in and update state.
  };

  const logout = async () => {
    await auth.signOut();
    setUser(null);
    setIsTouring(false);
    router.push('/login');
  };

  const switchTourRole = useCallback(async (role: UserRole) => {
      let email = '';
      switch (role) {
          case 'Sales Consultant':
              email = 'consultant.demo@autodrive.com';
              break;
          case 'Service Writer':
              email = 'service.writer.demo@autodrive.com';
              break;
          case 'Owner':
              email = 'owner.demo@autodrive.com';
              break;
          default:
              return;
      }
      await authenticateUser(email, 'readyplayer1');
  }, []);

  const value = { user, loading, isTouring, login, logout, register, setUser, switchTourRole };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
