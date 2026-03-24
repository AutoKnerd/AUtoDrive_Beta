import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);

function resolveScriptPath(): string {
  return path.join(process.cwd(), 'scripts', 'generate_followup_pdf.py');
}

function safeFilename(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

export async function POST(req: NextRequest) {
  let inputPath = '';
  let outputPath = '';

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, message: 'Invalid request body.' }, { status: 400 });
    }

    const cadence = body.cadence;
    if (!cadence || !Array.isArray(cadence.days) || cadence.days.length === 0) {
      return NextResponse.json({ ok: false, message: 'Cadence data is required.' }, { status: 400 });
    }

    const workId = randomUUID();
    const tmpDir = os.tmpdir();
    inputPath = path.join(tmpDir, `followup-${workId}.json`);
    outputPath = path.join(tmpDir, `followup-${workId}.pdf`);

    await fs.writeFile(inputPath, JSON.stringify(body), 'utf-8');

    const scriptPath = resolveScriptPath();
    await execFileAsync('python3', [scriptPath, inputPath, outputPath], { timeout: 20000 });

    const buffer = await fs.readFile(outputPath);
    const metadata = body.metadata || {};
    const statusPart = safeFilename(String(metadata.dealStatus || 'follow-up-cadence'));
    const daysPart = safeFilename(String(metadata.days || 'plan'));
    const filename = `follow-up-cadence-${statusPart}-${daysPart}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=\"${filename}\"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error?.message || 'Could not generate PDF.' },
      { status: 500 }
    );
  } finally {
    if (inputPath) {
      await fs.unlink(inputPath).catch(() => undefined);
    }
    if (outputPath) {
      await fs.unlink(outputPath).catch(() => undefined);
    }
  }
}
