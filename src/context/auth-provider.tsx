'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth as useFirebaseAuth } from '@/firebase'; // Using alias to avoid naming conflict
import { getUserById, createUserProfile } from '@/lib/data';
import type { User, UserRole } from '@/lib/definitions';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  originalUser: User | null;
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
    'manager.demo@autodrive.com',
    'owner.demo@autodrive.com',
];

const tourUserRoles: Record<string, UserRole> = {
  'consultant.demo@autodrive.com': 'Sales Consultant',
  'service.writer.demo@autodrive.com': 'Service Writer',
  'manager.demo@autodrive.com': 'manager',
  'owner.demo@autodrive.com': 'Owner',
};


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTouring, setIsTouring] = useState(false);
  const router = useRouter();
  const auth = useFirebaseAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userProfile = await getUserById(firebaseUser.uid);
        setUser(userProfile);
        if (userProfile?.role === 'Developer') {
          setOriginalUser(userProfile);
        } else {
          setOriginalUser(null);
        }
        if(userProfile?.email) {
            setIsTouring(demoUserEmails.includes(userProfile.email));
        }
      } else {
        setUser(null);
        setOriginalUser(null);
        setIsTouring(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);
  
  const register = useCallback(async (name: string, email: string, password: string, brand: string, role: UserRole) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    try {
      const newUserProfile = await createUserProfile(userCredential.user.uid, name, email, role, brand);
      // onAuthStateChanged will set the user state
    } catch(error) {
        // If profile creation fails, sign out the newly created auth user to allow a retry.
        await auth.signOut();
        throw error;
    }
  }, [auth]);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
        if ((error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') && demoUserEmails.includes(email)) {
            try {
                const role = tourUserRoles[email];
                const name = `Demo ${role === 'manager' ? 'Sales Manager' : role}`;
                await register(name, email, password, 'Toyota', role);
                return; // User is created and signed in, onAuthStateChanged will handle the rest.
            } catch (registrationError) {
                console.error("Failed to auto-register demo user:", registrationError);
                // If registration fails, throw the original login error to be displayed.
                throw error;
            }
        }
        // For non-demo users or other types of errors, re-throw the original error.
        throw error;
    }
  }, [auth, register]);

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
          case 'manager':
              email = 'manager.demo@autodrive.com';
              break;
          case 'Owner':
              email = 'owner.demo@autodrive.com';
              break;
          default:
              return;
      }
      await login(email, 'readyplayer1');
  }, [login]);

  const value = { user, originalUser, loading, isTouring, login, logout, register, setUser, switchTourRole };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
