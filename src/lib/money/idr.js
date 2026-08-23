export function requireIntegerIdr(
  value,
  { allowNegative = false, allowZero = true, label = 'amount' } = {},
) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer IDR amount.`);
  }

  if (!allowNegative && value < 0) {
    throw new RangeError(`${label} must not be negative.`);
  }

  if (!allowZero && value === 0) {
    throw new RangeError(`${label} must be greater than zero.`);
  }

  return value;
}

export function sumIntegerIdr(values, options = {}) {
  if (!Array.isArray(values)) {
    throw new TypeError('amounts must be an array.');
  }

  const { label = 'amounts', ...amountOptions } = options;

  return values.reduce((total, value, index) => {
    const amount = requireIntegerIdr(value, {
      ...amountOptions,
      label: `${label}[${index}]`,
    });
    const nextTotal = total + amount;

    if (!Number.isSafeInteger(nextTotal)) {
      throw new RangeError(`${label} total exceeds the safe integer IDR range.`);
    }

    return nextTotal;
  }, 0);
}

export function formatIntegerIdr(value, { currencyDisplay = 'symbol', locale = 'id-ID' } = {}) {
  requireIntegerIdr(value, { allowNegative: true });

  return new Intl.NumberFormat(locale, {
    currency: 'IDR',
    currencyDisplay,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}
