import type { Page } from 'puppeteer-core';
import type { MarketSnapshot } from '../models/types';

/**
 * Injects live market data into the broadcast page's main screen area
 * for the "Market in a Minute" segment.
 */
export async function showMarketData(page: Page, market: MarketSnapshot): Promise<void> {
  await page.evaluate(
    (m: MarketSnapshot) => {
      const mainScreen = document.getElementById('main-screen-headline');
      const sub = document.getElementById('main-screen-sub');
      const tag = document.getElementById('main-screen-tag');

      if (tag) tag.textContent = 'MARKET IN A MINUTE';

      if (mainScreen) {
        const btcArrow = m.btcChange24h >= 0 ? '▲' : '▼';
        const ethArrow = m.ethChange24h >= 0 ? '▲' : '▼';
        mainScreen.innerHTML = `
          <div style="font-size:28px;line-height:1.6">
            <span style="color:#f7931a">BTC</span> $${m.btcPrice.toLocaleString()}
            <span style="color:${m.btcChange24h >= 0 ? '#22c55e' : '#ef4444'}">${btcArrow}${Math.abs(m.btcChange24h).toFixed(1)}%</span>
            <br>
            <span style="color:#627eea">ETH</span> $${m.ethPrice.toLocaleString()}
            <span style="color:${m.ethChange24h >= 0 ? '#22c55e' : '#ef4444'}">${ethArrow}${Math.abs(m.ethChange24h).toFixed(1)}%</span>
          </div>
        `;
      }

      if (sub && m.topMovers.length > 0) {
        const movers = m.topMovers.slice(0, 5).map((mv) => {
          const arrow = mv.change >= 0 ? '▲' : '▼';
          const color = mv.change >= 0 ? '#22c55e' : '#ef4444';
          return `<span style="color:${color}">${mv.symbol} ${arrow}${Math.abs(mv.change).toFixed(1)}%</span>`;
        });
        sub.innerHTML = `Top movers: ${movers.join(' &nbsp;|&nbsp; ')}`;
      }
    },
    market,
  );
}
