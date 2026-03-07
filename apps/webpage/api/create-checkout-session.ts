import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceId = process.env.STRIPE_PRICE_ID ?? 'price_1SsMKIIqxH0CMe02hpGHxYq0';

function getBaseUrl(req: { headers?: Record<string, string | string[] | undefined> }) {
    const protoHeader = req.headers?.['x-forwarded-proto'];
    const hostHeader = req.headers?.['x-forwarded-host'] ?? req.headers?.host;

    const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
    const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;

    if (host) {
        return `${proto ?? 'https'}://${host}`;
    }

    return process.env.PUBLIC_SITE_URL ?? 'http://localhost:5173';
}

export default async function handler(
    req: { method?: string; headers?: Record<string, string | string[] | undefined> },
    res: {
        status: (code: number) => { json: (body: unknown) => void; end: (body?: string) => void };
        setHeader: (name: string, value: string) => void;
    }
) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    if (!stripeSecretKey) {
        res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
        return;
    }

    try {
        const stripe = new Stripe(stripeSecretKey);
        const baseUrl = getBaseUrl(req);

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: stripePriceId, quantity: 1 }],
            subscription_data: {
                trial_period_days: 30
            },
            custom_text: {
                submit: {
                    message: '30-day free trial. Cancel anytime before billing begins.'
                }
            },
            success_url: `${baseUrl}/trial-success`,
            cancel_url: `${baseUrl}/start-trial`
        });

        if (!session.url) {
            res.status(500).json({ error: 'Stripe did not return a checkout URL' });
            return;
        }

        res.setHeader('Location', session.url);
        res.status(303).end();
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to create checkout session';
        res.status(500).json({ error: message });
    }
}
