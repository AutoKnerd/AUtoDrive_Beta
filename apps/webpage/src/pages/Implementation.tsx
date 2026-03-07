import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, Shield, Zap, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';

const Implementation: React.FC = () => {
    const [showFloatingCta, setShowFloatingCta] = useState(false);
    const [footerLift, setFooterLift] = useState(0);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            const doc = document.documentElement;
            const maxScrollable = doc.scrollHeight - window.innerHeight;
            const progress = maxScrollable > 0 ? window.scrollY / maxScrollable : 0;
            setShowFloatingCta(progress >= 0.3);

            const pixelsFromBottom = doc.scrollHeight - (window.scrollY + window.innerHeight);
            setFooterLift(Math.max(0, 140 - pixelsFromBottom));
        };

        const onResize = () => {
            setIsMobile(window.innerWidth <= 768);
            onScroll();
        };

        onResize();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);

        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return (
        <div className="implementation-page">
            <Navigation />

            {/* HERO SECTION */}
            <section className="dark-section" style={{
                minHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '0 5%',
                background: '#0a0b0d',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Subtle Architecture background */}
                {/* Architectural Dealership Background */}
                <div style={{
                    position: 'absolute', top: 0, right: 0, width: '100%', height: '100%',
                    backgroundImage: `
                        linear-gradient(to right, rgba(10, 11, 13, 1) 20%, rgba(10, 11, 13, 0.4) 60%, rgba(10, 11, 13, 0.8) 100%),
                        url("/hero-visual-dealership.png")
                    `,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 0.5,
                    zIndex: 1,
                    filter: 'grayscale(0.3) contrast(1.1) brightness(0.7)'
                }}>
                    {/* Subtle Engineering Grid Overlay */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        backgroundImage: `
                            linear-gradient(rgba(102, 184, 72, 0.05) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(102, 184, 72, 0.05) 1px, transparent 1px)
                        `,
                        backgroundSize: '40px 40px',
                        maskImage: 'radial-gradient(circle at 70% 50%, black, transparent 70%)',
                        WebkitMaskImage: 'radial-gradient(circle at 70% 50%, black, transparent 70%)'
                    }}></div>
                </div>

                <div className="container hero-content" style={{ position: 'relative', zIndex: 10 }}>
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        style={{ maxWidth: '900px' }}
                    >
                        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', color: '#fff', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-0.03em' }}>
                            Explore Dealership Implementation
                        </h1>
                        <h2 style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.8rem)', color: 'var(--logo-blue)', fontWeight: 500, marginBottom: '2rem', opacity: 0.9 }}>
                            How AutoDriveCX behavioral operating system integrates into your store without disrupting operations.
                        </h2>

                        <div style={{ borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: '2.5rem', marginBottom: '4rem' }}>
                            <p style={{ fontSize: '1.4rem', color: '#fff', marginBottom: '1rem', fontWeight: 600 }}>
                                AutoDriveCX does not replace your managers. <span style={{ color: 'var(--logo-green)' }}>It equips them.</span>
                            </p>
                            <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.62)', marginBottom: '0.8rem', fontWeight: 600, letterSpacing: '0.01em' }}>
                                Installed across departments. Governed by management. Visible to ownership.
                            </p>
                            <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, maxWidth: '600px' }}>
                                Implementation is structured, phased, and built around your existing dealership workflows. No sudden shifts. Just systematic evolution.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 'clamp(1rem, 3vw, 1.5rem)', flexWrap: 'wrap' }}>
                            <a
                                href="https://calendar.app.google/QWRXFH9k24iZnBZWA"
                                target="_blank"
                                rel="noopener"
                                style={{ textDecoration: 'none' }}
                            >
                                <button className="btn btn-primary" style={{ padding: 'clamp(1rem, 3vw, 1.2rem) clamp(2rem, 5vw, 2.4rem)', fontSize: 'clamp(0.8rem, 2vw, 1rem)' }}>Schedule Implementation Call</button>
                            </a>
                            <Link to="/sample-rollout-plan" className="btn btn-ghost" style={{ padding: 'clamp(1rem, 3vw, 1.2rem) clamp(2rem, 5vw, 2.4rem)', fontSize: 'clamp(0.8rem, 2vw, 1rem)', textDecoration: 'none' }}>View Sample Rollout Plan</Link>
                        </div>
                        <p style={{ marginTop: '0.9rem', fontSize: '0.88rem', color: 'rgba(255,255,255,0.58)', letterSpacing: '0.01em' }}>
                            20-minute working session to map AutoDriveCX to your dealership structure.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* SECTION 1 – The 4-Phase Rollout Model */}
            <section className="light-section" style={{ padding: 'var(--spacing-huge) 5%', background: '#fff' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: '6rem' }}>
                        <h2 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>A Structured Rollout, Not a Training Event</h2>
                        <p style={{ marginTop: '0.9rem', fontSize: '1.05rem', color: '#666', lineHeight: 1.55 }}>
                            Sales, service, BDC, and support teams participate in the same reinforcement loop.
                        </p>
                    </div>

                    <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1px', background: '#eee', border: '1px solid #eee' }}>
                        {[
                            {
                                phase: "Phase 1",
                                title: "Alignment",
                                items: ["Identify primary CX priority", "Assign Manager Champion", "Activate store dashboard"],
                                desc: "Clear ownership from day one. No guesswork."
                            },
                            {
                                phase: "Phase 2",
                                title: "Manager Enablement",
                                items: ["30-minute onboarding session", "Dashboard walkthrough", "First reinforcement cycle selected"],
                                desc: "Managers lead the system. Not HR. Not outside trainers."
                            },
                            {
                                phase: "Phase 3",
                                title: "Team Activation",
                                items: ["Frontline teams activate daily Execution Reps within existing workflows", "Performance tracking begins immediately", "First weekly Reinforcement Loop session auto-generated"],
                                desc: "Behavior shifts within week one."
                            },
                            {
                                phase: "Phase 4",
                                title: "Performance Stabilization",
                                items: ["Behavior trendlines visible", "Coaching prompts triggered automatically", "Culture becomes predictable"],
                                desc: "Consistency becomes structural, not motivational."
                            }
                        ].map((p, i) => (
                            <motion.div
                                key={p.phase}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                style={{ background: '#fff', padding: '3rem', display: 'flex', flexDirection: 'column' }}
                            >
                                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--logo-blue)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '1rem' }}>{p.phase}</span>
                                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '2rem' }}>{p.title}</h3>
                                <ul style={{ listStyle: 'none', marginBottom: 'auto' }}>
                                    {p.items.map(item => (
                                        <li key={item} style={{ marginBottom: '0.8rem', display: 'flex', gap: '0.75rem', fontSize: '0.95rem', color: '#444' }}>
                                            <CheckCircle2 size={16} style={{ color: 'var(--logo-green)', marginTop: '0.2rem', flexShrink: 0 }} />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                                <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #f0f0f0' }}>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 700, fontStyle: 'italic', opacity: 0.6 }}>{p.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 2 – What It Looks Like Inside a Store */}
            <section style={{ padding: 'var(--spacing-huge) 5%', background: '#f8f9fa' }}>
                <div className="container">
                    <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                        <div>
                            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>AutoDriveCX in Daily Operation</h2>
                            <p style={{ fontSize: '1.1rem', color: '#666', lineHeight: 1.6, marginBottom: '3rem' }}>
                                No offsite training. No shutdown days.<br />
                                <span style={{ fontWeight: 700, color: '#000' }}>Just reinforcement embedded in daily dealership operations.</span>
                            </p>
                        </div>

                        <div className="mobile-stack" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                            {[
                                { day: "Daily Execution", time: "5 MIN", task: "Execution reps aligned to the day's workflow reinforce operational standards across departments.", icon: <Zap size={20} /> },
                                { day: "Continuous Visibility", time: "DATA", task: "Managers see emerging workflow gaps across sales, service, and support operations before performance begins to drift.", icon: <TrendingUp size={20} /> },
                                { day: "Reinforcement Loop", time: "10 MIN", task: "Managers use an auto-generated coaching guide to reinforce standards and recalibrate the team.", icon: <Users size={20} /> }
                            ].map((item, i) => (
                                <motion.div
                                    key={item.day}
                                    initial={{ opacity: 0, x: 20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    style={{ background: '#fff', padding: 'clamp(1rem, 5vw, 2rem)', display: 'flex', gap: 'clamp(1rem, 5vw, 2rem)', alignItems: 'center', border: '1px solid #eee', width: '100%' }}
                                >
                                    <div style={{
                                        width: '60px', height: '60px', background: '#f0f0f0', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                    }}>
                                        {item.icon}
                                    </div>
                                    <div style={{ flexGrow: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                            <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.day}</span>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 900, background: '#000', color: '#fff', padding: '2px 8px', borderRadius: '2px' }}>{item.time}</span>
                                        </div>
                                        <p style={{ fontSize: '1.1rem', color: '#444' }}>{item.task}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="light-section" style={{ padding: '6rem 5%', background: '#fff', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <div className="container" style={{ textAlign: 'center', maxWidth: '900px' }}>
                    <h2 style={{ fontSize: 'clamp(1.9rem, 4vw, 2.6rem)', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-0.02em' }}>
                        See How This Would Work in Your Store
                    </h2>
                    <p style={{ fontSize: '1.08rem', color: '#666', lineHeight: 1.65, marginBottom: '2rem', maxWidth: '760px', marginLeft: 'auto', marginRight: 'auto' }}>
                        Most dealerships begin with a short implementation conversation to pressure-test how AutoDriveCX would install inside their environment.
                    </p>
                    <a
                        href="https://calendar.app.google/QWRXFH9k24iZnBZWA"
                        target="_blank"
                        rel="noopener"
                        style={{ textDecoration: 'none' }}
                    >
                        <button className="btn btn-primary">Schedule Implementation Call</button>
                    </a>
                </div>
            </section>

            {/* SECTION 3 – Role-Based Implementation */}
            <section className="light-section" style={{ padding: 'var(--spacing-huge) 5%', background: '#fff' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
                        <h2 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Built Around Roles, Not Theory</h2>
                    </div>

                    <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {[
                            {
                                role: "For Owners",
                                items: ["Store-wide trend visibility", "Department heat maps", "Culture stabilization tracking"]
                            },
                            {
                                role: "For Managers",
                                items: ["Coaching prompts", "Meeting guides", "Performance gap visibility"]
                            },
                            {
                                role: "For Frontline Teams",
                                items: ["Execution reps", "Performance visibility", "Role-based progression"]
                            }
                        ].map((role) => (
                            <div key={role.role} style={{
                                padding: '3rem', border: '1px solid #f0f0f0', background: '#fafafa',
                                transition: 'transform 0.3s ease'
                            }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2.5rem', color: 'var(--logo-blue)' }}>{role.role}</h3>
                                <ul style={{ listStyle: 'none' }}>
                                    {role.items.map(item => (
                                        <li key={item} style={{ marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem', fontWeight: 500 }}>
                                            <div style={{ width: '6px', height: '6px', background: 'var(--logo-green)', borderRadius: '50%' }} />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 4 – Time Commitment Reality */}
            <section style={{ padding: 'var(--spacing-huge) 5%', background: '#0a0b0d', color: '#fff' }}>
                <div className="container">
                    <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '3rem', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '2.5rem' }}>What It Does Not Require</h2>
                            <ul style={{ listStyle: 'none', opacity: 0.6 }}>
                                {[
                                    "No full-day seminars",
                                    "No offsite training",
                                    "No external consultants onsite",
                                    "No disruption to sales flow",
                                    "No department restructuring required",
                                    "No new hiring required",
                                    "No new complex systems to manage"
                                ].map(item => (
                                    <li key={item} style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <div style={{ width: '12px', height: '1px', background: 'var(--logo-blue)' }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: 'clamp(2rem, 5vw, 4rem)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', width: '100%' }}>
                            <div style={{ marginBottom: '3rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 900, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Daily time per consultant</span>
                                <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--logo-green)' }}>5–8 minutes</p>
                            </div>
                            <div>
                                <span style={{ fontSize: '0.7rem', fontWeight: 900, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Weekly manager meeting</span>
                                <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--logo-blue)' }}>10–15 minutes</p>
                            </div>
                            <p style={{ marginTop: '3rem', fontSize: '1.1rem', fontWeight: 600, opacity: 0.9 }}>
                                Minimal disruption. Maximum reinforcement.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 5 – Why This Doesn’t Fade */}
            <section style={{ padding: '8rem 5%', textAlign: 'center', background: '#fff' }}>
                <div className="container">
                    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                        <h2 style={{ fontSize: '2.4rem', fontWeight: 800, marginBottom: '2rem' }}>Why This Doesn’t Become “Another Initiative”</h2>
                        <p style={{ fontSize: '1.2rem', color: '#666', lineHeight: 1.6, marginBottom: '4rem' }}>
                            Initiatives fail when measurement fades.<br />
                            Measurement fades when accountability is manual.<br />
                            AutoDriveCX automates reinforcement.
                        </p>

                        <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '4rem' }}>
                            {[
                                { label: "Daily Repetition", icon: <Zap size={20} /> },
                                { label: "Automatic Logging", icon: <Shield size={20} /> },
                                { label: "Coaching Triggers", icon: <CheckCircle2 size={20} /> },
                                { label: "Weekly Reset", icon: <Calendar size={20} /> }
                            ].map(item => (
                                <div key={item.label} style={{ padding: '2rem', border: '1px solid #f0f0f0' }}>
                                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center', color: 'var(--logo-blue)' }}>{item.icon}</div>
                                    <span style={{ fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase' }}>{item.label}</span>
                                </div>
                            ))}
                        </div>

                        <p style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.4, letterSpacing: '-0.02em', color: '#000' }}>
                            Consistency emerges when behavior is measured daily and reinforced weekly.
                        </p>
                    </div>
                </div>
            </section>

            {/* OPTIONAL VISUAL SECTION – Day 1 → Day 30 → Day 90 */}
            <section style={{ padding: '8rem 5%', background: '#f8f9fa', borderTop: '1px solid #eee' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>Maturity Timeline</h2>
                    </div>

                    <div className="mobile-stack" style={{ display: 'flex', gap: '2rem', alignItems: 'stretch', justifyContent: 'center' }}>
                        {[
                            { day: "Day 1", title: "Activation", desc: "Dashboard live. First execution rep assigned." },
                            { day: "Day 30", title: "Pattern Visibility", desc: "Behavior trends measurable across departments. Coaching calibrated." },
                            { day: "Day 90", title: "Culture Stabilized", desc: "Cross-department behavior aligned. CX predictable." }
                        ].map((step) => (
                            <div key={step.day} style={{
                                flex: '1', minWidth: '280px', background: '#fff', padding: 'clamp(1.5rem, 5vw, 3rem)',
                                border: '1px solid #eee', position: 'relative'
                            }}>
                                <div style={{
                                    position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)',
                                    background: 'var(--logo-green)', color: '#fff', padding: '5px 20px', fontSize: '0.75rem', fontWeight: 900,
                                    borderRadius: '20px'
                                }}>
                                    {step.day}
                                </div>
                                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '1rem 0', textAlign: 'center' }}>{step.title}</h3>
                                <p style={{ color: '#666', textAlign: 'center', fontSize: '1rem' }}>{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="light-section" style={{ padding: '6rem 5%', background: '#fff', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <div className="container" style={{ textAlign: 'center', maxWidth: '920px' }}>
                    <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-0.02em' }}>
                        Explore Implementation for Your Store
                    </h2>
                    <p style={{ fontSize: '1.05rem', color: '#666', lineHeight: 1.65, marginBottom: '0.9rem', maxWidth: '820px', marginLeft: 'auto', marginRight: 'auto' }}>
                        Every dealership deploys AutoDriveCX slightly differently depending on leadership structure and operational flow.
                    </p>
                    <p style={{ fontSize: '1.05rem', color: '#666', lineHeight: 1.65, marginBottom: '2rem', maxWidth: '820px', marginLeft: 'auto', marginRight: 'auto' }}>
                        A short implementation call allows us to map the rollout to your store and confirm whether the deployment model fits.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <a
                            href="https://calendar.app.google/QWRXFH9k24iZnBZWA"
                            target="_blank"
                            rel="noopener"
                            style={{ textDecoration: 'none' }}
                        >
                            <button className="btn btn-primary">Schedule Implementation Call</button>
                        </a>
                        <Link to="/sample-rollout-plan" className="btn btn-ghost-dark" style={{ textDecoration: 'none' }}>
                            View Sample Rollout Plan
                        </Link>
                    </div>
                </div>
            </section>

            <a
                href="https://calendar.app.google/QWRXFH9k24iZnBZWA"
                target="_blank"
                rel="noopener"
                aria-label="Schedule Implementation Call"
                style={{
                    position: 'fixed',
                    right: isMobile ? '18px' : '24px',
                    bottom: `${(isMobile ? 18 : 24) + footerLift}px`,
                    padding: isMobile ? '12px 16px' : '14px 18px',
                    borderRadius: '8px',
                    background: 'var(--logo-green)',
                    color: '#fff',
                    zIndex: 1000,
                    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.22)',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    opacity: showFloatingCta ? 1 : 0,
                    transform: showFloatingCta ? 'translateY(0)' : 'translateY(10px)',
                    pointerEvents: showFloatingCta ? 'auto' : 'none',
                    transition: 'opacity 220ms ease, transform 220ms ease, bottom 220ms ease'
                }}
            >
                Schedule Implementation Call
            </a>

            <Footer />
        </div>
    );
};


export default Implementation;

// Mocking TrendingUp since it was missing in the simplified import
const TrendingUp = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
);
