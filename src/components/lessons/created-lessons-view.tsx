'use client';

import { useEffect, useState } from 'react';
import type { User } from '@/lib/definitions';
import { getCreatedLessonStatuses } from '@/lib/data.client';
import type { CreatedLessonStatus } from '@/lib/data.client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Clock3, FileText } from 'lucide-react';

interface CreatedLessonsViewProps {
  user: User;
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

export function CreatedLessonsView({ user, refreshKey = 0 }: CreatedLessonsViewProps) {
  const [rows, setRows] = useState<CreatedLessonStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const selectedRow = rows.find((row) => row.lesson.lessonId === selectedLessonId) || rows[0];

  useEffect(() => {
    let active = true;

    const fetchCreatedLessons = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCreatedLessonStatuses(user.userId);
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
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchCreatedLessons();
    return () => {
      active = false;
    };
  }, [user.userId, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-2 py-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="py-2 text-sm text-destructive">{error}</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <FileText className="h-5 w-5" />
        <p className="text-sm">No created lessons found yet.</p>
      </div>
    );
  }

  if (!selectedRow) return null;
  const takenAssignees = selectedRow.assignees.filter((assignee) => assignee.taken);

  return (
    <div className="space-y-4">
      <ScrollArea className="max-h-[45vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lesson</TableHead>
              <TableHead>Target</TableHead>
              <TableHead className="text-center">Assigned</TableHead>
              <TableHead className="text-center">Taken</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Sent</TableHead>
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
                  <TableCell>{formatRoleLabel(row.lesson.role)}</TableCell>
                  <TableCell className="text-center">{row.assignedUserCount}</TableCell>
                  <TableCell className="text-center">
                    {row.assignedUserCount === 0 ? '0' : `${row.takenUserCount}/${row.assignedUserCount}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="inline-flex items-center gap-1.5">
                      {getStatusIcon(row)}
                      {getStatusLabel(row)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.lastAssignedAt ? row.lastAssignedAt.toLocaleDateString() : 'Not sent yet'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold">{selectedRow.lesson.title}</h4>
            <p className="text-sm text-muted-foreground">
              {formatRoleLabel(selectedRow.lesson.role)} • {selectedRow.lesson.category}
            </p>
          </div>
          <Badge variant="secondary">
            {selectedRow.takenUserCount > 1
              ? 'Taken by Multiple'
              : selectedRow.takenUserCount === 1
                ? 'Taken by 1 Person'
                : 'Not Taken Yet'}
          </Badge>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lesson Scenario</p>
          <p className="text-sm">{selectedRow.lesson.customScenario || 'No custom scenario provided.'}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {selectedRow.takenUserCount} of {selectedRow.assignedUserCount} assigned people have taken this lesson.
          </p>
          {selectedRow.assignees.length === 0 ? (
            <p className="text-sm text-muted-foreground">This lesson has not been assigned yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {selectedRow.assignees.map((assignee) => (
                <div key={assignee.userId} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{assignee.name}</p>
                    {assignee.role && <p className="text-xs text-muted-foreground">{formatRoleLabel(assignee.role)}</p>}
                  </div>
                  <Badge variant={assignee.taken ? 'default' : 'outline'}>
                    {assignee.taken ? 'Taken' : 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {takenAssignees.length > 1 && (
            <p className="text-sm font-medium text-emerald-700">
              Multiple people have taken this created lesson.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
