export type ThemeType = 'financial' | 'cartoon' | 'minimal';

export interface Theme {
  id: ThemeType;
  name: string;
  description: string;
}

export const themes: Theme[] = [
  { id: 'financial', name: '金融风格', description: '专业深色，适合交易' },
  { id: 'cartoon', name: '卡通风格', description: '像素风，马里奥风格' },
  { id: 'minimal', name: '极简风格', description: '极致简洁，无装饰' },
];

export const themeColors: Record<ThemeType, {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  up: string;
  down: string;
}> = {
  financial: {
    primary: '#3B82F6',
    secondary: '#6366F1',
    background: '#0F172A',
    surface: '#1E293B',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    border: '#334155',
    up: '#EF4444',
    down: '#22C55E',
  },
  cartoon: {
    primary: '#FFD700',
    secondary: '#FF6B6B',
    background: '#87CEEB',
    surface: '#FFFFFF',
    text: '#2D3436',
    textSecondary: '#636E72',
    border: '#B2BEC3',
    up: '#FF4757',
    down: '#2ECC71',
  },
  minimal: {
    primary: '#000000',
    secondary: '#6B7280',
    background: '#FFFFFF',
    surface: '#FAFAFA',
    text: '#000000',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    up: '#000000',
    down: '#9CA3AF',
  },
};
