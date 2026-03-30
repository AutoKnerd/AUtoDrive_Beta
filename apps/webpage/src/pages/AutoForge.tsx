import {
  ArrowRight,
  Bolt,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  ListChecks,
  Search,
  Send,
  ShieldCheck,
  TimerOff,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';

type PainCard = {
  icon: LucideIcon;
  title: string;
  body: string;
};

type Benefit = {
  title: string;
  body: string;
};

type Step = {
  number: string;
  icon: LucideIcon;
  title: string;
};

type Comparison = {
  metric: string;
  legacy: string;
  system: string;
  systemAccent?: boolean;
};

const painCards: PainCard[] = [
  {
    icon: Users,
    title: 'Inconsistent experience',
    body: 'Customers get different experiences depending on who they talk to.',
  },
  {
    icon: Gauge,
    title: 'Wasted training budget',
    body: 'Thousands spent on training that disappears within days.',
  },
  {
    icon: TimerOff,
    title: 'The 7-day memory gap',
    body: 'Your team forgets most training within a week without enforcement.',
  },
];

const benefits: Benefit[] = [
  {
    title: 'Centralized command',
    body: 'Monitor weekly mission completion across your whole dealership group in one view.',
  },
  {
    title: 'Behavior audit',
    body: 'Verify that coaching is actually happening on the floor, not just in a meeting room.',
  },
  {
    title: 'Measured lift',
    body: 'Sustained improvement comes from a weekly cadence managers can actually run.',
  },
];

const steps: Step[] = [
  { number: '01', icon: Search, title: 'Identify leakage' },
  { number: '02', icon: Send, title: 'Deploy mission' },
  { number: '03', icon: Users, title: 'Run 10-minute session' },
  { number: '04', icon: ClipboardCheck, title: 'Verify behavior' },
  { number: '05', icon: ShieldCheck, title: 'Standardize' },
];

const implementationSteps = [
  'Select your missions',
  'Automate assignments',
  'Track and verify',
];

const comparisons: Comparison[] = [
  { metric: 'Retention Rate', legacy: '~15%', system: '90%+', systemAccent: true },
  { metric: 'Implementation', legacy: 'Manual / Random', system: 'Weekly Automated' },
  { metric: 'Visibility', legacy: 'Non-existent', system: 'Group-Wide View', systemAccent: true },
  { metric: 'Management Time', legacy: 'High Friction', system: 'Plug-and-Play' },
];

const outcomes = [
  'Consistent sales workflow',
  'Locked-in service experience',
  'Verified management accountability',
];

function AutoForge() {
  return (
    <div className="autoforge-page">
      <Navigation />

      <main className="autoforge-main">
        <section className="autoforge-hero">
          <div className="autoforge-media">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDrPeL72sI4RNZv7AlDZZBUAN_xbgW9cKb4cdDSXxUG9QjB-XaagynWSZhcjpeV79ywH6oasQRiBAa6BEl4Cx1uNiaf6sRrIsgMbPC3oeBh-fMchIa_VW3SCxReddMdPaSI5AU-3-uKrZLcY4KaWQ-pMczfKC1kj-iicbK27q_D8dZH3h3xwPHd_id5QnUEgimV4mCiozOYg1C49o34TdnlCp5J9t8FyXLJGSCsYMW5MVpWzjNc8nSZ0EqAjjhk5oJoArNdgi-Fn0vg"
              alt="Motion blur performance vehicle"
            />
          </div>
          <div className="container">
            <div className="autoforge-hero-copy">
              <p className="autoforge-kicker">High-Performance Imagery Edition</p>
              <h1>
                Execution is <span>profit.</span>
              </h1>
              <p className="autoforge-lead">
                If your team is not improving every week, your dealership is falling behind.
              </p>
              <p className="autoforge-body">
                AutoForge gives your managers a plug-and-play system to coach behavior, align teams,
                and improve customer experience every single week.
              </p>
              <div className="autoforge-actions">
                <a href="#missions" className="autoforge-btn autoforge-btn-primary">
                  See Weekly CX Missions
                </a>
                <a href="/tools" className="autoforge-btn autoforge-btn-ghost">
                  Start With Free Tools
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="autoforge-section autoforge-section-problem">
          <div className="autoforge-section-art">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGbUZq34xmfJiikuvYndigAmPDHfiyKAKnnfsWbBHwbuEdIHh5RIxBTn4-oV3jF_ivReZpK8g2dMC_g2lUSWUf-TeJ9cRFpujBRA_NnuZCukUd1PU2_wU8P7KgK5dnBtSeaawSff1VOMRHHzDvNF1AKQBHkE0sBzeYeO83aen65i5QkHG6E8tAvQr2wORiKNWRXgf7FMqW8AW5xCTuTdeuJXtBfPREY94E86uNsSqYdt0pj451J9oww4Dy71O2pecYWkoE0bfbZB6J"
              alt="Brake disc detail"
            />
          </div>
          <div className="container autoforge-two-column">
            <div className="autoforge-copy-block">
              <p className="autoforge-kicker">The breakdown</p>
              <h2>
                Training is not your problem.
                <br />
                <span>Execution is.</span>
              </h2>
              <p>
                Dealerships spend thousands on one-and-done training events that never stick. Without
                a weekly system to enforce behavior, teams revert to old habits before the trainers
                even leave the building.
              </p>
              <a href="#cta" className="autoforge-inline-link">
                See how this would work in your store <ArrowRight size={16} />
              </a>
            </div>

            <div className="autoforge-card-grid">
              {painCards.map(({ icon: Icon, title, body }) => (
                <article key={title} className="autoforge-panel">
                  <Icon size={28} />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="autoforge-section autoforge-gap">
          <div className="autoforge-section-art">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAWGlTNXEcrTiQYKuzGGHmHQwcngIpYB7fao_cm6PuDQ8WepOfg4zd-fCURgfOeuzY1QiD6D4vWa7FifgCU_IGVkOQ-q5y8DN2UWcz_Pxnaw2MVpjzNDdIVhC3ZSBOW1JGICuJ_m7-dsWdYy0PXkeKv9n6nm4rcZzI8a-BfSu7jW5I38HPtvdf297ScF_Oc4T31fMXiYPeBihhmQIkq8qvF6ox2AJYiWOPMZ37uWPsZZPXyj0T4LtUavoL9ohJ8_3Wg5xA_6JbeeqHj"
              alt="Track surface texture"
            />
          </div>
          <div className="container">
            <div className="autoforge-gap-card">
              <p className="autoforge-kicker">The performance gap</p>
              <h2>Most dealerships do not fail because of lack of knowledge.</h2>
              <p>
                They fail because there is no system to reinforce behavior weekly.
              </p>
            </div>
          </div>
        </section>

        <section className="autoforge-section autoforge-system" id="missions">
          <div className="autoforge-section-art">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCWlH9oFo4pgFsfrZBlot6cZPDXxFxw1XQlJjdKf38wQub_s-Ft87qXdKJIjJanUriqT8DGffcyvgDi-1HBCO-CtfhLIBwq-bcPW4KqzsTAq54niSZSMZMLx_9oyLzWJNuxh4T1MnhS_cRP1WNBl56AgkzRsuadJrmDeZM8wSx9O8f3uOPoHyJwVBUMeUXgpw3sfQGEJcM1ZBiIoMgD163vq53CUK1VPxXCQOluLWIcId6ct6_3dVMFJhNS4iEtkod7uG021awegR88"
              alt="Execution dashboard"
            />
          </div>
          <div className="container">
            <div className="autoforge-section-heading">
              <p className="autoforge-kicker">The system</p>
              <h2>Here’s how your dealership improves every week</h2>
              <p>Measurable outcomes. Total visibility. Zero guesswork.</p>
            </div>

            <div className="autoforge-system-grid">
              <article className="autoforge-dashboard-card">
                <div className="autoforge-dashboard-copy">
                  <h3>Manager dashboard</h3>
                  <p>Centralized command for weekly mission completion and skill-gap visibility.</p>
                </div>

                <div className="autoforge-metric-block">
                  <div className="autoforge-metric-row">
                    <span>Weekly mission progress</span>
                    <strong>88% done</strong>
                  </div>
                  <div className="autoforge-progress">
                    <span style={{ width: '88%' }} />
                  </div>
                </div>

                <div className="autoforge-metric-block autoforge-metric-block-alert">
                  <div className="autoforge-metric-row">
                    <span>Active skill gaps</span>
                    <strong>3 alerts</strong>
                  </div>
                  <div className="autoforge-progress">
                    <span style={{ width: '35%' }} />
                  </div>
                </div>

                <div className="autoforge-dashboard-footer">
                  <span>System status: active</span>
                  <span>All teams synchronized</span>
                </div>
              </article>

              <div className="autoforge-system-side">
                {benefits.map((item, index) => (
                  <article key={item.title} className="autoforge-side-card">
                    <div className="autoforge-side-index">{`0${index + 1}`}</div>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="autoforge-section autoforge-process">
          <div className="autoforge-section-art">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCnFmZ_OXyt3xc2zZP5xMU5dR-qiXZywP6IuXdmw4iOS_xelWrh1H-Pt_pk1xZ-o5Uywf6Ewth56PBXZrnp5y0HiNYf7ou65EH5-uCzkGRtK3kwsnpg-Zoy3qDAhfU3ev2WARxqjYwZ8-1JOa1DTasFANu-K89hThKhpbNeS3b78mhxOcnmYtgjrPJPII-yv9Pa75axBIfntNEPr-oxZ4lcM9Zn3z3damkDJNAzazeZdOpmOQgycHRIIQ0OYHilh97mXDcs5KlvOIhR"
              alt="High speed motion"
            />
          </div>
          <div className="container autoforge-process-grid">
            <div>
              <p className="autoforge-kicker">Fast implementation</p>
              <h2>
                Fast implementation.
                <br />
                Immediate impact.
              </h2>
              <div className="autoforge-stack">
                {implementationSteps.map((item, index) => (
                  <article key={item} className="autoforge-implementation-row">
                    <div className="autoforge-side-index">{`0${index + 1}`}</div>
                    <div className="autoforge-implementation-copy">
                      {index === 0 && <ListChecks size={20} />}
                      {index === 1 && <Send size={20} />}
                      {index === 2 && <Bolt size={20} />}
                      <h3>{item}</h3>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <p className="autoforge-kicker">The process</p>
              <div className="autoforge-step-list">
                {steps.map(({ number, icon: Icon, title }) => (
                  <article key={number} className="autoforge-step-row">
                    <div className="autoforge-step-marker">
                      <Icon size={18} />
                    </div>
                    <div>
                      <span>{number}</span>
                      <h3>{title}</h3>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="autoforge-section autoforge-outcomes-section">
          <div className="autoforge-section-art">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDa56sS5masWLxfXZLaHL2hddfy2LLgHo5BDnkGH8Q0lFUMqm2YI4Wg4R-4FugIRCZqsZ8h5mBh4lbbNyaJycSwmCHzj6MiPF4OKfkPazjXthltcQXOfLXq6edDkmZmA8CEaeW14W6-2YqJ9ML7MVjjh7P2UpltGFAwfDouQXU58YmfwmiOZGt4H_uIoNas1kygPRzC2BtnBjFBo85u7PZnzolS9arTNLNh-XA1Q-ezw3cGuBvU3eCEnjqvykY6Nl-8XohQCPKXq96X"
              alt="Track detail"
            />
          </div>
          <div className="container autoforge-two-column autoforge-two-column-wide">
            <div className="autoforge-copy-block">
              <p className="autoforge-kicker">Outcome</p>
              <h2>The outcome of real execution</h2>
              <p>
                Stop guessing if your team is following the process. AutoForge provides the
                operational visibility you need to drive growth.
              </p>
              <ul className="autoforge-outcome-list">
                {outcomes.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={18} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a href="#cta" className="autoforge-inline-link">
                See how this would work in your store <ArrowRight size={16} />
              </a>
            </div>

            <div className="autoforge-table-wrap">
              <table className="autoforge-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Legacy Training</th>
                    <th>AutoForge System</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((item) => (
                    <tr key={item.metric}>
                      <td>{item.metric}</td>
                      <td>{item.legacy}</td>
                      <td className={item.systemAccent ? 'autoforge-table-accent' : ''}>{item.system}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="autoforge-section autoforge-cta" id="cta">
          <div className="autoforge-section-art">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCkmTSX_odmvYoLBh1gy3TRsapUmC5hX6fi646Qtt-fO0p6GLgrOPYKHE3iQ4tZasaliiQ7n754o2l2SHRbiRQjARgKDMrJ6_5rc1MggCuqBWSauSOyy4vpBcRidh_4BhPpt8p3_owB41WUiVr9-yoParsvnh8GrxOOTPfId6451f8pc40AqYb1qCAjU8GDjXRHzW2DHPysK-FhhhV5LVskpsLZsh80sWnOIdzm51UFWAPkpAh9-eqsCllt4zrM8O6Qrd-KiOvnfsEv"
              alt="Abstract light streaks"
            />
          </div>
          <div className="container autoforge-cta-content">
            <p className="autoforge-kicker">Stop guessing. Start forging.</p>
            <h2>
              Execution is <span>everything</span>
            </h2>
            <p>
              The most successful dealerships do not have smarter people. They have better systems.
              Deploy the AutoForge weekly execution protocol today.
            </p>
            <div className="autoforge-actions autoforge-actions-center">
              <a href="#missions" className="autoforge-btn autoforge-btn-primary">
                Deploy System
              </a>
              <a href="/demo" className="autoforge-btn autoforge-btn-secondary">
                Book Demo
              </a>
            </div>
            <div className="autoforge-cta-meta">
              <div>
                <CalendarDays size={16} />
                <span>Franchise dealers</span>
              </div>
              <div>
                <Bolt size={16} />
                <span>Large auto groups</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default AutoForge;
