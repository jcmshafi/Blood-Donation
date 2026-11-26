// BDT amounts are handled as integer minor units (poisha) to avoid float drift.
export const MIN_AMOUNT_MINOR = 1_000; // 10.00 BDT
export const MAX_AMOUNT_MINOR = 50_000_000; // 500,000.00 BDT

const DECIMAL = /^\d{1,9}(\.\d{1,2})?$/;

/**
 * Parses a positive BDT amount with at most two decimals into poisha.
 * Returns null for anything else (negative, NaN, exponent notation, 3+ decimals,
 * float noise such as 0.1 + 0.2, or outside the allowed bounds).
 */
export const parseDecimalToMinor = (value: unknown): number | null => {
	if (typeof value !== "string" && typeof value !== "number") return null;
	if (typeof value === "number" && !Number.isFinite(value)) return null;
	const text = String(value).trim();
	if (!DECIMAL.test(text)) return null;
	const [whole, fraction = ""] = text.split(".");
	const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
	if (minor < MIN_AMOUNT_MINOR || minor > MAX_AMOUNT_MINOR) return null;
	return minor;
};

export const formatMinor = (minor: number): string => {
	const whole = Math.trunc(minor / 100);
	const fraction = String(minor % 100).padStart(2, "0");
	return `${whole}.${fraction}`;
};

/** Parses a gateway-reported amount string such as "150.50" into poisha, without bounds. */
export const parseStoredAmountToMinor = (value: unknown): number | null => {
	if (typeof value !== "string" || !/^\d{1,12}(\.\d{1,2})?$/.test(value))
		return null;
	const [whole, fraction = ""] = value.split(".");
	return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
};
