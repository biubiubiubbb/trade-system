import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTheme } from '../theme/ThemeContext';

const navItems = [
  { path: '/', label: '仪表盘' },
  { path: '/market', label: '行情' },
  { path: '/trade', label: '交易' },
  { path: '/backtest', label: '回测' },
  { path: '/notes', label: '心得' },
  { path: '/settings', label: '设置' },
];

export function Layout() {
  const location = useLocation();
  const { theme } = useTheme();

  const asideStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text)',
    borderRight: `1px solid var(--color-border)`,
  };

  const linkActiveStyle = (path: string): React.CSSProperties => ({
    backgroundColor: location.pathname === path ? 'var(--color-primary)' : 'transparent',
    color: location.pathname === path ? '#fff' : 'var(--color-text-secondary)',
  });

  return (
    <div className="min-h-screen flex">
      <aside className="w-48 p-4" style={asideStyle}>
        <h1 className="text-lg font-bold mb-6">A股交易系统</h1>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="block px-3 py-2 rounded transition-all hover:opacity-80"
              style={linkActiveStyle(item.path)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text)' }}>
        <Outlet />
      </main>
    </div>
  );
}
