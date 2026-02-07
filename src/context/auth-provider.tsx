'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from 'firebase/auth';

import { useAuth as useFirebaseAuth } from '@/firebase'; // Using alias to avoid naming conflict
import { getUserById, createUserProfile, claimInvitation } from '@/lib/data.client';
import type { User, UserRole, EmailInvitation } from '@/lib/definitions';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  originalUser: User | null;
  loading: boolean;
  isTouring: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (name: string, password: string, invitation: EmailInvitation) => Promise<void>;
  publicSignup: (name: string, email: string, password: string) => Promise<void>;
  setUser: (user: User | null) => void;
  switchTourRole: (role: UserRole) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
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

const adminEmails = ['andrew@autoknerd.com', 'btedesign@mac.com'];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTouring, setIsTouring] = useState(false);

  const router = useRouter();
  const auth = useFirebaseAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      setLoading(true);
      setFirebaseUser(fbUser);

      if (fbUser) {
        let userProfile = await getUserById(fbUser.uid);

        // Self-heal if user doc missing
        if (!userProfile && fbUser.email) {
          console.log(`User document not found for UID ${fbUser.uid}. Attempting to self-heal.`);

          try {
            const idToken = await fbUser.getIdToken();

            const response = await fetch('/api/auth/resolve-invitation', {
              method: 'POST',
              headers: { Authorization: `Bearer ${idToken}` },
            });

            if (response.ok) {
              const invitation: EmailInvitation = await response.json();
              console.log(`Found pending invitation for ${fbUser.email}. Creating profile.`);

              const fallbackName = fbUser.displayName || 'New User';

              userProfile = await createUserProfile(
                fbUser.uid,
                fallbackName,
                invitation.email,
                invitation.role,
                [invitation.dealershipId],
              );

              await claimInvitation(invitation.token);
            } else if (adminEmails.includes(fbUser.email)) {
              console.log(`User is admin/dev. Creating profile for ${fbUser.email}.`);

              const role: UserRole = fbUser.email === 'btedesign@mac.com' ? 'Developer' : 'Admin';
              const name = role === 'Developer' ? 'AutoKnerd Developer' : 'AutoKnerd Admin';

              userProfile = await createUserProfile(fbUser.uid, name, fbUser.email, role, []);
            }
          } catch (e) {
            console.error('Error during self-heal process:', e);
          }
        }

        // Critical validation
        if (!userProfile || userProfile.userId !== fbUser.uid || !userProfile.role) {
          console.error(
            `CRITICAL: User profile validation failed for UID ${fbUser.uid}. ` +
              `Profile exists: ${!!userProfile}, UID Match: ${userProfile?.userId === fbUser.uid}, Role Exists: ${!!userProfile?.role}. Signing out.`
          );
          await auth.signOut();
          setLoading(false);
          return;
        }

        setUser(userProfile);

        if (userProfile.role === 'Developer' || userProfile.role === 'Admin') {
          setOriginalUser(userProfile);
        } else {
          setOriginalUser(null);
        }

        if (userProfile.email) {
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

  const register = useCallback(
    async (name: string, password: string, invitation: EmailInvitation) => {
      try {
        // Normal path: brand new user
        const userCredential = await createUserWithEmailAndPassword(auth, invitation.email, password);
        await sendEmailVerification(userCredential.user);

        await createUserProfile(
          userCredential.user.uid,
          name,
          invitation.email,
          invitation.role,
          [invitation.dealershipId],
        );

        await claimInvitation(invitation.token);
        return;
      } catch (error: any) {
        console.error('Registration error:', error);

        // Existing user claiming invite
        if (error?.code === 'auth/email-already-in-use') {
          try {
            const existingCred = await signInWithEmailAndPassword(auth, invitation.email, password);

            await claimInvitation(invitation.token);

            // Optional: refresh profile so UI updates immediately
            const refreshed = await getUserById(existingCred.user.uid);
            if (refreshed) setUser(refreshed);

            return;
          } catch (loginErr: any) {
            console.error('Existing account sign-in failed:', loginErr);

            if (loginErr?.code === 'auth/wrong-password') {
              throw new Error(
                'This email already has an account, but that password is incorrect. Please sign in with your existing password, or reset your password.'
              );
            }

            if (loginErr?.code === 'auth/too-many-requests') {
              throw new Error('Too many attempts. Please wait a bit, then try again.');
            }

            throw new Error('This email already has an account. Please sign in to claim your invite.');
          }
        }

        throw error;
      }
    },
    [auth]
  );

  const publicSignup = useCallback(async (name: string, email: string, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      
      await createUserProfile(
        userCredential.user.uid,
        name,
        email,
        'Sales Consultant', // Default role for public signups
        [], // No dealership association initially
      );
      
    } catch(error: any) {
        console.error("Public signup error:", error);
        if (error.code === 'auth/email-already-in-use') {
            throw new Error('This email address is already in use. Please sign in or use a different email.');
        }
        throw error;
    }
  }, [auth]);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
        const isNotFound = error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential';
        const canAutoRegister = adminEmails.includes(email) || demoUserEmails.includes(email);

        if (isNotFound && canAutoRegister) {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                if (adminEmails.includes(email)) {
                  await sendEmailVerification(userCredential.user);
                }
                return;
            } catch (registrationError: any) {
                if (registrationError.code === 'auth/email-already-in-use') {
                    throw error;
                }
                console.error("Auto-registration for special user failed:", registrationError);
                throw registrationError;
            }
        } else {
             throw error;
        }
    }
  }, [auth]);

  const logout = async () => {
    await auth.signOut();
    setUser(null);
    setOriginalUser(null);
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

  const resendVerificationEmail = useCallback(async () => {
    if (firebaseUser) {
        await sendEmailVerification(firebaseUser);
    } else {
        throw new Error("You must be logged in to send a verification email.");
    }
  }, [firebaseUser]);

  const value = { user, firebaseUser, originalUser, loading, isTouring, login, logout, register, publicSignup, setUser, switchTourRole, resendVerificationEmail };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
