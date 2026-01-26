'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { UserRole } from '@/lib/definitions';
import { useRouter } from 'next/navigation';
import { Info, Bot } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TourGuideChat } from '@/components/tour/tour-guide-chat';

const tourRoles: { label: string; value: UserRole }[] = [
  { label: 'Sales Consultant', value: 'Sales Consultant' },
  { label: 'Service Writer', value: 'Service Writer' },
  { label: 'Sales Manager', value: 'manager' },
  { label: 'Owner', value: 'Owner' },
];

export function TourFooter() {
  const { user, switchTourRole, logout } = useAuth();
  const router = useRouter();

  const handleEndTour = () => {
    logout();
    router.push('/register');
  };

  if (!user) return null;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-primary/50 bg-slate-900/90 text-white backdrop-blur-lg">
      <div className="container mx-auto flex h-24 items-center justify-between px-4">
        <div className="flex items-center gap-4">
           <Info className="h-6 w-6 text-cyan-400 hidden sm:block" />
           <div>
               <h3 className="font-bold text-lg hidden sm:block">Tour Control Panel</h3>
               <p className="text-sm text-muted-foreground">You are currently in a guided tour.</p>
           </div>
        </div>

        <div className="flex items-center gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-slate-800 border-slate-700 hover:bg-slate-700 hidden md:flex">
                  <Bot className="mr-2 h-4 w-4" /> Ask AI Guide
                </Button>
              </DialogTrigger>
              <DialogContent className="p-0 gap-0 sm:max-w-lg">
                <DialogHeader className="p-4 border-b">
                  <DialogTitle>AI Tour Guide</DialogTitle>
                </DialogHeader>
                <TourGuideChat user={user} />
              </DialogContent>
            </Dialog>

            <div className="text-right">
                <label className="text-sm font-medium text-muted-foreground">Viewing as:</label>
                <Select onValueChange={(role) => switchTourRole(role as UserRole)} value={user.role}>
                    <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select a role..." />
                    </SelectTrigger>
                    <SelectContent>
                        {tourRoles.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                                {role.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <Button onClick={handleEndTour} size="lg" className="bg-cyan-400 text-slate-900 hover:bg-cyan-300">
                End Tour & Sign Up
            </Button>
        </div>
      </div>
    </footer>
  );
}
