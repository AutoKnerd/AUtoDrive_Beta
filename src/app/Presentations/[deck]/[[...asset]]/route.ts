import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function responseWithMessage(message: string, status: number) {
  return new Response(message, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deck: string; asset?: string[] }> }
) {
  const { deck, asset = [] } = await params;

  if (!deck || deck.includes('..') || asset.some((segment) => segment.includes('..'))) {
    return responseWithMessage('Invalid presentation path.', 400);
  }

  const presentationsRoot = path.join(process.cwd(), 'Presentations');
  const deckRoot = path.join(presentationsRoot, deck);
  const relativePath = asset.length > 0 ? path.join(...asset) : 'index.html';
  const resolvedPath = path.resolve(deckRoot, relativePath);

  if (resolvedPath !== deckRoot && !resolvedPath.startsWith(`${deckRoot}${path.sep}`)) {
    return responseWithMessage('Invalid presentation path.', 400);
  }

  try {
    const payload = await readFile(resolvedPath);
    const extension = path.extname(resolvedPath).toLowerCase();

    return new Response(payload, {
      headers: {
        'cache-control': 'no-store',
        'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
      },
    });
  } catch {
    return responseWithMessage('Presentation file not found.', 404);
  }
}
