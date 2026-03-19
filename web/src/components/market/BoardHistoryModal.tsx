import { marketApi } from '../../services/marketApi';
import { KLineChart } from '../charts/KLineChart';
import { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTheme } from '../../theme/ThemeContext';

interface BoardHistoryModalProps {
  boardName: string;
  boardType: 'concept' | 'industry';
  open: boolean;
  onClose: () => void;
}

export function BoardHistoryModal({ boardName, boardType, open, onClose }: BoardHistoryModalProps) {
  const { theme } = useTheme();
  const isFinancial = theme === 'financial';
  const isCartoon = theme === 'cartoon';
  const isMinimal = theme === 'minimal';
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = boardType === 'concept'
        ? await marketApi.getConceptBoardIndex(boardName)
        : await marketApi.getIndustryBoardIndex(boardName);
      setHistory(data.map(d => ({
        date: d.date,
        open: d.open,
        close: d.close,
        high: d.high,
        low: d.low,
        volume: d.volume,
      })));
    } catch (e) {
      console.error('Failed to load board history:', e);
    } finally {
      setLoading(false);
    }
  }, [boardName, boardType]);

  useEffect(() => {
    if (open && boardName) {
      loadData();
    }
  }, [open, boardName, boardType, loadData]);

  // 响应式宽度
  const modalWidth = isMinimal ? '95vw' : isFinancial ? '800px' : '700px';

  return (
    <Dialog.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 bg-black/50"
          style={{ backdropFilter: isFinancial ? 'blur(4px)' : undefined }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg overflow-hidden"
          style={{
            width: modalWidth,
            maxWidth: '95vw',
            maxHeight: '85vh',
            backgroundColor: isCartoon ? 'var(--color-surface)' : (isMinimal ? '#FFFFFF' : 'var(--color-surface)'),
            border: isCartoon ? '4px solid var(--color-border)' : (isMinimal ? 'none' : '1px solid var(--color-border)'),
            boxShadow: isCartoon ? '8px 8px 0px var(--color-border)' : undefined,
          }}
        >
          {/* Header */}
          <div
            className="flex justify-between items-center p-4"
            style={{
              borderBottom: isCartoon ? '3px solid var(--color-border)' : '1px solid var(--color-border)',
            }}
          >
            <Dialog.Title
              className="text-lg font-semibold"
              style={{
                fontFamily: isCartoon ? 'var(--font-heading)' : undefined,
                color: 'var(--color-text)',
              }}
            >
              {boardName} - 指数历史
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                aria-label="关闭"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div
            className="p-4 overflow-y-auto"
            style={{ maxHeight: 'calc(85vh - 70px)' }}
          >
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">加载中...</div>
              </div>
            ) : (
              <KLineChart data={history} height={400} />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
