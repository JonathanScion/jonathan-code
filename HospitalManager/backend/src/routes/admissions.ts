import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const admissionSchema = z.object({
  patientId: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  roomId: z.number().int().positive(),
  bedId: z.number().int().positive().optional().nullable(),
  admitDate: z.string().datetime({ offset: true }).or(z.string().date()),
  dischargeDate: z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
  status: z.enum(['ADMITTED', 'DISCHARGED', 'TRANSFERRED']).optional(),
  reason: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const statusTransitions: Record<string, string[]> = {
  ADMITTED: ['DISCHARGED', 'TRANSFERRED'],
  DISCHARGED: [],
  TRANSFERRED: [],
};

const statusSchema = z.object({
  status: z.enum(['ADMITTED', 'DISCHARGED', 'TRANSFERRED']),
});

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const where: any = {};
    if (req.query.patientId) where.patientId = parseInt(req.query.patientId as string);
    if (req.query.status) where.status = req.query.status as string;
    const [data, total] = await Promise.all([
      prisma.admission.findMany({
        where,
        skip,
        take,
        orderBy: { admitDate: 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          doctor: { select: { id: true, firstName: true, lastName: true } },
          room: true,
          bed: true,
        },
      }),
      prisma.admission.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admission = await prisma.admission.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
        room: true,
        bed: true,
      },
    });
    if (!admission) throw new AppError('Admission not found', 404);
    res.json(admission);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(admissionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      admitDate: new Date(req.body.admitDate),
      dischargeDate: req.body.dischargeDate ? new Date(req.body.dischargeDate) : null,
      status: req.body.status || 'ADMITTED',
    };
    const admission = await prisma.admission.create({
      data,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
        room: true,
        bed: true,
      },
    });
    res.status(201).json(admission);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(admissionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      admitDate: new Date(req.body.admitDate),
      dischargeDate: req.body.dischargeDate ? new Date(req.body.dischargeDate) : null,
    };
    const admission = await prisma.admission.update({
      where: { id: parseInt(req.params.id) },
      data,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
        room: true,
        bed: true,
      },
    });
    res.json(admission);
  } catch (err) { next(err); }
});

// Status transition
router.patch('/:id/status', validate(statusSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admission = await prisma.admission.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!admission) throw new AppError('Admission not found', 404);

    const allowed = statusTransitions[admission.status] || [];
    if (!allowed.includes(req.body.status)) {
      throw new AppError(
        `Cannot transition from ${admission.status} to ${req.body.status}. Allowed: ${allowed.join(', ') || 'none'}`,
        400,
      );
    }

    const updateData: any = { status: req.body.status };
    if (req.body.status === 'DISCHARGED') {
      updateData.dischargeDate = new Date();
    }

    // When discharged, set the bed status back to AVAILABLE
    if (req.body.status === 'DISCHARGED' && admission.bedId) {
      await prisma.bed.update({
        where: { id: admission.bedId },
        data: { status: 'AVAILABLE' },
      });
    }

    const updated = await prisma.admission.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, firstName: true, lastName: true } },
        room: true,
        bed: true,
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.admission.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
