import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const Navigation: React.FC = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <nav className={`autodrive-marketing-header ${mobileMenuOpen ? 'mobile-menu-open' : ''}`} style={{ padding: 'clamp(1rem, 4vw, 2rem) 5%', position: 'absolute', width: '100%', zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <button
                type="button"
                className="autodrive-mobile-menu-trigger"
                aria-label="Open navigation menu"
                onClick={() => setMobileMenuOpen((open) => !open)}
            >
                <span></span>
                <span></span>
                <span></span>
            </button>
            <div className="autodrive-left-nav" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div className="autodrive-system-group">
                    <button type="button" className="autodrive-menu-link autodrive-system-trigger">
                        System
                        <span className="autodrive-system-caret">▾</span>
                    </button>
                    <div className="autodrive-system-dropdown">
                        <a href="/Autoknerd" className="autodrive-system-item">
                            <span className="autodrive-system-title">AutoKnerd</span>
                            <span className="autodrive-system-subtitle">Performance Intelligence</span>
                        </a>
                        <a href="/tools" className="autodrive-system-item">
                            <span className="autodrive-system-title">AutoShop</span>
                            <span className="autodrive-system-subtitle">Diagnostic Suite</span>
                        </a>
                        <a href="/autoforge" className="autodrive-system-item">
                            <span className="autodrive-system-title">AutoForge</span>
                            <span className="autodrive-system-subtitle">Hardware Deployment</span>
                        </a>
                    </div>
                </div>
                <a href="/Autoknerd/podcast" className="autodrive-menu-link">Podcast</a>
                <a href="/Autoknerd/about" className="autodrive-menu-link">About</a>
            </div>
            <div className="autodrive-brand-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Link to="/" className="autodrive-brand-link" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                    <img src="/logo2.png" alt="AutoDriveCX" style={{ height: 'clamp(52px, 8vw, 88px)', width: 'auto', filter: 'brightness(1)' }} />
                </Link>
                <div className="hide-mobile" style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }}></div>
                <span className="hide-mobile" style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
                    CX Performance
                </span>
            </div>
            <div className="nav-action-group" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <motion.a
                    href="#login"
                    className="btn nav-action-btn nav-login-btn autodrive-login-btn"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                        fontSize: 'clamp(0.7rem, 2vw, 0.8rem)',
                        padding: 'clamp(0.6rem, 2vw, 0.8rem) clamp(1rem, 3vw, 1.5rem)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--logo-blue)',
                        color: '#fff',
                        fontWeight: 800,
                        transition: 'all 0.3s ease',
                        boxShadow: '0 10px 20px rgba(52, 136, 186, 0.4)',
                        textDecoration: 'none',
                        textAlign: 'center',
                        whiteSpace: 'nowrap'
                    }}
                >
                    LOG IN
                </motion.a>
                <motion.a
                    href="/individual-trial"
                    className="btn btn-primary nav-action-btn nav-trial-btn autodrive-signup-btn"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                        fontSize: 'clamp(0.7rem, 2vw, 0.8rem)',
                        padding: 'clamp(0.6rem, 2vw, 0.8rem) clamp(1rem, 3vw, 1.5rem)',
                        borderRadius: '4px',
                        boxShadow: '0 10px 20px rgba(102, 184, 72, 0.3)',
                        textDecoration: 'none',
                        textAlign: 'center',
                        whiteSpace: 'nowrap'
                    }}
                >
                    START TRIAL
                </motion.a>
            </div>
            <div className="autodrive-mobile-menu-panel">
                <div className="autodrive-mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)}></div>
                <div className="autodrive-mobile-menu-inner">
                    <div className="autodrive-mobile-menu-header">
                        <p className="autodrive-mobile-menu-title">AutoDriveCX</p>
                        <p className="autodrive-mobile-menu-description">Product navigation and system links</p>
                        <button type="button" className="autodrive-mobile-menu-close" aria-label="Close navigation menu" onClick={() => setMobileMenuOpen(false)}>×</button>
                    </div>
                    <a href="https://app.autodrivecx.com/login" className="autodrive-mobile-primary">Login</a>
                    <div className="autodrive-mobile-links">
                        <a href="/autodrive" className="autodrive-mobile-item">Home</a>
                        <a href="/Autoknerd/podcast" className="autodrive-mobile-item">Podcast</a>
                        <a href="/Autoknerd/about" className="autodrive-mobile-item">About</a>
                    </div>
                    <div className="autodrive-mobile-section">
                        <p className="autodrive-mobile-label">System</p>
                        <a href="/Autoknerd" className="autodrive-mobile-item">AutoKnerd</a>
                        <a href="/autoshop" className="autodrive-mobile-item">AutoShop</a>
                        <a href="/autoforge" className="autodrive-mobile-item">AutoForge</a>
                    </div>
                </div>
            </div>
        </nav>


    );
};

export default Navigation;
