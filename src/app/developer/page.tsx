
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { ConsultantDashboard } from '@/components/dashboard/consultant-dashboard';
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard';
import { Spinner } from '@/components/ui/spinner';
import { allRoles, managerialRoles, UserRole } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';

export default function DeveloperPage() {
  const { user, loading, setUser, originalUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || originalUser?.role !== 'Developer')) {
      router.push('/login');
    }
  }, [user, loading, router, originalUser]);

  if (loading || !user || !originalUser || originalUser.role !== 'Developer') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }
  
  const handleSwitchRole = (newRole: UserRole) => {
    if (originalUser) {
        setUser({ ...originalUser, role: newRole });
    }
  };

  const isViewingAsManager = managerialRoles.includes(user.role);

  return (
    <div className="flex min-h-screen w-full flex-col">
       <Header />
      <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-8">
        <Card className="border-cyan-400/50">
          <CardHeader>
            <CardTitle>Developer Dashboard</CardTitle>
            <CardDescription>
              Use the tools below to view the application from the perspective of any user role.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <span className="text-sm font-medium">Viewing as:</span>
            <Select onValueChange={(role) => handleSwitchRole(role as UserRole)} value={user.role}>
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role === 'manager' ? 'Sales Manager' : role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        
        <div className="border-t pt-8">
            {isViewingAsManager ? (
                <ManagerDashboard user={user} />
            ) : (
                <ConsultantDashboard user={user} />
            )}
        </div>

      </main>
    </div>
  );
}
