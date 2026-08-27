import { yerevanOrderDateStamp } from './order-number';

describe('yerevanOrderDateStamp', () => {
  it('uses the Yerevan business date when UTC is still on the previous day', () => {
    expect(yerevanOrderDateStamp(new Date('2026-08-14T20:05:00.000Z'))).toBe('20260815');
  });
});
