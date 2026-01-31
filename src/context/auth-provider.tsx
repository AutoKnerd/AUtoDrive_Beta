
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
        // Handle auto-registration for admins and demo users
        const isNotFound = error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential';
        
        if (isNotFound) {
             if (adminEmails.includes(email)) {
                try {
                    // Attempt to create the admin user if they don't exist
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    await sendEmailVerification(userCredential.user);
                    // onAuthStateChanged will handle profile creation, so we just need to wait for it to complete.
                    // A short delay might be needed if redirection happens too quickly, but usually onAuthStateChanged is fast.
                    return; 
                } catch (registrationError: any) {
                    // This could happen if the user *does* exist but used the wrong password.
                    // Or if creation fails for another reason (e.g., weak password).
                    // In either case, we should fail the login attempt.
                    console.error('Admin auto-registration failed:', registrationError);
                    throw error;
                }
            } else if (demoUserEmails.includes(email)) {
                 // Demo user auto-registration logic (existing)
                try {
                    const role = tourUserRoles[email];
                    const name = `Demo ${role === 'manager' ? 'Sales Manager' : role}`;
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    await createUserProfile(userCredential.user.uid, name, email, role, ['tour-dealership-1']);
                } catch (registrationError: any) {
                    if (registrationError.code === 'auth/email-already-in-use') {
                        // This is expected if the demo user already exists but login failed due to wrong password.
                        // We re-throw the original error in this case.
                         throw error;
                    } else {
                        console.error("Failed to auto-register demo user:", registrationError);
                        throw error;
                    }
                }
            } else {
                 throw error; // Re-throw for normal users
            }
        } else {
            throw error; // Re-throw for other errors like 'auth/wrong-password'
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

  const resendVerificationEmail = useCallback(async () => {
    if (firebaseUser) {
        await sendEmailVerification(firebaseUser);
    } else {
        throw new Error("You must be logged in to send a verification email.");
    }
  }, [firebaseUser]);

  const value = { user, firebaseUser, originalUser, loading, isTouring, login, logout, register, setUser, switchTourRole, resendVerificationEmail };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
