'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { UserRole } from '@/lib/definitions';
import { useRouter } from 'next/navigation';
import { Bot, LogOut, Users, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TourGuideChat } from '@/components/tour/tour-guide-chat';
import { cn } from '@/lib/utils';

const tourRoles: { label: string; value: UserRole }[] = [
  { label: 'Sales Consultant', value: 'Sales Consultant' },
  { label: 'Service Writer', value: 'Service Writer' },
  { label: 'Parts Consultant', value: 'Parts Consultant' },
  { label: 'Finance Manager', value: 'Finance Manager' },
  { label: 'Sales Manager', value: 'manager' },
  { label: 'Service Manager', value: 'Service Manager' },
  { label: 'Parts Manager', value: 'Parts Manager' },
  { label: 'General Manager', value: 'General Manager' },
  { label: 'Owner', value: 'Owner' },
];

export function TourFooter() {
  const { user, switchTourRole, logout } = useAuth();
  const router = useRouter();

  const handleEndTour = () => {
    logout();
    router.push('/about');
  };
  
  const handleRestartTour = () => {
    // Switch to the default consultant role to "restart"
    switchTourRole('Sales Consultant');
  };

  if (!user) return null;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 h-20 border-t-2 border-primary/50 bg-slate-900/90 text-white backdrop-blur-lg">
      {/* Mobile Layout */}
      <div className="flex h-full items-center justify-around md:hidden">
        <Dialog>
          <DialogTrigger asChild>
             <button className={cn('flex flex-col items-center justify-center gap-1 w-full h-full transition-colors text-gray-400 hover:text-white')}>
              <Bot className="h-6 w-6" />
              <span className="text-xs font-medium">Guide</span>
            </button>
          </DialogTrigger>
          <DialogContent className="p-0 gap-0 sm:max-w-lg">
            <DialogHeader className="p-4 border-b">
              <DialogTitle>AI Tour Guide</DialogTitle>
            </DialogHeader>
            <TourGuideChat user={user} />
          </DialogContent>
        </Dialog>

        <Dialog>
            <DialogTrigger asChild>
                <button className={cn('flex flex-col items-center justify-center gap-1 w-full h-full transition-colors text-gray-400 hover:text-white')}>
                    <Users className="h-6 w-6" />
                    <span className="text-xs font-medium">Switch Role</span>
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Switch Tour Role</DialogTitle>
                    <DialogDescription>
                        Explore the app from a different perspective.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Select onValueChange={(role) => switchTourRole(role as UserRole)} value={user.role}>
                        <SelectTrigger className="w-full bg-slate-800 border-slate-700">
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
            </DialogContent>
        </Dialog>
        
        <button onClick={handleRestartTour} className={cn('flex flex-col items-center justify-center gap-1 w-full h-full transition-colors text-gray-400 hover:text-white')}>
            <RefreshCw className="h-6 w-6" />
            <span className="text-xs font-medium">Restart</span>
        </button>

        <button onClick={handleEndTour} className={cn('flex flex-col items-center justify-center gap-1 w-full h-full transition-colors text-red-400/80 hover:text-red-400')}>
            <LogOut className="h-6 w-6" />
            <span className="text-xs font-medium">End Tour</span>
        </button>
      </div>
      
      {/* Desktop Layout */}
      <div className="container mx-auto hidden h-20 items-center justify-between px-4 md:flex">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="h-6 w-6 text-cyan-400" />
            <div>
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

        <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Viewing as:</p>
              <Select onValueChange={(role) => switchTourRole(role as UserRole)} value={user.role}>
                  <SelectTrigger className="w-[150px] bg-slate-800 border-slate-700">
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
