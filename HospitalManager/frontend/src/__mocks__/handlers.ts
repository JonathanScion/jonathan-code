import { http, HttpResponse } from 'msw';

const BASE_URL = '/api';

// Reusable paginated response helper
function paginated<T>(data: T[], page = 1, pageSize = 25) {
  return {
    data,
    pagination: {
      page,
      pageSize,
      total: data.length,
      totalPages: Math.ceil(data.length / pageSize),
    },
  };
}

const mockDepartments = [
  { id: 1, name: 'Cardiology', description: 'Heart care', phone: '555-0101', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  { id: 2, name: 'Neurology', description: 'Brain care', phone: '555-0102', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
];

const mockDashboard = {
  patientCount: 150,
  todayAppointments: 12,
  bedOccupancy: { occupied: 45, total: 100 },
  pendingLabOrders: 8,
  outstandingBills: { count: 25, total: 15000.00 },
};

export const handlers = [
  // Departments
  http.get(`${BASE_URL}/departments`, () => {
    return HttpResponse.json(paginated(mockDepartments));
  }),
  http.get(`${BASE_URL}/departments/:id`, ({ params }) => {
    const dept = mockDepartments.find(d => d.id === Number(params.id));
    if (!dept) return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    return HttpResponse.json(dept);
  }),
  http.post(`${BASE_URL}/departments`, async ({ request }) => {
    const body = await request.json() as Record<string, any>;
    return HttpResponse.json({ id: 3, ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { status: 201 });
  }),
  http.put(`${BASE_URL}/departments/:id`, async ({ request, params }) => {
    const body = await request.json() as Record<string, any>;
    return HttpResponse.json({ id: Number(params.id), ...body, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: new Date().toISOString() });
  }),
  http.delete(`${BASE_URL}/departments/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Dashboard
  http.get(`${BASE_URL}/dashboard`, () => {
    return HttpResponse.json(mockDashboard);
  }),

  // Patients
  http.get(`${BASE_URL}/patients`, () => {
    return HttpResponse.json(paginated([
      { id: 1, firstName: 'John', lastName: 'Doe', dateOfBirth: '1990-01-01', gender: 'MALE', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z', _count: { visits: 3, appointments: 5 } },
    ]));
  }),

  // Appointments
  http.get(`${BASE_URL}/appointments`, () => {
    return HttpResponse.json(paginated([]));
  }),

  // Bills
  http.get(`${BASE_URL}/bills`, () => {
    return HttpResponse.json(paginated([]));
  }),
];
