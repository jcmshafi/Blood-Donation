import nodemailer from "nodemailer";
import config from "../config/index";

export interface ISendEmailPayload {
	to: string;
	subject: string;
	text?: string;
	html: string;
}

/**
 * Transporter utility for sending transactional emails via Google SMTP.
 * Uses EMAIL_USER and GOOGLE_APP_PASSWORD from environment variables.
 * If credentials are not yet configured, gracefully logs the email to console without throwing.
 */
export const sendEmail = async (
	payload: ISendEmailPayload,
): Promise<boolean> => {
	const { to, subject, text, html } = payload;

	const isConfigured =
		config.email_user &&
		config.google_app_password &&
		!config.email_user.includes("your-email") &&
		!config.google_app_password.includes("your-google-app-password");

	if (!isConfigured) {
		console.log(
			`[Email Notification Simulated - Configure real EMAIL_USER & GOOGLE_APP_PASSWORD in .env for live delivery]`,
		);
		console.log(`  To: ${to}`);
		console.log(`  Subject: ${subject}`);
		return true;
	}

	try {
		const transporter = nodemailer.createTransport({
			service: "gmail",
			host: "smtp.gmail.com",
			port: 587,
			secure: false,
			auth: {
				user: config.email_user,
				pass: config.google_app_password,
			},
		});

		const info = await transporter.sendMail({
			from: `"Blood Donation & Emergency Platform" <${config.email_user}>`,
			to,
			subject,
			text: text || subject,
			html,
		});

		console.log(
			`Email successfully delivered to ${to} (Message ID: ${info.messageId})`,
		);
		return true;
	} catch (error) {
		console.error(`Failed to send email to ${to}:`, error);
		// Return false instead of crashing critical business flows
		return false;
	}
};

/**
 * HTML Email Template for Emergency Blood Requests
 */
export const emergencyAlertEmailHtml = (
	patientName: string,
	bloodGroup: string,
	unitsNeeded: number,
	hospitalName: string,
	hospitalAddress: string,
	contactNumber: string,
) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
	<div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
		<h1 style="margin: 0; font-size: 24px;">🚨 Critical Blood Emergency Alert</h1>
		<p style="margin: 5px 0 0 0; opacity: 0.9;">Urgent Donor Needed Immediately</p>
	</div>
	<div style="padding: 24px; color: #1e293b;">
		<p>An emergency request has been created that matches available donors:</p>
		<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
			<tr>
				<td style="padding: 8px 0; font-weight: bold; width: 140px;">Patient:</td>
				<td style="padding: 8px 0;">${patientName}</td>
			</tr>
			<tr>
				<td style="padding: 8px 0; font-weight: bold;">Blood Group:</td>
				<td style="padding: 8px 0; color: #dc2626; font-size: 18px; font-weight: bold;">${bloodGroup}</td>
			</tr>
			<tr>
				<td style="padding: 8px 0; font-weight: bold;">Units Required:</td>
				<td style="padding: 8px 0;">${unitsNeeded} Unit(s)</td>
			</tr>
			<tr>
				<td style="padding: 8px 0; font-weight: bold;">Hospital:</td>
				<td style="padding: 8px 0;">${hospitalName} (${hospitalAddress})</td>
			</tr>
			<tr>
				<td style="padding: 8px 0; font-weight: bold;">Emergency Phone:</td>
				<td style="padding: 8px 0; font-weight: bold; color: #16a34a;">${contactNumber}</td>
			</tr>
		</table>
		<p style="margin-top: 20px;">If you are available to donate, please log in and accept the request to save a life.</p>
	</div>
	<div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
		Blood Donation & Emergency Assistance Platform • Automated Notification
	</div>
</div>
`;

/**
 * HTML Email Template for Donor Acceptance Confirmation
 */
export const donorAssignedEmailHtml = (
	donorName: string,
	patientName: string,
	bloodGroup: string,
	hospitalName: string,
	contactNumber: string,
) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
	<div style="background-color: #16a34a; color: white; padding: 20px; text-align: center;">
		<h1 style="margin: 0; font-size: 24px;">✅ Donor Match Confirmed!</h1>
		<p style="margin: 5px 0 0 0; opacity: 0.9;">A donor has accepted your blood request</p>
	</div>
	<div style="padding: 24px; color: #1e293b;">
		<p>Good news! Donor <strong>${donorName}</strong> has agreed to donate blood for <strong>${patientName}</strong> (${bloodGroup}).</p>
		<div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; margin: 16px 0;">
			<p style="margin: 0 0 8px 0;"><strong>Location:</strong> ${hospitalName}</p>
			<p style="margin: 0;"><strong>Contact Hotline:</strong> <a href="tel:${contactNumber}" style="color: #2563eb;">${contactNumber}</a></p>
		</div>
		<p>Please coordinate with the donor promptly. Thank you for using our emergency platform.</p>
	</div>
	<div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
		Blood Donation & Emergency Assistance Platform • Automated Notification
	</div>
</div>
`;

/**
 * HTML Email Template for bKash Payment Receipt
 */
export const paymentReceiptEmailHtml = (
	payerName: string,
	amount: number,
	trxID: string,
	paymentID: string,
) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
	<div style="background-color: #e11d48; color: white; padding: 20px; text-align: center;">
		<h1 style="margin: 0; font-size: 24px;">🧾 bKash Payment Receipt</h1>
		<p style="margin: 5px 0 0 0; opacity: 0.9;">Emergency Logistics & Verification Fee</p>
	</div>
	<div style="padding: 24px; color: #1e293b;">
		<p>Dear <strong>${payerName}</strong>,</p>
		<p>Your payment via bKash has been verified and completed successfully.</p>
		<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
			<tr>
				<td style="padding: 8px 0; font-weight: bold;">Amount Paid:</td>
				<td style="padding: 8px 0; font-size: 18px; color: #e11d48; font-weight: bold;">${amount} BDT</td>
			</tr>
			<tr>
				<td style="padding: 8px 0; font-weight: bold;">Transaction ID (TrxID):</td>
				<td style="padding: 8px 0; font-family: monospace; font-size: 14px;">${trxID}</td>
			</tr>
			<tr>
				<td style="padding: 8px 0; font-weight: bold;">Payment ID:</td>
				<td style="padding: 8px 0; font-family: monospace; font-size: 14px;">${paymentID}</td>
			</tr>
			<tr>
				<td style="padding: 8px 0; font-weight: bold;">Status:</td>
				<td style="padding: 8px 0; color: #16a34a; font-weight: bold;">COMPLETED</td>
			</tr>
		</table>
	</div>
	<div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
		Blood Donation & Emergency Assistance Platform • Payment Confirmation
	</div>
</div>
`;
