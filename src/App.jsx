import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CandleChart from './components/CandleChart.jsx';
import { COINS, getCoinBySymbol } from './data/coins.js';
import {
  CANDLE_SECONDS,
  INITIAL_CANDLES,
  MAX_CANDLES,
  REVIVE_BALANCE,
  START_BALANCE,
  TARGET_BALANCE,
  TICK_MS,
  buildShareText,
  calculateEquity,
  calculateLiquidationDistanceRate,
  calculateLiquidationPrice,
  calculatePnlRate,
  createInitialCandles,
  createLiveCandle,
  formatKRW,
  formatPercent,
  generateNextPrice,
  getActionLabel,
  getRandomLiquidationReason,
  getRiskLabel,
  isLiquidatedByPrice,
  updateLiveCandle,
} from './utils/gameLogic.js';

const STORAGE_KEY = 'cheongsanKingBestBalance';
const SCREENS = {
  HOME: 'home',
  COIN: 'coin',
  POSITION: 'position',
  LEVERAGE: 'leverage',
  PLAY: 'play',
  CLOSED: 'closed',
  LIQUIDATED: 'liquidated',
  AD: 'ad',
  WON: 'won',
};

const initialTradeState = {
  selectedCoin: null,
  position: null,
  leverage: null,
  entryPrice: 100,
  currentPrice: 100,
  liquidationPrice: 0,
  candles: [],
  secondsLeftInCandle: CANDLE_SECONDS,
  tickInCandle: 0,
  pnlRate: 0,
  distanceRate: 0,
  liquidationReason: '',
  lastClosedPnlRate: 0,
};

function App() {
  const [screen, setScreen] = useState(SCREENS.HOME);
  const [balance, setBalance] = useState(START_BALANCE);
  const [bestBalance, setBestBalance] = useState(START_BALANCE);
  const [revived, setRevived] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const [copyMessage, setCopyMessage] = useState('');
  const [trade, setTrade] = useState(initialTradeState);
  const screenRef = useRef(screen);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(saved) && saved > START_BALANCE) {
      setBestBalance(saved);
    }
  }, []);

  const selectedCoin = trade.selectedCoin ? getCoinBySymbol(trade.selectedCoin) : null;
  const currentEquity = useMemo(
    () => calculateEquity(balance, trade.pnlRate),
    [balance, trade.pnlRate],
  );

  const updateBestBalance = useCallback((candidate) => {
    setBestBalance((prev) => {
      const next = Math.max(prev, Math.round(candidate));
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setScreen(SCREENS.HOME);
    setBalance(START_BALANCE);
    setRevived(false);
    setCopyMessage('');
    setAdCountdown(5);
    setTrade(initialTradeState);
    updateBestBalance(START_BALANCE);
  }, [updateBestBalance]);

  const startNewRun = useCallback(() => {
    setBalance(START_BALANCE);
    setRevived(false);
    setCopyMessage('');
    setTrade(initialTradeState);
    setScreen(SCREENS.COIN);
    updateBestBalance(START_BALANCE);
  }, [updateBestBalance]);

  const selectCoin = (symbol) => {
    setTrade((prev) => ({ ...prev, selectedCoin: symbol, position: null, leverage: null }));
    setScreen(SCREENS.POSITION);
  };

  const selectPosition = (position) => {
    setTrade((prev) => ({ ...prev, position }));
    setScreen(SCREENS.LEVERAGE);
  };

  const selectLeverage = (leverage) => {
    const coin = getCoinBySymbol(trade.selectedCoin);
    if (!coin || !trade.position) return;

    const baseCandles = createInitialCandles(coin, INITIAL_CANDLES);
    const lastClose = baseCandles[baseCandles.length - 1].close;
    const liveCandle = createLiveCandle(baseCandles.length + 1, lastClose);
    const entryPrice = lastClose;
    const liquidationPrice = calculateLiquidationPrice(entryPrice, trade.position, leverage);

    setCopyMessage('');
    setTrade((prev) => ({
      ...prev,
      leverage,
      entryPrice,
      currentPrice: entryPrice,
      liquidationPrice,
      candles: [...baseCandles, liveCandle],
      secondsLeftInCandle: CANDLE_SECONDS,
      tickInCandle: 0,
      pnlRate: 0,
      distanceRate: calculateLiquidationDistanceRate(entryPrice, liquidationPrice, trade.position),
      liquidationReason: '',
      lastClosedPnlRate: 0,
    }));
    setScreen(SCREENS.PLAY);
  };

  const finishPosition = useCallback(() => {
    if (screenRef.current !== SCREENS.PLAY) return;
    const pnlRate = calculatePnlRate(
      trade.entryPrice,
      trade.currentPrice,
      trade.position,
      trade.leverage,
    );
    const nextBalance = Math.max(0, Math.round(calculateEquity(balance, pnlRate)));

    setBalance(nextBalance);
    updateBestBalance(nextBalance);
    setTrade((prev) => ({ ...prev, lastClosedPnlRate: pnlRate, pnlRate: 0, distanceRate: 0 }));

    if (nextBalance >= TARGET_BALANCE) {
      setScreen(SCREENS.WON);
      return;
    }

    setScreen(SCREENS.CLOSED);
  }, [balance, trade.currentPrice, trade.entryPrice, trade.leverage, trade.position, updateBestBalance]);

  const liquidatePosition = useCallback((nextPrice) => {
    const reason = getRandomLiquidationReason({
      position: trade.position,
      leverage: trade.leverage,
    });
    const pnlRate = calculatePnlRate(trade.entryPrice, nextPrice, trade.position, trade.leverage);
    const peak = calculateEquity(balance, Math.max(trade.pnlRate, pnlRate));

    updateBestBalance(peak);
    setTrade((prev) => ({
      ...prev,
      currentPrice: nextPrice,
      pnlRate: -1,
      distanceRate: 0,
      liquidationReason: reason,
      lastClosedPnlRate: -1,
    }));
    setScreen(SCREENS.LIQUIDATED);
  }, [balance, trade.entryPrice, trade.leverage, trade.pnlRate, trade.position, updateBestBalance]);

  useEffect(() => {
    if (screen !== SCREENS.PLAY || !selectedCoin) return undefined;

    const intervalId = window.setInterval(() => {
      setTrade((prev) => {
        if (!prev.candles.length) return prev;

        const nextPrice = generateNextPrice(prev.currentPrice, selectedCoin);
        const pnlRate = calculatePnlRate(prev.entryPrice, nextPrice, prev.position, prev.leverage);
        const equity = calculateEquity(balance, pnlRate);
        updateBestBalance(equity);

        const lastCandle = prev.candles[prev.candles.length - 1];
        const updatedLiveCandle = updateLiveCandle(lastCandle, nextPrice);
        let nextCandles = [...prev.candles.slice(0, -1), updatedLiveCandle];
        let nextTick = prev.tickInCandle + 1;
        let nextSeconds = Math.max(0, CANDLE_SECONDS - nextTick);

        if (isLiquidatedByPrice(nextPrice, prev.liquidationPrice, prev.position)) {
          window.setTimeout(() => liquidatePosition(nextPrice), 0);
          return {
            ...prev,
            currentPrice: nextPrice,
            pnlRate,
            distanceRate: 0,
            candles: nextCandles,
            secondsLeftInCandle: nextSeconds,
            tickInCandle: nextTick,
          };
        }

        if (nextTick >= CANDLE_SECONDS) {
          const newLiveCandle = createLiveCandle(updatedLiveCandle.time + 1, updatedLiveCandle.close);
          nextCandles = [...nextCandles, newLiveCandle].slice(-MAX_CANDLES);
          nextTick = 0;
          nextSeconds = CANDLE_SECONDS;
        }

        return {
          ...prev,
          currentPrice: nextPrice,
          pnlRate,
          distanceRate: calculateLiquidationDistanceRate(nextPrice, prev.liquidationPrice, prev.position),
          candles: nextCandles,
          secondsLeftInCandle: nextSeconds,
          tickInCandle: nextTick,
        };
      });
    }, TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [balance, liquidatePosition, screen, selectedCoin, updateBestBalance]);

  useEffect(() => {
    if (screen !== SCREENS.AD) return undefined;
    setAdCountdown(5);
    const timerId = window.setInterval(() => {
      setAdCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId);
          setBalance(REVIVE_BALANCE);
          setRevived(true);
          setTrade(initialTradeState);
          setCopyMessage('');
          setScreen(SCREENS.COIN);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [screen]);

  const continueWithSameCoin = () => {
    setTrade((prev) => ({
      ...initialTradeState,
      selectedCoin: prev.selectedCoin,
    }));
    setScreen(SCREENS.POSITION);
  };

  const chooseAnotherCoin = () => {
    setTrade(initialTradeState);
    setScreen(SCREENS.COIN);
  };

  const handleShare = async () => {
    const shareText = buildShareText({
      coin: selectedCoin,
      position: trade.position,
      leverage: trade.leverage,
      reason: trade.liquidationReason || '이번엔 다를 줄 아셨군요.',
      bestBalance,
    });

    try {
      if (navigator.share) {
        await navigator.share({ title: '청산왕 결과', text: shareText });
        setCopyMessage('공유창을 열었습니다.');
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopyMessage('결과가 복사되었습니다.');
    } catch {
      setCopyMessage('공유가 취소되었습니다.');
    }
  };

  return (
    <main className="appShell">
      <div className="phoneFrame">
        <Header bestBalance={bestBalance} balance={balance} screen={screen} />

        {screen === SCREENS.HOME && (
          <section className="screen heroScreen">
            <div className="heroBadge">15초봉 자동 캔들차트</div>
            <h1>청산왕</h1>
            <p className="subtitle">100만 원으로 100억 만들기</p>
            <div className="heroCard">
              <span>최고 기록</span>
              <strong>{formatKRW(bestBalance)}</strong>
              <p>롱/숏, 3배/10배/50배. 청산선에 닿기 전에 빠져나오세요.</p>
            </div>
            <button className="primaryButton" onClick={startNewRun}>시작하기</button>
            <p className="finePrint">실제 투자와 무관한 게임용 랜덤 차트입니다.</p>
          </section>
        )}

        {screen === SCREENS.COIN && (
          <section className="screen">
            <ScreenTitle eyebrow="STEP 1" title="종목을 선택하세요" />
            <div className="choiceList">
              {COINS.map((coin) => (
                <button key={coin.symbol} className="choiceCard" onClick={() => selectCoin(coin.symbol)}>
                  <div>
                    <strong>{coin.displayName}</strong>
                    <p>{coin.description}</p>
                  </div>
                  <span>{coin.tag}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {screen === SCREENS.POSITION && selectedCoin && (
          <section className="screen">
            <ScreenTitle eyebrow={selectedCoin.shortName} title="포지션을 선택하세요" />
            <div className="twoColumn">
              <button className="choiceCard tall green" onClick={() => selectPosition('long')}>
                <strong>롱</strong>
                <p>오르면 수익</p>
              </button>
              <button className="choiceCard tall red" onClick={() => selectPosition('short')}>
                <strong>숏</strong>
                <p>내리면 수익</p>
              </button>
            </div>
            <button className="ghostButton" onClick={() => setScreen(SCREENS.COIN)}>종목 다시 고르기</button>
          </section>
        )}

        {screen === SCREENS.LEVERAGE && selectedCoin && (
          <section className="screen">
            <ScreenTitle eyebrow={`${selectedCoin.shortName} / ${trade.position === 'long' ? '롱' : '숏'}`} title="레버리지를 선택하세요" />
            <div className="choiceList">
              {[3, 10, 50].map((lev) => (
                <button key={lev} className="choiceCard leverage" onClick={() => selectLeverage(lev)}>
                  <strong>{lev}배</strong>
                  <p>{lev === 3 ? '안전하지만 느립니다.' : lev === 10 ? '적당한 광기입니다.' : '한 방 또는 청산입니다.'}</p>
                </button>
              ))}
            </div>
            <button className="ghostButton" onClick={() => setScreen(SCREENS.POSITION)}>포지션 다시 고르기</button>
          </section>
        )}

        {screen === SCREENS.PLAY && selectedCoin && (
          <section className="screen playScreen">
            <div className="tradeTop">
              <div>
                <span>15초봉 LIVE</span>
                <strong>{selectedCoin.symbol} / {trade.position === 'long' ? '롱' : '숏'} / {trade.leverage}배</strong>
              </div>
              <div className="candleTimer">{trade.secondsLeftInCandle}s</div>
            </div>
            <CandleChart
              candles={trade.candles}
              entryPrice={trade.entryPrice}
              liquidationPrice={trade.liquidationPrice}
              position={trade.position}
            />
            <div className="metricGrid">
              <Metric label="현재가" value={trade.currentPrice.toFixed(4)} />
              <Metric label="진입가" value={trade.entryPrice.toFixed(4)} />
              <Metric label="청산가" value={trade.liquidationPrice.toFixed(4)} danger />
              <Metric label="청산까지" value={formatPercent(trade.distanceRate, 2)} danger={trade.distanceRate < 0.01} />
            </div>
            <div className="equityPanel">
              <span>평가 자산</span>
              <strong>{formatKRW(currentEquity)}</strong>
              <em className={trade.pnlRate >= 0 ? 'profitText' : 'lossText'}>{formatPercent(trade.pnlRate, 2)}</em>
              <p className={trade.distanceRate < 0.01 ? 'dangerText' : ''}>{getRiskLabel(trade.distanceRate)}</p>
            </div>
            <button className={trade.pnlRate >= 0 ? 'primaryButton greenButton' : 'primaryButton redButton'} onClick={finishPosition}>
              {getActionLabel(trade.pnlRate, trade.distanceRate)}
            </button>
          </section>
        )}

        {screen === SCREENS.CLOSED && selectedCoin && (
          <section className="screen resultScreen">
            <div className={trade.lastClosedPnlRate >= 0 ? 'resultIcon profit' : 'resultIcon loss'}>
              {trade.lastClosedPnlRate >= 0 ? '익절' : '손절'}
            </div>
            <h2>{trade.lastClosedPnlRate >= 0 ? '포지션을 잘 빠져나왔습니다.' : '그래도 청산은 피했습니다.'}</h2>
            <p className={trade.lastClosedPnlRate >= 0 ? 'bigPnl profitText' : 'bigPnl lossText'}>{formatPercent(trade.lastClosedPnlRate, 2)}</p>
            <div className="resultCard">
              <span>현재 자산</span>
              <strong>{formatKRW(balance)}</strong>
            </div>
            <button className="primaryButton" onClick={continueWithSameCoin}>같은 종목 다시 진입</button>
            <button className="ghostButton" onClick={chooseAnotherCoin}>종목 다시 고르기</button>
          </section>
        )}

        {screen === SCREENS.LIQUIDATED && selectedCoin && (
          <section className="screen resultScreen liquidationScreen">
            <div className="resultIcon liquidation">청산</div>
            <h2>청산되었습니다.</h2>
            <p className="reasonText">{trade.liquidationReason}</p>
            <div className="resultCard dangerCard">
              <span>최고 기록</span>
              <strong>{formatKRW(bestBalance)}</strong>
            </div>
            {!revived && <button className="primaryButton" onClick={() => setScreen(SCREENS.AD)}>광고 보고 부활</button>}
            <button className="ghostButton" onClick={startNewRun}>다시 시작</button>
            <button className="ghostButton" onClick={handleShare}>결과 공유</button>
            {copyMessage && <p className="copyMessage">{copyMessage}</p>}
          </section>
        )}

        {screen === SCREENS.AD && (
          <section className="screen adScreen">
            <div className="adBox">
              <span>ADVERTISEMENT</span>
              <h2>마진콜 유예 심사 중...</h2>
              <strong>{adCountdown}</strong>
              <p>광고 시청 완료 후 500,000원으로 1회 부활합니다.</p>
            </div>
          </section>
        )}

        {screen === SCREENS.WON && (
          <section className="screen resultScreen wonScreen">
            <div className="resultIcon profit">달성</div>
            <h2>100억을 달성했습니다.</h2>
            <p className="reasonText">이 정도면 청산왕이 아니라 탈출왕입니다.</p>
            <div className="resultCard">
              <span>최종 자산</span>
              <strong>{formatKRW(balance)}</strong>
            </div>
            <button className="primaryButton" onClick={startNewRun}>새 게임 시작</button>
          </section>
        )}
      </div>
    </main>
  );
}

function Header({ bestBalance, balance, screen }) {
  const isHome = screen === SCREENS.HOME;
  return (
    <header className="appHeader">
      <div>
        <span>{isHome ? 'MVP' : '청산왕'}</span>
        <strong>{isHome ? 'Cheongsan King' : formatKRW(balance)}</strong>
      </div>
      <div className="headerBest">
        <span>BEST</span>
        <strong>{formatKRW(bestBalance)}</strong>
      </div>
    </header>
  );
}

function ScreenTitle({ eyebrow, title }) {
  return (
    <div className="screenTitle">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
    </div>
  );
}

function Metric({ label, value, danger = false }) {
  return (
    <div className={danger ? 'metric dangerMetric' : 'metric'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
