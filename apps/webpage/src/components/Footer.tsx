import React from 'react';

const Footer: React.FC = () => {
    const footerStyle: React.CSSProperties = {
        width: '100%',
        borderTop: '1px solid #18181b',
        background: '#000000',
    };

    const innerStyle: React.CSSProperties = {
        maxWidth: '80rem',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '2rem',
        padding: '4rem 2rem',
    };

    const labelStyle: React.CSSProperties = {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.18em',
        color: '#bdfc00',
        textTransform: 'uppercase',
        textDecoration: 'none',
        transition: 'color 0.2s ease',
    };

    const copyrightStyle: React.CSSProperties = {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        textAlign: 'center',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '8px',
        letterSpacing: '0.18em',
        color: 'rgba(255,255,255,0.28)',
        textTransform: 'uppercase',
    };

    return (
        <footer style={footerStyle}>
            <div style={innerStyle}>
                <a href="/Autoknerd" style={{ ...labelStyle, flex: '0 0 auto' }}>
                    AutoKnerd
                </a>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                    <img
                        src="/autodrive-webpage-assets/AutoKnerd%20Logo.png"
                        alt="AutoKnerd"
                        style={{ height: 'auto', width: '96px', opacity: 0.96 }}
                    />
                </div>
                <div style={{ ...copyrightStyle, flex: '0 0 auto' }}>
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
