// Exact token unit maths. Everything is BigInt and strings, never floats:
// in JavaScript 8.2 * 1e9 is 8199999999.999999, which is the wrong number
// of lamports.

const Units = (() => {
  const U64_MAX = 2n ** 64n - 1n;
  const UINT256_MAX = 2n ** 256n - 1n;
  const MAX_DECIMALS = 36;
  const MAX_DIGITS = 120;

  // units: [name, decimals below this unit], smallest first.
  // u64: amounts of this token are often stored in a 64-bit integer.
  const TOKENS = [
    { id: "eth", symbol: "ETH", decimals: 18, units: [["wei", 0], ["gwei", 9], ["ETH", 18]] },
    { id: "btc", symbol: "BTC", decimals: 8, units: [["sats", 0], ["BTC", 8]] },
    { id: "sol", symbol: "SOL", decimals: 9, units: [["lamports", 0], ["SOL", 9]], u64: true },
    { id: "usdc", symbol: "USDC", decimals: 6, units: [["base units", 0], ["USDC", 6]], u64: true },
    { id: "usdt", symbol: "USDT", decimals: 6, units: [["base units", 0], ["USDT", 6]], u64: true },
    { id: "sui", symbol: "SUI", decimals: 9, units: [["MIST", 0], ["SUI", 9]], u64: true },
    { id: "apt", symbol: "APT", decimals: 8, units: [["octas", 0], ["APT", 8]], u64: true },
    { id: "ton", symbol: "TON", decimals: 9, units: [["nanotons", 0], ["TON", 9]] },
    { id: "near", symbol: "NEAR", decimals: 24, units: [["yoctoNEAR", 0], ["NEAR", 24]] },
    { id: "atom", symbol: "ATOM", decimals: 6, units: [["uatom", 0], ["ATOM", 6]] },
    { id: "dot", symbol: "DOT", decimals: 10, units: [["planck", 0], ["DOT", 10]] },
    { id: "trx", symbol: "TRX", decimals: 6, units: [["sun", 0], ["TRX", 6]] },
    { id: "xrp", symbol: "XRP", decimals: 6, units: [["drops", 0], ["XRP", 6]] },
    { id: "ada", symbol: "ADA", decimals: 6, units: [["lovelace", 0], ["ADA", 6]] },
  ];

  function customToken(decimals) {
    return {
      id: "custom",
      symbol: "tokens",
      decimals,
      units: [["base units", 0], ["tokens", decimals]],
      u64: true,
    };
  }

  // Drop the separators people paste in: "1,500 000_000" is 1500000000.
  function clean(text) {
    return String(text).replace(/[\s,_]/g, "");
  }

  // "1.5" with 6 decimals is 1500000n. Accepts ".5", "1e18" and "2.5e-3".
  // Throws rather than rounding when the amount is finer than the unit allows.
  function parseAmount(text, decimals) {
    const value = clean(text);
    if (value === "") throw new Error("Enter a number.");
    if (value.startsWith("-")) throw new Error("Amounts cannot be negative.");
    const match = /^\+?(\d*)(?:\.(\d*))?(?:e([+-]?\d{1,4}))?$/i.exec(value);
    if (!match || (match[1] === "" && !match[2])) throw new Error("That is not a number.");
    const whole = match[1];
    const fraction = match[2] || "";
    const shift = decimals + Number(match[3] || 0) - fraction.length;
    let digits = (whole + fraction).replace(/^0+(?=\d)/, "");
    if (shift >= 0) {
      if (digits !== "0") digits += "0".repeat(Math.min(shift, MAX_DIGITS + 1));
    } else {
      const dropped = digits.slice(shift);
      if (/[1-9]/.test(dropped)) {
        throw new Error(
          decimals === 0
            ? "The smallest unit is a whole number."
            : `Too precise: this unit only has ${decimals} decimal places.`
        );
      }
      digits = digits.slice(0, shift) || "0";
    }
    if (digits.length > MAX_DIGITS) throw new Error("That number is too large.");
    return BigInt(digits);
  }

  // 1500000n with 6 decimals is "1.5".
  function formatAmount(raw, decimals) {
    const digits = raw.toString().padStart(decimals + 1, "0");
    const whole = digits.slice(0, digits.length - decimals);
    const fraction = digits.slice(digits.length - decimals).replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole;
  }

  function parseHex(text) {
    const value = clean(text).replace(/^0x/i, "");
    if (value === "") throw new Error("Enter a hex number.");
    if (!/^[0-9a-f]+$/i.test(value)) throw new Error("That is not a hex number.");
    if (value.length > 100) throw new Error("That number is too large.");
    return BigInt("0x" + value);
  }

  function toHex(raw) {
    return "0x" + raw.toString(16);
  }

  // "1500000.25" becomes "1,500,000.25".
  function group(text) {
    const [whole, fraction] = text.split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return fraction === undefined ? grouped : `${grouped}.${fraction}`;
  }

  // Integer sizes this amount no longer fits in.
  function overflows(raw, token) {
    const notes = [];
    if (raw > UINT256_MAX) {
      notes.push("Larger than a uint256, so no EVM contract can hold it.");
    } else if (token.u64 && raw > U64_MAX) {
      notes.push(
        `Larger than a u64 (max ${group(U64_MAX.toString())}), ` +
          "so it does not fit a token amount on Solana, Sui or Aptos."
      );
    }
    return notes;
  }

  return {
    TOKENS, U64_MAX, UINT256_MAX, MAX_DECIMALS,
    customToken, clean, parseAmount, formatAmount, parseHex, toHex, group, overflows,
  };
})();

if (typeof module !== "undefined") module.exports = Units;
