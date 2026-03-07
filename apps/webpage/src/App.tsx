import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Implementation from './pages/Implementation';
import SampleRolloutPlan from './pages/SampleRolloutPlan';
import IndividualTrial from './pages/IndividualTrial';
import TrialSuccess from './pages/TrialSuccess';

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const App: React.FC = () => {
  return (
    <Router>
      <ScrollToTop />
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/implementation" element={<Implementation />} />
          <Route path="/sample-rollout-plan" element={<SampleRolloutPlan />} />
          <Route path="/individual-trial" element={<IndividualTrial />} />
          <Route path="/start-trial" element={<IndividualTrial />} />
          <Route path="/trial-success" element={<TrialSuccess />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
