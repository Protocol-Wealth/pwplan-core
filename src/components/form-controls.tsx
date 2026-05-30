/**
 * form-controls — shared, presentational form primitives reused across the
 * planning tool forms (Monte Carlo, glide path, tax withdrawal). No logic of
 * substance; just consistent stone/font-mono styling.
 */

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="font-mono text-[0.65rem] uppercase tracking-wider text-stone-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function NumberInput({
  value,
  onChange,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full border border-stone-300 bg-white px-2 py-1 font-mono text-sm focus:border-stone-900 focus:outline-none"
    />
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-stone-300 bg-white px-2 py-1 font-mono text-sm focus:border-stone-900 focus:outline-none"
    />
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-stone-300 bg-white px-2 py-1 font-mono text-sm focus:border-stone-900 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SectionHeader({
  title,
  addLabel,
  onAdd,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-stone-200 pb-1">
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
        {title}
      </h3>
      <button
        type="button"
        onClick={onAdd}
        className="font-mono text-[0.65rem] uppercase tracking-wider text-stone-600 underline-offset-2 hover:underline"
      >
        + {addLabel}
      </button>
    </div>
  );
}

export function Card({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <div className="relative border border-stone-300 p-3">
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="absolute right-2 top-2 font-mono text-sm leading-none text-stone-400 hover:text-red-600"
      >
        ×
      </button>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-dashed border-stone-300 p-3 font-mono text-[0.65rem] text-stone-400">
      {children}
    </p>
  );
}

/**
 * Issues list shown above a tool's Run button. Renders nothing when valid.
 */
export function IssueList({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1 border border-amber-300 bg-amber-50 p-3">
      {issues.map((msg, i) => (
        <li key={i} className="font-mono text-[0.65rem] text-amber-800">
          • {msg}
        </li>
      ))}
    </ul>
  );
}

/**
 * The full-width Run button shared by every tool form.
 */
export function RunButton({
  running,
  disabled,
  onClick,
  label = "Run",
}: {
  running: boolean;
  disabled: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={running || disabled}
      className="w-full bg-stone-900 px-4 py-2 font-mono text-sm uppercase tracking-wider text-stone-50 transition hover:bg-stone-700 disabled:opacity-40"
    >
      {running ? "Running…" : label}
    </button>
  );
}
