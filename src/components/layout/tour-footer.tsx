'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { UserRole } from '@/lib/definitions';
import { useRouter } from 'next/navigation';
import { Bot, SlidersHorizontal } from 'lucide-react';
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
      <div className="container mx-auto flex h-20 items-center justify-between px-4">
        {/* Left side: Panel Title & Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="h-6 w-6 text-cyan-400" />
            <div className="hidden md:block">
              <p className="font-bold">Tour Control Panel</p>
              <p className="text-sm text-muted-foreground">You are in a guided tour.</p>
            </div>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
                <Bot className="h-5 w-5" />
                <span className="sr-only">Ask AI Guide</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="p-0 gap-0 sm:max-w-lg">
              <DialogHeader className="p-4 border-b">
                <DialogTitle>AI Tour Guide</DialogTitle>
              </DialogHeader>
              <TourGuideChat user={user} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Right side: Controls */}
        <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <p className="hidden sm:block text-sm text-muted-foreground">Viewing as:</p>
              <Select onValueChange={(role) => switchTourRole(role as UserRole)} value={user.role}>
                  <SelectTrigger className="w-[140px] sm:w-[150px] bg-slate-800 border-slate-700">
                      <SelectValue placeholder="Role" />
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

             <Button onClick={handleEndTour} variant="destructive">
                End Tour
            </Button>
        </div>
      </div>
    </footer>
  );
}
