import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

export const validateRequest = (schema: ZodTypeAny) => {
	return async (req: Request, _res: Response, next: NextFunction) => {
		try {
			const parsed = await schema.parseAsync({
				body: req.body,
				query: req.query,
				params: req.params,
				cookies: req.cookies,
			});
			if (parsed && typeof parsed === "object") {
				if ("body" in parsed && parsed.body !== undefined) {
					req.body = parsed.body;
				}
			}
			next();
		} catch (error) {
			next(error);
		}
	};
};
