import type { Response } from "express";

type TResponseData<T> = {
	statusCode: number;
	success?: boolean;
	message: string;
	data: T;
};

export const sendResponse = <T>(res: Response, payload: TResponseData<T>) => {
	res.status(payload.statusCode).json({
		success: payload.success ?? true,
		message: payload.message,
		data: payload.data,
	});
};
