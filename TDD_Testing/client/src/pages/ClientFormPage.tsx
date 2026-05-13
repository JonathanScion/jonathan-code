import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, createClient, getClient, updateClient } from '../api/client';
import { ClientForm } from '../components/ClientForm';
import { useLookups } from '../hooks/useLookups';
import type { ClientInput } from '../types';
import type { ValidationErrors } from '../utils/validation';

const EMPTY_CLIENT: ClientInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  companyName: '',
  clientType: 'Individual',
  status: 'Prospect',
  industry: 'Other',
  annualRevenue: null,
  notes: '',
};

export function ClientFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const lookupsState = useLookups();
  const [initial, setInitial] = useState<ClientInput>(EMPTY_CLIENT);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<ValidationErrors | undefined>();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getClient(id)
      .then((c) => {
        if (cancelled) return;
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = c;
        void _id;
        void _c;
        void _u;
        setInitial(rest);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmit = async (input: ClientInput) => {
    setSubmitting(true);
    setServerErrors(undefined);
    try {
      if (id) await updateClient(id, input);
      else await createClient(input);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.validation) {
        setServerErrors(err.validation);
      } else if (err instanceof Error) {
        setLoadError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (lookupsState.status === 'loading' || loading) {
    return <div className="loading" data-testid="form-loading">Loading…</div>;
  }
  if (lookupsState.status === 'error') {
    return (
      <div className="error-banner" data-testid="form-error">
        {lookupsState.error}
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="error-banner" data-testid="form-error">
        {loadError}
      </div>
    );
  }

  return (
    <div data-testid="page-form">
      <h2>{isEdit ? 'Edit client' : 'New client'}</h2>
      <ClientForm
        initial={initial}
        lookups={lookupsState.data}
        submitting={submitting}
        serverErrors={serverErrors}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/')}
      />
    </div>
  );
}
