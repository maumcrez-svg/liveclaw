import type { Page } from 'puppeteer-core';
import type { MarketSnapshot } from '../models/types';

/**
 * Injects live market/onchain data into the broadcast page
 * for the "Chain Radar" segment.
 */
export async function showMarketData(page: Page, market: MarketSnapshot): Promise<void> {
  await page.evaluate(
    (m: MarketSnapshot) => {
      const mainScreen = document.getElementById('main-screen-headline');
      const sub = document.getElementById('main-screen-sub');
      const tag = document.getElementById('main-screen-tag');

      if (tag) tag.textContent = 'CHAIN RADAR';

      if (mainScreen) {
        const ethArrow = m.ethChange24h >= 0 ? '▲' : '▼';
        const baseTvlLine = m.baseTvl
          ? `<br><span style="color:#0052FF">BASE TVL</span> $${(m.baseTvl / 1e9).toFixed(2)}B <span style="color:${(m.baseTvlChange24h || 0) >= 0 ? '#22c55e' : '#ef4444'}">${(m.baseTvlChange24h || 0) >= 0 ? '▲' : '▼'}${Math.abs(m.baseTvlChange24h || 0).toFixed(1)}%</span>`
          : '';
        const gasLine = m.baseGasGwei !== undefined
          ? `<br><span style="color:#22c55e">GAS</span> ${m.baseGasGwei < 0.01 ? '< 0.01' : m.baseGasGwei.toFixed(4)} gwei`
          : '';
        const blockLine = m.baseBlockNumber
          ? ` &nbsp; <span style="color:#8b5cf6">BLOCK</span> ${m.baseBlockNumber.toLocaleString()}`
          : '';
        mainScreen.innerHTML = `
          <div style="font-size:26px;line-height:1.6">
            <span style="color:#627eea">ETH</span> $${m.ethPrice.toLocaleString()}
            <span style="color:${m.ethChange24h >= 0 ? '#22c55e' : '#ef4444'}">${ethArrow}${Math.abs(m.ethChange24h).toFixed(1)}%</span>
            ${baseTvlLine}${gasLine}${blockLine}
          </div>
        `;
      }

      if (sub && m.topMovers.length > 0) {
        const movers = m.topMovers.slice(0, 5).map((mv) => {
          const arrow = mv.change >= 0 ? '▲' : '▼';
          const color = mv.change >= 0 ? '#22c55e' : '#ef4444';
          return `<span style="color:${color}">${mv.symbol} ${arrow}${Math.abs(mv.change).toFixed(1)}%</span>`;
        });
        sub.innerHTML = `Base tokens: ${movers.join(' &nbsp;|&nbsp; ')}`;
      }
    },
    market,
  );
}
