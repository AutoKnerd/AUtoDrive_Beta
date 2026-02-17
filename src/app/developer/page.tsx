
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


export default function DeveloperPage() {
  const { user, loading, setUser, originalUser } = useAuth();
  const router = useRouter();

  const [manageableUsers, setManageableUsers] = useState<User[]>([]);
  const [allDealerships, setAllDealerships] = useState<Dealership[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTool, setActiveTool] = useState('create_user');

  const refreshData = useCallback(async () => {
    if (originalUser) {
      setDataLoading(true);
      const [users, dealerships] = await Promise.all([
        getManageableUsers(originalUser.userId),
        getDealerships(originalUser)
      ]);
      setManageableUsers(users);
      setAllDealerships(dealerships);
      setDataLoading(false);
    }
  }, [originalUser]);

  useEffect(() => {
    if (!loading && originalUser) {
      refreshData();
    }
  }, [loading, originalUser, refreshData]);

  useEffect(() => {
    // Redirect if not a developer/admin or if still loading
    if (!loading && (!user || (originalUser?.role !== 'Developer' && originalUser?.role !== 'Admin'))) {
      router.push('/login');
    }
  }, [user, loading, router, originalUser]);

  if (loading || !user || !originalUser || (originalUser.role !== 'Developer' && originalUser.role !== 'Admin')) {
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
        <Card className="border-primary/50 bg-primary/5 text-primary-foreground">
          <CardHeader className="flex-row items-center gap-4">
            <SlidersHorizontal className="h-10 w-10 text-primary" />
            <div>
                <CardTitle className="text-2xl text-primary">God Mode</CardTitle>
                <CardDescription className="text-primary/80">
                    View the application as any user role, and manage users, dealerships, and system settings.
                </CardDescription>
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
                        <CardDescription>Select a role to view the corresponding user dashboard.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                             <span className="text-sm font-medium">Impersonating Role:</span>
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
                        </div>
                        <div className="border-t pt-8 mt-6">
                            {isViewingAsManager ? (
                                <ManagerDashboard user={user} />
                            ) : (
                                <ConsultantDashboard user={user} />
                            )}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="management" className="pt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>Management Tools</CardTitle>
                        <CardDescription>
                            Create, invite, assign, and remove users and dealerships.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {dataLoading ? (
                            <Spinner />
                        ) : (
                            <Tabs value={activeTool} onValueChange={setActiveTool} className="w-full">
                                <div className="mb-4">
                                    <Select value={activeTool} onValueChange={setActiveTool}>
                                        <SelectTrigger className="w-full md:w-[300px]">
                                            <SelectValue placeholder="Select a management tool..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {managementTools.map(tool => (
                                                <SelectItem key={tool.value} value={tool.value}>{tool.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <TabsContent value="create_user" className="pt-4">
                                    <CreateUserForm onUserCreated={refreshData} />
                                </TabsContent>
                                <TabsContent value="edit_user" className="pt-4">
                                    <EditUserForm manageableUsers={manageableUsers} onUserUpdated={refreshData} />
                                </TabsContent>
                                <TabsContent value="assign_dealerships" className="pt-4">
                                    <AssignDealershipsForm manageableUsers={manageableUsers} dealerships={allDealerships} currentUser={originalUser} onDealershipsAssigned={refreshData} />
                                </TabsContent>
                                <TabsContent value="invite" className="pt-4">
                                    <RegisterDealershipForm user={originalUser} dealerships={allDealerships} onUserInvited={refreshData} />
                                </TabsContent>
                                <TabsContent value="remove" className="pt-4">
                                    <RemoveUserForm manageableUsers={manageableUsers} onUserRemoved={refreshData} />
                                </TabsContent>
                                <TabsContent value="create_dealership" className="pt-4">
                                     <CreateDealershipForm user={originalUser} onDealershipCreated={refreshData} />
                                </TabsContent>
                                <TabsContent value="manage_dealerships" className="pt-4">
                                    <ManageDealershipForm dealerships={allDealerships} onDealershipManaged={refreshData} />
                                </TabsContent>
                            </Tabs>
                        )}
                    </CardContent>
                 </Card>
            </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
