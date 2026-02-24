'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Briefcase, CheckCircle2, Lock, Target, Trophy, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { conductSaasPppLesson } from '@/ai/flows/saas-ppp-lesson-flow';
import {
  completeSaasPppLessonPass,
  incrementSaasPppAbandonmentCounter,
  setSaasPppPrimaryChannel,
  setSaasPppSecondaryChannel,
} from '@/lib/data.client';
import {
  SAAS_LEAD_CHANNEL_OPTIONS,
  getSaasPppChannelLabel,
  getSaasPppLessonsForLevel,
  getSaasPppLevelTitle,
  sanitizeSaasLeadChannel,
  type SaasLeadChannel,
  type SaasPppPhase,
} from '@/lib/saas-ppp/definitions';
import { getSaasPppLevelKey, normalizeSaasPppUserState } from '@/lib/saas-ppp/state';
import { ASSISTANT_AVATAR_SRC, ASSISTANT_NAME } from '@/lib/assistant';

type ChatMessage = {
  sender: 'user' | 'ai';
  text: string;
};

type SaasPppEvaluation = {
  outcome: 'pass' | 'not_yet';
  coachFeedback: string;
  nextStep: string;
  adaptationHint: string;
};

function parseSaasPppEvaluation(responseText: string): SaasPppEvaluation | null {
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
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== 'object') continue;
      const outcome = parsed.outcome;
      if (outcome !== 'pass' && outcome !== 'not_yet') continue;

      return {
        outcome,
        coachFeedback: typeof parsed.coachFeedback === 'string' ? parsed.coachFeedback : 'Refine your structure and retry.',
        nextStep: typeof parsed.nextStep === 'string' ? parsed.nextStep : 'Retry with clear authority and pacing.',
        adaptationHint: typeof parsed.adaptationHint === 'string' ? parsed.adaptationHint : 'Next attempt will be adapted for clarity.',
      };
    } catch {
      // Continue parsing candidates.
    }
  }

  return null;
}

interface SaasPppInterfaceProps {
  featureEnabled?: boolean;
}

export function SaasPppInterface({ featureEnabled }: SaasPppInterfaceProps) {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [failureCounts, setFailureCounts] = useState<Record<string, number>>({});
  const [attemptOutcome, setAttemptOutcome] = useState<'pass' | 'not_yet' | null>(null);
  const [channelDraft, setChannelDraft] = useState<SaasLeadChannel | ''>('');
  const [isSavingChannel, setIsSavingChannel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeLessonIdRef = useRef<string | null>(null);
  const attemptOutcomeRef = useRef<'pass' | 'not_yet' | null>(null);
  const userIdRef = useRef<string | null>(null);

  const saasPpp = useMemo(() => (user ? normalizeSaasPppUserState(user) : null), [user]);
  const currentPhase: SaasPppPhase = saasPpp?.currentLevel === 2 ? saasPpp.l2Phase : 'primary';

  const currentLessons = useMemo(() => {
    if (!saasPpp) return [];
    return getSaasPppLessonsForLevel(saasPpp.currentLevel, {
      primaryChannel: saasPpp.primaryChannel,
      secondaryChannel: saasPpp.secondaryChannel,
      phase: currentPhase,
    });
  }, [saasPpp, currentPhase]);

  const levelKey = saasPpp ? getSaasPppLevelKey(saasPpp.currentLevel, currentPhase) : null;
  const passedLessons = useMemo(() => {
    if (!saasPpp || !levelKey) return new Set<string>();
    return new Set(saasPpp.lessonsPassed[levelKey] || []);
  }, [saasPpp, levelKey]);

  const firstUnpassedIndex = useMemo(() => {
    if (!currentLessons.length) return -1;
    return currentLessons.findIndex((lesson) => !passedLessons.has(lesson.lessonId));
  }, [currentLessons, passedLessons]);

  const activeLesson = useMemo(() => {
    if (!activeLessonId) return null;
    return currentLessons.find((lesson) => lesson.lessonId === activeLessonId) || null;
  }, [activeLessonId, currentLessons]);

  const needsPrimaryChannel = saasPpp?.currentLevel === 2 && !saasPpp.primaryChannel;
  const needsSecondaryChannel = saasPpp?.currentLevel === 2 && currentPhase === 'secondary' && !saasPpp.secondaryChannel;
  const needsChannelSelection = !!needsPrimaryChannel || !!needsSecondaryChannel;

  const selectableChannelOptions = useMemo(() => {
    if (!saasPpp) return SAAS_LEAD_CHANNEL_OPTIONS;
    if (needsSecondaryChannel && saasPpp.primaryChannel) {
      return SAAS_LEAD_CHANNEL_OPTIONS.filter((entry) => entry.value !== saasPpp.primaryChannel);
    }
    return SAAS_LEAD_CHANNEL_OPTIONS;
  }, [needsSecondaryChannel, saasPpp]);

  const ensureScrollToBottom = () => {
    setTimeout(() => {
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
      void incrementSaasPppAbandonmentCounter(userIdRef.current).catch(() => {
        // Silent by design.
      });
    };
  }, []);

  useEffect(() => {
    if (!needsChannelSelection) {
      setChannelDraft('');
    }
  }, [needsChannelSelection]);

  const buildFlowInput = (userMessage: string, history: ChatMessage[]) => {
    if (!activeLesson || !user || !saasPpp) return null;
    const failures = failureCounts[activeLesson.lessonId] || 0;
    const activeChannel = currentPhase === 'secondary' ? saasPpp.secondaryChannel : saasPpp.primaryChannel;

    return {
      lessonId: activeLesson.lessonId,
      level: activeLesson.level,
      levelTitle: activeLesson.levelTitle,
      userRole: user.role,
      lessonTitle: activeLesson.title,
      objective: activeLesson.objective,
      scenario: activeLesson.scenario,
      phase: currentPhase,
      channelLabel: getSaasPppChannelLabel(activeChannel),
      repeatedFailures: failures,
      abandonmentCounter: saasPpp.abandonmentCounter,
      history,
      userMessage,
    };
  };

  async function startLesson(lessonId: string) {
    if (!user || !saasPpp || needsChannelSelection) return;

    const lesson = currentLessons.find((entry) => entry.lessonId === lessonId);
    if (!lesson) return;

    const lessonIndex = currentLessons.findIndex((entry) => entry.lessonId === lessonId);
    const unlocked = passedLessons.has(lessonId) || lessonIndex === firstUnpassedIndex;
    if (!unlocked) {
      toast({
        title: 'Lesson locked',
        description: 'Complete lessons in order. No skipping levels or lessons.',
      });
      return;
    }

    setActiveLessonId(lessonId);
    setMessages([]);
    setInput('');
    setAttemptOutcome(null);
    setIsLoading(true);

    try {
      const response = await conductSaasPppLesson({
        lessonId: lesson.lessonId,
        level: lesson.level,
        levelTitle: lesson.levelTitle,
        userRole: user.role,
        lessonTitle: lesson.title,
        objective: lesson.objective,
        scenario: lesson.scenario,
        phase: currentPhase,
        channelLabel: getSaasPppChannelLabel(currentPhase === 'secondary' ? saasPpp.secondaryChannel : saasPpp.primaryChannel),
        repeatedFailures: failureCounts[lesson.lessonId] || 0,
        abandonmentCounter: saasPpp.abandonmentCounter,
        history: [],
        userMessage: 'Start SaaS PPP lesson.',
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
    if (!activeLesson || !input.trim() || isLoading || isEvaluating) return;

    const text = input.trim();
    const userMessage: ChatMessage = { sender: 'user', text };
    const nextHistory = [...messages, userMessage];

    setMessages(nextHistory);
    setInput('');
    setIsLoading(true);

    try {
      const flowInput = buildFlowInput(text, nextHistory);
      if (!flowInput) return;

      const response = await conductSaasPppLesson(flowInput);
      setMessages((prev) => [...prev, { sender: 'ai', text: response }]);
      ensureScrollToBottom();
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

  async function handleEvaluateAttempt() {
    if (!activeLesson || !user) return;

    setIsEvaluating(true);
    try {
      const flowInput = buildFlowInput('@evaluate_saas_ppp', messages);
      if (!flowInput) return;

      const response = await conductSaasPppLesson(flowInput);
      const evaluation = parseSaasPppEvaluation(response);
      if (!evaluation) {
        throw new Error('SaaS PPP evaluator did not return a valid Pass/Not Yet result.');
      }

      const evaluationMessage = [
        evaluation.outcome === 'pass' ? 'Outcome: PASS' : 'Outcome: NOT YET',
        evaluation.coachFeedback,
        `Next Step: ${evaluation.nextStep}`,
        `Adaptation: ${evaluation.adaptationHint}`,
      ].join('\n');

      setMessages((prev) => [...prev, { sender: 'ai', text: evaluationMessage }]);
      ensureScrollToBottom();

      if (evaluation.outcome === 'pass') {
        const result = await completeSaasPppLessonPass(user.userId, activeLesson.level, activeLesson.lessonId);
        setUser(result.updatedUser);
        setAttemptOutcome('pass');

        const contextLabel = result.currentLevel === 2 && result.currentPhase === 'secondary'
          ? 'Primary channel complete. Secondary channel unlocked.'
          : result.certified
            ? 'Certification complete.'
            : result.levelAdvanced
              ? 'Next level unlocked.'
              : 'Progress updated.';

        toast({
          title: result.alreadyPassed ? 'Already Passed' : 'Lesson Passed',
          description: result.alreadyPassed
            ? 'This lesson was already completed. Progress remains unchanged.'
            : `+${result.xpAwarded} XP awarded. ${contextLabel}`,
        });
      } else {
        setAttemptOutcome('not_yet');
        setFailureCounts((prev) => ({
          ...prev,
          [activeLesson.lessonId]: (prev[activeLesson.lessonId] || 0) + 1,
        }));
        toast({
          title: 'Not Yet',
          description: `No XP awarded. Retry now and ${ASSISTANT_NAME} will adapt coaching support.`,
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Evaluation failed',
        description: error?.message || 'Could not evaluate this attempt.',
      });
    } finally {
      setIsEvaluating(false);
    }
  }

  async function handleSaveChannelSelection() {
    if (!user || !channelDraft || isSavingChannel || !saasPpp) return;
    const sanitized = sanitizeSaasLeadChannel(channelDraft);
    if (!sanitized) return;

    setIsSavingChannel(true);
    try {
      const updatedUser = needsPrimaryChannel
        ? await setSaasPppPrimaryChannel(user.userId, sanitized)
        : await setSaasPppSecondaryChannel(user.userId, sanitized);

      setUser(updatedUser);
      setChannelDraft('');
      toast({
        title: needsPrimaryChannel ? 'Primary channel selected' : 'Secondary channel selected',
        description: `${getSaasPppChannelLabel(sanitized)} is now active for LVL 2 training.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Channel update failed',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setIsSavingChannel(false);
    }
  }

  async function handleExitAttempt() {
    if (!activeLesson || !user) return;

    if (attemptOutcome === null) {
      try {
        await incrementSaasPppAbandonmentCounter(user.userId);
      } catch {
        // Silent by design.
      }
    }

    setActiveLessonId(null);
    setMessages([]);
    setInput('');
    setAttemptOutcome(null);
  }

  if (!user || !saasPpp) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const isFeatureEnabled = featureEnabled ?? saasPpp.enabled;

  if (!isFeatureEnabled) {
    return (
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertTitle>SaaS PPP is currently disabled</AlertTitle>
        <AlertDescription>
          SaaS PPP training is not active for your dealership right now.
        </AlertDescription>
      </Alert>
    );
  }

  if (saasPpp.certifiedTimestamp) {
    return (
      <Card className="overflow-hidden border-emerald-300/70 bg-gradient-to-br from-slate-950 via-black to-slate-900 text-emerald-100 shadow-[0_0_28px_rgba(16,185,129,0.25)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Trophy className="h-6 w-6 text-emerald-300" />
            SaaS PPP LVL 5 Certified
          </CardTitle>
          <CardDescription className="text-emerald-200/90">
            Strategic Sales Certification complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-emerald-300/40 bg-black/30 p-4">
            <p className="text-sm leading-relaxed">
              You completed all SaaS PPP levels. Certification is now recorded on your profile.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
      {activeLesson && (
        <Card className="order-1 flex min-h-[620px] flex-col lg:order-2">
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{activeLesson.title}</CardTitle>
                <CardDescription className="mt-1 text-xs">{activeLesson.objective}</CardDescription>
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
                Not Yet. Retry immediately.
              </div>
            )}
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 p-4">
            <ScrollArea className="flex-1 rounded-md border p-3">
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
                        message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
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
                {(isLoading || isEvaluating) && (
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
                disabled={isLoading || isEvaluating || attemptOutcome === 'pass'}
              />
              <Button type="submit" disabled={isLoading || isEvaluating || attemptOutcome === 'pass' || input.trim().length === 0}>
                Send
              </Button>
            </form>

            <Button
              type="button"
              variant="secondary"
              onClick={handleEvaluateAttempt}
              disabled={isLoading || isEvaluating || messages.length === 0 || attemptOutcome === 'pass'}
            >
              Evaluate Attempt (Pass / Not Yet)
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className={activeLesson ? 'order-2 lg:order-1' : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Briefcase className="h-5 w-5 text-emerald-400" />
            LVL {saasPpp.currentLevel} - {getSaasPppLevelTitle(saasPpp.currentLevel)}
          </CardTitle>
          <CardDescription>
            Strategic Sales Certification. Unlimited retries. XP only on pass.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Current level completion</span>
              <span>{saasPpp.currentLevelProgress}%</span>
            </div>
            <Progress value={saasPpp.currentLevelProgress} className="h-3 [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-teal-400" />
          </div>

          {saasPpp.currentLevel === 2 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-sm font-semibold text-foreground">LVL 2 Adaptive Channel Training</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Primary channel: {getSaasPppChannelLabel(saasPpp.primaryChannel)}
                {saasPpp.secondaryChannel ? ` · Secondary channel: ${getSaasPppChannelLabel(saasPpp.secondaryChannel)}` : ''}
              </p>
              {needsChannelSelection && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {needsPrimaryChannel
                      ? 'What is your primary lead generation channel?'
                      : 'Primary channel complete. Select your secondary channel.'}
                  </p>
                  <div className="flex gap-2">
                    <Select value={channelDraft} onValueChange={(value) => setChannelDraft(value as SaasLeadChannel)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select channel" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableChannelOptions.map((option, index) => (
                          <SelectItem key={option.value} value={option.value}>{`${String.fromCharCode(65 + index)}) ${option.label}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" onClick={handleSaveChannelSelection} disabled={!channelDraft || isSavingChannel}>
                      {isSavingChannel ? <Spinner size="sm" /> : 'Save'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!needsChannelSelection && (
            <div className="space-y-2">
              {currentLessons.map((lesson, index) => {
                const passed = passedLessons.has(lesson.lessonId);
                const unlocked = passed || index === firstUnpassedIndex;
                const selected = activeLesson?.lessonId === lesson.lessonId;

                return (
                  <button
                    key={lesson.lessonId}
                    type="button"
                    onClick={() => startLesson(lesson.lessonId)}
                    className={[
                      'w-full rounded-lg border p-3 text-left transition',
                      selected ? 'border-emerald-400 bg-emerald-500/10' : 'border-border bg-card',
                      !unlocked ? 'opacity-60' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{lesson.sequence}. {lesson.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{lesson.objective}</p>
                      </div>
                      {passed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : unlocked ? (
                        <Target className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
