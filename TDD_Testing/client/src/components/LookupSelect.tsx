interface Props {
  id: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  testId?: string;
}

export function LookupSelect({ id, value, options, onChange, placeholder, invalid, testId }: Props) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      data-testid={testId}
    >
      <option value="">{placeholder ?? 'Select…'}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
