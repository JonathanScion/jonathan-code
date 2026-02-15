import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { validate } from '../middleware/validate';
import { getPagination, paginatedResponse } from '../lib/pagination';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const patientSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.coerce.date(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  ssn: z.string().max(11).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  zipCode: z.string().max(10).optional().nullable(),
  emergencyName: z.string().max(100).optional().nullable(),
  emergencyPhone: z.string().max(20).optional().nullable(),
  emergencyRelation: z.string().max(50).optional().nullable(),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional().nullable(),
  allergies: z.string().max(1000).optional().nullable(),
  medicalNotes: z.string().max(2000).optional().nullable(),
});

// List
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const search = req.query.search as string | undefined;
    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take,
        orderBy: { lastName: 'asc' },
        include: { _count: { select: { visits: true, appointments: true } } },
      }),
      prisma.patient.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, pageSize));
  } catch (err) { next(err); }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        insurances: { include: { insurancePlan: true } },
        visits: true,
        appointments: true,
      },
    });
    if (!patient) throw new AppError('Patient not found', 404);
    res.json(patient);
  } catch (err) { next(err); }
});

// Create
router.post('/', validate(patientSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await prisma.patient.create({ data: req.body });
    res.status(201).json(patient);
  } catch (err) { next(err); }
});

// Update
router.put('/:id', validate(patientSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patient = await prisma.patient.update({ where: { id: parseInt(req.params.id) }, data: req.body });
    res.json(patient);
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.patient.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
