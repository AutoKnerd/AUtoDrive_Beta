
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Lesson } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { Bot, Send, ArrowLeft } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { conductLesson } from '@/ai/flows/lesson-flow';
import { Spinner } from '../ui/spinner';
import { getConsultantActivity, logLessonCompletion } from '@/lib/data';

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

interface LessonViewProps {
  lesson: Lesson;
  isRecommended: boolean;
}

interface CxScores {
    empathy: number;
    listening: number;
    trust: number;
    followUp: number;
    closing: number;
    relationshipBuilding: number;
}

export function LessonView({ lesson, isRecommended }: LessonViewProps) {
  const { user, setUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [cxScores, setCxScores] = useState<CxScores | null>(null);
  const [inputDisabled, setInputDisabled] = useState(false);
  const lessonStarted = useRef(false);

  useEffect(() => {
    async function fetchScores() {
      if (user) {
        const activity = await getConsultantActivity(user.userId);
        if (!activity.length) {
            // Provide some default scores if no history, ensuring one is lowest
            setCxScores({ empathy: 75, listening: 62, trust: 80, followUp: 70, closing: 68, relationshipBuilding: 85 });
            return;
        }
        const total = activity.reduce((acc, log) => {
            acc.empathy += log.empathy;
            acc.listening += log.listening;
            acc.trust += log.trust;
            acc.followUp += log.followUp;
            acc.closing += log.closing;
            acc.relationshipBuilding += log.relationshipBuilding;
            return acc;
        }, { empathy: 0, listening: 0, trust: 0, followUp: 0, closing: 0, relationshipBuilding: 0 });

        const count = activity.length;
        setCxScores({
            empathy: Math.round(total.empathy / count),
            listening: Math.round(total.listening / count),
            trust: Math.round(total.trust / count),
            followUp: Math.round(total.followUp / count),
            closing: Math.round(total.closing / count),
            relationshipBuilding: Math.round(total.relationshipBuilding / count),
        });
      }
    }
    fetchScores();
  }, [user]);

  const handleAiResponse = async (responseText: string) => {
    try {
      const result = JSON.parse(responseText);
      if (result && result.xpAwarded) {
        const summaryText = `Lesson Complete!\n\nFocus Area: ${result.trainedTrait}\nXP Awarded: ${result.xpAwarded}\nSummary: ${result.coachSummary}\nNext Steps: Focus on ${result.recommendedNextFocus}.`;
        const finalMessage: Message = { sender: 'ai', text: summaryText };
        setMessages(prev => [...prev, finalMessage]);
        setInputDisabled(true);
        setIsCompleted(true);

        if (user && cxScores) {
            const updatedUser = await logLessonCompletion({
                userId: user.userId,
                lessonId: lesson.lessonId,
                xpGained: result.xpAwarded,
                isRecommended,
                scores: cxScores,
            });
            setUser(updatedUser);
        }
        return;
      }
    } catch (e) {
      // Not JSON, so it's a regular message
    }
    const aiMessage: Message = { sender: 'ai', text: responseText };
    setMessages(prev => [...prev, aiMessage]);
  };

  useEffect(() => {
    async function startLesson() {
      if (lessonStarted.current || !cxScores) return;
      lessonStarted.current = true;
      setIsLoading(true);
      
      const initialResponse = await conductLesson({
        lessonId: lesson.lessonId,
        lessonTitle: lesson.title,
        customScenario: lesson.customScenario,
        history: [],
        userMessage: 'Start the lesson.',
        cxScores,
      });

      await handleAiResponse(initialResponse);
      setIsLoading(false);
    }
    startLesson();
  }, [cxScores, lesson.lessonId, lesson.title, lesson.customScenario]); 


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || inputDisabled || !cxScores) return;

    const currentInput = input;
    const userMessage: Message = { sender: 'user', text: currentInput };
    
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const response = await conductLesson({
        lessonId: lesson.lessonId,
        lessonTitle: lesson.title,
        customScenario: lesson.customScenario,
        history: newMessages, // Send the most up-to-date history
        userMessage: currentInput,
        cxScores,
    });
    
    await handleAiResponse(response);
    setIsLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-3xl h-[80vh] flex flex-col">
            <CardHeader>
                <CardTitle>{lesson.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-4">
                    <div className="space-y-4">
                        {isLoading && messages.length === 0 && (
                            <div className="flex h-full w-full items-center justify-center">
                                <Spinner size="lg" />
                            </div>
                        )}
                        {messages.map((message, index) => (
                        <div key={index} className={`flex items-start gap-4 ${message.sender === 'user' ? 'justify-end' : ''}`}>
                            {message.sender === 'ai' && (
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback><Bot /></AvatarFallback>
                                </Avatar>
                            )}
                            <div className={`rounded-lg p-3 text-sm ${message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                <p style={{whiteSpace: 'pre-wrap'}}>{message.text}</p>
                            </div>
                            {message.sender === 'user' && user && (
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={user.avatarUrl} />
                                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                        ))}
                        {isLoading && messages.length > 0 && (
                            <div className="flex items-start gap-4">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback><Bot /></AvatarFallback>
                                </Avatar>
                                <div className="rounded-lg p-3 bg-muted flex items-center">
                                    <Spinner size="sm" />
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
            <CardFooter>
                {isCompleted ? (
                    <Button asChild className="w-full">
                        <Link href="/">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Dashboard
                        </Link>
                    </Button>
                ) : (
                    <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
                        <Input
                            id="message"
                            placeholder="Type your response..."
                            className="flex-1"
                            autoComplete="off"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isLoading || inputDisabled}
                        />
                        <Button type="submit" size="icon" disabled={isLoading || inputDisabled}>
                            <Send className="h-4 w-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </form>
                )}
            </CardFooter>
        </Card>
    </div>
  );
}
