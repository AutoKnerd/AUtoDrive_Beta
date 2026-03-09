'use client';

import Script from 'next/script';

export default function ResetPasswordPage() {
  return (
    <main className="reset-page">
      <div className="reset-card" role="region" aria-labelledby="reset-password-title">
        <h1 id="reset-password-title">Reset Your Password</h1>
        <p id="subtitle">Use the secure link from your email to set a new password.</p>

        <div id="loading-state" className="state-box">
          Verifying your reset link...
        </div>

        <div id="invalid-mode-state" className="state-box error hidden">
          This link is not a password reset link. Please request a new password reset email.
        </div>

        <div id="invalid-code-state" className="state-box error hidden">
          This password reset link is invalid or expired. Request a new reset email and try again.
        </div>

        <form id="reset-form" className="hidden" noValidate>
          <p id="email-display" className="email-pill" aria-live="polite"></p>

          <label htmlFor="new-password">New password</label>
          <div className="password-row">
            <input id="new-password" name="newPassword" type="password" autoComplete="new-password" required />
            <button type="button" id="toggle-new-password" className="toggle-btn" aria-label="Show or hide new password">
              Show
            </button>
          </div>
          <p id="new-password-error" className="field-error hidden" aria-live="polite"></p>

          <label htmlFor="confirm-password">Confirm new password</label>
          <div className="password-row">
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              id="toggle-confirm-password"
              className="toggle-btn"
              aria-label="Show or hide confirm password"
            >
              Show
            </button>
          </div>
          <p id="confirm-password-error" className="field-error hidden" aria-live="polite"></p>

          <p id="submit-error" className="field-error hidden" aria-live="polite"></p>

          <button id="submit-btn" type="submit" className="primary-btn">
            Update Password
          </button>
        </form>

        <div id="success-state" className="hidden success-box" role="status" aria-live="polite">
          <p className="success-title">Your password has been updated.</p>
          <div className="actions">
            <a className="primary-btn" href="/login">
              Go to Login
            </a>
            <a id="continue-link" className="secondary-btn hidden" href="#" rel="noopener noreferrer">
              Continue
            </a>
          </div>
        </div>
      </div>

      <Script src="/reset-password.js" type="module" strategy="afterInteractive" />

      <style jsx>{`
        .reset-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          background: radial-gradient(circle at top, #f3f7ff 0%, #f8fafc 45%, #eef2f7 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .reset-card {
          width: min(100%, 420px);
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
          padding: 28px;
        }

        h1 {
          margin: 0;
          font-size: 1.5rem;
          color: #0f172a;
          line-height: 1.2;
        }

        #subtitle {
          margin: 10px 0 20px;
          color: #475569;
          font-size: 0.95rem;
        }

        label {
          display: block;
          margin-top: 14px;
          margin-bottom: 6px;
          font-size: 0.9rem;
          color: #1f2937;
          font-weight: 600;
        }

        input {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 12px;
          font-size: 0.95rem;
          background: #fff;
          color: #0f172a;
        }

        input:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 1px;
          border-color: #3b82f6;
        }

        .password-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: center;
        }

        .toggle-btn {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #f8fafc;
          color: #0f172a;
          padding: 0 12px;
          min-height: 44px;
          cursor: pointer;
          font-weight: 600;
        }

        .primary-btn,
        .secondary-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 44px;
          border-radius: 10px;
          text-decoration: none;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
        }

        .primary-btn {
          margin-top: 16px;
          border: none;
          background: #2563eb;
          color: #fff;
        }

        .primary-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .secondary-btn {
          margin-top: 10px;
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #0f172a;
        }

        .state-box,
        .success-box {
          border-radius: 12px;
          padding: 14px;
          font-size: 0.92rem;
        }

        .state-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #0f172a;
        }

        .state-box.error {
          background: #fef2f2;
          border-color: #fecaca;
          color: #991b1b;
        }

        .success-box {
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #065f46;
        }

        .success-title {
          margin: 0 0 10px;
          font-weight: 700;
        }

        .email-pill {
          margin: 0 0 6px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e40af;
          border-radius: 999px;
          display: inline-block;
          padding: 6px 12px;
          font-size: 0.85rem;
        }

        .field-error {
          margin: 6px 0 0;
          color: #b91c1c;
          font-size: 0.84rem;
        }

        .actions {
          margin-top: 12px;
        }

        .hidden {
          display: none;
        }

        @media (max-width: 520px) {
          .reset-card {
            padding: 20px;
            border-radius: 14px;
          }
        }
      `}</style>
    </main>
  );
}
