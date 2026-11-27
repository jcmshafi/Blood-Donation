import Stripe from "stripe";
import config from "../../config/index";

const REQUEST_TIMEOUT_MS = 15_000;

/** Gateway-side failure. The message is internal; callers show a generic one. */
export class StripeGatewayError extends Error {
	constructor(
		message: string,
		readonly code?: string,
	) {
		super(message);
	}
}

/** Test mode only: live secret keys are refused outright. */
export const isTestModeKey = (key: string | undefined): key is string =>
	Boolean(key && /^(sk|rk)_test_[A-Za-z0-9]+$/.test(key));

export const isWebhookConfigured = (): boolean =>
	/^whsec_[A-Za-z0-9]+$/.test(config.stripe_webhook_secret ?? "");

export const isStripeConfigured = (): boolean =>
	isTestModeKey(config.stripe_secret_key) &&
	Boolean(config.stripe_currency) &&
	Boolean(config.frontend_url);

/** The checkout address we hand to the browser must be Stripe's (or the configured test gateway host). */
export const isTrustedCheckoutUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		const host = url.hostname.toLowerCase();
		if (config.stripe_api_base_url) {
			try {
				if (host === new URL(config.stripe_api_base_url).hostname.toLowerCase())
					return true;
			} catch {
				// ignore a malformed override
			}
		}
		return url.protocol === "https:" && host === "checkout.stripe.com";
	} catch {
		return false;
	}
};

const clientFor = (secretKey: string) => {
	const override = config.stripe_api_base_url;
	if (override) {
		const url = new URL(override);
		return new Stripe(secretKey, {
			host: url.hostname,
			port: url.port || (url.protocol === "https:" ? "443" : "80"),
			protocol: url.protocol.replace(":", "") as "http" | "https",
			timeout: REQUEST_TIMEOUT_MS,
			maxNetworkRetries: 0,
		});
	}
	return new Stripe(secretKey, {
		timeout: REQUEST_TIMEOUT_MS,
		maxNetworkRetries: 0,
	});
};

const apiClient = () => {
	if (!isTestModeKey(config.stripe_secret_key)) {
		throw new StripeGatewayError("Stripe test-mode key is not configured");
	}
	return clientFor(config.stripe_secret_key);
};

const wrap = async <T>(call: () => Promise<T>): Promise<T> => {
	try {
		return await call();
	} catch (error) {
		throw new StripeGatewayError(
			error instanceof Error ? error.message : "Stripe request failed",
			(error as { code?: string }).code,
		);
	}
};

export type CheckoutSessionParams = {
	paymentRecordId: string;
	requestId: string;
	amountMinor: number;
	currency: string;
	idempotencyKey: string;
	successUrl: string;
	cancelUrl: string;
};

export const StripeGateway = {
	/** Verifies the Stripe-Signature header against the raw body. Throws before anything is parsed on a bad signature. */
	constructWebhookEvent(rawBody: Buffer, signature: string | undefined) {
		if (!signature) throw new StripeGatewayError("Missing Stripe-Signature");
		try {
			return clientFor(
				isTestModeKey(config.stripe_secret_key)
					? config.stripe_secret_key
					: "sk_test_webhook_verification_only",
			).webhooks.constructEvent(
				rawBody,
				signature,
				config.stripe_webhook_secret,
			);
		} catch (error) {
			throw new StripeGatewayError(
				error instanceof Error ? error.message : "Invalid signature",
			);
		}
	},

	retrieveCheckoutSession: (sessionId: string) =>
		wrap(() => apiClient().checkout.sessions.retrieve(sessionId)),

	expireCheckoutSession: (sessionId: string) =>
		wrap(() => apiClient().checkout.sessions.expire(sessionId)),

	/** Creates a hosted Checkout Session. Throws StripeGatewayError on any failure; never fabricates a session. */
	async createCheckoutSession(params: CheckoutSessionParams) {
		if (!isTestModeKey(config.stripe_secret_key)) {
			throw new StripeGatewayError("Stripe test-mode key is not configured");
		}
		const stripe = clientFor(config.stripe_secret_key);
		let session: Stripe.Checkout.Session;
		try {
			session = await stripe.checkout.sessions.create(
				{
					mode: "payment",
					client_reference_id: params.paymentRecordId,
					line_items: [
						{
							quantity: 1,
							price_data: {
								currency: params.currency,
								unit_amount: params.amountMinor,
								product_data: { name: "Emergency transport support" },
							},
						},
					],
					metadata: {
						payment_record_id: params.paymentRecordId,
						request_id: params.requestId,
					},
					success_url: params.successUrl,
					cancel_url: params.cancelUrl,
				},
				{
					idempotencyKey: `checkout-${params.idempotencyKey}-${params.paymentRecordId}`,
				},
			);
		} catch (error) {
			const code = (error as { code?: string }).code;
			throw new StripeGatewayError(
				error instanceof Error ? error.message : "Stripe request failed",
				code,
			);
		}
		if (!session.id || !session.url) {
			throw new StripeGatewayError("Stripe returned an incomplete session");
		}
		if (!isTrustedCheckoutUrl(session.url)) {
			throw new StripeGatewayError("Stripe returned an untrusted checkout URL");
		}
		return { id: session.id, url: session.url };
	},
};
