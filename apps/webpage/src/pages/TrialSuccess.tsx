import React from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

const TrialSuccess: React.FC = () => {
    const appUrl = (import.meta.env.VITE_AUTODRIVE_APP_URL as string | undefined) ?? '#';

    return (
        <div className="dark-section" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <header style={{ padding: '1.2rem 5%', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <Link to="/" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <img src="/logo.png" alt="AutoDrive" style={{ height: '48px', width: 'auto' }} />
                </Link>
            </header>

            <main style={{ flex: 1, padding: 'clamp(2rem, 6vw, 5rem) 5%', display: 'grid', placeItems: 'center' }}>
                <section style={{ width: '100%', maxWidth: '760px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '10px', padding: 'clamp(1.4rem, 4vw, 3rem)', background: 'rgba(255,255,255,0.06)' }}>
                    <h1 style={{ color: '#fff', fontSize: 'clamp(2rem, 5vw, 3rem)', marginBottom: '1rem' }}>
                        Trial Activated
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.05rem', marginBottom: '1.8rem' }}>
                        Your AutoDriveCX individual trial is active.
                        <br />
                        Begin your first execution rep inside the AutoDriveCX app.
                    </p>
                    <a
                        href={appUrl}
                        className="btn btn-primary"
                    >
                        Login to AutoDriveCX
                    </a>
                </section>
            </main>

            <Footer />
        </div>
    );
};

export default TrialSuccess;
