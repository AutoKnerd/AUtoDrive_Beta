

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Message } from '@/lib/definitions';
import { useAuth } from '@/hooks/use-auth';
import { getMessagesForUser } from '@/lib/data.client';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User as UserIcon, MessageSquare, CreditCard, Undo2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

function MessageItem({ message }: { message: Message }) {
    const [relativeTime, setRelativeTime] = useState('');

    useEffect(() => {
        // This effect runs only on the client, after hydration
        if (message.timestamp) {
            setRelativeTime(formatDistanceToNow(new Date(message.timestamp), { addSuffix: true }));
        }
    }, [message.timestamp]);

    return (
        <div key={message.id} className="flex items-start gap-3">
            <Avatar className="h-9 w-9 border">
                <AvatarFallback>{message.senderName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="flex items-baseline justify-between">
                    <p className="font-semibold">{message.senderName}</p>
                    <p className="text-xs text-muted-foreground h-4" suppressHydrationWarning>
                        {relativeTime}
                    </p>
                </div>
                <p className="text-sm text-muted-foreground">{message.content}</p>
            </div>
        </div>
    );
}

function MessagesView({ messages }: { messages: Message[] }) {
    if (messages.length === 0) {
        return <p className="text-center text-sm text-muted-foreground py-8">No messages yet.</p>;
    }
  return (
    <ScrollArea className="h-[60vh] -mx-6 px-6">
        <div className="space-y-6">
            {messages.map((message) => (
                <MessageItem key={message.id} message={message} />
            ))}
        </div>
    </ScrollArea>
  );
}


interface UserNavProps {
  user: User;
  avatarClassName?: string;
  withBlur?: boolean;
}

export function UserNav({ user, avatarClassName, withBlur = false }: UserNavProps) {
    const { logout, originalUser, setUser } = useAuth();
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        // This ensures the component has mounted on the client
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!user || !isClient) return;
        
        async function fetchMessages() {
            const userMessages = await getMessagesForUser(user);
            setMessages(userMessages);

            const lastChecked = localStorage.getItem('lastMessagesCheckedTimestamp');
            if (userMessages.length > 0) {
                const newMessagesCount = userMessages.filter(
                    m => new Date(m.timestamp).getTime() > (parseInt(lastChecked || '0', 10))
                ).length;
                setUnreadCount(newMessagesCount);
            }
        }
        fetchMessages();
    }, [user, isClient]);

    const handleMessagesDialogOpen = (open: boolean) => {
        setIsDialogOpen(open);
        if (open && isClient) {
            setUnreadCount(0);
            if (messages.length > 0) {
                 localStorage.setItem('lastMessagesCheckedTimestamp', new Date(messages[0].timestamp).getTime().toString());
            }
        }
    };
    
    const handleReturnToDeveloper = () => {
        if (originalUser) {
            setUser(originalUser);
            router.push('/');
        }
    };

    const isViewingAsDifferentRole = originalUser && user.role !== originalUser.role;

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleMessagesDialogOpen}>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-auto w-auto rounded-full focus-visible:ring-0 focus-visible:ring-offset-0 p-0">
                <Avatar className={avatarClassName}>
                    <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="person portrait" />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                {withBlur && <div className="absolute inset-0 rounded-full border-2 border-cyan-400 blur-md" />}
                {isClient && unreadCount > 0 && (
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
                )}
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                </p>
                {isViewingAsDifferentRole && (
                     <p className="text-xs leading-none text-cyan-400/80 pt-1">
                        Viewing as: {user.role === 'manager' ? 'Sales Manager' : user.role}
                    </p>
                )}
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
             {isViewingAsDifferentRole && (
                 <DropdownMenuItem onSelect={handleReturnToDeveloper}>
                    <Undo2 className="mr-2 h-4 w-4" />
                    <span>Back to Developer</span>
                </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => router.push('/profile')}>
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Profile</span>
            </DropdownMenuItem>
             <DropdownMenuItem onSelect={() => router.push('/scorecard')}>
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Score Card</span>
            </DropdownMenuItem>
            <DialogTrigger asChild>
                <DropdownMenuItem>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    <span>Messages</span>
                    {isClient && unreadCount > 0 && <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">{unreadCount}</span>}
                </DropdownMenuItem>
            </DialogTrigger>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout()}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
            </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>

        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Announcements</DialogTitle>
            </DialogHeader>
            <MessagesView messages={messages} />
        </DialogContent>
    </Dialog>
  );
}
