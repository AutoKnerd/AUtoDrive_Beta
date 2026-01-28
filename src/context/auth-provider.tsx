
'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth as useFirebaseAuth } from '@/firebase'; // Using alias to avoid naming conflict
import { getUserById, createUserProfile, getInvitationByEmail, claimInvitation } from '@/lib/data';
import type { User, UserRole, EmailInvitation } from '@/lib/definitions';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  originalUser: User | null;
  loading: boolean;
  isTouring: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (name: string, password: string, invitation: EmailInvitation) => Promise<void>;
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
      setLoading(true);
      if (firebaseUser) {
        let userProfile = await getUserById(firebaseUser.uid);

        if (!userProfile && firebaseUser.email) {
          console.log(`User document not found for UID ${firebaseUser.uid}. Checking for invitation...`);
          
          const invitation = await getInvitationByEmail(firebaseUser.email);

          if (invitation && !invitation.claimed) {
            console.log(`Found unclaimed invitation for ${firebaseUser.email}. Creating profile.`);
            try {
               userProfile = await createUserProfile(
                firebaseUser.uid,
                firebaseUser.displayName || 'New User',
                firebaseUser.email,
                invitation.role,
                [invitation.dealershipId],
              );
              await claimInvitation(invitation.token);
            } catch (creationError) {
              console.error("Failed to create user profile from invitation:", creationError);
            }
          } else if (firebaseUser.email === 'andrew@autoknerd.com') { // Hardcoded admin self-healing
             console.log(`No invitation found, but user is admin. Creating admin profile.`);
             try {
                userProfile = await createUserProfile(
                  firebaseUser.uid,
                  'Andrew (Admin)',
                  firebaseUser.email,
                  'Admin',
                  []
                );
             } catch (e) {
                 console.error("Failed to create admin user profile:", e);
             }
          }
        }
        
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
  
  const register = useCallback(async (name: string, password: string, invitation: EmailInvitation) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, invitation.email, password);
      const newUserProfile = await createUserProfile(
          userCredential.user.uid, 
          name, 
          invitation.email, 
          invitation.role, 
          [invitation.dealershipId]
      );
      await claimInvitation(invitation.token);
      // onAuthStateChanged will set the user state
    } catch(error) {
        // If profile creation fails, the auth user still exists.
        // The self-healing logic in onAuthStateChanged will attempt to fix this on next login.
        console.error("Registration error:", error);
        throw error;
    }
  }, [auth]);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
        if ((error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') && demoUserEmails.includes(email)) {
             // This logic for demo users is a bit of a special case and doesn't use invitations
            try {
                 const role = tourUserRoles[email];
                 const name = `Demo ${role === 'manager' ? 'Sales Manager' : role}`;
                 const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                 await createUserProfile(userCredential.user.uid, name, email, role, ['tour-dealership-1']);
            } catch (registrationError: any) {
                if (registrationError.code === 'auth/email-already-in-use') {
                    // This is expected if the demo user already exists, so just sign in
                    await signInWithEmailAndPassword(auth, email, password);
                } else {
                    console.error("Failed to auto-register demo user:", registrationError);
                    throw error;
                }
            }
        } else {
            throw error;
        }
    }
  }, [auth]);

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
