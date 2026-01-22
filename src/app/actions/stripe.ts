'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { getUserById, updateUser } from '@/lib/data';

export async function createCheckoutSession(userId: string) {
  if (!userId) {
    throw new Error('User ID is required to create a checkout session.');
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

  // This is a placeholder price ID. In a real application, you would create
  // products and prices in your Stripe dashboard and use their IDs here.
  const placeholderPriceId = 'price_1PKOEaRxK1aUuF8P2ZtA2bC1'; // Replace with a real price ID from your Stripe dash

  try {
     const checkoutSession = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [
            {
                price: placeholderPriceId,
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
    // In a real app, you might want to create a product and price if the placeholder doesn't exist.
    // For this demo, we'll throw an error and ask the user to create one.
    if ((error as any).code === 'resource_missing' && (error as any).param === 'price') {
         throw new Error(`The placeholder Price ID "${placeholderPriceId}" does not exist in your Stripe account. Please create a new recurring Product in your Stripe Dashboard, add a Price to it, and replace the placeholderPriceId in src/app/actions/stripe.ts with the new Price ID.`);
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
