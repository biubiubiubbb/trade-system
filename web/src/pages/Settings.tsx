import { useTheme } from '../theme/ThemeContext';
import { themes } from '../theme/theme.config';

const themePreviews: Record<string, React.ReactNode> = {
  financial: (
    <svg viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="120" height="60" fill="#060B14"/>
      <rect x="4" y="4" width="30" height="52" fill="#0F1E32" rx="2"/>
      <rect x="38" y="4" width="78" height="52" fill="#0F1E32" rx="2"/>
      <rect x="42" y="10" width="40" height="6" fill="#3B82F6" rx="1"/>
      <rect x="42" y="20" width="70" height="2" fill="#334155"/>
      <rect x="42" y="26" width="55" height="2" fill="#334155"/>
      <rect x="42" y="32" width="62" height="2" fill="#334155"/>
      <rect x="42" y="44" width="20" height="8" fill="#EF4444" rx="1"/>
      <rect x="66" y="44" width="20" height="8" fill="#10B981" rx="1"/>
    </svg>
  ),
  cartoon: (
    <svg viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="120" height="60" fill="#87CEEB"/>
      <rect y="45" width="120" height="15" fill="#228B22"/>
      <rect x="4" y="4" width="30" height="40" fill="#228B22"/>
      <rect x="38" y="4" width="78" height="40" fill="#F0F8E8"/>
      <rect x="6" y="8" width="26" height="8" fill="#FFD700" stroke="#1A1A2E" strokeWidth="2"/>
      <rect x="42" y="10" width="40" height="6" fill="#FF6B6B" stroke="#1A1A2E" strokeWidth="2"/>
      <rect x="42" y="20" width="70" height="4" fill="#1A1A2E"/>
      <rect x="42" y="28" width="55" height="4" fill="#1A1A2E"/>
      <rect x="42" y="36" width="62" height="4" fill="#1A1A2E"/>
    </svg>
  ),
  minimal: (
    <svg viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="120" height="60" fill="#FFFFFF"/>
      <line x1="0" y1="0" x2="120" y2="0" stroke="#E5E5E5" strokeWidth="1"/>
      <line x1="0" y1="0" x2="0" y2="60" stroke="#E5E5E5" strokeWidth="1"/>
      <line x1="0" y1="15" x2="120" y2="15" stroke="#E5E5E5" strokeWidth="1"/>
      <line x1="0" y1="30" x2="120" y2="30" stroke="#E5E5E5" strokeWidth="1"/>
      <line x1="0" y1="45" x2="120" y2="45" stroke="#E5E5E5" strokeWidth="1"/>
      <rect x="4" y="4" width="20" height="60" fill="#FAFAFA"/>
      <line x1="4" y1="4" x2="4" y2="64" stroke="#000000" strokeWidth="4"/>
      <rect x="30" y="4" width="86" height="20" fill="#FAFAFA"/>
      <rect x="30" y="4" width="86" height="4" fill="#000000"/>
      <rect x="30" y="30" width="86" height="20" fill="#FAFAFA"/>
      <rect x="30" y="50" width="40" height="10" fill="#000000"/>
    </svg>
  ),
};

export function Settings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-background)' }}>
      <h1 className="page-title">设置</h1>

      {/* Theme section */}
      <div className="mb-8">
        <h2 style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          外观主题
        </h2>
        <div className="grid grid-cols-3 gap-6">
          {themes.map((t) => (
            <div
              key={t.id}
              onClick={() => setTheme(t.id)}
              className="cursor-pointer transition-all duration-200"
              style={{
                border: `2px solid ${theme === t.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                backgroundColor: 'var(--color-surface)',
                boxShadow: theme === t.id ? '0 0 0 1px var(--color-primary)' : 'none',
              }}
            >
              {/* Preview */}
              <div style={{ height: 100, overflow: 'hidden', backgroundColor: 'var(--color-background)' }}>
                {themePreviews[t.id]}
              </div>
              {/* Info */}
              <div className="p-4">
                <div
                  style={{
                    fontFamily: t.id === 'cartoon' ? 'var(--font-heading)' : (t.id === 'minimal' ? 'var(--font-heading)' : 'var(--font-body)'),
                    fontSize: t.id === 'cartoon' ? 10 : (t.id === 'minimal' ? 20 : 16),
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    marginBottom: 4,
                  }}
                >
                  {t.name}
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {t.description}
                </div>
                {theme === t.id && (
                  <div
                    className="mt-2"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--color-primary)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    ◉ ACTIVE
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System info */}
      <div className={theme === 'financial' ? 'glass-card' : (theme === 'cartoon' ? 'pixel-card' : 'swiss-card')} style={theme === 'cartoon' ? { boxShadow: '4px 4px 0px var(--color-border)' } : {}}>
        <div className="p-6">
          <h2 style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            系统信息
          </h2>
          <div className="space-y-3">
            {[
              ['版本', 'v1.0.0'],
              ['数据源', '东方财富 (模拟)'],
              ['数据范围', '2015年至今'],
              ['运行环境', '本地开发'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
