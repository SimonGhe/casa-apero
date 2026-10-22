import { Minus, Plus } from 'lucide-react';
import { MAX_QUANTITY } from '../lib/cart';

export function QuantityInput({ value, onChange, label, minimum = 1, disabled = false }: {
  value: number; onChange: (value: number) => void; label: string; minimum?: number; disabled?: boolean;
}) {
  return <div className="quantity-control" role="group" aria-label={label}>
    <button type="button" className="icon-button" aria-label={`Minder: ${label}`} title="Aantal verlagen" disabled={disabled || value <= minimum} onClick={() => onChange(value - 1)}><Minus size={15} aria-hidden="true" /></button>
    <input type="number" inputMode="numeric" min={minimum} max={MAX_QUANTITY} step={1} aria-label={label} value={value} disabled={disabled}
      onChange={(event) => {
        if (event.target.value === '') return;
        const number = event.target.valueAsNumber;
        if (Number.isFinite(number)) onChange(Math.max(minimum, Math.min(MAX_QUANTITY, Math.floor(number))));
      }} />
    <button type="button" className="icon-button" aria-label={`Meer: ${label}`} title="Aantal verhogen" disabled={disabled || value >= MAX_QUANTITY} onClick={() => onChange(value + 1)}><Plus size={15} aria-hidden="true" /></button>
  </div>;
}
