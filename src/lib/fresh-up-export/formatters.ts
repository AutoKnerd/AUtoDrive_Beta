import type { FreshUpExportBundle, FreshUpExportFormat, FreshUpExportType } from '@/lib/fresh-up-export/types';

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '';
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const body = rows.map((row) => headers.map((key) => csvEscape(row[key])).join(','));
  return [headers.join(','), ...body].join('\n');
}

function toStructuredReport(input: {
  exportType: FreshUpExportType;
  rows?: Array<Record<string, unknown>>;
  data?: Record<string, unknown>;
}): string {
  const titleByType: Record<FreshUpExportType, string> = {
    raw_sessions: 'Fresh Up Raw Session Export',
    dealer_summary: 'Fresh Up Dealer Summary Export',
    consultant_trends: 'Fresh Up Consultant Trend Export',
    manager_coaching: 'Fresh Up Manager Coaching Export',
    autoforge_triggers: 'Fresh Up AutoForge Trigger Export',
    marketing_insights: 'Fresh Up Marketing Insight Export',
    benchmarks: 'Fresh Up Benchmark Export',
    weekly_digest: 'Fresh Up Weekly Digest Export',
    risk_radar: 'Fresh Up CX Risk Radar Export',
    command_center: 'Fresh Up CX Command Center Export',
  };

  const lines: string[] = [`# ${titleByType[input.exportType]}`, ''];
  if (input.rows && input.rows.length > 0) {
    lines.push(`Total Rows: ${input.rows.length}`);
    lines.push('');
    input.rows.slice(0, 15).forEach((row, index) => {
      lines.push(`## Record ${index + 1}`);
      Object.entries(row).forEach(([key, value]) => lines.push(`- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`));
      lines.push('');
    });
    if (input.rows.length > 15) {
      lines.push(`... ${input.rows.length - 15} additional records omitted from preview.`);
    }
    return lines.join('\n');
  }
  if (input.data) {
    Object.entries(input.data).forEach(([section, value]) => {
      lines.push(`## ${section}`);
      if (Array.isArray(value)) {
        value.forEach((entry) => lines.push(`- ${typeof entry === 'object' ? JSON.stringify(entry) : String(entry)}`));
      } else if (value && typeof value === 'object') {
        Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
          lines.push(`- ${key}: ${typeof nested === 'object' ? JSON.stringify(nested) : String(nested)}`);
        });
      } else {
        lines.push(String(value));
      }
      lines.push('');
    });
  }
  return lines.join('\n');
}

export function buildExportBundle(input: {
  exportType: FreshUpExportType;
  format: FreshUpExportFormat;
  rows?: Array<Record<string, unknown>>;
  data?: Record<string, unknown>;
}): FreshUpExportBundle {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `fresh-up-${input.exportType}-${stamp}`;
  if (input.format === 'csv') {
    const content = toCsv(input.rows ?? []);
    return {
      fileName: `${baseName}.csv`,
      mimeType: 'text/csv',
      content,
      preview: content.split('\n').slice(0, 20).join('\n'),
      rowCount: input.rows?.length ?? 0,
    };
  }
  if (input.format === 'json') {
    const payload = input.rows ?? input.data ?? {};
    const content = JSON.stringify(payload, null, 2);
    return {
      fileName: `${baseName}.json`,
      mimeType: 'application/json',
      content,
      preview: content.slice(0, 6000),
      rowCount: input.rows?.length ?? (Array.isArray(payload) ? payload.length : 1),
    };
  }
  const content = toStructuredReport({
    exportType: input.exportType,
    rows: input.rows,
    data: input.data,
  });
  return {
    fileName: `${baseName}.md`,
    mimeType: 'text/markdown',
    content,
    preview: content.slice(0, 8000),
    rowCount: input.rows?.length ?? 1,
  };
}
