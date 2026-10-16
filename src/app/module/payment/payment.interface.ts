import type {
	PaymentMethod,
	PaymentStatus,
} from "../../../generated/prisma/enums";

export interface ICreatePaymentPayload {
	requestId: string;
	amount: number;
}

export interface IBkashCallbackPayload {
	paymentID: string;
	status?: string; // e.g. "success", "failure", "cancel"
}

export interface IBkashGrantTokenResponse {
	statusCode: string;
	statusMessage: string;
	id_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
}

export interface IBkashCreatePaymentResponse {
	statusCode: string;
	statusMessage: string;
	paymentID: string;
	bkashURL: string;
	amount: string;
	currency: string;
	paymentCreateTime: string;
	transactionStatus: string;
	merchantInvoiceNumber: string;
}

export interface IBkashExecutePaymentResponse {
	statusCode: string;
	statusMessage: string;
	paymentID: string;
	trxID: string;
	transactionStatus: string;
	amount: string;
	currency: string;
	intent: string;
	paymentExecuteTime: string;
	merchantInvoiceNumber: string;
	customerMsisdn?: string;
}

export interface IBkashQueryPaymentResponse {
	statusCode: string;
	statusMessage: string;
	paymentID: string;
	trxID?: string;
	transactionStatus: string;
	amount: string;
	currency: string;
}
