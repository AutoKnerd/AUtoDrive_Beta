import React, { useEffect, useState } from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';

const SampleRolloutPlan: React.FC = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 768);
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return (
        <div className="sample-rollout-plan-page">
            <Navigation />

            {/* HERO - KEEP DARK FOR CONTRAST */}
            <section
                className="dark-section"
                style={{
                    minHeight: '70vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '80px 5%',
                    background: '#0a0b0d',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '100%',
                        height: '100%',
                        backgroundImage:
                            'linear-gradient(to right, rgba(10,11,13,1) 20%, rgba(10,11,13,0.4) 60%, rgba(10,11,13,0.8) 100%), url("/hero-visual-dealership.png")',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        opacity: 0.45,
                        zIndex: 1,
                        filter: 'grayscale(0.35) brightness(0.7)'
                    }}
                />

                <div className="container hero-content" style={{ position: 'relative', zIndex: 10 }}>
                    <div style={{ maxWidth: '920px' }}>
                        <h1
                            style={{
                                fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
                                color: '#fff',
                                fontWeight: 800,
                                marginBottom: '24px',
                                letterSpacing: '-0.03em'
                            }}
                        >
                            Inside the 90-Day Rollout
                        </h1>
                        <h2
                            style={{
                                fontSize: 'clamp(1.1rem, 2.5vw, 1.8rem)',
                                color: 'var(--logo-blue)',
                                fontWeight: 500,
                                marginBottom: '24px',
                                opacity: 0.9
                            }}
                        >
                            See how AutoDriveCX installs inside a dealership while normal operations continue.
                        </h2>
                        <p
                            style={{
                                fontSize: '1.05rem',
                                color: 'rgba(255,255,255,0.65)',
                                lineHeight: 1.6,
                                maxWidth: '680px',
                                marginBottom: '40px'
                            }}
                        >
                            Managers introduce the system in phases while sales, service, BDC, and support teams continue working with customers.
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <a
                                href="https://calendar.app.google/QWRXFH9k24iZnBZWA"
                                target="_blank"
                                rel="noopener"
                                className="btn btn-primary"
                                style={{ textDecoration: 'none', padding: '1rem 2rem' }}
                            >
                                Schedule Implementation Call
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 1: Deployment Overview (White) */}
            <section style={{ background: '#fff', padding: '72px 5%', borderBottom: '1px solid #f0f0f0' }}>
                <div className="container" style={{ maxWidth: '980px' }}>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em' }}>
                        Deployment Overview
                    </h2>
                    <p style={{ fontSize: '1.08rem', color: '#4b5563', lineHeight: 1.7, marginBottom: '1rem' }}>
                        AutoDriveCX installs through a simple four-phase rollout designed for normal dealership operations.
                    </p>
                    <p style={{ fontSize: '1.08rem', color: '#4b5563', lineHeight: 1.7, marginBottom: '1rem' }}>
                        Each phase introduces a new layer of the system while teams continue working with customers.
                    </p>
                    <p style={{ fontSize: '1.08rem', color: '#111827', lineHeight: 1.7, fontWeight: 700 }}>
                        Activation window: approximately 90 days
                    </p>
                </div>
            </section>

            {/* SECTION 2: 90-Day Deployment Map (F9FAFB) */}
            <section
                id="deployment-map"
                style={{ background: '#F9FAFB', padding: '72px 5%' }}
            >
                <div className="container">
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em', color: '#111827' }}>
                        90-Day Deployment Map
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '32px' }}>
                        {[
                            { week: 'Week 1–2', stage: 'Activation' },
                            { week: 'Week 3–4', stage: 'Manager Execution Oversight' },
                            { week: 'Week 5–8', stage: 'Department Adoption' },
                            { week: 'Week 9–12', stage: 'Operational Stabilization' }
                        ].map((item) => (
                            <div key={item.week} style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '24px', textAlign: 'center', background: '#FFFFFF', minHeight: '148px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <p style={{ fontSize: '0.82rem', color: '#6B7280', marginBottom: '8px' }}>
                                    {item.week}
                                </p>
                                <p style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{item.stage}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 3: Dealership Reality Check (White) */}
            <section style={{ background: '#fff', padding: '72px 5%', borderBottom: '1px solid #f0f0f0' }}>
                <div className="container" style={{ maxWidth: '860px' }}>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em' }}>
                        Dealership Reality Check
                    </h2>
                    <p style={{ fontSize: '1.06rem', color: '#4b5563', lineHeight: 1.75, marginBottom: '1rem' }}>
                        Dealership floors are unpredictable.
                    </p>
                    <p style={{ fontSize: '1.06rem', color: '#4b5563', lineHeight: 1.75, marginBottom: '1rem' }}>
                        Managers are interrupted constantly.
                        <br />
                        Service lanes fill unexpectedly.
                        <br />
                        Sales teams juggle walk-ins, appointments, and digital leads at the same time.
                    </p>
                    <p style={{ fontSize: '1.06rem', color: '#4b5563', lineHeight: 1.75, marginBottom: '1rem' }}>
                        Consistency doesn&apos;t fail because people don&apos;t care.
                    </p>
                    <p style={{ fontSize: '1.06rem', color: '#4b5563', lineHeight: 1.75, marginBottom: '1rem' }}>
                        It fails because execution drifts under pressure.
                    </p>
                    <p style={{ fontSize: '1.06rem', color: '#4b5563', lineHeight: 1.75, marginBottom: '1rem' }}>
                        AutoDriveCX was designed specifically for this environment.
                    </p>
                    <p style={{ fontSize: '1.06rem', color: '#4b5563', lineHeight: 1.75, marginBottom: '1rem' }}>
                        Execution happens inside normal workflow.
                        <br />
                        Managers reinforce standards between real customer interactions.
                        <br />
                        Behavior is measured continuously instead of waiting for CSI reports weeks later.
                    </p>
                    <div style={{ marginTop: '48px', borderTop: '1px solid #f0f0f0', paddingTop: '40px' }}>
                        <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em' }}>
                            See How AutoDriveCX Would Deploy in Your Store
                        </h3>
                        <p style={{ fontSize: '1.02rem', color: '#4b5563', lineHeight: 1.7, marginBottom: '0.7rem' }}>
                            Every dealership installs the system slightly differently depending on department structure and leadership coverage.
                        </p>
                        <p style={{ fontSize: '1.02rem', color: '#4b5563', lineHeight: 1.7, marginBottom: '32px' }}>
                            Schedule a short implementation call to walk through how deployment would look in your store.
                        </p>
                        <a
                            href="https://calendar.app.google/QWRXFH9k24iZnBZWA"
                            target="_blank"
                            rel="noopener"
                            className="btn btn-primary"
                            style={{ textDecoration: 'none' }}
                        >
                            Schedule Implementation Call
                        </a>
                    </div>
                </div>
            </section>

            {/* SECTION 4: 90-Day Rollout Timeline (F9FAFB) */}
            <section style={{ background: '#F9FAFB', padding: '72px 5%' }}>
                <div className="container">
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em' }}>
                        The 90-Day Rollout Timeline
                    </h2>
                    <div style={{ position: 'relative', maxWidth: '900px', marginTop: '40px' }}>
                        {/* Vertical Timeline Guide */}
                        <div style={{ position: 'absolute', left: isMobile ? '12px' : '24px', top: '0', bottom: '0', width: '1px', background: '#E5E7EB', zIndex: 1 }} />

                        {[
                            {
                                title: 'Phase 1 — Activation',
                                week: 'Week 1-2',
                                items: ['Dashboard installed', 'Manager Champion assigned', 'Primary CX priority identified', 'Manager onboarding session completed'],
                                outcome: 'Leadership gains visibility into behavior patterns across departments.'
                            },
                            {
                                title: 'Phase 2 — Manager Execution Oversight',
                                week: 'Week 3-4',
                                items: ['First Execution Reps activated', 'Managers begin observation logging', 'Coaching prompts begin appearing'],
                                outcome: 'Behavior data begins accumulating across the dealership.'
                            },
                            {
                                title: 'Phase 3 — Department Adoption',
                                week: 'Week 5-8',
                                items: ['Execution Reps embedded into daily workflows', 'Weekly execution review sessions begin', 'Behavior trendlines become visible'],
                                outcome: 'Managers begin identifying drift before performance degrades.'
                            },
                            {
                                title: 'Phase 4 — Operational Stabilization',
                                week: 'Week 9-12',
                                items: ['Coaching triggers activate automatically', 'Manager operating rhythm stabilizes', 'Cross-department CX alignment improves'],
                                outcome: 'Consistency becomes structural rather than motivational.'
                            }
                        ].map((block) => (
                            <div key={block.title} style={{ position: 'relative', paddingLeft: isMobile ? '34px' : '46px', marginBottom: '40px', zIndex: 2 }}>
                                {/* Timeline Dot Overlaying the Line */}
                                <div style={{ position: 'absolute', left: isMobile ? '7px' : '19px', top: '24px', width: '10px', height: '10px', borderRadius: '50%', background: '#111827', border: '2px solid #F9FAFB' }} />

                                <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', padding: '24px', borderRadius: '10px' }}>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', color: '#111827' }}>{block.title}</h3>
                                    <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: '#6B7280', marginBottom: '16px' }}>
                                        {block.week}
                                    </p>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0' }}>
                                        {block.items.map((item) => (
                                            <li key={item} style={{ marginBottom: '0.65rem', color: '#4b5563', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                <span style={{ color: '#E5E7EB', marginTop: '-2px' }}>•</span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                    <div style={{ borderTop: '1px solid #f9fafb', paddingTop: '16px' }}>
                                        <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Outcome:</p>
                                        <p style={{ fontSize: '0.95rem', color: '#6B7280', lineHeight: 1.5 }}>{block.outcome}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 5: The AutoDriveCX Operating Rhythm (White) */}
            <section style={{ background: '#fff', padding: '72px 5%', borderBottom: '1px solid #f0f0f0' }}>
                <div className="container">
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em', color: '#111827' }}>
                        The AutoDriveCX Operating Rhythm
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1px', background: '#E5E7EB', border: '1px solid #E5E7EB' }}>
                        {[
                            { label: 'Daily', text: 'Execution Reps maintain customer-facing standards across departments.' },
                            { label: 'Weekly', text: 'Managers operate the Weekly Execution Review.' },
                            { label: 'Monthly', text: 'Ownership reviews compliance and drift trends.' }
                        ].map((item) => (
                            <div key={item.label} style={{ background: '#fff', padding: '32px' }}>
                                <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, color: '#6B7280', marginBottom: '12px' }}>
                                    {item.label}
                                </p>
                                <p style={{ fontSize: '1rem', color: '#4b5563', lineHeight: 1.6 }}>{item.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 6: How Managers Operate (F9FAFB) */}
            <section style={{ background: '#F9FAFB', padding: '72px 5%' }}>
                <div className="container">
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em' }}>
                        How Managers Operate AutoDriveCX
                    </h2>
                    <p style={{ fontSize: '1.05rem', color: '#4b5563', marginBottom: '32px' }}>
                        Managers run AutoDriveCX through three simple actions.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1px', background: '#E5E7EB', border: '1px solid #E5E7EB' }}>
                        {[
                            {
                                title: 'Assign Execution Reps',
                                body: 'Managers assign daily Execution Reps aligned to current CX priorities.',
                                time: 'Time required: 2-3 minutes'
                            },
                            {
                                title: 'Observe Behavior',
                                body: 'Managers observe normal customer interactions across departments while the system logs patterns and surfaces execution drift automatically.',
                                time: 'Time required: no additional meetings'
                            },
                            {
                                title: 'Reinforce Weekly',
                                body: 'Managers lead a short weekly execution review using an auto-generated coaching guide.',
                                time: 'Time required: 10-15 minutes'
                            }
                        ].map((item) => (
                            <div key={item.title} style={{ background: '#fff', padding: '32px' }}>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '16px' }}>{item.title}</h3>
                                <p style={{ fontSize: '0.98rem', color: '#4b5563', lineHeight: 1.6, marginBottom: '20px' }}>{item.body}</p>
                                <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>{item.time}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 7: What Teams Experience (White) */}
            <section style={{ background: '#fff', padding: '72px 5%', borderBottom: '1px solid #f0f0f0' }}>
                <div className="container" style={{ maxWidth: '980px' }}>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em' }}>
                        What Teams Experience
                    </h2>
                    <p style={{ fontSize: '1.08rem', color: '#4b5563', lineHeight: 1.7, marginBottom: '1rem' }}>
                        Frontline teams interact with AutoDriveCX through short Execution Reps embedded directly in daily workflow.
                    </p>
                    <p style={{ fontSize: '1.08rem', color: '#111827', lineHeight: 1.7, marginBottom: '1rem' }}>
                        Not training. <br />
                        Not meetings. <br />
                        Just repetition.
                    </p>
                    <p style={{ fontSize: '1.08rem', color: '#111827', fontWeight: 700, lineHeight: 1.7 }}>
                        Typical daily participation: about 5 minutes
                    </p>
                </div>
            </section>

            {/* SECTION 8: Behavior Stabilization Milestones (F9FAFB) */}
            <section style={{ background: '#F9FAFB', padding: '72px 5%' }}>
                <div className="container">
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '32px', letterSpacing: '-0.02em', color: '#111827' }}>
                        Behavior Stabilization Milestones
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '32px' }}>
                        {[
                            {
                                day: 'Day 1',
                                title: 'System Activated',
                                description: 'Managers gain immediate visibility into execution patterns across the dealership.'
                            },
                            {
                                day: 'Day 30',
                                title: 'Behavior Patterns Visible',
                                description: 'Managers begin identifying execution drift across departments.'
                            },
                            {
                                day: 'Day 60',
                                title: 'Early Drift Correction',
                                description: 'Coaching triggers begin correcting execution gaps before performance degrades.'
                            },
                            {
                                day: 'Day 90',
                                title: 'Operational Stability',
                                description: 'Consistency becomes structural across the dealership.'
                            }
                        ].map((item) => (
                            <div key={item.day} style={{ border: '1px solid #E5E7EB', borderRadius: '10px', padding: '24px', background: '#FFFFFF' }}>
                                <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, color: '#9CA3AF', marginBottom: '8px' }}>
                                    {item.day}
                                </p>
                                <p style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', lineHeight: 1.35 }}>{item.title}</p>
                                <p style={{ fontSize: '0.9rem', color: '#6B7280', lineHeight: 1.5, marginTop: '16px' }}>{item.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 9: Why This Rollout Works (White) */}
            <section style={{ background: '#fff', padding: '72px 5%' }}>
                <div className="container" style={{ maxWidth: '980px' }}>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em' }}>
                        Why This Rollout Works
                    </h2>
                    <p style={{ fontSize: '1.08rem', color: '#4b5563', lineHeight: 1.7, marginBottom: '1rem' }}>
                        Most dealership initiatives fail because they attempt large behavioral changes all at once.
                    </p>
                    <p style={{ fontSize: '1.08rem', color: '#4b5563', lineHeight: 1.7, marginBottom: '1rem' }}>
                        AutoDriveCX installs consistency gradually.
                    </p>
                    <p style={{ fontSize: '1.08rem', color: '#111827', lineHeight: 1.7 }}>
                        Managers lead the change while teams continue normal operations.
                    </p>
                </div>
            </section>

            {/* SECTION 10: Is This Happening? (DARK FOR FINAL CTA) */}
            <section
                className="dark-section"
                style={{ background: '#0a0b0d', padding: '80px 5%', borderTop: '1px solid rgba(255,255,255,0.08)' }}
            >
                <div className="container" style={{ maxWidth: '860px' }}>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '32px', letterSpacing: '-0.02em', color: '#fff' }}>
                        Is This Happening in Your Store?
                    </h2>
                    <p style={{ fontSize: '1.04rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.7, marginBottom: '24px' }}>
                        If these patterns sound familiar, it&apos;s worth seeing how AutoDriveCX would deploy inside your store.
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 40px 0' }}>
                        {[
                            'CSI or gross slipping without a clear root cause',
                            'Managers stuck in fire drills instead of coaching and execution oversight',
                            'Inconsistent handoffs between sales, service, and BDC',
                            'Standards changing by shift, by person, or by mood'
                        ].map((item) => (
                            <li key={item} style={{ fontSize: '1.04rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.6, marginBottom: '12px', display: 'flex', gap: '12px' }}>
                                <span style={{ color: 'var(--logo-blue)' }}>•</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                    <p style={{ fontSize: '1.04rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.7, marginBottom: '16px' }}>
                        The implementation call is a short working session to review how AutoDriveCX would deploy inside your store.
                        <br />
                        We map AutoDriveCX to your dealership structure and confirm whether the deployment model fits.
                    </p>
                    <p style={{ fontSize: '1.04rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: '40px' }}>
                        No commitment. No disruption plan. Just clarity.
                    </p>
                    <p style={{ fontSize: '1.04rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.7, marginBottom: '32px' }}>
                        Most dealerships use this call to pressure-test whether the system would actually work inside their store before making any decisions.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <a
                            href="https://calendar.app.google/QWRXFH9k24iZnBZWA"
                            target="_blank"
                            rel="noopener"
                            className="btn btn-primary"
                            style={{ textDecoration: 'none' }}
                        >
                            Schedule Implementation Call
                        </a>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default SampleRolloutPlan;
