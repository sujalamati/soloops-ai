import { useRef, useState } from 'react';
import { FileUp, X, FileText, Image as ImageIcon, LoaderCircle, Trash2 } from 'lucide-react';

const ACCEPTED = '.pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp';

export default function UploadModal({ onClose, onUpload, busy }) {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function addFiles(list) {
    const next = Array.from(list || []);
    setFiles((current) => {
      const seen = new Set(current.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      return [...current, ...next.filter((f) => !seen.has(`${f.name}-${f.size}-${f.lastModified}`))].slice(0, 20);
    });
  }

  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
    <section className="modal upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <div className="modal-head"><div><div className="eyebrow">DOCUMENT INTAKE</div><h2 id="upload-title">Upload receipts</h2><p>We'll extract the details and add each file to your review queue.</p></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Close"><X size={19}/></button></div>
      <div className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}>
        <div className="drop-icon"><FileUp size={24}/></div><strong>Drop files here or <span>browse</span></strong><p>PDF, PNG, JPG, TIFF, or WEBP · Up to 20 files</p>
        <input ref={inputRef} type="file" accept={ACCEPTED} multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}/>
      </div>
      {files.length > 0 && <div className="selected-files"><div className="selected-heading">Selected files <span>{files.length}/20</span></div>{files.map((file, i) => <div className="selected-file" key={`${file.name}-${file.lastModified}-${i}`}><div className="file-type-icon">{file.type === 'application/pdf' ? <FileText size={17}/> : <ImageIcon size={17}/>}</div><div className="file-meta"><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(0)} KB</span></div><button className="icon-button subtle" aria-label={`Remove ${file.name}`} onClick={() => setFiles((all) => all.filter((_, index) => index !== i))}><Trash2 size={16}/></button></div>)}</div>}
      <div className="privacy-note"><span className="privacy-dot"/><span>Local-first processing: files are sent to your configured SoloOps backend.</span></div>
      <div className="modal-actions"><button className="button button-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" onClick={() => onUpload(files)} disabled={!files.length || busy}>{busy ? <><LoaderCircle size={16} className="spin"/> Processing…</> : <><FileUp size={16}/> Process {files.length || ''} {files.length === 1 ? 'file' : 'files'}</>}</button></div>
    </section>
  </div>;
}
