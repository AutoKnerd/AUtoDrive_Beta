'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { ConsultantDashboard } from '@/components/dashboard/consultant-dashboard';
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard';
import { Spinner } from '@/components/ui/spinner';
import { allRoles, managerialRoles, UserRole, User, Dealership } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';
import { SlidersHorizontal } from 'lucide-react';
import { getManageableUsers, getDealerships } from '@/lib/data.client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RegisterDealershipForm } from '@/components/admin/register-dealership-form';
import { RemoveUserForm } from '@/components/admin/remove-user-form';
import { CreateDealershipForm } from '@/components/admin/create-dealership-form';
import { CreateUserForm } from '@/components/admin/create-user-form';
import { AssignDealershipsForm } from '@/components/admin/assign-dealerships-form';
import { ManageDealershipForm } from '@/components/admin/ManageDealershipForm';
import { EditUserForm } from '@/components/admin/edit-user-form';

type DashboardMode = 'role_based' | 'single_user';

export default function DeveloperPage() {
  const { user, loading, setUser, originalUser } = useAuth();
  const router = useRouter();

  const [manageableUsers, setManageableUsers] = useState<User[]>([]);
  const [allDealerships, setAllDealerships] = useState<Dealership[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTool, setActiveTool] = useState('create_user');
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('role_based');

  const refreshData = useCallback(async () => {
    if (originalUser) {
      setDataLoading(true);
      const [users, dealerships] = await Promise.all([
        getManageableUsers(originalUser.userId),
        getDealerships()
      ]);
      setManageableUsers(users);
      setAllDealerships(dealerships);
      setDataLoading(false);
    }
  }, [originalUser]);

  useEffect(() => {
    if (!loading && originalUser) refreshData();
  }, [loading, originalUser, refreshData]);

  useEffect(() => {
    if (!loading && (!user || (originalUser?.role !== 'Developer' && originalUser?.role !== 'Admin'))) {
      router.push('/login');
    }
  }, [user, loading, router, originalUser]);

  if (loading || !user || !originalUser || (originalUser.role !== 'Developer' && originalUser.role !== 'Admin')) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><Spinner size="lg" /></div>;
  }
  
  const handleSwitchRole = (newRole: UserRole) => {
    if (originalUser) setUser({ ...originalUser, role: newRole });
  };

  const dashboardUser: User = dashboardMode === 'single_user'
    ? {
        ...user,
        role: 'Sales Consultant',
        dealershipIds: [],
        selfDeclaredDealershipId: undefined,
      }
    : user;

  const isViewingAsManager = managerialRoles.includes(dashboardUser.role);
  
  const managementTools = [
    { value: 'create_user', label: 'Create User' },
    { value: 'edit_user', label: 'Edit User' },
    { value: 'assign_dealerships', label: 'Assign Dealerships' },
    { value: 'invite', label: 'Invite to Store' },
    { value: 'remove', label: 'Remove User' },
    { value: 'create_dealership', label: 'Create Dealership' },
    { value: 'manage_dealerships', label: 'Manage Dealerships' },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col">
       <Header />
      <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-8">
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="flex-row items-center gap-4">
            <SlidersHorizontal className="h-10 w-10 text-primary" />
            <div>
                <CardTitle className="text-2xl text-primary">God Mode</CardTitle>
                <CardDescription className="text-primary/80">Manage system-wide data or impersonate roles.</CardDescription>
            </div>
          </CardHeader>
        </Card>
        
        <Tabs defaultValue="impersonation" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="impersonation">Impersonation</TabsTrigger>
                <TabsTrigger value="management">System Management</TabsTrigger>
            </TabsList>
            <TabsContent value="impersonation" className="pt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>Dashboard View</CardTitle>
                        <CardDescription>
                          Use role-based impersonation or jump directly into a single-user dashboard with no dealership assignment.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap items-center gap-4">
                             <span className="text-sm font-medium">Mode:</span>
                            <Select onValueChange={(mode) => setDashboardMode(mode as DashboardMode)} value={dashboardMode}>
                              <SelectTrigger className="w-[240px]">
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="role_based">Role-Based</SelectItem>
                                  <SelectItem value="single_user">Single User</SelectItem>
                              </SelectContent>
                            </Select>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-4">
                             <span className="text-sm font-medium">Impersonating:</span>
                            <Select onValueChange={(role) => handleSwitchRole(role as UserRole)} value={user.role}>
                            <SelectTrigger className="w-[240px]" disabled={dashboardMode === 'single_user'}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {allRoles.map((role) => (
                                <SelectItem key={role} value={role}>{role === 'manager' ? 'Sales Manager' : role}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            {dashboardMode === 'single_user' && (
                              <span className="text-xs text-muted-foreground">
                                Single User mode uses `Sales Consultant` with no dealership.
                              </span>
                            )}
                        </div>
                        <div className="border-t pt-8 mt-6">
                            {isViewingAsManager ? <ManagerDashboard user={dashboardUser} /> : <ConsultantDashboard user={dashboardUser} />}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="management" className="pt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>Management Tools</CardTitle>
                        <CardDescription>Consolidated system administration.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {dataLoading ? <Spinner /> : (
                            <div className="w-full">
                                <div className="mb-6">
                                    <Select value={activeTool} onValueChange={setActiveTool}>
                                        <SelectTrigger className="w-full md:w-[300px]">
                                            <SelectValue placeholder="Select a tool..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {managementTools.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="mt-4">
                                    {activeTool === 'create_user' && <CreateUserForm onUserCreated={refreshData} />}
                                    {activeTool === 'edit_user' && <EditUserForm manageableUsers={manageableUsers} dealerships={allDealerships} onUserUpdated={refreshData} />}
                                    {activeTool === 'assign_dealerships' && <AssignDealershipsForm manageableUsers={manageableUsers} dealerships={allDealerships} currentUser={originalUser!} onDealershipsAssigned={refreshData} />}
                                    {activeTool === 'invite' && <RegisterDealershipForm user={originalUser!} dealerships={allDealerships} onUserInvited={refreshData} />}
                                    {activeTool === 'remove' && <RemoveUserForm manageableUsers={manageableUsers} onUserRemoved={refreshData} />}
                                    {activeTool === 'create_dealership' && <CreateDealershipForm user={originalUser!} onDealershipCreated={refreshData} />}
                                    {activeTool === 'manage_dealerships' && <ManageDealershipForm dealerships={allDealerships} onDealershipManaged={refreshData} />}
                                </div>
                            </div>
                        )}
                    </CardContent>
                 </Card>
            </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
