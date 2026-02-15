import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const visitSchema = z.object({
  patientId: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  visitDate: z.string().datetime({ offset: true }),
  chiefComplaint: z.string().max(500).optional().nullable(),
  vitalSigns: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const where: any = {};
    if (req.query.patientId) where.patientId = parseInt(req.query.patientId as string);
    const [data, total] = await Promise.all([
      prisma.visit.findMany({
        where,
        skip,
        take,
        orderBy: { visitDate: 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          doctor: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.visit.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID (deep includes)
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
        diagnoses: true,
        labOrders: true,
        prescriptions: {
          include: { items: { include: { medication: true } } },
        },
      },
    });
    if (!visit) throw new AppError('Visit not found', 404);
    res.json(visit);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(visitSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      visitDate: new Date(req.body.visitDate),
    };
    const visit = await prisma.visit.create({
      data,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.status(201).json(visit);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(visitSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      visitDate: new Date(req.body.visitDate),
    };
    const visit = await prisma.visit.update({
      where: { id: parseInt(req.params.id) },
      data,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.json(visit);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.visit.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
