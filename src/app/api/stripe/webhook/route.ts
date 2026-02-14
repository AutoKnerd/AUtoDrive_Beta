import { NextResponse } from 'next/server';

// TEMPORARY: Stripe is disabled for the beta.
// We keep this route so builds and deployments succeed, but it does not process events.

export async function POST() {
  return NextResponse.json(
    {
      ok: true,
      stripeDisabled: true,
      message: 'Stripe webhook is temporarily disabled for this beta build.',
    },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      stripeDisabled: true,
      message: 'Stripe webhook is temporarily disabled for this beta build.',
    },
    { status: 200 }
  );
}
