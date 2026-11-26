import config from "../../config/index";
import type {
	IBkashCreatePaymentResponse,
	IBkashExecutePaymentResponse,
	IBkashGrantTokenResponse,
	IBkashQueryPaymentResponse,
} from "./payment.interface";

const REQUEST_TIMEOUT_MS = 15_000;
const SUCCESS_CODE = "0000";

/** Gateway-side failure. The message is internal; callers show a generic one. */
export class BkashGatewayError extends Error {}

/** bKash answered, but did not confirm the operation (as opposed to being unreachable). */
export class BkashDeclinedError extends BkashGatewayError {}

export const isBkashConfigured = (): boolean =>
	Boolean(
		config.bkash_app_key &&
			config.bkash_app_secret &&
			config.bkash_username &&
			config.bkash_password &&
			config.bkash_base_url &&
			config.bkash_callback_url,
	);

/** The checkout URL we hand to the browser must point at bKash (or the configured gateway host). */
export const isTrustedCheckoutUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		let configuredHost = "";
		try {
			configuredHost = new URL(
				config.bkash_base_url as string,
			).hostname.toLowerCase();
		} catch {
			// no configured host
		}
		if (configuredHost && host === configuredHost) return true;
		if (url.protocol !== "https:") return false;
		return (
			host === "bka.sh" ||
			host.endsWith(".bka.sh") ||
			host === "bkash.com" ||
			host.endsWith(".bkash.com")
		);
	} catch {
		return false;
	}
};

class BkashClientService {
	private idToken: string | null = null;
	private tokenExpiresAt = 0;

	private async post<T>(
		path: string,
		init: { headers: Record<string, string>; body: unknown },
	): Promise<T> {
		let response: Response;
		try {
			response = await fetch(`${config.bkash_base_url}${path}`, {
				method: "POST",
				headers: { "Content-Type": "application/json", ...init.headers },
				body: JSON.stringify(init.body),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
		} catch {
			throw new BkashGatewayError("bKash gateway unreachable");
		}
		if (!response.ok)
			throw new BkashGatewayError(
				`bKash gateway returned HTTP ${response.status}`,
			);
		try {
			return (await response.json()) as T;
		} catch {
			throw new BkashGatewayError("bKash gateway returned a non-JSON response");
		}
	}

	/** Retrieves a valid bKash id_token, reusing the cached one until shortly before expiry. */
	public async getValidToken(): Promise<string> {
		const now = Date.now();
		if (this.idToken && now < this.tokenExpiresAt - 60_000) return this.idToken;

		const data = await this.post<IBkashGrantTokenResponse>(
			"/tokenized/checkout/token/grant",
			{
				headers: {
					username: config.bkash_username as string,
					password: config.bkash_password as string,
				},
				body: {
					app_key: config.bkash_app_key,
					app_secret: config.bkash_app_secret,
				},
			},
		);
		if (!data.id_token)
			throw new BkashGatewayError("bKash token grant was rejected");
		this.idToken = data.id_token;
		this.tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
		return this.idToken;
	}

	private async authorizedPost<T>(path: string, body: unknown): Promise<T> {
		const token = await this.getValidToken();
		return this.post<T>(path, {
			headers: {
				Authorization: token,
				"X-APP-Key": config.bkash_app_key as string,
			},
			body,
		});
	}

	/** Creates a tokenized checkout. `amount` is a two-decimal BDT string such as "150.50". */
	public async createPayment(params: {
		amount: string;
		invoiceNumber: string;
		payerReference?: string;
	}): Promise<IBkashCreatePaymentResponse> {
		const data = await this.authorizedPost<IBkashCreatePaymentResponse>(
			"/tokenized/checkout/create",
			{
				mode: "0011",
				payerReference: params.payerReference || "01700000000",
				callbackURL: config.bkash_callback_url,
				amount: params.amount,
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: params.invoiceNumber,
			},
		);
		if (data.statusCode !== SUCCESS_CODE || !data.paymentID || !data.bkashURL) {
			throw new BkashGatewayError("bKash declined the checkout request");
		}
		if (!isTrustedCheckoutUrl(data.bkashURL)) {
			throw new BkashGatewayError("bKash returned an untrusted checkout URL");
		}
		return data;
	}

	/** Executes an initiated payment. Throws on any gateway failure; never fabricates success. */
	public async executePayment(
		paymentID: string,
	): Promise<IBkashExecutePaymentResponse> {
		const data = await this.authorizedPost<IBkashExecutePaymentResponse>(
			"/tokenized/checkout/execute",
			{
				paymentID,
			},
		);
		if (data.statusCode !== SUCCESS_CODE) {
			throw new BkashDeclinedError("bKash did not confirm the payment");
		}
		if (!data.trxID) {
			throw new BkashGatewayError("bKash execute response was incomplete");
		}
		return data;
	}

	/** Queries payment status from bKash. Throws on any gateway failure. */
	public async queryPayment(
		paymentID: string,
	): Promise<IBkashQueryPaymentResponse> {
		const data = await this.authorizedPost<IBkashQueryPaymentResponse>(
			"/tokenized/checkout/payment/status",
			{
				paymentID,
			},
		);
		if (!data.transactionStatus)
			throw new BkashGatewayError("bKash status response was incomplete");
		return data;
	}
}

export const BkashClient = new BkashClientService();
