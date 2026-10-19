import { useMemo } from 'react';
import { Search, Pencil, Check, Trash2, FileText, Image as ImageIcon, AlertCircle, ArrowUpRight, Inbox } from 'lucide-react';

function money(value, currency) {
  if (value === null || value === undefined || value === '') return '—';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(Number(value)); }
  catch { return `${currency || ''} ${Number(value).toFixed(2)}`.trim(); }
}
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function statusLabel(status) {
  return ({ approved: 'Approved', needs_review: 'Needs review', failed: 'Failed', processing: 'Processing' })[status] || status;
}
function categoryLabel(category) { return (category || 'Uncategorized').replaceAll('_', ' '); }

export default function ExpenseTable({ expenses, filter, onFilterChange, search, onSearchChange, onEdit, onApprove, onDelete, busyIds }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (filter !== 'all' && expense.status !== filter) return false;
      if (!q) return true;
      return [expense.merchant, expense.original_filename, expense.category, String(expense.id)].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [expenses, filter, search]);

  return <section className="panel expenses-panel">
    <div className="panel-header expense-panel-header"><div><div className="eyebrow">YOUR LEDGER</div><h2>Expenses <span className="count-pill">{filtered.length}</span></h2><p>Review AI-extracted records before exporting them.</p></div><div className="table-tools"><label className="search-box"><Search size={16}/><input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search expenses…" aria-label="Search expenses"/><kbd>/</kbd></label><select className="filter-select" value={filter} onChange={(e) => onFilterChange(e.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option value="needs_review">Needs review</option><option value="approved">Approved</option><option value="failed">Failed</option></select></div></div>
    {filtered.length === 0 ? <div className="empty-state"><div className="empty-icon"><Inbox size={26}/></div><strong>{search || filter !== 'all' ? 'No matching expenses' : 'Your ledger is ready for its first receipt'}</strong><p>{search || filter !== 'all' ? 'Try changing your search or filter.' : 'Upload a receipt to extract the merchant, date, tax, and total automatically.'}</p></div> : <div className="table-scroll"><table className="expense-table"><thead><tr><th>Merchant / source</th><th>Date</th><th>Category</th><th>Amount</th><th>Status</th><th className="actions-head">Actions</th></tr></thead><tbody>{filtered.map((expense) => {
      const busy = busyIds.has(expense.id);
      return <tr key={expense.id}>
        <td><div className="merchant-cell"><div className="merchant-avatar">{expense.original_filename?.toLowerCase().endsWith('.pdf') ? <FileText size={17}/> : <ImageIcon size={17}/>}</div><div className="merchant-info"><strong>{expense.merchant || 'Unknown merchant'}</strong><span title={expense.original_filename}>{expense.original_filename}</span>{expense.review_reasons?.length > 0 && expense.status !== 'approved' && <small className="warning-inline"><AlertCircle size={12}/> {expense.review_reasons.length} {expense.review_reasons.length === 1 ? 'item' : 'items'} to check</small>}</div></div></td>
        <td className="date-cell">{formatDate(expense.expense_date)}</td><td><span className="category-label">{categoryLabel(expense.category)}</span></td><td className="amount-cell">{money(expense.total, expense.currency)}</td>
        <td><span className={`status-pill status-${expense.status}`}><span className="status-dot"/>{statusLabel(expense.status)}</span></td>
        <td><div className="row-actions"><button className="icon-button action-edit" title="Edit expense" aria-label={`Edit expense ${expense.id}`} onClick={() => onEdit(expense)} disabled={busy || expense.status === 'failed'}><Pencil size={15}/></button>{expense.status !== 'approved' && expense.status !== 'failed' && <button className="icon-button action-approve" title="Approve expense" aria-label={`Approve expense ${expense.id}`} onClick={() => onApprove(expense)} disabled={busy}><Check size={16}/></button>}<button className="icon-button action-delete" title="Delete expense" aria-label={`Delete expense ${expense.id}`} onClick={() => onDelete(expense)} disabled={busy}><Trash2 size={15}/></button></div></td>
      </tr>;
    })}</tbody></table></div>}
    <div className="table-footer"><span>Showing {filtered.length} of {expenses.length} records</span><span><span className="footer-dot"/> Updates saved to your local database</span></div>
  </section>;
}
