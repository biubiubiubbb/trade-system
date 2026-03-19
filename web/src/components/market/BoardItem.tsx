import { useTheme } from '../../theme/ThemeContext';

interface BoardItemProps {
  type: 'sector' | 'limitup';
  // sector 模式
  name?: string;
  changePct?: number;
  riseCount?: number;
  fallCount?: number;
  leaderStock?: string;
  // limitup 模式
  code?: string;
  price?: number;
  continueBoard?: number;
  brokenCount?: number;
  onClick?: () => void;
}

export function BoardItem({
  type,
  name,
  changePct,
  riseCount,
  fallCount,
  leaderStock,
  code,
  price,
  continueBoard,
  brokenCount,
  onClick,
}: BoardItemProps) {
  const { theme } = useTheme();
  const isUp = changePct !== undefined && changePct >= 0;

  const isFinancial = theme === 'financial';
  const isCartoon = theme === 'cartoon';

  // === Financial Theme: 毛玻璃 + 发光边框 ===
  if (isFinancial) {
    return (
      <div
        onClick={onClick}
        className="group relative p-3 cursor-pointer rounded-lg transition-all duration-300"
        style={{
          background: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
          e.currentTarget.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {type === 'sector' ? (
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-sm text-gray-100">{name}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                上涨 <span className="text-red-400">{riseCount || 0}</span> / 下跌 <span className="text-green-400">{fallCount || 0}</span>
              </div>
              {leaderStock && (
                <div className="text-xs text-gray-500 mt-0.5">
                  领涨: {leaderStock}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${isUp ? 'text-red-400' : 'text-green-400'}`}>
                {changePct !== undefined ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '--'}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-sm text-gray-100">{name}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {code}
                {continueBoard !== undefined && continueBoard > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                    {continueBoard}连板
                  </span>
                )}
                {brokenCount !== undefined && brokenCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">
                    {brokenCount}次炸板
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${isUp ? 'text-red-400' : 'text-green-400'}`}>
                {changePct !== undefined ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '--'}
              </div>
              <div className="text-xs text-gray-400">
                ¥{price?.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // === Cartoon Theme: 像素风格 ===
  if (isCartoon) {
    return (
      <div
        onClick={onClick}
        className="relative p-3 cursor-pointer transition-transform duration-100"
        style={{
          background: 'var(--color-surface)',
          border: '3px solid var(--color-border)',
          boxShadow: '4px 4px 0px var(--color-border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translate(-2px, -2px)';
          e.currentTarget.style.boxShadow = '6px 6px 0px var(--color-border)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translate(0, 0)';
          e.currentTarget.style.boxShadow = '4px 4px 0px var(--color-border)';
        }}
      >
        {type === 'sector' ? (
          <div className="flex justify-between items-center">
            <div>
              <div className="font-heading text-sm text-gray-800">{name}</div>
              <div className="font-mono text-xs text-gray-600 mt-0.5">
                <span className="text-red-500">▲{riseCount || 0}</span> / <span className="text-green-500">▼{fallCount || 0}</span>
              </div>
              {leaderStock && (
                <div className="font-mono text-xs text-gray-500 mt-0.5">
                  ★ {leaderStock}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className={`font-mono text-lg font-bold ${isUp ? 'text-red-500' : 'text-green-500'}`}>
                {changePct !== undefined ? `${isUp ? '+' : ''}${changePct.toFixed(1)}%` : '--'}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <div>
              <div className="font-heading text-sm text-gray-800">{name}</div>
              <div className="font-mono text-xs text-gray-600 mt-0.5">
                {code}
                {continueBoard !== undefined && continueBoard > 0 && (
                  <span className="ml-1 bg-yellow-300 text-gray-800 px-1 text-xs">
                    ×{continueBoard}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className={`font-mono text-lg font-bold ${isUp ? 'text-red-500' : 'text-green-500'}`}>
                {changePct !== undefined ? `${isUp ? '+' : ''}${changePct.toFixed(1)}%` : '--'}
              </div>
              <div className="font-mono text-xs text-gray-600">
                ¥{price?.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // === Minimal Theme: 极致简洁 ===
  return (
    <div
      onClick={onClick}
      className="group p-3 cursor-pointer border-b border-gray-200 transition-colors duration-200 hover:bg-gray-50"
    >
      {type === 'sector' ? (
        <div className="flex justify-between items-center">
          <div>
            <div className="font-medium text-sm text-black">{name}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {riseCount || 0}↑ {fallCount || 0}↓
              {leaderStock && <span className="ml-2">· {leaderStock}</span>}
            </div>
          </div>
          <div className={`text-lg font-light ${isUp ? 'text-black' : 'text-gray-400'}`}>
            {changePct !== undefined ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '--'}
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <div>
            <div className="font-medium text-sm text-black">{name}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {code}
              {continueBoard !== undefined && continueBoard > 0 && (
                <span className="ml-1">{continueBoard}连板</span>
              )}
            </div>
          </div>
          <div className={`text-lg font-light ${isUp ? 'text-black' : 'text-gray-400'}`}>
            {changePct !== undefined ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '--'}
          </div>
        </div>
      )}
    </div>
  );
}
