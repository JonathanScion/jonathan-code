import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const billSchema = z.object({
  patientId: z.number().int().positive(),
  visitId: z.number().int().positive().optional().nullable(),
  date: z.string().datetime({ offset: true }).or(z.string().date()),
  dueDate: z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const statusTransitions: Record<string, string[]> = {
  PENDING: ['PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'],
  PARTIAL: ['PAID'],
  PAID: [],
  OVERDUE: ['PAID'],
  CANCELLED: [],
};

const statusSchema = z.object({
  status: z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']),
});

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const where: any = {};
    if (req.query.patientId) where.patientId = parseInt(req.query.patientId as string);
    if (req.query.status) where.status = req.query.status as string;
    const [data, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.bill.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID (includes line items)
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        lineItems: true,
      },
    });
    if (!bill) throw new AppError('Bill not found', 404);
    res.json(bill);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(billSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      date: new Date(req.body.date),
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      status: req.body.status || 'PENDING',
    };
    const bill = await prisma.bill.create({
      data,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.status(201).json(bill);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(billSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      date: new Date(req.body.date),
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
    };
    const bill = await prisma.bill.update({
      where: { id: parseInt(req.params.id) },
      data,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.json(bill);
  } catch (err) { next(err); }
});

// Status transition
router.patch('/:id/status', validate(statusSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bill = await prisma.bill.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!bill) throw new AppError('Bill not found', 404);

    const allowed = statusTransitions[bill.status] || [];
    if (!allowed.includes(req.body.status)) {
      throw new AppError(
        `Cannot transition from ${bill.status} to ${req.body.status}. Allowed: ${allowed.join(', ') || 'none'}`,
        400,
      );
    }

    const updated = await prisma.bill.update({
      where: { id: parseInt(req.params.id) },
      data: { status: req.body.status },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        lineItems: true,
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// Recalculate total from line items
router.post('/:id/recalculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bill = await prisma.bill.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!bill) throw new AppError('Bill not found', 404);

    const aggregate = await prisma.billLineItem.aggregate({
      where: { billId: parseInt(req.params.id) },
      _sum: { total: true },
    });

    const totalAmount = aggregate._sum.total || 0;

    const updated = await prisma.bill.update({
      where: { id: parseInt(req.params.id) },
      data: { totalAmount },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        lineItems: true,
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.bill.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
