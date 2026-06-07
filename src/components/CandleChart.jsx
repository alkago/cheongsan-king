import { useEffect, useRef } from 'react';
import { CandlestickSeries, ColorType, createChart, LineStyle } from 'lightweight-charts';

const CHART_HEIGHT = 276;

function CandleChart({ candles, entryPrice, liquidationPrice, position }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const entryLineRef = useRef(null);
  const liquidationLineRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = createChart(containerRef.current, {
      height: CHART_HEIGHT,
      width: containerRef.current.clientWidth,
      layout: {
        background: { type: ColorType.Solid, color: '#0c111d' },
        textColor: '#a6b0c3',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.18)',
        scaleMargins: { top: 0.12, bottom: 0.18 },
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.18)',
        timeVisible: false,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 10,
        minBarSpacing: 5,
        fixLeftEdge: true,
        fixRightEdge: false,
      },
      crosshair: {
        mode: 0,
        vertLine: { visible: false, labelVisible: false },
        horzLine: { color: 'rgba(226, 232, 240, 0.22)', labelBackgroundColor: '#111827' },
      },
      handleScale: false,
      handleScroll: false,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#86efac',
      wickDownColor: '#fca5a5',
      priceLineVisible: true,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
        chart.timeScale().scrollToRealTime();
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      entryLineRef.current = null;
      liquidationLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !candles?.length) return;
    candleSeriesRef.current.setData(candles);
    chartRef.current?.timeScale().scrollToRealTime();
  }, [candles]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series || !entryPrice || !liquidationPrice) return;

    if (entryLineRef.current) {
      series.removePriceLine(entryLineRef.current);
    }
    if (liquidationLineRef.current) {
      series.removePriceLine(liquidationLineRef.current);
    }

    entryLineRef.current = series.createPriceLine({
      price: entryPrice,
      color: '#facc15',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '진입가',
    });

    liquidationLineRef.current = series.createPriceLine({
      price: liquidationPrice,
      color: '#fb7185',
      lineWidth: 2,
      lineStyle: position === 'short' ? LineStyle.Dotted : LineStyle.Solid,
      axisLabelVisible: true,
      title: '청산가',
    });
  }, [entryPrice, liquidationPrice, position]);

  return <div className="chartBox" ref={containerRef} aria-label="15초봉 캔들차트" />;
}

export default CandleChart;
