
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Lesson, Badge } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { Send, ArrowLeft, ArrowRightToLine } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { conductLesson } from '@/ai/flows/lesson-flow';
import { Spinner } from '../ui/spinner';
import { getConsultantActivity, logLessonCompletion } from '@/lib/data.client';
import { useToast } from '@/hooks/use-toast';

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
  const { user, setUser, isTouring } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [cxScores, setCxScores] = useState<CxScores | null>(null);
  const [inputDisabled, setInputDisabled] = useState(false);
  const lessonStarted = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    async function fetchScores() {
      if (!user) return;
      try {
        const activity = await getConsultantActivity(user.userId);
        if (!activity.length) {
          // Provide some default scores if no history, ensuring one is lowest.
          setCxScores({ empathy: 75, listening: 62, trust: 80, followUp: 70, closing: 68, relationshipBuilding: 85 });
          return;
        }
        const total = activity.reduce((acc, log) => {
          acc.empathy += log.empathy || 0;
          acc.listening += log.listening || 0;
          acc.trust += log.trust || 0;
          acc.followUp += log.followUp || 0;
          acc.closing += log.closing || 0;
          acc.relationshipBuilding += log.relationshipBuilding || 0;
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
      } catch (error: any) {
        console.error('Failed to load CX scores, falling back to defaults.', error);
        setCxScores({ empathy: 75, listening: 62, trust: 80, followUp: 70, closing: 68, relationshipBuilding: 85 });
        toast({
          variant: 'destructive',
          title: 'Could not load score history',
          description: 'Using baseline scores for this lesson.',
        });
      }
    }
    fetchScores();
  }, [user, toast]);

  const handleAiResponse = async (responseText: string) => {
    try {
      let textToParse = responseText;
      // Strip markdown code block if the AI sends it
      if (textToParse.trim().startsWith('```json')) {
        textToParse = textToParse.substring(textToParse.indexOf('{'), textToParse.lastIndexOf('}') + 1);
      }

      const result = JSON.parse(textToParse);

      if (result && result.xpAwarded) {
        const summaryText = `Lesson Complete!\n\nFocus Area: ${result.trainedTrait}\nXP Awarded: ${result.xpAwarded}\nSummary: ${result.coachSummary}\nNext Steps: Focus on ${result.recommendedNextFocus}.`;
        const finalMessage: Message = { sender: 'ai', text: summaryText };
        setMessages(prev => [...prev, finalMessage]);
        setInputDisabled(true);
        setIsCompleted(true);

        if (user && cxScores) {
            const { updatedUser, newBadges } = await logLessonCompletion({
                userId: user.userId,
                lessonId: lesson.lessonId,
                xpGained: result.xpAwarded,
                isRecommended,
                scores: cxScores,
            });
            setUser(updatedUser);

            newBadges.forEach((badge, index) => {
                setTimeout(() => {
                    toast({
                        title: `Badge Unlocked: ${badge.name}!`,
                        description: badge.description,
                    });
                }, index * 1200);
            });
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
      try {
        const initialResponse = await conductLesson({
          lessonId: lesson.lessonId,
          lessonTitle: lesson.title,
          lessonRole: lesson.role,
          lessonCategory: lesson.category,
          lessonAssociatedTrait: lesson.associatedTrait,
          isRecommendedLesson: isRecommended,
          customScenario: lesson.customScenario,
          history: [],
          userMessage: 'Start the lesson.',
          cxScores,
        });

        await handleAiResponse(initialResponse);
      } catch (error: any) {
        console.error('Failed to start lesson:', error);
        toast({
          variant: 'destructive',
          title: 'Lesson failed to start',
          description: error?.message || 'Please try again.',
        });
      } finally {
        setIsLoading(false);
      }
    }
    startLesson();
  }, [cxScores, lesson.lessonId, lesson.title, lesson.role, lesson.category, lesson.associatedTrait, lesson.customScenario, isRecommended, toast]); 


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || inputDisabled || !cxScores) return;

    const currentInput = input;
    const userMessage: Message = { sender: 'user', text: currentInput };
    
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await conductLesson({
          lessonId: lesson.lessonId,
          lessonTitle: lesson.title,
          lessonRole: lesson.role,
          lessonCategory: lesson.category,
          lessonAssociatedTrait: lesson.associatedTrait,
          isRecommendedLesson: isRecommended,
          customScenario: lesson.customScenario,
          history: newMessages, // Send the most up-to-date history
          userMessage: currentInput,
          cxScores,
      });
      
      await handleAiResponse(response);
    } catch (error: any) {
      console.error('Failed to continue lesson:', error);
      toast({
        variant: 'destructive',
        title: 'Lesson response failed',
        description: error?.message || 'Please try sending again.',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSkipLesson = async () => {
    if (isLoading || inputDisabled || !cxScores) return;
    
    setIsLoading(true);
    setInput(''); 

    try {
      const response = await conductLesson({
          lessonId: lesson.lessonId,
          lessonTitle: lesson.title,
          lessonRole: lesson.role,
          lessonCategory: lesson.category,
          lessonAssociatedTrait: lesson.associatedTrait,
          isRecommendedLesson: isRecommended,
          customScenario: lesson.customScenario,
          history: messages,
          userMessage: '@skip_lesson', // Special keyword for the AI
          cxScores,
      });
      
      await handleAiResponse(response);
    } catch (error: any) {
      console.error('Failed to skip lesson:', error);
      toast({
        variant: 'destructive',
        title: 'Skip failed',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-8">
        <Card className="w-full max-w-3xl h-full flex flex-col bg-card/80 backdrop-blur-sm">
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
                                    <Image src="/autodrive-ai-icon1.png" alt="AutoDrive AI" width={32} height={32} />
                                </Avatar>
                            )}
                            <div className={`rounded-lg p-3 text-sm max-w-[80%] ${message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
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
                        {isLoading && messages.length > 0 && messages[messages.length-1].sender === 'user' && (
                            <div className="flex items-start gap-4">
                                <Avatar className="h-8 w-8 animate-spin">
                                    <Image src="/autodrive-ai-icon1.png" alt="Thinking..." width={32} height={32} />
                                </Avatar>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
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
                         {isTouring && (
                             <Button type="button" variant="outline" size="icon" onClick={handleSkipLesson} disabled={isLoading || inputDisabled} title="Skip to Results">
                                <ArrowRightToLine className="h-4 w-4" />
                                <span className="sr-only">Skip to Results</span>
                            </Button>
                        )}
                    </form>
                )}
            </CardFooter>
        </Card>
    </div>
  );
}
