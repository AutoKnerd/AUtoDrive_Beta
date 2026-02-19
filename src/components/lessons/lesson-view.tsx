
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Lesson, InteractionSeverity, Ratings } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { Send, ArrowLeft, ArrowRightToLine } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { conductLesson } from '@/ai/flows/lesson-flow';
import { Spinner } from '../ui/spinner';
import { getConsultantActivity, logLessonCompletion, type LessonCompletionDetails } from '@/lib/data.client';
import { useToast } from '@/hooks/use-toast';
import { assessBehaviorViolation } from '@/lib/moderation/behavior-violation';

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

type LessonCompletionResponse = {
  trainedTrait?: string;
  xpAwarded?: number;
  coachSummary?: string;
  recommendedNextFocus?: string;
  ratings?: Partial<Ratings>;
  severity?: InteractionSeverity;
  flags?: string[];
};

type FinalLessonCompletionResponse = LessonCompletionResponse & {
  trainedTrait: string;
  xpAwarded: number;
  ratings: Ratings;
};

function hasValidCompletionRatings(ratings: Partial<Ratings> | undefined): ratings is Ratings {
  if (!ratings) return false;
  return (
    typeof ratings.empathy === 'number' &&
    typeof ratings.listening === 'number' &&
    typeof ratings.trust === 'number' &&
    typeof ratings.followUp === 'number' &&
    typeof ratings.closing === 'number' &&
    typeof ratings.relationship === 'number'
  );
}

function isValidCompletionResponse(payload: LessonCompletionResponse | null): payload is FinalLessonCompletionResponse {
  if (!payload) return false;
  if (typeof payload.xpAwarded !== 'number' || !Number.isFinite(payload.xpAwarded)) return false;
  if (typeof payload.trainedTrait !== 'string' || payload.trainedTrait.trim().length === 0) return false;
  if (!hasValidCompletionRatings(payload.ratings)) return false;
  return true;
}

function parseLessonCompletionResponse(responseText: string): LessonCompletionResponse | null {
  const candidates: string[] = [];
  const trimmed = responseText.trim();

  if (trimmed.length > 0) {
    candidates.push(trimmed);
  }

  const fencedBlocks = responseText.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const match of fencedBlocks) {
    const block = match[1]?.trim();
    if (block) {
      candidates.push(block);
    }
  }

  const firstBrace = responseText.indexOf('{');
  const lastBrace = responseText.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(responseText.slice(firstBrace, lastBrace + 1).trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') {
        return parsed as LessonCompletionResponse;
      }
    } catch {
      // Ignore and continue trying the next candidate.
    }
  }

  return null;
}

function toFallbackRatings(cxScores: CxScores | null | undefined): Partial<Ratings> | undefined {
  if (!cxScores) return undefined;
  return {
    empathy: cxScores.empathy,
    listening: cxScores.listening,
    trust: cxScores.trust,
    followUp: cxScores.followUp,
    closing: cxScores.closing,
    relationship: cxScores.relationshipBuilding,
  };
}

const STAT_ORDER = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding'] as const;
type StatOrderKey = (typeof STAT_ORDER)[number];

const STAT_LABELS: Record<StatOrderKey, string> = {
  empathy: 'Empathy',
  listening: 'Listening',
  trust: 'Trust',
  followUp: 'Follow Up',
  closing: 'Closing',
  relationshipBuilding: 'Relationship Building',
};

function formatSigned(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded >= 0 ? '+' : '';
  return `${sign}${rounded.toFixed(1)}`;
}

function buildCompletionSummary(
  result: LessonCompletionResponse,
  details?: Pick<LessonCompletionDetails, 'severity' | 'ratingsUsed' | 'statChanges'>,
  displayedXp?: number,
  flags: string[] = []
): string {
  const finalXp = displayedXp ?? result.xpAwarded;
  const lines = [
    'Lesson Complete!',
    '',
    `Focus Area: ${result.trainedTrait}`,
    `XP Awarded: ${finalXp}`,
    `Summary: ${result.coachSummary}`,
    `Next Steps: Focus on ${result.recommendedNextFocus}.`,
  ];

  if (details?.statChanges) {
    lines.push('', 'Score Changes:');
    for (const key of STAT_ORDER) {
      const stat = details.statChanges[key];
      lines.push(
        `${STAT_LABELS[key]}: ${stat.before.toFixed(1)}% -> ${stat.after.toFixed(1)}% (${formatSigned(stat.delta)}) | AI Rating: ${stat.rating.toFixed(0)}`
      );
    }
  }

  if (details) {
    lines.push(
      '',
      `AI Ratings Used: Empathy ${details.ratingsUsed.empathy}, Listening ${details.ratingsUsed.listening}, Trust ${details.ratingsUsed.trust}, Follow Up ${details.ratingsUsed.followUp}, Closing ${details.ratingsUsed.closing}, Relationship ${details.ratingsUsed.relationship}`
    );
    lines.push('', `Severity: ${details.severity}`);
    if (details.severity === 'behavior_violation') {
      lines.push('Behavior note: this interaction was flagged as a behavior violation, so XP penalties are allowed.');
      if (typeof finalXp === 'number' && finalXp < 0) {
        lines.push(`XP Penalty Applied: ${finalXp} (penalties are capped at -100 XP).`);
      }
      if (flags.length > 0) {
        lines.push(`Flags: ${flags.join(', ')}`);
      }
    }
    lines.push('Why this changed: each skill updates independently toward its own AI rating after each lesson.');
  }

  return lines.join('\n');
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
  const finalizingLesson = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    async function fetchScores() {
      if (!user) return;
      const rollingStats = user.stats;
      const empathy = rollingStats?.empathy?.score;
      const listening = rollingStats?.listening?.score;
      const trust = rollingStats?.trust?.score;
      const followUp = rollingStats?.followUp?.score;
      const closing = rollingStats?.closing?.score;
      const relationship = rollingStats?.relationship?.score;

      const hasValidRollingScores = [
        empathy,
        listening,
        trust,
        followUp,
        closing,
        relationship,
      ].every((value) => typeof value === 'number' && Number.isFinite(value));

      if (hasValidRollingScores) {
        setCxScores({
          empathy: Math.round(empathy as number),
          listening: Math.round(listening as number),
          trust: Math.round(trust as number),
          followUp: Math.round(followUp as number),
          closing: Math.round(closing as number),
          relationshipBuilding: Math.round(relationship as number),
        });
        return;
      }

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

  const handleAiResponse = async (responseText: string, conversationHistory?: Message[]) => {
    const result = parseLessonCompletionResponse(responseText);

    if (isValidCompletionResponse(result)) {
      if (finalizingLesson.current || isCompleted) return;
      finalizingLesson.current = true;
      let completionDetails: Pick<LessonCompletionDetails, 'severity' | 'ratingsUsed' | 'statChanges'> | undefined;
      let displayedXp = result.xpAwarded;
      let mergedFlags = result.flags ?? [];

      if (user) {
        const fallbackRatings = toFallbackRatings(cxScores);
        const userMessages = (conversationHistory ?? messages)
          .filter(message => message.sender === 'user')
          .map(message => message.text);
        const moderation = assessBehaviorViolation({
          userMessages,
          ratings: result.ratings ?? fallbackRatings,
          xpAwarded: result.xpAwarded,
        });
        mergedFlags = Array.from(new Set([...(result.flags ?? []), ...moderation.flags]));
        const effectiveSeverity: InteractionSeverity =
          moderation.violated ? 'behavior_violation' : (result.severity ?? 'normal');
        const effectiveRatings = moderation.adjustedRatings ?? result.ratings ?? fallbackRatings;
        const effectiveXpAwarded = moderation.adjustedXpAwarded ?? result.xpAwarded;
        displayedXp = effectiveXpAwarded;

        try {
          const completion = await logLessonCompletion({
            userId: user.userId,
            lessonId: lesson.lessonId,
            xpGained: effectiveXpAwarded,
            isRecommended,
            ratings: effectiveRatings,
            severity: effectiveSeverity,
            flags: mergedFlags,
            scores: cxScores ?? undefined,
            trainedTrait: result.trainedTrait,
            coachSummary: result.coachSummary,
            recommendedNextFocus: result.recommendedNextFocus,
          });
          setUser(completion.updatedUser);
          completionDetails = {
            severity: completion.severity,
            ratingsUsed: completion.ratingsUsed,
            statChanges: completion.statChanges,
          };

          completion.newBadges.forEach((badge, index) => {
            setTimeout(() => {
              toast({
                title: `Badge Unlocked: ${badge.name}!`,
                description: badge.description,
              });
            }, index * 1200);
          });
        } catch (error: any) {
          console.error('Failed to save lesson completion details:', error);
          toast({
            variant: 'destructive',
            title: 'Saved with limited details',
            description: error?.message || 'We could not calculate score deltas for this lesson.',
          });
        }
      }

      const summaryText = buildCompletionSummary(result, completionDetails, displayedXp, mergedFlags);
      const finalMessage: Message = { sender: 'ai', text: summaryText };
      setMessages(prev => [...prev, finalMessage]);
      setInputDisabled(true);
      setIsCompleted(true);
      return;
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

        await handleAiResponse(initialResponse, []);
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
      
      await handleAiResponse(response, newMessages);
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
      
      await handleAiResponse(response, messages);
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
