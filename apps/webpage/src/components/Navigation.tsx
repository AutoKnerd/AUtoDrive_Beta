import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const Navigation: React.FC = () => {
    return (
        <nav style={{ padding: 'clamp(1rem, 4vw, 2rem) 5%', position: 'absolute', width: '100%', zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
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
                    className="btn nav-action-btn"
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
                    className="btn btn-primary nav-action-btn"
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
        </nav>


    );
};

export default Navigation;
