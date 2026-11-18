import { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client";
import { BloodGroup, RequestStatus, UrgencyLevel } from "../../../generated/prisma/enums";

const positiveInteger = (maximum: number, fallback: number) =>
  z.string().regex(/^[1-9]\d*$/).transform(Number)
    .pipe(z.number().int().min(1).max(maximum)).default(fallback);

// Parse the Express query object directly: arrays/objects and unknown keys fail.
export const publicRequestQuerySchema = z.object({
  searchTerm: z.string().trim().max(200).optional(),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
  urgency: z.nativeEnum(UrgencyLevel).optional(),
  status: z.nativeEnum(RequestStatus).optional(),
  page: positiveInteger(1000000, 1),
  limit: positiveInteger(100, 10),
  sortBy: z.enum(["createdAt", "updatedAt", "urgency", "unitsNeeded"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict();

export const publicRequestIdSchema = z.string().uuid();

// Contact details, coordinates, account relations and free-form private notes
// are deliberately absent. A public description needs a separate authored field.
export const publicRequestSelect = {
  id: true,
  patientName: true,
  bloodGroup: true,
  unitsNeeded: true,
  unitsFulfilled: true,
  hospitalName: true,
  hospitalAddress: true,
  urgency: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BloodRequestSelect;

export type PublicBloodRequest = Prisma.BloodRequestGetPayload<{
  select: typeof publicRequestSelect;
}>;
