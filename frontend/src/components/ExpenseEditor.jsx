import { useEffect, useState } from 'react';
import { X, Save, LoaderCircle, AlertCircle } from 'lucide-react';

const CATEGORIES = ['software', 'office_supplies', 'travel', 'meals', 'utilities', 'marketing', 'professional_services', 'equipment', 'other'];
const EMPTY = { merchant: '', expense_date: '', currency: '', subtotal: '', tax: '', total: '', category: 'other' };

export default function ExpenseEditor({ expense, onClose, onSave, saving }) {
  const [form, setForm] = useState(EMPTY);
  useEffect(() => {
    if (expense) setForm({
      merchant: expense.merchant ?? '',
      expense_date: expense.expense_date ?? '',
      currency: expense.currency ?? '',
      subtotal: expense.subtotal ?? '',
      tax: expense.tax ?? '',
      total: expense.total ?? '',
      category: expense.category ?? 'other',
    });
  }, [expense]);

  function set(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  function submit(e) {
    e.preventDefault();
    const payload = { ...form };
    for (const key of ['merchant', 'expense_date', 'currency', 'subtotal', 'tax', 'total', 'category']) {
      if (payload[key] === '') payload[key] = null;
    }
    for (const key of ['subtotal', 'tax', 'total']) {
      if (payload[key] !== null) payload[key] = Number(payload[key]);
    }
    if (payload.currency) payload.currency = payload.currency.trim().toUpperCase();
    onSave(payload);
  }

  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
    <section className="modal edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
      <div className="modal-head"><div><div className="eyebrow">EXPENSE #{expense.id}</div><h2 id="edit-title">Review expense</h2><p>Check the extracted values and correct anything that looks wrong.</p></div><button className="icon-button" onClick={onClose} disabled={saving} aria-label="Close"><X size={19}/></button></div>
      {expense.review_reasons?.length > 0 && <div className="review-alert"><AlertCircle size={17}/><div><strong>Needs attention</strong><ul>{expense.review_reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul></div></div>}
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="field field-full">Merchant<input required maxLength="255" value={form.merchant} onChange={(e) => set('merchant', e.target.value)} placeholder="e.g. Office Supplies Co."/></label>
          <label className="field">Invoice / receipt date<input type="date" value={form.expense_date} onChange={(e) => set('expense_date', e.target.value)}/></label>
          <label className="field">Currency<input maxLength="3" minLength="3" value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} placeholder="USD"/></label>
          <label className="field">Subtotal<input type="number" min="0" step="0.01" value={form.subtotal} onChange={(e) => set('subtotal', e.target.value)} placeholder="0.00"/></label>
          <label className="field">Tax<input type="number" min="0" step="0.01" value={form.tax} onChange={(e) => set('tax', e.target.value)} placeholder="0.00"/></label>
          <label className="field">Total amount<input required type="number" min="0.01" step="0.01" value={form.total} onChange={(e) => set('total', e.target.value)} placeholder="0.00"/></label>
          <label className="field">Category<select value={form.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}</select></label>
        </div>
        <div className="source-file"><span>Source file</span><strong title={expense.original_filename}>{expense.original_filename}</strong></div>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? <><LoaderCircle size={16} className="spin"/> Saving…</> : <><Save size={16}/> Save changes</>}</button></div>
      </form>
    </section>
  </div>;
}
