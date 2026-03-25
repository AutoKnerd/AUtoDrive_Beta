import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';

const IndividualTrial: React.FC = () => {
    const { pathname, hash } = useLocation();
    const enrollmentRef = useRef<HTMLElement | null>(null);
    const startTrialAnchor = '/start-trial#trial-enrollment';
    const directCheckoutUrl = import.meta.env.VITE_STRIPE_CHECKOUT_URL as string | undefined;

    useEffect(() => {
        if ((pathname === '/start-trial' && hash === '#trial-enrollment') && enrollmentRef.current) {
            enrollmentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [pathname, hash]);

    const handleCheckoutStart = () => {
        if (directCheckoutUrl) {
            window.location.assign(directCheckoutUrl);
            return;
        }

        window.location.assign('/api/create-checkout-session');
    };

    return (
        <div>
            <Navigation />

            <section className="dark-section" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden', background: '#0a0b0d' }}>
                {/* Visual Background - Architectural Dealership */}
                <div style={{
                    position: 'absolute', top: 0, right: 0, width: '100%', height: '100%',
                    backgroundImage: 'url("/hero-visual-dealership.png")', backgroundSize: 'cover', backgroundPosition: 'center',
                    maskImage: 'linear-gradient(to right, rgba(0,0,0,1) 30%, rgba(0,0,0,0.1) 100%)',
                    WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,1) 30%, rgba(0,0,0,0.1) 100%)',
                    opacity: 0.5,
                    zIndex: 1,
                    filter: 'grayscale(0.2) brightness(0.7)'
                }}></div>

                {/* Subtle Structural Grid Overlay */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundImage: `
                        linear-gradient(rgba(102, 184, 72, 0.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(102, 184, 72, 0.05) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                    maskImage: 'radial-gradient(circle at 70% 50%, black, transparent 70%)',
                    WebkitMaskImage: 'radial-gradient(circle at 70% 50%, black, transparent 70%)',
                    zIndex: 2
                }}></div>

                <div className="container" style={{ position: 'relative', zIndex: 10 }}>
                    <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--logo-blue)', fontWeight: 800, marginBottom: '2.5rem' }}>
                        Individual Trial
                    </p>
                    <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 5.2rem)', lineHeight: 0.98, color: '#fff', maxWidth: '920px', marginBottom: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                        Try AutoDriveCX — Individual Trial
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.85)', maxWidth: '780px', fontSize: 'clamp(1.1rem, 2.2vw, 1.45rem)', marginBottom: '1.2rem', lineHeight: 1.5, fontWeight: 500 }}>
                        "Sharpen your execution where it matters most: the dealership floor."
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.55)', maxWidth: '720px', fontSize: '1.05rem', marginBottom: '3.5rem', lineHeight: 1.6 }}>
                        Designed for consultants, advisors, and BDC professionals who want sharper execution under pressure.
                    </p>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <Link to={startTrialAnchor} className="btn btn-primary" style={{ padding: '1.2rem 3.2rem', fontSize: '1rem', boxShadow: '0 20px 40px rgba(102, 184, 72, 0.25)' }}>
                            Start Your 30-Day Trial
                        </Link>
                        <Link to="/sample-rollout-plan" className="btn btn-ghost" style={{ padding: '1.2rem 2.8rem', textDecoration: 'none', fontSize: '1rem' }}>
                            Explore Dealership Implementation
                        </Link>
                    </div>
                </div>
            </section>

            <section className="light-section" style={{ padding: 'var(--spacing-large) 5%', background: '#FFFFFF', position: 'relative' }}>
                <div className="container" style={{ maxWidth: '980px', textAlign: 'center' }}>
                    <div style={{ width: '40px', height: '1px', background: 'rgba(0,0,0,0.1)', margin: '0 auto 3rem' }}></div>
                    <blockquote style={{ padding: '0', border: 'none', position: 'relative' }}>
                        <p style={{ fontSize: 'clamp(1.2rem, 2.5vw, 1.85rem)', lineHeight: 1.5, color: '#111827', fontWeight: 600, fontStyle: 'italic', position: 'relative', zIndex: 1 }}>
                            "We use apps to improve our physical fitness.
                            <br />
                            AutoDriveCX applies the same idea to the habits that drive our mental and financial performance."
                        </p>
                    </blockquote>
                    <div style={{ width: '40px', height: '1px', background: 'rgba(0,0,0,0.1)', margin: '3rem auto 0' }}></div>
                </div>
            </section>

            <section className="light-section" style={{ padding: 'var(--spacing-huge) 5%', background: '#F8FAFC' }}>
                <div className="container">
                    <div style={{ marginBottom: '4rem', maxWidth: '800px' }}>
                        <h2 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', marginBottom: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#111827' }}>
                            What You Experience
                        </h2>
                        <p style={{ color: '#6B7280', fontSize: '1.15rem', lineHeight: 1.6 }}>
                            A direct look at how the system sharpens daily execution.
                        </p>
                    </div>
                    <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                        <article style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                            <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--logo-blue)', fontWeight: 800, marginBottom: '1.2rem' }}>Execution Reps</p>
                            <p style={{ color: '#111827', marginBottom: '1.5rem', fontSize: '1.1rem', lineHeight: 1.6 }}>
                                Short operational reps designed to sharpen customer interaction habits during real dealership workflow.
                            </p>
                            <p style={{ color: '#374151', fontWeight: 700, fontSize: '0.9rem', opacity: 0.8 }}>Typical time commitment: 3-5 minutes.</p>
                        </article>
                        <article style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                            <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--logo-green)', fontWeight: 800, marginBottom: '1.2rem' }}>Behavior Logging</p>
                            <p style={{ color: '#111827', fontSize: '1.1rem', lineHeight: 1.6 }}>
                                Every rep is logged and time-stamped so consistency becomes measurable.
                            </p>
                        </article>
                        <article style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                            <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#111827', fontWeight: 800, marginBottom: '1.2rem' }}>Execution Drift Awareness</p>
                            <p style={{ color: '#111827', fontSize: '1.1rem', lineHeight: 1.6 }}>
                                Detect when execution begins drifting before performance drops.
                            </p>
                        </article>
                    </div>
                    <div style={{ marginTop: '4rem', textAlign: 'center' }}>
                        <Link to={startTrialAnchor} className="btn btn-primary" style={{ padding: '1.2rem 3rem' }}>
                            Start Your 30-Day Trial
                        </Link>
                    </div>
                </div>
            </section>

            <section className="light-section" style={{ padding: 'var(--spacing-huge) 5%', background: '#FFFFFF' }}>
                <div className="container">
                    <div style={{ marginBottom: '5rem', maxWidth: '800px' }}>
                        <h2 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', marginBottom: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#111827' }}>
                            How The Trial Works
                        </h2>
                        <p style={{ color: '#6B7280', fontSize: '1.15rem', lineHeight: 1.6 }}>
                            Simple activation. Immediate execution visibility.
                        </p>
                    </div>
                    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '900px' }}>
                        {[
                            { step: '01', title: 'Activate Trial', text: 'Create your account and enter the trial environment instantly.' },
                            { step: '02', title: 'Run Daily Execution Reps', text: 'Short reps reinforce customer interaction habits during real workflow.' },
                            { step: '03', title: 'See Behavior Signals', text: 'AutoDriveCX detects and surfaces execution drift patterns.' }
                        ].map((item, i) => (
                            <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '24px', display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--logo-blue)', opacity: 0.3 }}>{item.step}</span>
                                <div>
                                    <p style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.4rem', color: '#111827' }}>{item.title}</p>
                                    <p style={{ color: '#4B5563', lineHeight: 1.6 }}>{item.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="light-section" style={{ padding: 'var(--spacing-huge) 5%', background: '#F8FAFC' }}>
                <div className="container" style={{ maxWidth: '980px' }}>
                    <div style={{ marginBottom: '4rem', maxWidth: '900px' }}>
                        <h2 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', marginBottom: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#111827' }}>
                            Who This Trial Is For
                        </h2>
                        <p style={{ color: '#4B5563', lineHeight: 1.7, marginBottom: '1.1rem', fontSize: '1.1rem' }}>
                            AutoDriveCX is designed for dealership professionals who want sharper execution during real customer interactions.
                        </p>
                        <p style={{ color: '#111827', lineHeight: 1.7, marginBottom: '0.9rem', fontSize: '1.1rem', fontWeight: 600 }}>
                            This trial is a strong fit for:
                        </p>
                        <ul style={{ color: '#4B5563', lineHeight: 1.7, paddingLeft: '1.25rem', marginBottom: '1.2rem', display: 'grid', gap: '0.7rem' }}>
                            <li>
                                <strong>Sales Consultants</strong>
                                <br />
                                Sharpen customer conversations and maintain consistency during busy showroom days.
                            </li>
                            <li>
                                <strong>Service Advisors</strong>
                                <br />
                                Improve service-lane communication and customer confidence during write-ups.
                            </li>
                            <li>
                                <strong>BDC Professionals</strong>
                                <br />
                                Strengthen appointment discipline, response quality, and follow-up consistency.
                            </li>
                            <li>
                                <strong>High-Performing Operators</strong>
                                <br />
                                Maintain strong habits even when dealership pressure rises.
                            </li>
                        </ul>
                        <p style={{ color: '#4B5563', lineHeight: 1.7, fontSize: '1.1rem' }}>
                            If your performance depends on consistent customer interactions, the trial will make sense immediately.
                        </p>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '3.2rem', maxWidth: '900px' }}>
                        <h3 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', marginBottom: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#111827' }}>
                            Running a Dealership Instead?
                        </h3>
                        <p style={{ color: '#4B5563', lineHeight: 1.7, marginBottom: '1rem', fontSize: '1.1rem' }}>
                            The individual trial is designed for individual operators, not full dealership deployment.
                        </p>
                        <p style={{ color: '#111827', lineHeight: 1.7, marginBottom: '0.9rem', fontSize: '1.1rem', fontWeight: 600 }}>
                            It may not be the right path if:
                        </p>
                        <ul style={{ color: '#4B5563', lineHeight: 1.7, paddingLeft: '1.25rem', marginBottom: '1.2rem', display: 'grid', gap: '0.7rem' }}>
                            <li>You are evaluating AutoDriveCX for store-wide implementation</li>
                            <li>You need manager dashboards, team visibility, or cross-department rollout</li>
                            <li>Your dealership requires accounting setup or enterprise billing</li>
                        </ul>
                        <p style={{ color: '#4B5563', lineHeight: 1.7, marginBottom: '2rem', fontSize: '1.1rem' }}>
                            In those cases, the best next step is a short implementation call so we can map the system to your dealership structure.
                        </p>
                        <a href="https://calendar.app.google/QWRXFH9k24iZnBZWA" target="_blank" rel="noopener" className="btn btn-primary" style={{ padding: '1.1rem 2.4rem' }}>
                            Schedule Dealership Implementation
                        </a>
                    </div>
                </div>
            </section>

            <section id="trial-enrollment" ref={enrollmentRef} className="dark-section" style={{ padding: 'var(--spacing-huge) 5%', marginTop: '0', background: '#0a0b0d', position: 'relative', overflow: 'hidden' }}>
                {/* Structural Grid Overlay */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundImage: `
                        linear-gradient(rgba(102, 184, 72, 0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(102, 184, 72, 0.03) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                    maskImage: 'radial-gradient(circle at 50% 50%, black, transparent 80%)',
                    WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black, transparent 80%)',
                    zIndex: 1
                }}></div>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at 50% 50%, rgba(102, 184, 72, 0.05) 0%, transparent 70%)', zIndex: 2 }}></div>
                <div className="container" style={{ maxWidth: '820px', position: 'relative', zIndex: 10 }}>
                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <h2 style={{ color: '#fff', marginBottom: '1rem', fontSize: 'clamp(2.5rem, 6vw, 4.2rem)', fontWeight: 800, letterSpacing: '-0.03em' }}>
                            Trial Enrollment
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.2rem' }}>
                            Start your 30-day trial.
                        </p>
                    </div>

                    <div style={{ background: '#111418', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: 'clamp(2rem, 6vw, 4.5rem)', maxWidth: '720px', margin: '0 auto', boxShadow: '0 40px 100px rgba(0,0,0,0.6)' }}>
                        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
                            <h3 style={{ color: '#fff', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', marginBottom: '1rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                AutoDriveCX <span style={{ color: 'var(--logo-blue)' }}>Individual</span>
                            </h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '0', lineHeight: 1.6, fontSize: '1.1rem' }}>
                                For sales consultants, service advisors, and BDC professionals.
                            </p>
                        </div>

                        <div style={{ marginBottom: '3.5rem' }}>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 800, marginBottom: '1.8rem', textAlign: 'center' }}>
                                Included in the trial
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                {[
                                    'Daily Execution Reps (3–5 minutes)',
                                    'Behavioral performance tracking',
                                    'Execution drift detection',
                                    'Habit execution improvement'
                                ].map((feature, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'rgba(255,255,255,0.85)', fontSize: '1rem' }}>
                                        <div style={{ width: '6px', height: '6px', background: 'var(--logo-green)', borderRadius: '2px' }}></div>
                                        {feature}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', margin: '0 0 3.5rem', padding: '2.5rem 0', textAlign: 'center' }}>
                            <p style={{ color: '#fff', fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                                30-Day Free Trial
                            </p>
                            <p style={{ fontWeight: 500, color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', marginTop: '0.7rem' }}>
                                Then $50/month • Cancel anytime.
                            </p>
                        </div>

                        <button type="button" onClick={handleCheckoutStart} className="btn btn-primary" style={{ width: '100%', fontWeight: 800, padding: '1.5rem', fontSize: '1.1rem', borderRadius: '12px', boxShadow: '0 20px 40px rgba(102, 184, 72, 0.25)' }}>
                            Start Your 30-Day Trial
                        </button>

                        <p style={{ marginTop: '1.8rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', textAlign: 'center', fontWeight: 500 }}>
                            No charge today. Secure checkout via Stripe.
                        </p>
                    </div>
                </div>
            </section>

            <section className="light-section" style={{ padding: 'var(--spacing-huge) 5%', background: '#FFFFFF' }}>
                <div className="container" style={{ maxWidth: '900px', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--logo-blue)', fontWeight: 800, marginBottom: '2rem' }}>
                        Scale to Your Store
                    </p>
                    <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', marginBottom: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#111827' }}>
                        Dealership Deployment
                    </h2>
                    <p style={{ color: '#4B5563', lineHeight: 1.7, marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 500 }}>
                        AutoDriveCX is designed to stabilize execution across the entire dealership.
                    </p>
                    <p style={{ color: '#4B5563', lineHeight: 1.7, marginBottom: '1rem', fontSize: '1.1rem' }}>
                        Dealership rollout happens through a structured implementation call.
                    </p>
                    <p style={{ color: '#6B7280', lineHeight: 1.7, marginBottom: '3rem', fontSize: '1.1rem', maxWidth: '720px', margin: '0 auto 3.5rem' }}>
                        Many professionals begin with the individual trial and later introduce AutoDriveCX to their managers or dealer principals.
                    </p>
                    <a href="https://calendar.app.google/QWRXFH9k24iZnBZWA" target="_blank" rel="noopener" className="btn btn-primary" style={{ padding: '1.2rem 3rem' }}>
                        Schedule Dealership Implementation
                    </a>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default IndividualTrial;
