import { Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Market } from './pages/Market';
import { Trade } from './pages/Trade';
import { Backtest } from './pages/Backtest';
import { Notes } from './pages/Notes';
import { Settings } from './pages/Settings';
import { Layout } from './components/Layout';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="market" element={<Market />} />
        <Route path="trade" element={<Trade />} />
        <Route path="backtest" element={<Backtest />} />
        <Route path="notes" element={<Notes />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
