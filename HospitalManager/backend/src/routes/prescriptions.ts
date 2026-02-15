import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const prescriptionSchema = z.object({
  visitId: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  date: z.string().datetime({ offset: true }),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
});

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
});

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const where: any = {};
    if (req.query.visitId) where.visitId = parseInt(req.query.visitId as string);
    const [data, total] = await Promise.all([
      prisma.prescription.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        include: {
          doctor: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.prescription.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID (includes items with medication)
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        doctor: { select: { id: true, firstName: true, lastName: true } },
        visit: true,
        items: { include: { medication: true } },
      },
    });
    if (!prescription) throw new AppError('Prescription not found', 404);
    res.json(prescription);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(prescriptionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      date: new Date(req.body.date),
      status: req.body.status || 'ACTIVE',
    };
    const prescription = await prisma.prescription.create({
      data,
      include: {
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.status(201).json(prescription);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(prescriptionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      date: new Date(req.body.date),
    };
    const prescription = await prisma.prescription.update({
      where: { id: parseInt(req.params.id) },
      data,
      include: {
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.json(prescription);
  } catch (err) { next(err); }
});

// Status change
router.patch('/:id/status', validate(statusSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prescription = await prisma.prescription.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!prescription) throw new AppError('Prescription not found', 404);

    const updated = await prisma.prescription.update({
      where: { id: parseInt(req.params.id) },
      data: { status: req.body.status },
      include: {
        doctor: { select: { id: true, firstName: true, lastName: true } },
        items: { include: { medication: true } },
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.prescription.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
