import { useTheme } from '../theme/ThemeContext';
export function Trade() {
  const { theme } = useTheme();
  const isCartoon = theme === 'cartoon';
  const cardClass = isCartoon ? 'pixel-card' : (theme === 'financial' ? 'glass-card' : 'swiss-card');
  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-background)', minHeight: '100%' }}>
      <h1 className="page-title">交易</h1>
      <div className={`${cardClass} p-8 text-center`} style={isCartoon ? { boxShadow: '4px 4px 0px var(--color-border)' } : {}}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          {isCartoon ? '★' : '◉'}
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--color-text-secondary)' }}>
          交易下单功能开发中
        </div>
      </div>
    </div>
  );
}
