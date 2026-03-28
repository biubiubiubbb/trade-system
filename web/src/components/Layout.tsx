import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTheme } from '../theme/ThemeContext';

const navItems = [
  { path: '/', label: '仪表盘', icon: '◈' },
  { path: '/market', label: '行情', icon: '◉' },
  { path: '/trade', label: '交易', icon: '◎' },
  { path: '/backtest', label: '回测', icon: '◇' },
  { path: '/notes', label: '心得', icon: '○' },
  { path: '/settings', label: '设置', icon: '◇' },
];

export function Layout() {
  const location = useLocation();
  const { theme } = useTheme();
  const isMinimal = theme === 'minimal';

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Sidebar - varies by theme */}
      <aside
        className="shrink-0 flex flex-col"
        style={{
          backgroundColor: theme === 'cartoon' ? 'var(--color-surface-dark)' : 'var(--color-surface)',
          borderRight: isMinimal ? 'none' : (theme === 'cartoon' ? '3px solid var(--color-border)' : '1px solid var(--color-border)'),
          width: isMinimal ? 80 : (theme === 'financial' ? 220 : 200),
          backgroundImage: theme === 'cartoon'
            ? 'repeating-linear-gradient(90deg, transparent, transparent 23px, rgba(0,0,0,0.1) 23px, rgba(0,0,0,0.1) 25px), repeating-linear-gradient(0deg, transparent, transparent 11px, rgba(0,0,0,0.1) 11px, rgba(0,0,0,0.1) 13px), var(--color-surface)'
            : theme === 'financial'
            ? 'linear-gradient(180deg, rgba(59,130,246,0.04) 0%, transparent 100%)'
            : undefined,
          backdropFilter: theme === 'financial' ? 'blur(12px)' : undefined,
        }}
      >
        {/* Logo area */}
        <div
          className="px-5 py-6"
          style={{
            borderBottom: theme === 'cartoon' ? '3px solid var(--color-border)' : '1px solid var(--color-border)',
            ...(isMinimal && { borderRight: '4px solid var(--color-border)', borderBottom: 'none', padding: '16px 0', textAlign: 'center' as const }),
          }}
        >
          {isMinimal ? (
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 32,
                color: 'var(--color-text)',
                letterSpacing: '0.1em',
              }}
            >
              A
            </div>
          ) : theme === 'cartoon' ? (
            <div className="pixel-btn text-center" style={{ fontSize: '7px', letterSpacing: '1px' }}>
              A股
            </div>
          ) : (
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 18,
                  color: 'var(--color-text)',
                  letterSpacing: '0.08em',
                  marginBottom: 4,
                }}
              >
                A股交易
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--color-primary)',
                  letterSpacing: '0.05em',
                }}
              >
                SIMULATED TRADING
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 py-4 ${isMinimal ? 'px-0' : 'px-3'}`}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                style={{
                  display: isMinimal ? 'flex' : 'block',
                  justifyContent: isMinimal ? 'center' : undefined,
                  alignItems: isMinimal ? 'center' : undefined,
                  margin: isMinimal ? '8px 0' : '2px 0',
                  padding: isMinimal ? '10px' : '10px 16px',
                  fontSize: isMinimal ? 10 : (theme === 'cartoon' ? 8 : 14),
                }}
              >
                {isMinimal ? (
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, letterSpacing: '0.05em' }}>
                    {item.label[0]}
                  </span>
                ) : (
                  <>
                    <span style={{ marginRight: 10, opacity: 0.7 }}>{item.icon}</span>
                    {item.label}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {!isMinimal && (
          <div
            className="px-5 py-4"
            style={{ borderTop: theme === 'cartoon' ? '3px solid var(--color-border)' : '1px solid var(--color-border)' }}
          >
            <div
              className={theme === 'cartoon' ? 'pixel-card p-3' : ''}
              style={{
                background: theme === 'financial' ? 'rgba(59,130,246,0.08)' : (theme === 'cartoon' ? 'rgba(0,0,0,0.3)' : undefined),
                padding: theme === 'cartoon' ? undefined : 12,
                borderRadius: theme === 'financial' ? 4 : undefined,
              }}
            >
              <div
                style={{
                  fontFamily: theme === 'cartoon' ? 'var(--font-heading)' : 'var(--font-mono)',
                  fontSize: theme === 'cartoon' ? 6 : 10,
                  color: theme === 'cartoon' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  letterSpacing: '1px',
                }}
              >
                {theme === 'financial' ? '◈ v1.0.0 | 模拟环境' : 'V1.0.0'}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main
        className="flex-1 overflow-auto"
        style={{ backgroundColor: 'var(--color-background)' }}
      >
        <Outlet />
      </main>
    </div>
  );
}
