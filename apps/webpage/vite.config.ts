import Stripe from 'stripe';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function json(res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void }, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function getBaseUrl(req: { headers?: Record<string, string | string[] | undefined> }, fallback: string) {
  const protoHeader = req.headers?.['x-forwarded-proto'];
  const hostHeader = req.headers?.['x-forwarded-host'] ?? req.headers?.host;
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (host) return `${proto ?? 'http'}://${host}`;
  return fallback;
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const stripeSecretKey = env.STRIPE_SECRET_KEY;
  const stripePriceId = env.STRIPE_PRICE_ID ?? 'price_1SsMKIIqxH0CMe02hpGHxYq0';
  const publicSiteUrl = env.PUBLIC_SITE_URL ?? 'http://localhost:5173';
  const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

  return {
    plugins: [
      react(),
      {
        name: 'local-stripe-api',
        configureServer(server) {
          server.middlewares.use('/api/create-checkout-session', async (req, res) => {
            if (req.method !== 'GET' && req.method !== 'POST') {
              json(res, 405, { error: 'Method not allowed' });
              return;
            }

            if (!stripe) {
              json(res, 500, { error: 'Missing STRIPE_SECRET_KEY' });
              return;
            }

            try {
              const baseUrl = getBaseUrl(req, publicSiteUrl);
              const session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [{ price: stripePriceId, quantity: 1 }],
                subscription_data: { trial_period_days: 30 },
                custom_text: {
                  submit: {
                    message: '30-day free trial. Cancel anytime before billing begins.',
                  },
                },
                success_url: `${baseUrl}/trial-success`,
                cancel_url: `${baseUrl}/start-trial`,
              });

              if (!session.url) {
                json(res, 500, { error: 'Stripe did not return a checkout URL' });
                return;
              }

              res.statusCode = 303;
              res.setHeader('Location', session.url);
              res.end();
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unable to create checkout session';
              json(res, 500, { error: message });
            }
          });
        },
      },
    ],
  };
});
