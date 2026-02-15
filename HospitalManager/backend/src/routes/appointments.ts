import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const appointmentSchema = z.object({
  patientId: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  dateTime: z.string().datetime({ offset: true }),
  duration: z.number().int().min(5).max(480),
  type: z.enum(['CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'ROUTINE']),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const statusTransitions: Record<string, string[]> = {
  SCHEDULED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

const statusSchema = z.object({
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const where: any = {};
    if (req.query.patientId) where.patientId = parseInt(req.query.patientId as string);
    if (req.query.doctorId) where.doctorId = parseInt(req.query.doctorId as string);
    if (req.query.status) where.status = req.query.status as string;
    const [data, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take,
        orderBy: { dateTime: 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          doctor: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!appointment) throw new AppError('Appointment not found', 404);
    res.json(appointment);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(appointmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      dateTime: new Date(req.body.dateTime),
      status: req.body.status || 'SCHEDULED',
    };
    const appointment = await prisma.appointment.create({
      data,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.status(201).json(appointment);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(appointmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      dateTime: new Date(req.body.dateTime),
    };
    const appointment = await prisma.appointment.update({
      where: { id: parseInt(req.params.id) },
      data,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.json(appointment);
  } catch (err) { next(err); }
});

// Status transition
router.patch('/:id/status', validate(statusSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appointment = await prisma.appointment.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!appointment) throw new AppError('Appointment not found', 404);

    const allowed = statusTransitions[appointment.status] || [];
    if (!allowed.includes(req.body.status)) {
      throw new AppError(
        `Cannot transition from ${appointment.status} to ${req.body.status}. Allowed: ${allowed.join(', ') || 'none'}`,
        400,
      );
    }

    const updated = await prisma.appointment.update({
      where: { id: parseInt(req.params.id) },
      data: { status: req.body.status },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.appointment.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
