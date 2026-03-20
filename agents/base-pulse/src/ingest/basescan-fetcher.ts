import type { RawArticle } from '../models/types';
import { DEFILLAMA } from './sources';
import crypto from 'crypto';

interface DeFiLlamaProtocol {
  name: string;
  slug: string;
  chains: string[];
  tvl: number;
  change_1d?: number;
  change_7d?: number;
  category?: string;
}

interface BaseTvlDataPoint {
  date: number;
  tvl: number;
}

const BASE_RPC = 'https://mainnet.base.org';

/**
 * Fetch onchain data from Base RPC + DeFiLlama
 * Layer 2: onchain reality — gas, blocks, TVL, protocol rankings
 */
export async function fetchOnchainData(): Promise<{
  articles: RawArticle[];
  baseTvl?: number;
  baseTvlChange?: number;
  gasGwei?: number;
  blockNumber?: number;
}> {
  const articles: RawArticle[] = [];
  let baseTvl: number | undefined;
  let baseTvlChange: number | undefined;
  let gasGwei: number | undefined;
  let blockNumber: number | undefined;

  // ---- Base RPC: Gas Price ----
  try {
    const gasRes = await fetch(BASE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 }),
      signal: AbortSignal.timeout(10000),
    });
    if (gasRes.ok) {
      const gasData = await gasRes.json() as { result: string };
      const gasWei = parseInt(gasData.result, 16);
      gasGwei = gasWei / 1e9;
      console.log(`[Base RPC] Gas: ${gasGwei.toFixed(4)} gwei`);
    }
  } catch (err) {
    console.error('[Base RPC] Gas fetch failed:', err);
  }

  // ---- Base RPC: Block Number ----
  try {
    const blockRes = await fetch(BASE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      signal: AbortSignal.timeout(10000),
    });
    if (blockRes.ok) {
      const blockData = await blockRes.json() as { result: string };
      blockNumber = parseInt(blockData.result, 16);
      console.log(`[Base RPC] Block: ${blockNumber.toLocaleString()}`);
    }
  } catch (err) {
    console.error('[Base RPC] Block fetch failed:', err);
  }

  // ---- DeFiLlama: Base TVL ----
  try {
    const tvlRes = await fetch(DEFILLAMA.baseTvl, {
      signal: AbortSignal.timeout(10000),
    });

    if (tvlRes.ok) {
      const tvlData = (await tvlRes.json()) as BaseTvlDataPoint[];
      if (tvlData.length >= 2) {
        const latest = tvlData[tvlData.length - 1];
        const previous = tvlData[tvlData.length - 2];
        baseTvl = latest.tvl;
        baseTvlChange = previous.tvl > 0
          ? ((latest.tvl - previous.tvl) / previous.tvl) * 100
          : 0;

        const tvlFormatted = (baseTvl / 1e9).toFixed(2);
        const changeFormatted = baseTvlChange.toFixed(1);

        const id = crypto.createHash('md5').update(`base-tvl-${new Date().toISOString().slice(0, 10)}`).digest('hex').slice(0, 12);
        articles.push({
          id,
          title: `Base TVL: $${tvlFormatted}B (${baseTvlChange >= 0 ? '+' : ''}${changeFormatted}% 24h)`,
          summary: `Base chain total value locked is $${tvlFormatted} billion, ${baseTvlChange >= 0 ? 'up' : 'down'} ${Math.abs(baseTvlChange).toFixed(1)}% in the last 24 hours. Gas: ${gasGwei !== undefined ? gasGwei.toFixed(4) + ' gwei' : 'N/A'}. Block: ${blockNumber ? blockNumber.toLocaleString() : 'N/A'}.`,
          url: 'https://defillama.com/chain/Base',
          source: 'DeFiLlama',
          publishedAt: new Date().toISOString(),
          category: 'onchain',
          layer: 'onchain',
          signalType: 'metric',
        });

        console.log(`[DeFiLlama] Base TVL: $${tvlFormatted}B (${baseTvlChange >= 0 ? '+' : ''}${changeFormatted}%)`);
      }
    }
  } catch (err) {
    console.error('[DeFiLlama] Base TVL fetch failed:', err);
  }

  // ---- DeFiLlama: Top protocols on Base ----
  try {
    const protocolsRes = await fetch(DEFILLAMA.protocols, {
      signal: AbortSignal.timeout(15000),
    });

    if (protocolsRes.ok) {
      const allProtocols = (await protocolsRes.json()) as DeFiLlamaProtocol[];
      const baseProtocols = allProtocols
        .filter(p => p.chains?.includes('Base') && p.tvl > 1_000_000)
        .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
        .slice(0, 10);

      // Top movers (biggest 24h change)
      const movers = baseProtocols
        .filter(p => p.change_1d !== undefined && Math.abs(p.change_1d) > 5)
        .sort((a, b) => Math.abs(b.change_1d || 0) - Math.abs(a.change_1d || 0))
        .slice(0, 3);

      for (const protocol of movers) {
        const id = crypto.createHash('md5').update(`protocol-${protocol.slug}-${new Date().toISOString().slice(0, 10)}`).digest('hex').slice(0, 12);
        const tvlFormatted = protocol.tvl >= 1e9
          ? `$${(protocol.tvl / 1e9).toFixed(2)}B`
          : `$${(protocol.tvl / 1e6).toFixed(1)}M`;
        const change = protocol.change_1d || 0;

        articles.push({
          id,
          title: `${protocol.name} TVL ${change >= 0 ? 'surges' : 'drops'} ${Math.abs(change).toFixed(1)}% on Base (${tvlFormatted})`,
          summary: `${protocol.name} (${protocol.category || 'DeFi'}) on Base: TVL ${tvlFormatted}, 24h change ${change >= 0 ? '+' : ''}${change.toFixed(1)}%, 7d change ${(protocol.change_7d || 0).toFixed(1)}%.`,
          url: `https://defillama.com/protocol/${protocol.slug}`,
          source: 'DeFiLlama',
          publishedAt: new Date().toISOString(),
          category: 'defi',
          layer: 'onchain',
          signalType: 'metric',
        });
      }

      console.log(`[DeFiLlama] ${baseProtocols.length} Base protocols tracked, ${movers.length} significant movers`);
    }
  } catch (err) {
    console.error('[DeFiLlama] Protocols fetch failed:', err);
  }

  console.log(`[Onchain] ${articles.length} onchain signals collected`);
  return { articles, baseTvl, baseTvlChange, gasGwei, blockNumber };
}
