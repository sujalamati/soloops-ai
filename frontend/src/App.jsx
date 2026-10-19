import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownToLine, ArrowUpRight, CheckCircle2, ChevronDown,
  CircleHelp, FileCheck2, FileUp, LayoutDashboard, LoaderCircle, Menu,
  Plus, RefreshCw, ShieldCheck, Sparkles, Wallet, X, Zap,
} from 'lucide-react';
import ExpenseTable from './components/ExpenseTable.jsx';
import UploadModal from './components/UploadModal.jsx';
import ExpenseEditor from './components/ExpenseEditor.jsx';
import { apiBaseUrl, approveExpense, deleteExpense, exportCsvUrl, getExpenses, getHealth, updateExpense, uploadDocuments } from './lib/api.js';

function currencyTotals(expenses) {
  const totals = {};
  expenses.forEach((expense) => {
    if (expense.total === null || expense.total === undefined || expense.total === '') return;
    const currency = expense.currency || 'UNKNOWN';
    totals[currency] = (totals[currency] || 0) + Number(expense.total);
  });
  return totals;
}
function money(value, currency) {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${Number(value).toFixed(2)}`; }
}
function compactTotals(totals) {
  const entries = Object.entries(totals).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return '—';
  return entries.map(([currency, value]) => currency === 'UNKNOWN' ? value.toFixed(2) : money(value, currency)).join(' · ');
}
function Toast({ toast, onClose }) {
  if (!toast) return null;
  return <div className={`toast toast-${toast.type}`} role="status"><span>{toast.type === 'error' ? <CircleHelp size={18}/> : <CheckCircle2 size={18}/>}</span><div><strong>{toast.title}</strong><p>{toast.message}</p></div><button className="icon-button" onClick={onClose} aria-label="Dismiss notification"><X size={16}/></button></div>;
}

export default function App() {
  const [expenses, setExpenses] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [busyIds, setBusyIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [uploadResults, setUploadResults] = useState([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const notify = useCallback((type, title, message) => {
    setToast({ type, title, message });
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(null), 5500);
  }, []);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [records, status] = await Promise.all([getExpenses({ limit: 500 }), getHealth().catch(() => null)]);
      setExpenses(records);
      setHealth(status);
    } catch (error) {
      notify('error', 'Could not load expenses', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [notify]);

  useEffect(() => { refresh(); }, [refresh]);

  const approved = useMemo(() => expenses.filter((e) => e.status === 'approved'), [expenses]);
  const pending = useMemo(() => expenses.filter((e) => e.status === 'needs_review'), [expenses]);
  const failed = useMemo(() => expenses.filter((e) => e.status === 'failed'), [expenses]);
  const approvedTotals = useMemo(() => currencyTotals(approved), [approved]);
  const allTotals = useMemo(() => currencyTotals(expenses.filter((e) => e.status !== 'failed')), [expenses]);
  const needsReviewCount = pending.filter((e) => e.review_reasons?.length > 0).length;

  async function handleUpload(files) {
    setUploading(true);
    try {
      const results = await uploadDocuments(files);
      setUploadResults(results);
      setUploadOpen(false);
      await refresh({ silent: true });
      const successful = results.filter((r) => r.id !== null && r.status !== 'failed' && r.status !== 'rejected').length;
      const unsuccessful = results.length - successful;
      notify(unsuccessful ? 'error' : 'success', unsuccessful ? 'Upload completed with issues' : 'Receipts added', `${successful} processed${unsuccessful ? ` · ${unsuccessful} failed or rejected` : ''}. Review the new records before approving.`);
    } catch (error) {
      notify('error', 'Upload failed', error.message);
    } finally { setUploading(false); }
  }

  async function handleSave(payload) {
    setSaving(true);
    try {
      await updateExpense(editing.id, payload);
      setEditing(null);
      await refresh({ silent: true });
      notify('success', 'Changes saved', 'The expense was updated and returned to the review queue.');
    } catch (error) { notify('error', 'Could not save changes', error.message); }
    finally { setSaving(false); }
  }

  async function handleApprove(expense) {
    if (!window.confirm(`Approve ${expense.merchant || expense.original_filename}? Make sure the merchant, date, currency, and total are correct.`)) return;
    setBusyIds((ids) => new Set(ids).add(expense.id));
    try {
      await approveExpense(expense.id);
      await refresh({ silent: true });
      notify('success', 'Expense approved', `${expense.merchant || expense.original_filename} is now included in CSV exports.`);
    } catch (error) { notify('error', 'Approval blocked', error.message); }
    finally { setBusyIds((ids) => { const next = new Set(ids); next.delete(expense.id); return next; }); }
  }

  async function handleDelete(expense) {
    if (!window.confirm(`Delete “${expense.merchant || expense.original_filename}”? This permanently removes the expense record and its stored upload.`)) return;
    setBusyIds((ids) => new Set(ids).add(expense.id));
    try {
      await deleteExpense(expense.id);
      setExpenses((current) => current.filter((e) => e.id !== expense.id));
      notify('success', 'Expense deleted', 'The record and stored upload were removed.');
    } catch (error) { notify('error', 'Could not delete expense', error.message); }
    finally { setBusyIds((ids) => { const next = new Set(ids); next.delete(expense.id); return next; }); }
  }

  function jumpToReview() {
    setFilter('needs_review');
    document.getElementById('expenses')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Sparkles size={20}/></div><div><strong>soloops<span>.</span></strong><small>AI WORKSPACE</small></div><button className="icon-button mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="workspace-switch"><div className="workspace-avatar">S</div><div className="workspace-label"><strong>Solo workspace</strong><span>Personal account</span></div><ChevronDown size={15}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="side-nav"><button className="nav-item active" onClick={() => { setFilter('all'); setMobileNavOpen(false); }}><LayoutDashboard size={18}/>Overview</button><button className={`nav-item ${filter === 'needs_review' ? 'nav-selected' : ''}`} onClick={() => { jumpToReview(); setMobileNavOpen(false); }}><FileCheck2 size={18}/>Review queue{pending.length > 0 && <span className="nav-count">{pending.length}</span>}</button><button className="nav-item" onClick={() => { setFilter('approved'); document.getElementById('expenses')?.scrollIntoView({ behavior: 'smooth' }); setMobileNavOpen(false); }}><CheckCircle2 size={18}/>Approved expenses</button></nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-tip"><div className="tip-icon"><ShieldCheck size={18}/></div><strong>Your data, your machine.</strong><p>SoloOps is designed for local-first document processing. Keep this development server private.</p><span className="tip-link"><Zap size={13}/> Local-first by design</span></div>
      <div className="sidebar-bottom"><div className={`connection-dot ${health?.ollama_reachable ? 'connected' : 'disconnected'}`}/><div><strong>{health?.ollama_reachable ? 'AI engine connected' : 'AI engine unavailable'}</strong><span>{health?.model || 'Checking local model…'}</span></div><button className="icon-button" onClick={() => refresh({ silent: true })} aria-label="Check connection"><RefreshCw size={15}/></button></div>
    </aside>
    {mobileNavOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}/>}
    <main className="main-content">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={20}/></button><span className="breadcrumb-muted">Workspace</span><span className="breadcrumb-sep">/</span><strong>Overview</strong></div><div className="topbar-right"><span className="local-badge"><span/> Local workspace</span><button className="icon-button refresh-button" title="Refresh data" onClick={() => refresh({ silent: true })} disabled={refreshing}>{refreshing ? <LoaderCircle size={17} className="spin"/> : <RefreshCw size={17}/>}</button><button className="button button-primary top-upload" onClick={() => setUploadOpen(true)}><Plus size={17}/> Add receipts</button></div></header>
      <div className="page-content">
        <section className="welcome-row"><div><div className="eyebrow welcome-eyebrow"><span className="eyebrow-line"/> YOUR FINANCES, IN FOCUS</div><h1>Good work starts<br className="desktop-break"/> with <span>clarity.</span></h1><p>Keep your expenses organized. Let AI handle the paperwork, while you stay in control.</p></div><div className="welcome-art" aria-hidden="true"><div className="art-ring ring-one"/><div className="art-ring ring-two"/><div className="art-card"><div className="art-card-top"><span/><span/><span/></div><div className="art-card-line wide"/><div className="art-card-line"/><div className="art-card-total"><span/><b/></div><div className="art-spark"><Sparkles size={21}/></div></div><div className="art-float"><CheckCircle2 size={16}/><span>Ready for review</span></div></div></section>

        <section className="metric-grid" aria-label="Expense summary">
          <article className="metric-card metric-primary"><div className="metric-top"><span>Approved spend</span><span className="metric-icon"><Wallet size={18}/></span></div><div className="metric-value metric-total">{loading ? '…' : compactTotals(approvedTotals)}</div><div className="metric-bottom"><span className="metric-status"><span className="mini-green-dot"/> Verified expenses</span><span className="metric-subtext">{approved.length} approved</span></div><div className="metric-decoration"/></article>
          <article className="metric-card"><div className="metric-top"><span>Needs review</span><span className="metric-icon icon-amber"><FileCheck2 size={18}/></span></div><div className="metric-value">{loading ? '…' : pending.length}</div><div className="metric-bottom"><button className="text-link" onClick={jumpToReview}>Review expenses <ArrowUpRight size={14}/></button><span className="metric-subtext">{needsReviewCount} flagged</span></div></article>
          <article className="metric-card"><div className="metric-top"><span>Documents processed</span><span className="metric-icon icon-blue"><FileUp size={18}/></span></div><div className="metric-value">{loading ? '…' : expenses.length}</div><div className="metric-bottom"><span className="metric-subtext">Across all statuses</span><span className="metric-subtext">{failed.length} failed</span></div></article>
          <article className="metric-card"><div className="metric-top"><span>Unreviewed value</span><span className="metric-icon icon-violet"><Activity size={18}/></span></div><div className="metric-value metric-total">{loading ? '…' : compactTotals(currencyTotals(pending))}</div><div className="metric-bottom"><span className="metric-subtext">Not yet in exports</span><span className="metric-subtext">{pending.length} records</span></div></article>
        </section>

        {health && !health.ollama_reachable && <div className="inline-alert"><CircleHelp size={18}/><div><strong>Ollama isn't reachable</strong><span>The dashboard can still show and manage existing records, but new AI extraction may fail. Start Ollama and check the backend's model configuration.</span></div><button className="text-link" onClick={() => refresh({ silent: true })}>Retry <RefreshCw size={13}/></button></div>}

        <div className="section-title-row"><div><div className="eyebrow">RECENT ACTIVITY</div><h2>Your expense ledger</h2><p>Every receipt, extracted and ready for your review.</p></div><div className="section-actions"><button className="button button-secondary" onClick={() => refresh({ silent: true })} disabled={refreshing}>{refreshing ? <LoaderCircle size={16} className="spin"/> : <RefreshCw size={16}/>} Refresh</button><a className="button button-secondary export-button" href={exportCsvUrl()}><ArrowDownToLine size={16}/> Export CSV</a></div></div>

        {uploadResults.length > 0 && <section className="upload-results"><div className="results-heading"><div><strong>Latest upload results</strong><span>Processing response from the backend</span></div><button className="icon-button" onClick={() => setUploadResults([])} aria-label="Dismiss upload results"><X size={16}/></button></div>{uploadResults.map((result, index) => <div className="result-row" key={`${result.filename}-${index}`}><div className={`result-icon result-${result.status}`}><FileUp size={15}/></div><div className="result-details"><strong>{result.filename}</strong><span>{result.message}</span></div><span className={`status-pill status-${result.status === 'rejected' || result.status === 'failed' ? 'failed' : result.status === 'approved' ? 'approved' : 'needs_review'}`}>{result.status.replaceAll('_', ' ')}</span></div>)}</section>}

        {loading ? <section className="panel loading-panel"><LoaderCircle size={24} className="spin"/><strong>Loading your expense ledger…</strong><span>Connecting to {apiBaseUrl()}</span></section> : <ExpenseTable expenses={expenses} filter={filter} onFilterChange={setFilter} search={search} onSearchChange={setSearch} onEdit={setEditing} onApprove={handleApprove} onDelete={handleDelete} busyIds={busyIds}/>}

        <footer className="page-footer"><span>© 2026 SoloOps AI</span><span><span className="footer-dot"/> Built for people who do it all</span><span className="footer-local"><ShieldCheck size={13}/> Local-first workflow</span></footer>
      </div>
    </main>
    {uploadOpen && <UploadModal onClose={() => !uploading && setUploadOpen(false)} onUpload={handleUpload} busy={uploading}/>}
    {editing && <ExpenseEditor expense={editing} onClose={() => !saving && setEditing(null)} onSave={handleSave} saving={saving}/>}
    <Toast toast={toast} onClose={() => setToast(null)}/>
  </div>;
}
