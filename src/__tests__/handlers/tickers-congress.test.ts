import { describe, it, expect } from 'vitest';
import { resolveCik } from '../../handlers/_tickers.js';
import { extractTicker, parseTradesTable } from '../../handlers/congress.js';
import { tradeTicker, matchesTicker } from '../../handlers/trading.js';
import { MemoryStore } from '../../store.js';
import type { ToolContext } from '../../types.js';

// Seed the SEC ticker map BEFORE the first resolveCik call — the module keeps
// a session-level memMap after first load, so late seeding would be ignored.
const store = new MemoryStore();
store.cacheSet(
  'sec:company_tickers',
  {
    'BRK-B': { cik: '0001067983', title: 'BERKSHIRE HATHAWAY INC' },
    AAPL: { cik: '0000320193', title: 'Apple Inc.' },
    FSLR: { cik: '0000850429', title: 'FIRST SOLAR INC' },
  },
  24 * 60 * 60,
);

const ctx: ToolContext = {
  client: undefined as never,
  store,
  callTool: async () => {
    throw new Error('network disabled in tests');
  },
};

describe('resolveCik', () => {
  it('resolves SEC dash-format share classes (BRK-B)', async () => {
    const info = await resolveCik(ctx, 'BRK-B');
    expect(info).toEqual({ cik: '0001067983', title: 'BERKSHIRE HATHAWAY INC' });
  });

  it('normalizes dot to dash (BRK.B → BRK-B)', async () => {
    const info = await resolveCik(ctx, 'BRK.B');
    expect(info).toEqual({ cik: '0001067983', title: 'BERKSHIRE HATHAWAY INC' });
  });

  it('returns null for indices (^VIX)', async () => {
    expect(await resolveCik(ctx, '^VIX')).toBeNull();
  });

  it('returns null for futures (GC=F)', async () => {
    expect(await resolveCik(ctx, 'GC=F')).toBeNull();
  });

  it('returns null for unknown tickers (ZZZQ)', async () => {
    expect(await resolveCik(ctx, 'ZZZQ')).toBeNull();
  });

  it('is case-insensitive (aapl)', async () => {
    const info = await resolveCik(ctx, 'aapl');
    expect(info).toEqual({ cik: '0000320193', title: 'Apple Inc.' });
  });
});

describe('extractTicker', () => {
  it('extracts the trailing :US listing tag', () => {
    expect(extractTicker('NVIDIA Corp NVDA:US')).toBe('NVDA');
  });

  it('handles dotted share classes in the tag', () => {
    expect(extractTicker('Berkshire Hathaway BRK.B:US')).toBe('BRK.B');
  });

  it('returns null when no tag is present', () => {
    expect(extractTicker('no tag')).toBeNull();
  });
});

describe('parseTradesTable', () => {
  const HTML = `
    <table>
      <tbody>
        <tr>
          <td>Jane Smith Democrat House CA</td>
          <td><span>NVIDIA Corp NVDA:US</span></td>
          <td>2026-06-20</td>
          <td>2026-06-01</td>
          <td>19 days</td>
          <td>Self</td>
          <td>buy</td>
          <td>15K-50K</td>
          <td>$150.00</td>
        </tr>
      </tbody>
    </table>`;

  it('parses a row and extracts the ticker from the issuer cell', () => {
    const rows = parseTradesTable(HTML);
    expect(rows).toHaveLength(1);
    expect(rows[0].ticker).toBe('NVDA');
    expect(rows[0].issuer).toBe('NVIDIA Corp NVDA:US');
    expect(rows[0].type).toBe('buy');
  });
});

describe('matchesTicker', () => {
  it('matches on the parsed ticker exactly', () => {
    expect(matchesTicker({ ticker: 'NVDA' }, 'NVDA')).toBe(true);
  });

  it('does not prefix-match a shorter symbol (NVDA vs NVD)', () => {
    expect(matchesTicker({ ticker: 'NVDA' }, 'NVD')).toBe(false);
  });

  it('stopword title token: FIRST REPUBLIC BANK must not match FIRST SOLAR INC', () => {
    expect(
      matchesTicker({ issuer: 'FIRST REPUBLIC BANK' }, 'FSLR', 'FIRST SOLAR INC'),
    ).toBe(false);
  });

  it('stopword title token: UNITED PARCEL SERVICE must not match UNITED AIRLINES HOLDINGS', () => {
    expect(
      matchesTicker(
        { issuer: 'UNITED PARCEL SERVICE' },
        'UAL',
        'UNITED AIRLINES HOLDINGS',
      ),
    ).toBe(false);
  });

  it('short-symbol guard: T must not match AT&T INC by issuer text', () => {
    expect(matchesTicker({ issuer: 'AT&T INC' }, 'T')).toBe(false);
  });

  it('a :US tag on the issuer is authoritative — name heuristics never run', () => {
    const trade = { issuer: 'APPLE HOLDINGS NVDA:US' };
    expect(tradeTicker(trade)).toBe('NVDA');
    expect(matchesTicker(trade, 'AAPL', 'Apple Inc.')).toBe(false);
  });

  it('untagged issuer still matches via a distinctive title token', () => {
    expect(matchesTicker({ issuer: 'NVIDIA CORP' }, 'NVDA', 'NVIDIA Corp')).toBe(true);
  });
});
