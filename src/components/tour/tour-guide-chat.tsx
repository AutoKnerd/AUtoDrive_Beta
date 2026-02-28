'use client';

import { useState, useRef, useEffect } from 'react';
import { User } from '@/lib/definitions';
import { askTourGuide } from '@/ai/flows/tour-guide-flow';
import { Bot, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback } from '../ui/avatar';
import Image from 'next/image';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface TourGuideChatProps {
  user: User;
}

export function TourGuideChat({ user }: TourGuideChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Start loading to fetch initial message
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Fetch the initial greeting from the AI guide
  useEffect(() => {
    const getInitialMessage = async () => {
      setIsLoading(true);
      setMessages([]);
      try {
        const response = await askTourGuide({
          question: '__INIT_TOUR_GUIDE__',
          role: user.role,
        });
        setMessages([{ role: 'model', content: response }]);
      } catch (error) {
        console.error("AI tour guide error:", error);
        setMessages([{ role: 'model', content: "Sorry, I'm having trouble connecting right now. Please try again in a moment." }]);
      } finally {
        setIsLoading(false);
      }
    };
    getInitialMessage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role]); // Re-fetch if role changes

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await askTourGuide({
        question: input,
        role: user.role,
        conversationHistory: newMessages,
      });

      setMessages(prev => [...prev, { role: 'model', content: response }]);
    } catch (error) {
      console.error("AI tour guide error:", error);
      setMessages(prev => [...prev, { role: 'model', content: "Sorry, I'm having trouble connecting right now. Please try again in a moment." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[60vh]">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'model' && (
                <Avatar className="h-8 w-8">
                  <Image src="/autodrive-ai-icon1.png" alt="AI Guide" width={32} height={32} />
                </Avatar>
              )}
              <div className={`rounded-lg p-3 text-sm max-w-[85%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.role === 'user' && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          {isLoading && messages.length > 0 && (
             <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8 animate-pulse">
                    <Image src="/autodrive-ai-icon1.png" alt="Thinking..." width={32} height={32} />
                </Avatar>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2 border-t p-4">
        <Input
          placeholder="e.g., 'What are CX Scores?'"
          className="flex-1"
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          {isLoading && messages.length > 0 ? <Spinner size="sm" /> : <Send />}
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
