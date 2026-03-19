import { RealtimeData } from '../../services/marketApi';

interface Props {
  code: string;
  name: string;
  industry?: string;
  realtime?: RealtimeData;
  selected?: boolean;
  onClick?: () => void;
}

export function RealtimeTicker({ code, name, industry, realtime, selected, onClick }: Props) {
  const price = realtime?.price ?? 0;
  const changePct = realtime?.changePct ?? 0;
  const isUp = changePct >= 0;

  return (
    <div
      className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
        selected ? 'bg-blue-50' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <div>
          <span className="font-medium">{name}</span>
          <span className="ml-2 text-xs text-gray-400">{code}</span>
        </div>
        <span
          className={`text-lg font-bold ${isUp ? 'text-up' : 'text-down'}`}
        >
          {price > 0 ? price.toFixed(2) : '--'}
        </span>
      </div>
      <div className="flex justify-between mt-1 text-sm">
        <span className="text-gray-500">{industry || ''}</span>
        <span
          className={`${isUp ? 'text-up' : 'text-down'}`}
        >
          {changePct !== 0 ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '--'}
        </span>
      </div>
    </div>
  );
}