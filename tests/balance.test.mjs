import test from 'node:test';
import assert from 'node:assert/strict';
import { trustedBalanceRequest, parseBalance } from '../lib/balance.mjs';

test('balance endpoint rejects cross-site, rebinding, proxies and non-local peers', () => {
  const req = (headers = {}, address = '127.0.0.1') => ({ headers: { host: '127.0.0.1:3478', ...headers }, socket: { remoteAddress: address } });
  assert(trustedBalanceRequest(req()));
  assert(trustedBalanceRequest(req({ origin: 'http://127.0.0.1:3478' })));
  assert(!trustedBalanceRequest(req({ host: 'evil.example:3478' })));
  assert(!trustedBalanceRequest(req({ origin: 'https://evil.example' })));
  assert(!trustedBalanceRequest(req({ 'sec-fetch-site': 'cross-site' })));
  assert(!trustedBalanceRequest(req({ 'x-forwarded-for': '127.0.0.1' })));
  assert(!trustedBalanceRequest(req({}, '192.168.1.7')));
});

test('real zero balances are distinct from invalid values and CNY is selected explicitly', () => {
  const payload = value => ({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: value }] });
  for (const value of [null, false, '', 'NaN', 'Infinity', {}, []]) assert.equal(parseBalance(payload(value)), null);
  assert.equal(parseBalance(payload('0.00')).text, '¥0.00');
  assert.equal(parseBalance({ balance_infos: [{ currency: 'USD', total_balance: '3.50' }, { currency: 'CNY', total_balance: '25.40' }] }).text, '¥25.40');
  assert.equal(parseBalance({ is_available: false, balance_infos: [{ currency: 'USD', total_balance: '-1' }] }).available, false);
});
