import { useEffect, useState } from 'react';
import type { ClientInput, Lookups } from '../types';
import { hasErrors, requiresRevenue, validateClient, type ValidationErrors } from '../utils/validation';
import { LookupSelect } from './LookupSelect';

interface Props {
  initial: ClientInput;
  lookups: Lookups;
  submitting: boolean;
  serverErrors?: ValidationErrors;
  onSubmit: (input: ClientInput) => void;
  onCancel: () => void;
}

const EMPTY: ValidationErrors = {};

export function ClientForm({ initial, lookups, submitting, serverErrors, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<ClientInput>(initial);
  const [errors, setErrors] = useState<ValidationErrors>(EMPTY);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setValues(initial);
  }, [initial]);

  useEffect(() => {
    if (serverErrors) setErrors(serverErrors);
  }, [serverErrors]);

  const update = <K extends keyof ClientInput>(field: K, value: ClientInput[K]) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      if (touched) setErrors(validateClient(next));
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const v = validateClient(values);
    setErrors(v);
    if (hasErrors(v)) return;
    onSubmit(values);
  };

  const showRevenue = requiresRevenue(values.clientType);

  return (
    <form className="form" onSubmit={handleSubmit} data-testid="client-form" noValidate>
      <Field id="firstName" label="First name" error={errors.firstName}>
        <input
          id="firstName"
          value={values.firstName}
          onChange={(e) => update('firstName', e.target.value)}
          aria-invalid={Boolean(errors.firstName)}
          data-testid="input-firstName"
        />
      </Field>

      <Field id="lastName" label="Last name" error={errors.lastName}>
        <input
          id="lastName"
          value={values.lastName}
          onChange={(e) => update('lastName', e.target.value)}
          aria-invalid={Boolean(errors.lastName)}
          data-testid="input-lastName"
        />
      </Field>

      <Field id="email" label="Email" error={errors.email}>
        <input
          id="email"
          type="email"
          value={values.email}
          onChange={(e) => update('email', e.target.value)}
          aria-invalid={Boolean(errors.email)}
          data-testid="input-email"
        />
      </Field>

      <Field id="phone" label="Phone" error={errors.phone}>
        <input
          id="phone"
          value={values.phone}
          onChange={(e) => update('phone', e.target.value)}
          aria-invalid={Boolean(errors.phone)}
          data-testid="input-phone"
        />
      </Field>

      <Field id="clientType" label="Client type" error={errors.clientType}>
        <LookupSelect
          id="clientType"
          value={values.clientType}
          options={lookups.clientTypes}
          onChange={(v) => update('clientType', v as ClientInput['clientType'])}
          invalid={Boolean(errors.clientType)}
          testId="select-clientType"
        />
      </Field>

      <Field id="status" label="Status" error={errors.status}>
        <LookupSelect
          id="status"
          value={values.status}
          options={lookups.statuses}
          onChange={(v) => update('status', v as ClientInput['status'])}
          invalid={Boolean(errors.status)}
          testId="select-status"
        />
      </Field>

      <Field id="industry" label="Industry" error={errors.industry}>
        <LookupSelect
          id="industry"
          value={values.industry}
          options={lookups.industries}
          onChange={(v) => update('industry', v as ClientInput['industry'])}
          invalid={Boolean(errors.industry)}
          testId="select-industry"
        />
      </Field>

      <Field id="companyName" label="Company name" error={errors.companyName}>
        <input
          id="companyName"
          value={values.companyName}
          onChange={(e) => update('companyName', e.target.value)}
          aria-invalid={Boolean(errors.companyName)}
          data-testid="input-companyName"
        />
      </Field>

      {showRevenue && (
        <Field id="annualRevenue" label="Annual revenue (USD)" error={errors.annualRevenue}>
          <input
            id="annualRevenue"
            type="number"
            min={0}
            value={values.annualRevenue ?? ''}
            onChange={(e) =>
              update('annualRevenue', e.target.value === '' ? null : Number(e.target.value))
            }
            aria-invalid={Boolean(errors.annualRevenue)}
            data-testid="input-annualRevenue"
          />
        </Field>
      )}

      <div className="field full">
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          rows={3}
          value={values.notes}
          onChange={(e) => update('notes', e.target.value)}
          data-testid="input-notes"
        />
      </div>

      <div className="form-actions">
        <button type="button" onClick={onCancel} data-testid="form-cancel">
          Cancel
        </button>
        <button
          type="submit"
          className="primary"
          disabled={submitting}
          data-testid="form-submit"
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <div className="error" data-testid={`error-${id}`}>
          {error}
        </div>
      )}
    </div>
  );
}
