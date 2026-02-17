'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

import { useAuth as useFirebaseAuth } from '@/firebase'; // Using alias to avoid naming conflict
import { getUserById, createUserProfile, claimInvitation, updateUser } from '@/lib/data.client';
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
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const demoUserEmails = [
  'consultant.demo@autodrive.com',
  'service.writer.demo@autodrive.com',
  'parts.consultant.demo@autodrive.com',
  'finance.manager.demo@autodrive.com',
  'manager.demo@autodrive.com',
  'service.manager.demo@autodrive.com',
  'parts.manager.demo@autodrive.com',
  'general.manager.demo@autodrive.com',
  'owner.demo@autodrive.com',
];

const tourUserRoles: Record<string, UserRole> = {
  'consultant.demo@autodrive.com': 'Sales Consultant',
  'service.writer.demo@autodrive.com': 'Service Writer',
  'parts.consultant.demo@autodrive.com': 'Parts Consultant',
  'finance.manager.demo@autodrive.com': 'Finance Manager',
  'manager.demo@autodrive.com': 'manager',
  'service.manager.demo@autodrive.com': 'Service Manager',
  'parts.manager.demo@autodrive.com': 'Parts Manager',
  'general.manager.demo@autodrive.com': 'General Manager',
  'owner.demo@autodrive.com': 'Owner',
};

const adminEmails = ['andrew@autoknerd.com', 'btedesign@mac.com'];

function deriveNameFromEmail(email: string): string {
  const localPart = (email || '').split('@')[0] || '';
  const cleaned = localPart.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return 'Member';
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function waitForUserProfile(uid: string, attempts = 8, delayMs = 500): Promise<User | null> {
  for (let i = 0; i < attempts; i += 1) {
    const profile = await getUserById(uid);
    if (profile) return profile;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

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

      try {
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

                const fallbackName = fbUser.displayName || deriveNameFromEmail(invitation.email || fbUser.email || '');

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

          // Registration flow can briefly authenticate before the profile doc is committed.
          // Give Firestore a short window to catch up before treating this as a hard failure.
          if (!userProfile) {
            userProfile = await waitForUserProfile(fbUser.uid);
          }

          const isDemoAuthUser = !!fbUser.email && demoUserEmails.includes(fbUser.email);
          const hasUidMismatch = !!userProfile && userProfile.userId !== fbUser.uid;

          // Critical validation
          // Demo accounts intentionally resolve to canonical `tour-*` IDs.
          if (!userProfile || (!isDemoAuthUser && hasUidMismatch) || !userProfile.role) {
            console.error(
              `CRITICAL: User profile validation failed for UID ${fbUser.uid}. ` +
                `Profile exists: ${!!userProfile}, UID Match: ${userProfile?.userId === fbUser.uid}, Demo Auth User: ${isDemoAuthUser}, Role Exists: ${!!userProfile?.role}. Signing out.`
            );
            await auth.signOut();
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
      } catch (error) {
        console.error('[AuthProvider] Failed to resolve auth state:', error);
        setUser(null);
        setOriginalUser(null);
        setIsTouring(false);
        try {
          await auth.signOut();
        } catch {
          // no-op: best effort cleanup
        }
      } finally {
        setLoading(false);
      }

    });

    return () => unsubscribe();
  }, [auth]);

  const register = useCallback(
    async (name: string, password: string, invitation: EmailInvitation) => {
      const submittedName = name.trim();
      try {
        // Normal path: brand new user
        const userCredential = await createUserWithEmailAndPassword(auth, invitation.email, password);
        // Invitation claim runs via server/admin and creates the Firestore profile with role/dealership.
        await claimInvitation(invitation.token);
        // Ensure profile reflects the account-creation form name.
        if (submittedName.length > 0) {
          await updateUser(userCredential.user.uid, { name: submittedName });
        }
        return;
      } catch (error: any) {
        console.error('Registration error:', error);

        // Existing user claiming invite
        if (error?.code === 'auth/email-already-in-use') {
          try {
            const existingCred = await signInWithEmailAndPassword(auth, invitation.email, password);

            await claimInvitation(invitation.token);
            // Existing auth accounts may have a placeholder profile name. Overwrite with submitted name.
            if (submittedName.length > 0) {
              await updateUser(existingCred.user.uid, { name: submittedName });
            }

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
                await createUserWithEmailAndPassword(auth, email, password);
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
          case 'Parts Consultant':
              email = 'parts.consultant.demo@autodrive.com';
              break;
          case 'Finance Manager':
              email = 'finance.manager.demo@autodrive.com';
              break;
          case 'manager':
              email = 'manager.demo@autodrive.com';
              break;
          case 'Service Manager':
              email = 'service.manager.demo@autodrive.com';
              break;
          case 'Parts Manager':
              email = 'parts.manager.demo@autodrive.com';
              break;
          case 'General Manager':
              email = 'general.manager.demo@autodrive.com';
              break;
          case 'Owner':
              email = 'owner.demo@autodrive.com';
              break;
          default:
              return;
      }
      await login(email, 'readyplayer1');
  }, [login]);

  const value = { user, firebaseUser, originalUser, loading, isTouring, login, logout, register, publicSignup, setUser, switchTourRole };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
