
'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { getUserById, updateUser } from '@/lib/data.server';

export async function createCheckoutSession(userId: string) {
  if (!userId) {
    throw new Error('User ID is required to create a checkout session.');
  }
  
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error('The Stripe Price ID is not configured. Please set NEXT_PUBLIC_STRIPE_PRICE_ID in your .env file.');
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  const origin = headers().get('origin') || 'http://localhost:9002';

  let stripeCustomerId = user.stripeCustomerId;

  // Create a Stripe customer if one doesn't exist
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user.userId,
      },
    });
    stripeCustomerId = customer.id;
    await updateUser(userId, { stripeCustomerId });
  }

  try {
     const checkoutSession = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        mode: 'subscription',
        success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payment/cancel`,
        metadata: {
            userId: userId,
        }
    });

    if (checkoutSession.url) {
      redirect(checkoutSession.url);
    } else {
        throw new Error('Could not create Stripe checkout session.');
    }
  } catch (error) {
    console.error('Stripe Error:', error);
    if ((error as any).code === 'resource_missing' && (error as any).param === 'price') {
         throw new Error(`The Price ID "${priceId}" set in NEXT_PUBLIC_STRIPE_PRICE_ID does not exist in your Stripe account. Please create a new recurring Product in your Stripe Dashboard, add a Price to it, and set its ID in the .env file.`);
    }
    throw new Error('An unexpected error occurred with Stripe.');
  }
}

export async function createCustomerPortalSession(stripeCustomerId: string) {
    if (!stripeCustomerId) {
        throw new Error("Stripe customer ID is required.");
    }
    const origin = headers().get('origin') || 'http://localhost:9002';

    const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${origin}/profile`,
    });

    if (portalSession.url) {
        redirect(portalSession.url);
    } else {
        throw new Error('Could not create customer portal session.');
    }
}
