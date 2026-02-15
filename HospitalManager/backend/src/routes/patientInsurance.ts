import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const patientInsuranceSchema = z.object({
  patientId: z.number().int().positive(),
  insurancePlanId: z.number().int().positive(),
  policyNumber: z.string().min(1).max(100),
  startDate: z.string().datetime({ offset: true }).or(z.string().date()),
  endDate: z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
  isPrimary: z.boolean(),
});

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const where: any = {};
    if (req.query.patientId) where.patientId = parseInt(req.query.patientId as string);
    const [data, total] = await Promise.all([
      prisma.patientInsurance.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { insurancePlan: true },
      }),
      prisma.patientInsurance.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await prisma.patientInsurance.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { insurancePlan: true, patient: true },
    });
    if (!record) throw new AppError('Patient insurance not found', 404);
    res.json(record);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(patientInsuranceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      startDate: new Date(req.body.startDate),
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
    };
    const record = await prisma.patientInsurance.create({
      data,
      include: { insurancePlan: true },
    });
    res.status(201).json(record);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(patientInsuranceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      startDate: new Date(req.body.startDate),
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
    };
    const record = await prisma.patientInsurance.update({
      where: { id: parseInt(req.params.id) },
      data,
      include: { insurancePlan: true },
    });
    res.json(record);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.patientInsurance.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
