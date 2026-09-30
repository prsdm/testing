/** Minimum prepaid top-up amount (whole USD). */
export const MIN_TOP_UP_USD = 5;

/** Soft ceiling to catch typos (whole USD). */
export const MAX_TOP_UP_USD = 10_000;

/** Suggested amounts shown as quick buttons in the Billing UI. */
export const TOP_UP_SUGGESTIONS_USD = [25, 50, 100, 200] as const;

export function isValidTopUpUsd(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_TOP_UP_USD &&
    value <= MAX_TOP_UP_USD
  );
}
