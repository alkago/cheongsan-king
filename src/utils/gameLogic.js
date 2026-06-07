import {
  GENERAL_REASONS,
  HIGH_LEVERAGE_REASONS,
  LONG_REASONS,
  SHORT_REASONS,
} from '../data/liquidationReasons.js';

export const START_BALANCE = 1_000_000;
export const REVIVE_BALANCE = 500_000;
export const TARGET_BALANCE = 10_000_000_000;
export const CANDLE_SECONDS = 15;
export const TICK_MS = 1000;
export const INITIAL_CANDLES = 24;
export const MAX_CANDLES = 64;

const randomBetween = (min, max) => min + Math.random() * (max - min);
const randomSign = () => (Math.random() >= 0.5 ? 1 : -1);

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const formatKRW = (value) => {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return new Intl.NumberFormat('ko-KR').format(safeValue) + '원';
};

export const formatPercent = (rate, digits = 2) => {
  const safeRate = Number.isFinite(rate) ? rate : 0;
  const sign = safeRate > 0 ? '+' : '';
  return `${sign}${(safeRate * 100).toFixed(digits)}%`;
};

export const generateMoveRate = (coin) => {
  const isSpike = Math.random() < coin.spikeChance;
  const min = isSpike ? coin.spikeMoveMin : coin.baseMoveMin;
  const max = isSpike ? coin.spikeMoveMax : coin.baseMoveMax;
  return randomBetween(min, max) * randomSign();
};

export const generateNextPrice = (currentPrice, coin) => {
  const moveRate = generateMoveRate(coin);
  return Math.max(1, currentPrice * (1 + moveRate));
};

export const createCandle = (time, open, close, coin) => {
  const directionHigh = Math.max(open, close);
  const directionLow = Math.min(open, close);
  const bodySize = Math.abs(close - open);
  const baseWick = open * randomBetween(0.0005, 0.0025) * coin.wickFactor;
  const wickPadding = Math.max(baseWick, bodySize * randomBetween(0.15, 0.55));

  return {
    time,
    open: roundPrice(open),
    high: roundPrice(directionHigh + wickPadding),
    low: roundPrice(Math.max(1, directionLow - wickPadding)),
    close: roundPrice(close),
  };
};

export const createInitialCandles = (coin, count = INITIAL_CANDLES) => {
  const candles = [];
  let price = 100;

  for (let i = 1; i <= count; i += 1) {
    const open = price;
    // 과거봉은 15초 안의 여러 틱을 압축해 조금 더 자연스럽게 생성합니다.
    for (let tick = 0; tick < CANDLE_SECONDS; tick += 1) {
      price = generateNextPrice(price, coin);
    }
    candles.push(createCandle(i, open, price, coin));
  }

  return candles;
};

export const createLiveCandle = (time, open) => ({
  time,
  open: roundPrice(open),
  high: roundPrice(open),
  low: roundPrice(open),
  close: roundPrice(open),
});

export const updateLiveCandle = (candle, price) => ({
  ...candle,
  high: roundPrice(Math.max(candle.high, price)),
  low: roundPrice(Math.min(candle.low, price)),
  close: roundPrice(price),
});

export const calculateLiquidationPrice = (entryPrice, position, leverage) => {
  if (!entryPrice || !leverage || !position) return 0;
  const offset = 1 / leverage;
  if (position === 'long') return roundPrice(entryPrice * (1 - offset));
  return roundPrice(entryPrice * (1 + offset));
};

export const calculatePnlRate = (entryPrice, currentPrice, position, leverage) => {
  if (!entryPrice || !currentPrice || !position || !leverage) return 0;
  const rawPriceMove = (currentPrice - entryPrice) / entryPrice;
  const directionalMove = position === 'long' ? rawPriceMove : -rawPriceMove;
  return directionalMove * leverage;
};

export const calculateEquity = (balance, pnlRate) => {
  if (!Number.isFinite(pnlRate)) return balance;
  return Math.max(0, balance * (1 + pnlRate));
};

export const isLiquidatedByPrice = (currentPrice, liquidationPrice, position) => {
  if (!currentPrice || !liquidationPrice || !position) return false;
  if (position === 'long') return currentPrice <= liquidationPrice;
  return currentPrice >= liquidationPrice;
};

export const calculateLiquidationDistanceRate = (currentPrice, liquidationPrice, position) => {
  if (!currentPrice || !liquidationPrice || !position) return 0;
  if (position === 'long') return Math.max(0, (currentPrice - liquidationPrice) / currentPrice);
  return Math.max(0, (liquidationPrice - currentPrice) / currentPrice);
};

export const getActionLabel = (pnlRate, distanceRate) => {
  if (distanceRate < 0.003) return '탈출하기';
  if (pnlRate >= 0) return '익절하기';
  return '손절하기';
};

export const getRiskLabel = (distanceRate) => {
  if (distanceRate < 0.003) return '청산선이 코앞입니다.';
  if (distanceRate < 0.01) return '슬슬 위험합니다.';
  if (distanceRate < 0.025) return '아직 버틸 만합니다.';
  return '여유는 있지만 방심은 금물입니다.';
};

export const getRandomLiquidationReason = ({ position, leverage } = {}) => {
  let pool = [...GENERAL_REASONS];
  if (position === 'long') pool = [...LONG_REASONS, ...pool];
  if (position === 'short') pool = [...SHORT_REASONS, ...pool];
  if (Number(leverage) >= 50) pool = [...HIGH_LEVERAGE_REASONS, ...pool];

  return pool[Math.floor(Math.random() * pool.length)];
};

export const buildShareText = ({ coin, position, leverage, reason, bestBalance }) => {
  const positionText = position === 'long' ? '롱' : '숏';
  return [
    `청산왕에서 ${coin?.symbol ?? '코인'} ${leverage}배 ${positionText} 잡고 청산당했습니다.`,
    '',
    reason,
    '',
    `최고 자산: ${formatKRW(bestBalance)}`,
    '100만 원으로 100억 만들기, 당신도 도전해보세요.',
  ].join('\n');
};

const roundPrice = (value) => Math.round(value * 10000) / 10000;
