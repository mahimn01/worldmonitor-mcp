import { describe, it, expect } from 'vitest';
import { parseForm4Xml } from '../../handlers/_form4.js';

const FIXTURE = `<?xml version="1.0"?>
<ownershipDocument>
  <issuer><issuerTradingSymbol>TEST</issuerTradingSymbol></issuer>
  <reportingOwner><reportingOwnerId><rptOwnerName>Doe John</rptOwnerName></reportingOwnerId></reportingOwner>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <transactionDate><value>2026-06-15</value></transactionDate>
      <transactionCoding><transactionCode>P</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>1000</value></transactionShares>
        <transactionPricePerShare><value>50</value></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
    </nonDerivativeTransaction>
    <nonDerivativeTransaction>
      <transactionDate><value>2026-06-16</value></transactionDate>
      <transactionCoding><transactionCode>S</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>400</value></transactionShares>
        <transactionPricePerShare><value>60</value></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
</ownershipDocument>`;

// The exact real-world pattern that caused fabricated dollar amounts: a
// footnote-only price element followed by another numeric <value> in the
// same transaction block (sharesOwnedFollowingTransaction).
const FOOTNOTE_FIXTURE = `<?xml version="1.0"?>
<ownershipDocument>
  <reportingOwner><reportingOwnerId><rptOwnerName>Exec Jane</rptOwnerName></reportingOwnerId></reportingOwner>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <transactionDate><value>2026-06-17</value></transactionDate>
      <transactionCoding><transactionCode>M</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>30104</value></transactionShares>
        <transactionPricePerShare><footnoteId id="F1"/></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
      <postTransactionAmounts>
        <sharesOwnedFollowingTransaction><value>57784</value></sharesOwnedFollowingTransaction>
      </postTransactionAmounts>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
</ownershipDocument>`;

const DERIVATIVE_FIXTURE = `<?xml version="1.0"?>
<ownershipDocument>
  <reportingOwner><reportingOwnerId><rptOwnerName>Opt Trader</rptOwnerName></reportingOwnerId></reportingOwner>
  <derivativeTable>
    <derivativeTransaction>
      <transactionDate><value>2026-06-18</value></transactionDate>
      <transactionCoding><transactionCode>P</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>500</value></transactionShares>
        <transactionPricePerShare><value>5</value></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
    </derivativeTransaction>
  </derivativeTable>
</ownershipDocument>`;

describe('parseForm4Xml', () => {
  it('extracts owner and per-transaction code/shares/price/AD/date', () => {
    const { owner, txns } = parseForm4Xml(FIXTURE);
    expect(owner).toBe('Doe John');
    expect(txns).toHaveLength(2);
    expect(txns[0]).toEqual({
      code: 'P',
      shares: 1000,
      price: 50,
      ad: 'A',
      date: '2026-06-15',
      derivative: false,
    });
    expect(txns[1]).toEqual({
      code: 'S',
      shares: 400,
      price: 60,
      ad: 'D',
      date: '2026-06-16',
      derivative: false,
    });
  });

  it('footnote-only price yields price=null — never captures a later value as the price', () => {
    const { txns } = parseForm4Xml(FOOTNOTE_FIXTURE);
    expect(txns).toHaveLength(1);
    expect(txns[0].code).toBe('M');
    expect(txns[0].shares).toBe(30104);
    expect(txns[0].price).toBeNull(); // the money bug: must NOT be 57784
  });

  it('flags derivative-table transactions as derivative', () => {
    const { txns } = parseForm4Xml(DERIVATIVE_FIXTURE);
    expect(txns).toHaveLength(1);
    expect(txns[0].derivative).toBe(true);
    expect(txns[0].code).toBe('P');
  });

  it('returns empty txns for non-Form-4 content', () => {
    const { txns } = parseForm4Xml('<html><body>not a filing</body></html>');
    expect(txns).toHaveLength(0);
  });
});
