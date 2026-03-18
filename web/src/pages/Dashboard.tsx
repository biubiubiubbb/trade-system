import { useTheme } from '../theme/ThemeContext';

const stats = [
  { label: '总收益率', value: '+12.34%', up: true, icon: '◈' },
  { label: '总交易次数', value: '128', up: null, icon: '◉' },
  { label: '胜率', value: '62.5%', up: true, icon: '◎' },
  { label: '最大回撤', value: '-8.23%', up: false, icon: '◇' },
];

export function Dashboard() {
  const { theme } = useTheme();
  const isFinancial = theme === 'financial';
  const isCartoon = theme === 'cartoon';
  const isMinimal = theme === 'minimal';
  const cardClass = isFinancial ? 'glass-card' : (isCartoon ? 'pixel-card' : 'swiss-card');

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-background)', minHeight: '100%' }}>
      <h1 className="page-title">仪表盘</h1>

      {/* Stats grid */}
      <div className={`grid ${isMinimal ? 'swiss-grid' : 'grid-cols-4 gap-4'} mb-6`}>
        {stats.map((s) => (
          <div
            key={s.label}
            className={cardClass}
            style={isCartoon ? { boxShadow: '4px 4px 0px var(--color-border)' } : (isFinancial ? { backdropFilter: 'blur(12px)' } : { borderTop: '4px solid var(--color-border)' })}
          >
            <div className="p-6">
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: isCartoon ? 8 : (isMinimal ? 10 : 11), color: 'var(--color-text-secondary)', marginBottom: 8, letterSpacing: '0.05em' }}>
                {s.icon} {s.label}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: isCartoon ? 12 : (isMinimal ? 32 : 24), fontWeight: 700, color: s.up === null ? 'var(--color-text)' : (s.up ? 'var(--color-up)' : 'var(--color-down)'), letterSpacing: '0.02em' }}>
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className={`${cardClass} p-6`} style={isCartoon ? { boxShadow: '4px 4px 0px var(--color-border)' } : (isFinancial ? { backdropFilter: 'blur(12px)' } : { borderTop: '4px solid var(--color-border)' })}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, letterSpacing: '0.05em' }}>
          收益曲线 (模拟数据)
        </div>
        <div style={{ height: isMinimal ? 200 : 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          [ ECharts 收益曲线图表区域 ]
        </div>
      </div>
    </div>
  );
}
