import {NextResponse} from 'next/server';
import type {Stripe} from 'stripe';

import {stripe} from '@/lib/stripe';
import {updateUserSubscriptionStatus} from '@/lib/data';

export async function POST(req: Request) {
  let event: Stripe.Event;

  const signature = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;

  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, signature!, secret);
  } catch (err: any) {
    console.log(`❌ Error message: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, {status: 400});
  }

  // Successfully constructed event.
  console.log('✅ Success:', event.id);

  // Cast event data to Stripe object.
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log('Checkout session completed:', session);
    
    const customerId = session.customer as string;
    await updateUserSubscriptionStatus(customerId, 'active');
    
  } else if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
     const subscription = event.data.object as Stripe.Subscription;
     const customerId = subscription.customer as string;
     const newStatus = subscription.status === 'active' ? 'active' : 'inactive';
     
     if (subscription.cancel_at_period_end && newStatus === 'active') {
        // The subscription is set to be cancelled at the end of the period, but is still active.
        // We can choose to reflect this in the UI, but for now, we'll keep it simple.
     } else {
        await updateUserSubscriptionStatus(customerId, newStatus);
     }
  }
   else {
    console.warn(`🤷‍♀️ Unhandled event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event.
  return NextResponse.json({received: true});
}
