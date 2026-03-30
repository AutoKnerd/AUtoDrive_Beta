import React from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';

const Implementation: React.FC = () => {
  return (
    <div style={{ background: '#050505', color: '#fff', minHeight: '100vh' }}>
      <Navigation />

      <section
        className="dark-section"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          background:
            'radial-gradient(circle at 20% 20%, rgba(255,0,0,0.18), transparent 35%), radial-gradient(circle at 80% 15%, rgba(95,255,95,0.12), transparent 35%), #050505'
        }}
      >
        <div className="container" style={{ maxWidth: '900px' }}>
          <p
            style={{
              fontSize: '0.82rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#89ff6f',
              fontWeight: 800,
              marginBottom: '1rem'
            }}
          >
            Implementation Reset
          </p>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', lineHeight: 1.05, marginBottom: '1rem' }}>
            This page is ready for a clean rebuild.
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.76)' }}>
            The structure is in place and waiting for final implementation content.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Implementation;
