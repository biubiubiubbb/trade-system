import { Outlet, Link, useLocation } from 'react-router-dom';

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

  return (
    <div className="min-h-screen flex">
      <aside className="w-48 bg-gray-900 text-white p-4">
        <h1 className="text-lg font-bold mb-6">A股交易系统</h1>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-3 py-2 rounded ${
                location.pathname === item.path ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
