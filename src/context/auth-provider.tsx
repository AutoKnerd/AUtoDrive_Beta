
'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { useAuth as useFirebaseAuth } from '@/firebase'; // Using alias to avoid naming conflict
import { getUserById, createUserProfile, getInvitationByEmail, claimInvitation } from '@/lib/data';
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

        // Self-healing logic: If a Firebase Auth user exists but their Firestore document does not, create it.
        if (!userProfile && fbUser.email) {
          console.log(`User document not found for UID ${fbUser.uid}. Checking for invitation or admin status...`);
          
          const invitation = await getInvitationByEmail(fbUser.email);

          if (invitation && !invitation.claimed) {
            console.log(`Found unclaimed invitation for ${fbUser.email}. Creating profile.`);
            try {
               userProfile = await createUserProfile(
                fbUser.uid,
                fbUser.displayName || 'New User',
                fbUser.email,
                invitation.role,
                [invitation.dealershipId],
              );
              await claimInvitation(invitation.token);
            } catch (creationError) {
              console.error("Failed to create user profile from invitation:", creationError);
            }
          } else if (adminEmails.includes(fbUser.email)) {
             console.log(`No invitation found, but user is admin/dev. Creating profile for ${fbUser.email}.`);
             const role = fbUser.email === 'btedesign@mac.com' ? 'Developer' : 'Admin';
             const name = role === 'Developer' ? 'AutoKnerd Developer' : 'AutoKnerd Admin';
             try {
                userProfile = await createUserProfile(
                  fbUser.uid,
                  name,
                  fbUser.email,
                  role,
                  []
                );
             } catch (e) {
                 console.error("Failed to create admin/dev user profile:", e);
             }
          }
        }
        
        // If a user is authenticated but no Firestore profile exists after the self-heal attempt,
        // it indicates an inconsistent state. We sign them out to prevent permission errors
        // that rely on data from the /users/{uid} document.
        if (!userProfile) {
          console.error(`Signing out user ${fbUser.uid} due to missing Firestore profile.`);
          await auth.signOut();
          // The onAuthStateChanged listener will re-run with a null user, which correctly clears all app state.
          // We can stop processing here for this run.
          setLoading(false);
          return;
        }
        
        setUser(userProfile);
        if (userProfile?.role === 'Developer' || userProfile?.role === 'Admin') {
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
  
  const register = useCallback(async (name: string, password: string, invitation: EmailInvitation) => {
    try {
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
      
    } catch(error: any) {
        console.error("Registration error:", error);
        if (error.code === 'auth/email-already-in-use') {
            throw new Error('This email address is already associated with an account. Please sign in.');
        }
        throw error;
    }
  }, [auth]);

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
        // If sign-in fails, check if it's a special user (admin/demo) that should be auto-registered.
        const isNotFound = error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential';
        const canAutoRegister = adminEmails.includes(email) || demoUserEmails.includes(email);

        if (isNotFound && canAutoRegister) {
            try {
                // Attempt to create the user. If it succeeds, onAuthStateChanged will handle the rest.
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                if (adminEmails.includes(email)) {
                  await sendEmailVerification(userCredential.user);
                }
                // The onAuthStateChanged listener will now fire and create the appropriate profile.
                return;
            } catch (registrationError: any) {
                // If creating the user fails because they already exist, it means the password was wrong for the initial login attempt.
                // We re-throw the original login error.
                if (registrationError.code === 'auth/email-already-in-use') {
                    throw error;
                }
                // For other registration errors (like a weak password), throw the new error.
                console.error("Auto-registration for special user failed:", registrationError);
                throw registrationError;
            }
        } else {
             // For normal users or other types of login errors, re-throw the original error.
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
