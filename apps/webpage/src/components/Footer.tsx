import React from 'react';
import { useLocation } from 'react-router-dom';

const Footer: React.FC = () => {
    const { pathname } = useLocation();
    const isAutoForge = pathname.startsWith('/autoforge');
    const logoSrc = isAutoForge ? '/autodrive-webpage-assets/auto-forge-logo.png' : '/logo2.png';
    const logoAlt = isAutoForge ? 'AutoForge Logo' : 'AutoDriveCX Logo';

    return (
        <footer className="dark-section" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: '#060607' }}>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '2rem',
                    padding: '4rem 5%',
                    maxWidth: '80rem',
                    margin: '0 auto',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <img
                        src={logoSrc}
                        alt={logoAlt}
                        style={{ height: 'clamp(48px, 6vw, 80px)', width: 'auto', opacity: 0.96 }}
                    />
                </div>

                <a
                    href="/Autoknerd"
                    style={{
                        fontFamily: '"Press Start 2P", monospace',
                        fontSize: '9px',
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        color: '#bdfc00',
                        textTransform: 'uppercase',
                        textDecoration: 'none',
                    }}
                >
                    AutoKnerd
                </a>

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        textAlign: 'center',
                        fontFamily: '"Press Start 2P", monospace',
                        fontSize: '8px',
                        letterSpacing: '0.18em',
                        color: 'rgba(255,255,255,0.28)',
                        textTransform: 'uppercase',
                    }}
                >
                    <span>© 2024 AutoKnerd LLC Dealership CX Development.</span>
                    <span style={{ color: 'rgba(255,255,255,0.12)' }} aria-hidden="true">
                        |
                    </span>
                    <a href="/legal" style={{ color: 'rgba(255,255,255,0.38)', textDecoration: 'none' }}>
                        Legal
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
