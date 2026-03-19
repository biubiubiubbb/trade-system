import { BidAsk } from '../../services/marketApi';

interface Props {
  bidAsk: BidAsk | null;
  loading?: boolean;
}

export function BidAskPanel({ bidAsk, loading }: Props) {
  if (loading) return <div className="text-gray-400">加载中...</div>;
  if (!bidAsk) return null;

  const bids = [bidAsk.bid1, bidAsk.bid2, bidAsk.bid3, bidAsk.bid4, bidAsk.bid5];
  const asks = [bidAsk.ask1, bidAsk.ask2, bidAsk.ask3, bidAsk.ask4, bidAsk.ask5];

  const formatVol = (vol: number) => {
    if (vol >= 1e8) return (vol / 1e8).toFixed(2) + '亿';
    if (vol >= 1e4) return (vol / 1e4).toFixed(2) + '万';
    return vol.toFixed(0);
  };

  return (
    <div className="text-sm">
      <div className="grid grid-cols-2 gap-2">
        {/* 卖盘（5档） */}
        <div>
          <div className="text-xs text-gray-400 mb-1">卖盘</div>
          {[...asks].reverse().map((ask, i) => (
            <div key={`ask-${i}`} className="flex justify-between text-down">
              <span className="text-gray-400">{ask.price.toFixed(2)}</span>
              <span>{formatVol(ask.vol)}</span>
            </div>
          ))}
        </div>
        {/* 买盘（5档） */}
        <div>
          <div className="text-xs text-gray-400 mb-1">买盘</div>
          {bids.map((bid, i) => (
            <div key={`bid-${i}`} className="flex justify-between text-up">
              <span className="text-gray-400">{bid.price.toFixed(2)}</span>
              <span>{formatVol(bid.vol)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}