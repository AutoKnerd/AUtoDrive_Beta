'use client';

import { useEffect, useState } from 'react';
import type { User, UserRole } from '@/lib/definitions';
import { getCreatedLessonStatuses, assignLesson } from '@/lib/data.client';
import type { CreatedLessonStatus } from '@/lib/data.client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { CheckCircle2, Clock3, FileText, RefreshCw } from 'lucide-react';

interface CreatedLessonsViewProps {
  user: User;
  dealershipId?: string | null;
  refreshKey?: number;
}

const formatRoleLabel = (role: string): string => {
  if (role === 'manager') return 'Sales Manager';
  if (role === 'global') return 'All Roles';
  return role;
};

const getStatusLabel = (row: CreatedLessonStatus): string => {
  if (row.assignedUserCount === 0) return 'Created';
  if (row.takenUserCount === 0) return 'Assigned';
  if (row.takenUserCount < row.assignedUserCount) return 'Partially Taken';
  return 'Taken by All';
};

const getStatusIcon = (row: CreatedLessonStatus) => {
  if (row.takenUserCount > 0) return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  return <Clock3 className="h-3.5 w-3.5 text-amber-600" />;
};

const formatDateLabel = (value: unknown): string => {
  if (!value) return 'Not sent';
  try {
    if (value instanceof Date) return value.toLocaleDateString();
    if (typeof value === 'object' && value !== null && 'toDate' in (value as Record<string, unknown>) && typeof (value as any).toDate === 'function') {
      return (value as any).toDate().toLocaleDateString();
    }
    const parsed = new Date(value as any);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString();
  } catch {}
  return 'Not sent';
};

export function CreatedLessonsView({ user, dealershipId = null, refreshKey = 0 }: CreatedLessonsViewProps) {
  const [rows, setRows] = useState<CreatedLessonStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [isReassigning, setIsReassigning] = useState<string | null>(null);
  const [internalRefreshKey, setInternalRefreshKey] = useState(0);
  const { toast } = useToast();
  
  const selectedRow = rows.find((row) => row.lesson.lessonId === selectedLessonId) || rows[0];
  const creatorHasAssignment = !!selectedRow?.assignees.some((assignee) => assignee.userId === user.userId);
  const canOptIn = !!selectedRow
    && !creatorHasAssignment
    && !['Owner', 'Trainer', 'Admin', 'Developer'].includes(user.role);

  useEffect(() => {
    let active = true;
    const fetchCreatedLessons = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCreatedLessonStatuses(user.userId, dealershipId);
        if (!active) return;
        setRows(data);
        setSelectedLessonId((current) => {
          if (current && data.some((row) => row.lesson.lessonId === current)) return current;
          return data[0]?.lesson.lessonId || null;
        });
      } catch (e: any) {
        if (!active) return;
        setRows([]);
        setSelectedLessonId(null);
        setError(e?.message || 'Failed to load created lessons.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchCreatedLessons();
    return () => { active = false; };
  }, [user.userId, dealershipId, refreshKey, internalRefreshKey]);
  
  const handleReassign = async (assigneeId: string, lessonId: string) => {
      setIsReassigning(assigneeId);
      try {
          await assignLesson(assigneeId, lessonId, user.userId);
          toast({ title: "Lesson Re-assigned", description: "A new assignment has been sent to the user." });
          setInternalRefreshKey(prev => prev + 1);
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Re-assignment Failed', description: e.message });
      } finally {
          setIsReassigning(null);
      }
  };

  const handleOptIn = async () => {
    if (!selectedRow) return;
    setIsReassigning(user.userId);
    try {
      await assignLesson(user.userId, selectedRow.lesson.lessonId, user.userId);
      toast({ title: 'Lesson Assigned', description: 'This lesson was added to your Assigned lessons.' });
      setInternalRefreshKey((prev) => prev + 1);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Opt In Failed', description: e.message || 'Could not assign this lesson.' });
    } finally {
      setIsReassigning(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 py-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) return <p className="py-2 text-sm text-destructive">{error}</p>;
  if (rows.length === 0) return <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-muted-foreground"><FileText className="h-5 w-5" /><p className="text-sm">No created lessons found yet.</p></div>;
  if (!selectedRow) return null;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto -mx-4 px-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lesson</TableHead>
              <TableHead className="hidden md:table-cell">Target</TableHead>
              <TableHead className="text-center">Assigned</TableHead>
              <TableHead className="text-center">Taken</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Last Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isSelected = row.lesson.lessonId === selectedRow.lesson.lessonId;
              return (
                <TableRow
                  key={row.lesson.lessonId}
                  className={`cursor-pointer ${isSelected ? 'bg-muted/40' : ''}`}
                  onClick={() => setSelectedLessonId(row.lesson.lessonId)}
                >
                  <TableCell className="font-medium">{row.lesson.title}</TableCell>
                  <TableCell className="hidden md:table-cell">{formatRoleLabel(row.lesson.role)}</TableCell>
                  <TableCell className="text-center">{row.assignedUserCount}</TableCell>
                  <TableCell className="text-center">{row.assignedUserCount === 0 ? '0' : `${row.takenUserCount}/${row.assignedUserCount}`}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="inline-flex items-center gap-1.5">
                      {getStatusIcon(row)}
                      <span className="hidden sm:inline">{getStatusLabel(row)}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{formatDateLabel(row.lastAssignedAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold">{selectedRow.lesson.title}</h4>
              {canOptIn && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOptIn}
                  disabled={isReassigning === user.userId}
                  className="h-7 text-xs"
                >
                  {isReassigning === user.userId ? <Spinner size="sm" /> : 'Opt In'}
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{formatRoleLabel(selectedRow.lesson.role)} • {selectedRow.lesson.category}</p>
          </div>
          <Badge variant="secondary">{selectedRow.takenUserCount > 1 ? 'Taken by Multiple' : selectedRow.takenUserCount === 1 ? 'Taken by 1' : 'Not Taken'}</Badge>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scenario</p>
          <p className="text-sm italic">{selectedRow.lesson.customScenario || 'No scenario provided.'}</p>
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium">Assignee Completion:</p>
          {selectedRow.assignees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assignments yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {selectedRow.assignees.map((assignee) => (
                <div key={assignee.userId} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{assignee.name}</p>
                    {assignee.role && <p className="text-xs text-muted-foreground">{formatRoleLabel(assignee.role)}</p>}
                  </div>
                  {assignee.taken ? (
                      <Button size="sm" variant="ghost" onClick={() => handleReassign(assignee.userId, selectedRow.lesson.lessonId)} disabled={isReassigning === assignee.userId} className="text-xs h-7 text-cyan-400">
                          {isReassigning === assignee.userId ? <Spinner size="sm" /> : <RefreshCw className="mr-1.5 h-3 w-3" />}
                          Re-assign
                      </Button>
                  ) : (
                      <Badge variant="outline" className="text-[10px]">Pending</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
