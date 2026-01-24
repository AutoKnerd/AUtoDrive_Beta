
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { UserRole } from '@/lib/definitions';

const quickLoginRoles = [
  { value: 'consultant@autodrive.com', label: 'Sales Consultant' },
  { value: 'manager@autodrive.com', label: 'Sales Manager' },
  { value: 'service.writer@autodrive.com', label: 'Service Writer' },
  { value: 'service.manager@autodrive.com', label: 'Service Manager' },
  { value: 'finance.manager@autodrive.com', label: 'Finance Manager' },
  { value: 'parts.consultant@autodrive.com', label: 'Parts Consultant' },
  { value: 'parts.manager@autodrive.com', label: 'Parts Manager' },
  { value: 'gm@autodrive.com', label: 'General Manager' },
  { value: 'owner@autodrive.com', label: 'Owner' },
  { value: 'trainer@autoknerd.com', label: 'Trainer' },
  { value: 'admin@autoknerd.com', label: 'Admin' },
];

const tourRoles: { value: string, label: UserRole }[] = [
  { value: 'consultant.demo@autodrive.com', label: 'Sales Consultant' },
  { value: 'service.writer.demo@autodrive.com', label: 'Service Writer' },
  { value: 'owner.demo@autodrive.com', label: 'Owner' },
];


export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedQuickLogin, setSelectedQuickLogin] = useState<string>('');
  const [selectedTourRole, setSelectedTourRole] = useState<string>(tourRoles[0].value);
  const router = useRouter();
  const { login, user, loading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  async function handleTourLogin() {
    setIsSubmitting(true);
    const roleInfo = tourRoles.find(r => r.value === selectedTourRole);
    try {
      await login(selectedTourRole, 'password'); // Password can be anything for mock auth
      toast({
        title: 'Welcome to the Tour!',
        description: `You are now exploring as a ${roleInfo?.label}.`,
      });
      router.push('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: `Tour Login Failed`,
        description: `Could not start the tour. Please try again.`,
      });
      setIsSubmitting(false);
    }
  }

  async function handleQuickLogin() {
    if (!selectedQuickLogin) {
      toast({
        variant: 'destructive',
        title: 'Quick Login Failed',
        description: 'Please select a role from the dropdown.',
      });
      return;
    }

    setIsSubmitting(true);
    const roleInfo = quickLoginRoles.find(r => r.value === selectedQuickLogin);

    try {
      await login(selectedQuickLogin, 'password');
      toast({
        title: 'Login Successful',
        description: `Logged in as ${roleInfo?.label}.`,
      });
      router.push('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: `${roleInfo?.label} Login Failed`,
        description: `Could not log in as ${roleInfo?.label.toLowerCase()} user.`,
      });
      setIsSubmitting(false);
    }
  }
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center justify-center text-center">
            <div className="mb-4 w-full">
                <Logo variant="full" width={610} height={203} />
            </div>
        </div>
        <LoginForm />
        
        <div className="relative mt-8 w-full">
            <Separator />
            <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-background px-2 text-xs text-muted-foreground">
                OR
            </span>
        </div>
        
        <div className="mt-6 w-full space-y-2">
            <p className="text-center text-sm text-muted-foreground">Take a tour of the app</p>
             <Select onValueChange={setSelectedTourRole} defaultValue={selectedTourRole} disabled={isSubmitting}>
                <SelectTrigger>
                    <SelectValue placeholder="Select a role to tour..." />
                </SelectTrigger>
                <SelectContent>
                    {tourRoles.map(role => (
                        <SelectItem key={role.value} value={role.value}>
                            {role.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button type="button" variant="secondary" className="w-full" onClick={handleTourLogin} disabled={isSubmitting}>
              {isSubmitting ? <Spinner size="sm" /> : 'Start Tour'}
            </Button>
        </div>


        <div className="relative mt-8 w-full">
            <Separator />
        </div>

        <div className="mt-6 w-full space-y-2">
            <p className="text-center text-sm text-muted-foreground">Quick login as developer role</p>
            <Select onValueChange={setSelectedQuickLogin} value={selectedQuickLogin} disabled={isSubmitting}>
                <SelectTrigger>
                    <SelectValue placeholder="Select a role to log in..." />
                </SelectTrigger>
                <SelectContent>
                    {quickLoginRoles.map(role => (
                        <SelectItem key={role.value} value={role.value}>
                            {role.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button type="button" variant="outline" className="w-full" onClick={handleQuickLogin} disabled={isSubmitting || !selectedQuickLogin}>
              {isSubmitting ? <Spinner size="sm" /> : 'Quick Login'}
            </Button>
        </div>
      </div>
    </main>
  );
}
