import { useTheme } from '../theme/ThemeContext';
import { themes } from '../theme/theme.config';

export function Settings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">设置</h1>

      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">主题设置</h2>
        <div className="grid grid-cols-3 gap-4">
          {themes.map((t) => (
            <div
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`p-4 border-2 cursor-pointer transition-all ${
                theme === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              style={{ borderRadius: t.id === 'minimal' ? 0 : t.id === 'financial' ? 6 : 0 }}
            >
              <div
                className="h-20 mb-3"
                style={{
                  background: t.id === 'financial' ? '#0F172A' : t.id === 'cartoon' ? '#87CEEB' : '#FFFFFF',
                  border: t.id === 'financial' ? '2px solid #334155' : t.id === 'cartoon' ? '2px solid #2D3436' : '1px solid #E5E7EB',
                }}
              />
              <div className="font-medium">{t.name}</div>
              <div className="text-sm opacity-60">{t.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
