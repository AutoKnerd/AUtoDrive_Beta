'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { CheckCircle2, Lock, Shield, Target, Trophy, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { conductPppLesson } from '@/ai/flows/ppp-lesson-flow';
import { applyCxRatingsToUser, completePppLessonPass, incrementPppAbandonmentCounter } from '@/lib/data.client';
import { getPppLessonsForLevel, getPppLevelTitle, PPP_DAILY_PASS_LIMIT, PPP_TOUR_UNLOCKED_LESSON_COUNT } from '@/lib/ppp/definitions';
import { getPppLevelKey, normalizePppUserState } from '@/lib/ppp/state';
import { ASSISTANT_AVATAR_SRC, ASSISTANT_NAME } from '@/lib/assistant';
import type { Ratings } from '@/lib/definitions';

type ChatMessage = {
  sender: 'user' | 'ai';
  text: string;
};

type PppEvaluation = {
  outcome: 'pass' | 'not_yet';
  coachFeedback: string;
  nextStep: string;
  adaptationHint: string;
  ratings: Ratings;
};

function parsePppEvaluation(responseText: string): PppEvaluation | null {
  const clamp = (value: unknown, fallback: number): number => {
    if (value === null || value === undefined) return fallback;
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  };

  const fallbackRatingsForOutcome = (outcome: 'pass' | 'not_yet'): Ratings => {
    const fallback = outcome === 'pass' ? 78 : 45;
    return {
      empathy: fallback,
      listening: fallback,
      trust: fallback,
      followUp: fallback,
      closing: fallback,
      relationship: fallback,
    };
  };

  const parseRatings = (raw: unknown, outcome: 'pass' | 'not_yet'): Ratings => {
    const fallback = fallbackRatingsForOutcome(outcome);
    if (!raw || typeof raw !== 'object') return fallback;
    const source = raw as Partial<Record<keyof Ratings, unknown>>;
    return {
      empathy: clamp(source.empathy, fallback.empathy),
      listening: clamp(source.listening, fallback.listening),
      trust: clamp(source.trust, fallback.trust),
      followUp: clamp(source.followUp, fallback.followUp),
      closing: clamp(source.closing, fallback.closing),
      relationship: clamp(source.relationship, fallback.relationship),
    };
  };

  const parseOutcome = (text: string): 'pass' | 'not_yet' | null => {
    const match = text.match(/["']?outcome["']?\s*[:=]\s*["']?(pass|not_yet)["']?/i);
    if (!match?.[1]) return null;
    return match[1].toLowerCase() === 'pass' ? 'pass' : 'not_yet';
  };

  const extractField = (text: string, field: 'coachFeedback' | 'nextStep' | 'adaptationHint'): string | null => {
    const quoted = text.match(new RegExp(`["']?${field}["']?\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,|}|$)`, 'i'));
    if (quoted?.[1]) return quoted[1].trim();

    const loose = text.match(new RegExp(`["']?${field}["']?\\s*:\\s*([^\\n\\r}]+)`, 'i'));
    if (!loose?.[1]) return null;
    return loose[1].trim().replace(/^["']/, '').replace(/["'],?$/, '').trim();
  };

  const extractNumericField = (text: string, field: string): number | null => {
    const match = text.match(new RegExp(`["']?${field}["']?\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, 'i'));
    if (!match?.[1]) return null;
    const numeric = Number(match[1]);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const candidates: string[] = [];
  const trimmed = responseText.trim();
  if (trimmed.length > 0) candidates.push(trimmed);

  const fencedBlocks = responseText.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const match of fencedBlocks) {
    const block = match[1]?.trim();
    if (block) candidates.push(block);
  }

  const firstBrace = responseText.indexOf('{');
  const lastBrace = responseText.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(responseText.slice(firstBrace, lastBrace + 1).trim());
  }

  for (const candidate of candidates) {
    const normalized = candidate
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"');

    try {
      const parsed = JSON.parse(normalized);
      if (!parsed || typeof parsed !== 'object') continue;
      const outcome = parsed.outcome;
      if (outcome !== 'pass' && outcome !== 'not_yet') continue;

      return {
        outcome,
        coachFeedback: typeof parsed.coachFeedback === 'string' ? parsed.coachFeedback : 'Keep practicing this behavior.',
        nextStep: typeof parsed.nextStep === 'string' ? parsed.nextStep : 'Retry with a more structured response.',
        adaptationHint: typeof parsed.adaptationHint === 'string' ? parsed.adaptationHint : 'Difficulty will adapt to support your next attempt.',
        ratings: parseRatings(parsed.ratings, outcome),
      };
    } catch {
      const outcome = parseOutcome(normalized);
      if (!outcome) continue;

      const extractedRatings = {
        empathy: extractNumericField(normalized, 'empathy'),
        listening: extractNumericField(normalized, 'listening'),
        trust: extractNumericField(normalized, 'trust'),
        followUp: extractNumericField(normalized, 'followUp'),
        closing: extractNumericField(normalized, 'closing'),
        relationship: extractNumericField(normalized, 'relationship'),
      };

      return {
        outcome,
        coachFeedback: extractField(normalized, 'coachFeedback') || 'Keep practicing this behavior.',
        nextStep: extractField(normalized, 'nextStep') || 'Retry with a more structured response.',
        adaptationHint: extractField(normalized, 'adaptationHint') || 'Difficulty will adapt to support your next attempt.',
        ratings: parseRatings(extractedRatings, outcome),
      };
    }
  }

  return null;
}

interface PppInterfaceProps {
  featureEnabled?: boolean;
}

export function PppInterface({ featureEnabled }: PppInterfaceProps) {
  const { user, setUser, isTouring } = useAuth();
  const { toast } = useToast();
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failureCounts, setFailureCounts] = useState<Record<string, number>>({});
  const [attemptOutcome, setAttemptOutcome] = useState<'pass' | 'not_yet' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);
  const activeLessonIdRef = useRef<string | null>(null);
  const attemptOutcomeRef = useRef<'pass' | 'not_yet' | null>(null);
  const userIdRef = useRef<string | null>(null);

  const ppp = useMemo(() => (user ? normalizePppUserState(user) : null), [user]);

  const currentLessons = useMemo(() => {
    if (!user || !ppp) return [];
    return getPppLessonsForLevel(ppp.level, user.role);
  }, [user, ppp]);

  const levelKey = ppp ? getPppLevelKey(ppp.level) : null;
  const passedLessons = useMemo(() => {
    if (!ppp || !levelKey) return new Set<string>();
    return new Set(ppp.lessonsPassed[levelKey] || []);
  }, [ppp, levelKey]);

  const firstUnpassedIndex = useMemo(() => {
    if (!currentLessons.length) return -1;
    return currentLessons.findIndex((lesson) => !passedLessons.has(lesson.lessonId));
  }, [currentLessons, passedLessons]);

  const activeLesson = useMemo(() => {
    if (!activeLessonId) return null;
    return currentLessons.find((lesson) => lesson.lessonId === activeLessonId) || null;
  }, [activeLessonId, currentLessons]);

  const ensureScrollToBottom = () => {
    setTimeout(() => {
      const viewport = chatScrollAreaRef.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
        return;
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 10);
  };

  useEffect(() => {
    activeLessonIdRef.current = activeLessonId;
    attemptOutcomeRef.current = attemptOutcome;
    userIdRef.current = user?.userId || null;
  }, [activeLessonId, attemptOutcome, user?.userId]);

  useEffect(() => {
    return () => {
      const shouldTrackAbandonment = !!activeLessonIdRef.current && attemptOutcomeRef.current !== 'pass';
      if (!shouldTrackAbandonment || !userIdRef.current) return;
      void incrementPppAbandonmentCounter(userIdRef.current).catch(() => {
        // Silent by design.
      });
    };
  }, []);

  const buildFlowInput = (userMessage: string, history: ChatMessage[]) => {
    if (!activeLesson || !user || !ppp) return null;
    const failures = failureCounts[activeLesson.lessonId] || 0;
    return {
      lessonId: activeLesson.lessonId,
      level: activeLesson.level,
      levelTitle: activeLesson.levelTitle,
      userRole: user.role,
      stageTitle: activeLesson.stageTitle,
      skillTitle: activeLesson.skill,
      scenario: activeLesson.scenario,
      repeatedFailures: failures,
      abandonmentCounter: ppp.abandonmentCounter,
      history,
      userMessage,
    };
  };

  async function startLesson(lessonId: string) {
    if (!user || !ppp) return;

    const lesson = currentLessons.find((entry) => entry.lessonId === lessonId);
    if (!lesson) return;

    const lessonIndex = currentLessons.findIndex((entry) => entry.lessonId === lessonId);
    const unlocked = isTouring
      ? lessonIndex < PPP_TOUR_UNLOCKED_LESSON_COUNT
      : (passedLessons.has(lessonId) || lessonIndex === firstUnpassedIndex);
    if (!unlocked) {
      toast({
        title: 'Lesson locked',
        description: isTouring
          ? `Tour mode unlocks only the first ${PPP_TOUR_UNLOCKED_LESSON_COUNT} PPP lessons.`
          : 'Complete lessons in order. No skipping levels or lessons.',
      });
      return;
    }

    if (!passedLessons.has(lessonId) && ppp.dailyLimitReached) {
      toast({
        variant: 'destructive',
        title: 'Daily PPP limit reached',
        description: `You can pass up to ${PPP_DAILY_PASS_LIMIT} PPP lessons per day. Come back tomorrow.`,
      });
      return;
    }

    setActiveLessonId(lessonId);
    setMessages([]);
    setInput('');
    setAttemptOutcome(null);
    setIsLoading(true);

    try {
      const response = await conductPppLesson({
        lessonId: lesson.lessonId,
        level: lesson.level,
        levelTitle: lesson.levelTitle,
        userRole: user.role,
        stageTitle: lesson.stageTitle,
        skillTitle: lesson.skill,
        scenario: lesson.scenario,
        repeatedFailures: failureCounts[lesson.lessonId] || 0,
        abandonmentCounter: ppp.abandonmentCounter,
        history: [],
        userMessage: 'Start PPP lesson.',
      });
      setMessages([{ sender: 'ai', text: response }]);
      ensureScrollToBottom();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not start lesson',
        description: error?.message || 'Please try again.',
      });
      setActiveLessonId(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeLesson || !input.trim() || isLoading) return;

    const text = input.trim();
    const userMessage: ChatMessage = { sender: 'user', text };
    const nextHistory = [...messages, userMessage];

    setMessages(nextHistory);
    setInput('');
    setIsLoading(true);

    try {
      const flowInput = buildFlowInput(text, nextHistory);
      if (!flowInput) return;

      const response = await conductPppLesson(flowInput);
      const inlineEvaluation = parsePppEvaluation(response);
      if (inlineEvaluation) {
        await applyPppEvaluation(inlineEvaluation);
      } else {
        setMessages((prev) => [...prev, { sender: 'ai', text: response }]);
        ensureScrollToBottom();
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Message failed',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function applyPppEvaluation(evaluation: PppEvaluation) {
    if (!activeLesson || !user) return;

    const evaluationMessage = [
      evaluation.outcome === 'pass' ? 'Outcome: PASS' : 'Outcome: NOT YET',
      evaluation.coachFeedback,
      `Next Step: ${evaluation.nextStep}`,
      `Adaptation: ${evaluation.adaptationHint}`,
    ].join('\n');

    setMessages((prev) => [...prev, { sender: 'ai', text: evaluationMessage }]);
    ensureScrollToBottom();

    if (evaluation.outcome === 'pass') {
      const result = await completePppLessonPass(user.userId, activeLesson.level, activeLesson.lessonId);
      const cxUpdate = await applyCxRatingsToUser(user.userId, evaluation.ratings);
      setUser(cxUpdate.updatedUser);
      setAttemptOutcome('pass');
      toast({
        title: result.alreadyPassed ? 'Already Passed' : 'PPP Lesson Passed',
        description: result.alreadyPassed
          ? 'This lesson was already completed. CX scores still updated from this attempt.'
          : `+${result.xpAwarded} XP awarded. ${result.levelAdvanced ? 'Next level unlocked.' : 'Next lesson unlocked.'} CX scores updated.`,
      });
      return;
    }

    const cxUpdate = await applyCxRatingsToUser(user.userId, evaluation.ratings);
    setUser(cxUpdate.updatedUser);
    setAttemptOutcome('not_yet');
    setFailureCounts((prev) => ({
      ...prev,
      [activeLesson.lessonId]: (prev[activeLesson.lessonId] || 0) + 1,
    }));
    toast({
      title: 'Not Yet',
      description: `No XP awarded. CX scores were updated from this attempt. Retry and ${ASSISTANT_NAME} will adapt support.`,
    });
  }

  async function handleExitAttempt() {
    if (!activeLesson || !user) return;

    if (attemptOutcome === null) {
      try {
        await incrementPppAbandonmentCounter(user.userId);
      } catch {
        // Silent by design.
      }
    }

    setActiveLessonId(null);
    setMessages([]);
    setInput('');
    setAttemptOutcome(null);
  }

  if (!user || !ppp) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const isFeatureEnabled = featureEnabled ?? ppp.enabled;

  if (!isFeatureEnabled) {
    return (
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertTitle>PPP is currently disabled</AlertTitle>
        <AlertDescription>
          AutoKnerd: The Next Gear is not active for your account right now.
        </AlertDescription>
      </Alert>
    );
  }

  if (ppp.certified) {
    return (
      <Card className="overflow-hidden border-amber-300/70 bg-gradient-to-br from-slate-950 via-black to-slate-900 text-amber-100 shadow-[0_0_28px_rgba(245,158,11,0.25)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Trophy className="h-6 w-6 text-amber-300" />
            PPP LVL 10 Certified
          </CardTitle>
          <CardDescription className="text-amber-200/90">
            Institutional Mastery complete. You have finished all AutoKnerd: The Next Gear levels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-300/40 bg-black/30 p-4">
            <p className="text-sm leading-relaxed">
              Completion status: Certified. Badge unlocked: black + gold mastery badge.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr] lg:[--ppp-panel-height:calc(100svh-15rem)]">
      {activeLesson && (
        <Card className="order-1 flex min-h-[620px] flex-col lg:order-2 lg:h-[var(--ppp-panel-height)] lg:max-h-[var(--ppp-panel-height)] lg:min-h-0 lg:overflow-hidden">
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{activeLesson.stageTitle}</CardTitle>
                <CardDescription className="mt-1 text-xs">{activeLesson.skill}</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleExitAttempt}>
                Exit Attempt
              </Button>
            </div>
            {attemptOutcome === 'pass' && (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Pass recorded. XP awarded and progression updated.
              </div>
            )}
            {attemptOutcome === 'not_yet' && (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <XCircle className="h-3.5 w-3.5" />
                Not Yet. Retry immediately. Difficulty will adapt.
              </div>
            )}
          </CardHeader>
          <CardContent className="flex flex-1 min-h-0 flex-col gap-3 p-4">
            <ScrollArea ref={chatScrollAreaRef} className="min-h-0 flex-1 rounded-md border p-3">
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={`${message.sender}-${index}`}
                    className={`flex items-start gap-2 ${message.sender === 'user' ? 'justify-end' : ''}`}
                  >
                    {message.sender === 'ai' && (
                      <Avatar className="h-7 w-7">
                        <Image src={ASSISTANT_AVATAR_SRC} alt={ASSISTANT_NAME} width={28} height={28} />
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                        message.sender === 'user' ? 'bg-[#7CC242] text-slate-950' : 'bg-muted'
                      }`}
                    >
                      {message.text}
                    </div>
                    {message.sender === 'user' && (
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Spinner size="sm" /> {ASSISTANT_NAME} is thinking...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Respond to ${ASSISTANT_NAME}...`}
                disabled={isLoading || attemptOutcome === 'pass'}
              />
              <Button
                type="submit"
                className="bg-[#7CC242] text-slate-950 hover:bg-[#8ED24F]"
                disabled={isLoading || attemptOutcome === 'pass' || input.trim().length === 0}
              >
                Send
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card
        className={activeLesson
          ? 'order-2 flex flex-col lg:order-1 lg:h-[var(--ppp-panel-height)] lg:max-h-[var(--ppp-panel-height)] lg:min-h-0 lg:overflow-hidden'
          : undefined}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-5 w-5 text-[#9BD85B]" />
            LVL {ppp.level} - {getPppLevelTitle(ppp.level)}
          </CardTitle>
          <CardDescription>
            Complete every lesson in sequence. Unlimited retries. XP only on pass.
          </CardDescription>
        </CardHeader>
        <CardContent className={activeLesson ? 'space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto' : 'space-y-4'}>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Current level completion</span>
              <span>{ppp.progressPercentage}%</span>
            </div>
            <Progress value={ppp.progressPercentage} className="h-3 [&>div]:bg-gradient-to-r [&>div]:from-[#7CC242] [&>div]:to-[#5EA93D]" />
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Today&apos;s passes</span>
              <span>{ppp.dailyPassCount}/{PPP_DAILY_PASS_LIMIT}</span>
            </div>
            {ppp.dailyLimitReached && (
              <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                Daily PPP limit reached. New lessons unlock tomorrow.
              </p>
            )}
          </div>

          <div className="space-y-2">
            {currentLessons.map((lesson, index) => {
              const passed = passedLessons.has(lesson.lessonId);
              const isDailyLocked = !passed && ppp.dailyLimitReached;
              const isTourLocked = isTouring && index >= PPP_TOUR_UNLOCKED_LESSON_COUNT;
              const unlocked = isTourLocked
                ? false
                : (isTouring
                  ? index < PPP_TOUR_UNLOCKED_LESSON_COUNT
                  : (passed || index === firstUnpassedIndex));
              const selected = activeLesson?.lessonId === lesson.lessonId;

              return (
                <button
                  key={lesson.lessonId}
                  type="button"
                  disabled={!unlocked || isDailyLocked}
                  onClick={() => startLesson(lesson.lessonId)}
                  className={[
                    'w-full rounded-lg border p-3 text-left transition',
                    selected ? 'border-[#7CC242]/70 bg-[#7CC242]/12' : 'border-border bg-card',
                    (!unlocked || isDailyLocked) ? 'opacity-60' : '',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{index + 1}. {lesson.stageShortTitle}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{lesson.skill}</p>
                    </div>
                    {isTourLocked ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : isDailyLocked ? (
                      <Lock className="h-4 w-4 text-amber-300" />
                    ) : passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : unlocked ? (
                      <Target className="h-4 w-4 text-[#9BD85B]" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
