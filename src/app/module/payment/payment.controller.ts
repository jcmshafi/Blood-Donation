import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentService } from "./payment.service";

const initiateBkashPayment = catchAsync(async (req: Request, res: Response) => {
	const payerId = req.user!.userId;
	const result = await PaymentService.initiateBkashPayment(
		payerId,
		req.body,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "bKash payment initiated successfully",
		data: result,
	});
});

const handleBkashCallback = catchAsync(async (req: Request, res: Response) => {
	const paymentID =
		((req.body?.paymentID || req.query.paymentID) as string) || "";
	const status = (req.body?.status || req.query.status) as string | undefined;

	if (!paymentID) {
		throw new AppError(httpStatus.BAD_REQUEST, "paymentID query parameter is required");
	}

	const result = await PaymentService.handleBkashCallback(
		{ paymentID, status },
		req.ip,
	);

	// If browser redirect requested HTML, render a clean styled confirmation receipt
	if (req.method === "GET" && req.headers.accept?.includes("text/html")) {
		res.setHeader("Content-Type", "text/html");
		return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>bKash Payment ${result.status}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fdf2f8; margin: 0; padding: 40px 16px; display: flex; justify-content: center; }
    .card { background: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(226, 19, 110, 0.1); max-width: 480px; width: 100%; padding: 32px; text-align: center; border-top: 6px solid #e2136e; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-weight: 600; font-size: 14px; margin-bottom: 16px; }
    .badge-success { background: #dcfce7; color: #15803d; }
    .badge-cancelled { background: #fee2e2; color: #b91c1c; }
    h1 { color: #111827; margin: 0 0 8px 0; font-size: 24px; }
    p { color: #4b5563; margin: 0 0 24px 0; font-size: 15px; }
    .details { background: #f9fafb; border-radius: 12px; padding: 16px; text-align: left; margin-bottom: 24px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .label { color: #6b7280; }
    .val { font-weight: 600; color: #1f2937; }
    .brand { color: #e2136e; font-weight: 700; font-size: 18px; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">bKash Payment Gateway</div>
    <span class="badge ${result.status === "COMPLETED" ? "badge-success" : "badge-cancelled"}">
      ${result.status === "COMPLETED" ? "✓ PAYMENT COMPLETED" : `✕ ${result.status}`}
    </span>
    <h1>${result.status === "COMPLETED" ? "Payment Successful!" : `Payment ${result.status}`}</h1>
    <p>${result.status === "COMPLETED" ? "Thank you! Your emergency blood assistance fee has been securely verified." : "The transaction was cancelled or could not be processed."}</p>
    <div class="details">
      <div class="row"><span class="label">Payment ID:</span><span class="val">${result.paymentId}</span></div>
      ${result.transactionId ? `<div class="row"><span class="label">Transaction ID (TrxID):</span><span class="val">${result.transactionId}</span></div>` : ""}
      <div class="row"><span class="label">Amount:</span><span class="val">BDT ${result.amount}</span></div>
      <div class="row"><span class="label">Status:</span><span class="val">${result.status}</span></div>
    </div>
    <p style="font-size: 13px; color: #9ca3af;">You can return to Postman or close this tab.</p>
  </div>
</body>
</html>
		`);
	}

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "bKash payment processed successfully",
		data: result,
	});
});

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const userId = req.user!.userId;
	const userRole = req.user!.role;

	const result = await PaymentService.getPaymentById(id, userId, userRole);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment details retrieved successfully",
		data: result,
	});
});

export const PaymentController = {
	initiateBkashPayment,
	handleBkashCallback,
	getPaymentById,
};
