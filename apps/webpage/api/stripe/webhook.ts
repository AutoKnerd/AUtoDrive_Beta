import type { IncomingMessage, ServerResponse } from 'node:http';

function readForwardTarget(): string {
  const explicitTarget = process.env.AUTODRIVE_STRIPE_WEBHOOK_FORWARD_URL?.trim();
  if (explicitTarget) {
    return explicitTarget;
  }

  const baseUrl =
    process.env.AUTODRIVE_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!baseUrl) {
    throw new Error('Missing AUTODRIVE_STRIPE_WEBHOOK_FORWARD_URL or AUTODRIVE_APP_URL');
  }

  return new URL('/api/stripe/webhook', baseUrl).toString();
}

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

function copyResponse(
  upstream: Response,
  res: ServerResponse,
  body: string
) {
  res.statusCode = upstream.status;

  const contentType = upstream.headers.get('content-type');
  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }

  res.end(body);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const target = readForwardTarget();
    const rawBody = await readRawBody(req);

    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'content-type': req.headers['content-type'] || 'application/json',
        'stripe-signature': Array.isArray(req.headers['stripe-signature'])
          ? req.headers['stripe-signature'][0]
          : req.headers['stripe-signature'] || '',
      },
      body: toArrayBuffer(rawBody),
    });

    const body = await upstream.text();
    copyResponse(upstream, res, body);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook forwarding failed';
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: message }));
  }
}
