export interface ICreatePaymentPayload {
	requestId: string;
	amountMinor: number; // poisha, validated by the schema
}
