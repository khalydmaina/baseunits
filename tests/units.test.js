const test = require("node:test");
const assert = require("node:assert/strict");
const Units = require("../units.js");

const { parseAmount, formatAmount, parseHex, toHex, group, overflows } = Units;

test("whole and fractional amounts", () => {
  assert.equal(parseAmount("1", 18), 10n ** 18n);
  assert.equal(parseAmount("1.5", 6), 1500000n);
  assert.equal(parseAmount(".5", 9), 500000000n);
  assert.equal(parseAmount("5.", 9), 5000000000n);
  assert.equal(parseAmount("0", 18), 0n);
  assert.equal(parseAmount("0.000", 6), 0n);
  assert.equal(parseAmount("000123", 0), 123n);
  assert.equal(parseAmount("0.000001", 6), 1n);
});

test("amounts that floats get wrong", () => {
  // 8.2 * 1e9 is 8199999999.999999 and 1.1 * 1e18 is 1100000000000000100 as floats.
  assert.equal(parseAmount("8.2", 9), 8200000000n);
  assert.equal(parseAmount("1.1", 18), 1100000000000000000n);
  assert.equal(parseAmount("2.01", 9), 2010000000n);
  assert.equal(
    parseAmount("123456789.123456789123456789", 18),
    123456789123456789123456789n
  );
});

test("separators and scientific notation", () => {
  assert.equal(parseAmount("1,500,000.25", 6), 1500000250000n);
  assert.equal(parseAmount(" 1_000 000 ", 0), 1000000n);
  assert.equal(parseAmount("1e18", 0), 10n ** 18n);
  assert.equal(parseAmount("1.5E6", 0), 1500000n);
  assert.equal(parseAmount("2.5e-3", 6), 2500n);
  assert.equal(parseAmount("+7", 0), 7n);
  assert.equal(parseAmount("0e5", 6), 0n);
  assert.equal(parseAmount("1500e-3", 3), 1500n);
});

test("too much precision is an error, never rounded", () => {
  assert.throws(() => parseAmount("0.0000001", 6), /only has 6 decimal places/);
  assert.throws(() => parseAmount("1.5", 0), /whole number/);
  assert.throws(() => parseAmount("1e-1", 0), /whole number/);
  // trailing zeros beyond the precision lose nothing, so they are fine
  assert.equal(parseAmount("1.5000000000", 6), 1500000n);
  assert.equal(parseAmount("15e-1", 1), 15n);
});

test("bad input", () => {
  assert.throws(() => parseAmount("", 6), /Enter a number/);
  assert.throws(() => parseAmount("   ", 6), /Enter a number/);
  assert.throws(() => parseAmount("-1", 6), /negative/);
  for (const bad of ["abc", ".", "1.2.3", "1e", "e5", "0x10", "1e99999", "1 e"]) {
    assert.throws(() => parseAmount(bad, 6), /not a number/, bad);
  }
  assert.throws(() => parseAmount("9".repeat(130), 0), /too large/);
  assert.throws(() => parseAmount("1e500", 0), /too large/);
});

test("formatting", () => {
  assert.equal(formatAmount(1500000n, 6), "1.5");
  assert.equal(formatAmount(1n, 18), "0.000000000000000001");
  assert.equal(formatAmount(10n ** 18n, 18), "1");
  assert.equal(formatAmount(0n, 9), "0");
  assert.equal(formatAmount(123n, 0), "123");
  assert.equal(formatAmount(1000n, 0), "1000");
  assert.equal(formatAmount(123456789123456789123456789n, 18), "123456789.123456789123456789");
});

test("parse and format round-trip for every token", () => {
  const samples = [0n, 1n, 999n, 10n ** 9n + 1n, 2n ** 64n - 1n, 2n ** 200n + 12345n];
  for (const token of [...Units.TOKENS, Units.customToken(0), Units.customToken(36)]) {
    for (const [, shift] of token.units) {
      for (const raw of samples) {
        assert.equal(parseAmount(formatAmount(raw, shift), shift), raw, `${token.id} ${shift}`);
      }
    }
  }
});

test("token table is consistent", () => {
  const ids = new Set();
  for (const token of Units.TOKENS) {
    assert.ok(!ids.has(token.id), token.id);
    ids.add(token.id);
    assert.equal(token.units[0][1], 0, token.id);
    assert.deepEqual(token.units[token.units.length - 1], [token.symbol, token.decimals]);
  }
  // 1 ETH is a billion gwei
  assert.equal(formatAmount(parseAmount("1", 18), 9), "1000000000");
});

test("hex", () => {
  assert.equal(parseHex("0xde0b6b3a7640000"), 10n ** 18n);
  assert.equal(parseHex("DE0B6B3A7640000"), 10n ** 18n);
  assert.equal(parseHex("0x0"), 0n);
  assert.equal(toHex(10n ** 18n), "0xde0b6b3a7640000");
  assert.equal(toHex(0n), "0x0");
  assert.throws(() => parseHex(""), /Enter a hex/);
  assert.throws(() => parseHex("0x"), /Enter a hex/);
  assert.throws(() => parseHex("0xzz"), /not a hex/);
  assert.throws(() => parseHex("12.5"), /not a hex/);
});

test("grouping", () => {
  assert.equal(group("1500000.25"), "1,500,000.25");
  assert.equal(group("999"), "999");
  assert.equal(group("1000"), "1,000");
  assert.equal(group("0.000001"), "0.000001");
  assert.equal(group("18446744073709551615"), "18,446,744,073,709,551,615");
});

test("overflow notes", () => {
  const sol = Units.TOKENS.find((token) => token.id === "sol");
  const eth = Units.TOKENS.find((token) => token.id === "eth");
  assert.deepEqual(overflows(Units.U64_MAX, sol), []);
  assert.match(overflows(Units.U64_MAX + 1n, sol)[0], /u64/);
  assert.deepEqual(overflows(Units.U64_MAX + 1n, eth), []);
  assert.deepEqual(overflows(Units.UINT256_MAX, eth), []);
  assert.match(overflows(Units.UINT256_MAX + 1n, eth)[0], /uint256/);
  assert.match(overflows(Units.UINT256_MAX + 1n, sol)[0], /uint256/);
});
