'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';


/* ---------- Types ---------- */
type Niveau = {
  id: string;
  ordre: number;
  titre: string;
  description: string | null;
};

type Sujet = {
  id: string;
  niveau_id: string;
  ordre: number;
  titre: string;
  description: string | null;
};

type Chapitre = {
  id: string;
  sujet_id: string;
  ordre: number;
  titre: string;
  description: string | null;
};

type FeuilleEntrainement = {
  id: string;
  chapitre_id: string;
  ordre: number;
  titre: string;
  description: string | null;
  pdf_url: string;
};

type NiveauWithData = Niveau & {
  sujets?: (Sujet & {
    chapitres?: (Chapitre & {
      feuilles?: FeuilleEntrainement[];
    })[];
  })[];
};

type DemandeCreation = {
  id: string;
  demandeur_id: string;
  nom_equipe: string;
  description: string | null;
  statut: 'en_attente' | 'approuvee' | 'refusee';
  created_at: string;
  demandeur_nom?: string;
  demandeur_email?: string;
};

/* ---------- Icônes ---------- */
const IconPlus = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconEdit = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const IconTrash = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const IconArrowUp = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconArrowDown = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M19 12l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    className={`w-5 h-5 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
    viewBox="0 0 24 24"
    fill="none"
  >
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconSave = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" />
    <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const IconCancel = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconFile = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12V7l-4-4z" stroke="currentColor" strokeWidth="2" />
    <path d="M14 3v4h4" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const Loader = () => (
  <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
  </svg>
);

/* ---------- Collapse Component ---------- */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<number | string>(open ? '9999px' : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      const h = el.scrollHeight;
      setMaxH(h);
      const id = setTimeout(() => setMaxH('9999px'), 300);
      return () => clearTimeout(id);
    } else {
      const h = el.scrollHeight;
      setMaxH(h);
      requestAnimationFrame(() => setMaxH(0));
    }
  }, [open, children]);

  return (
    <div
      ref={ref}
      className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
      style={{ maxHeight: typeof maxH === 'number' ? `${maxH}px` : maxH }}
    >
      {children}
    </div>
  );
}

/* ---------- Composants UI ---------- */
function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const baseClass = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2';
  const variantClass = {
    primary: 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm hover:shadow-md',
    secondary: 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400',
  }[variant];

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseClass} ${sizeClass} ${variantClass}`}>
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'number' | 'url';
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
      />
    </div>
  );
}

function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
            <IconCancel />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Formulaires ---------- */
function ItemForm({
  type,
  initial,
  parentId,
  onSave,
  onCancel,
}: {
  type: 'niveau' | 'sujet' | 'chapitre' | 'feuille';
  initial?: any;
  parentId?: string;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [titre, setTitre] = useState(initial?.titre || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [ordre, setOrdre] = useState(initial?.ordre?.toString() || '1');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setUploadProgress(null);
    
    try {
      const data: any = {
        titre,
        description: description || null,
        ordre: parseInt(ordre),
      };
      
      if (type === 'sujet' && parentId) data.niveau_id = parentId;
      if (type === 'chapitre' && parentId) data.sujet_id = parentId;
      if (type === 'feuille' && parentId) {
        data.chapitre_id = parentId;
        
        // Si modification et pas de nouveau fichier, garder l'ancien URL
        if (initial && !pdfFile) {
          data.pdf_url = initial.pdf_url;
        } else if (pdfFile) {
          // Upload du nouveau PDF
          setUploadProgress('Upload du PDF...');
          const { url, error } = await uploadPdfToStorage(pdfFile, parentId, parseInt(ordre));
          
          if (error || !url) {
            throw new Error(error || 'Erreur lors de l\'upload du PDF');
          }
          
          data.pdf_url = url;
          
          // Si modification, supprimer l'ancien PDF
          if (initial?.pdf_url) {
            setUploadProgress('Suppression de l\'ancien PDF...');
            await deletePdfFromStorage(initial.pdf_url);
          }
        } else if (!initial) {
          // Nouveau fichier sans PDF
          throw new Error('Veuillez sélectionner un fichier PDF');
        }
      }
      
      setUploadProgress('Enregistrement...');
      await onSave(data);
    } catch (error: any) {
      alert(error.message || 'Une erreur est survenue');
      setSaving(false);
      setUploadProgress(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Titre" value={titre} onChange={setTitre} placeholder="Ex: Addition" required />
      <Input label="Ordre" value={ordre} onChange={setOrdre} type="number" required />
      {type === 'feuille' && (
        <div>
          <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
            Fichier PDF {!initial && <span className="text-red-500">*</span>}
          </label>
          <PdfUpload
            onFileSelect={setPdfFile}
            selectedFile={pdfFile}
            onRemove={() => setPdfFile(null)}
            uploading={saving}
          />
          {initial?.pdf_url && !pdfFile && (
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              <a
                href={initial.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-600 dark:text-teal-400 hover:underline"
              >
                📄 Voir le PDF actuel
              </a>
            </div>
          )}
        </div>
      )}
      <Textarea label="Description" value={description} onChange={setDescription} placeholder="Description optionnelle..." />
      {uploadProgress && (
        <div className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400">
          <Loader />
          {uploadProgress}
        </div>
      )}
      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader /> : <IconSave />}
          {initial ? 'Modifier' : 'Créer'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          <IconCancel />
          Annuler
        </Button>
      </div>
    </form>
  );
}

/* ---------- Import des fonctions PDF ---------- */
async function uploadPdfToStorage(file: File, chapitreId: string, ordre: number): Promise<{ url: string | null; error: string | null }> {
  try {
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    // IMPORTANT: Ajouter le dossier "entrainements/" au début du chemin
    const fileName = `entrainements/${chapitreId}/${ordre}_${timestamp}_${sanitizedFileName}`;

    const { data, error } = await supabase.storage
      .from('pdfs')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Erreur upload:', error);
      return { url: null, error: error.message };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('pdfs')
      .getPublicUrl(fileName);

    return { url: publicUrl, error: null };
  } catch (e: any) {
    console.error('Erreur:', e);
    return { url: null, error: e.message || 'Erreur lors de l\'upload' };
  }
}

async function deletePdfFromStorage(pdfUrl: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const url = new URL(pdfUrl);
    const pathParts = url.pathname.split('/pdfs/');
    if (pathParts.length < 2) {
      return { success: false, error: 'URL invalide' };
    }
    const filePath = pathParts[1];

    const { error } = await supabase.storage
      .from('pdfs')
      .remove([filePath]);

    if (error) {
      console.error('Erreur suppression:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (e: any) {
    console.error('Erreur:', e);
    return { success: false, error: e.message || 'Erreur lors de la suppression' };
  }
}

/* ---------- Composant Upload PDF ---------- */
function PdfUpload({ onFileSelect, selectedFile, onRemove, uploading = false }: {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onRemove: () => void;
  uploading?: boolean;
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        onFileSelect(file);
      } else {
        alert('Veuillez sélectionner un fichier PDF');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        onFileSelect(file);
      } else {
        alert('Veuillez sélectionner un fichier PDF');
      }
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  if (selectedFile) {
    return (
      <div className="p-4 rounded-lg border-2 border-teal-500 bg-teal-50 dark:bg-teal-950/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="text-teal-600 dark:text-teal-400">
              <IconFile />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{selectedFile.name}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          </div>
          {!uploading && (
            <button
              type="button"
              onClick={onRemove}
              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-600 transition-colors"
            >
              <IconTrash />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative p-8 rounded-lg border-2 border-dashed transition-all cursor-pointer ${
        dragActive
          ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/30'
          : 'border-slate-300 dark:border-slate-600 hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={handleChange}
        className="hidden"
      />
      <div className="flex flex-col items-center justify-center text-center">
        <div className="text-teal-600 dark:text-teal-400 mb-3">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">
          Déposez votre PDF ici ou cliquez pour sélectionner
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">PDF uniquement, max 10 MB</p>
      </div>
    </div>
  );
}

/* ---------- Item Actions ---------- */
function ItemActions({
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  canMoveUp,
  canMoveDown,
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={onMoveUp}
        disabled={!canMoveUp}
        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Monter"
      >
        <IconArrowUp />
      </button>
      <button
        onClick={onMoveDown}
        disabled={!canMoveDown}
        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Descendre"
      >
        <IconArrowDown />
      </button>
      <button
        onClick={onEdit}
        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
        title="Modifier"
      >
        <IconEdit />
      </button>
      <button
        onClick={onDelete}
        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded transition-colors"
        title="Supprimer"
      >
        <IconTrash />
      </button>
    </div>
  );
}

/* ---------- Accordéon Items ---------- */
function FeuilleItem({
  feuille,
  index,
  total,
  onMove,
  onEdit,
  onDelete,
}: {
  feuille: FeuilleEntrainement;
  index: number;
  total: number;
  onMove: (direction: 'up' | 'down') => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-500 text-white font-bold text-sm shrink-0">
          {feuille.ordre}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{feuille.titre}</div>
          <a
            href={feuille.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-teal-600 dark:text-teal-400 hover:underline truncate block"
            onClick={(e) => e.stopPropagation()}
          >
            <IconFile className="inline w-3 h-3 mr-1" />
            Voir PDF
          </a>
        </div>
      </div>
      <ItemActions
        onMoveUp={() => onMove('up')}
        onMoveDown={() => onMove('down')}
        onEdit={onEdit}
        onDelete={onDelete}
        canMoveUp={index > 0}
        canMoveDown={index < total - 1}
      />
    </div>
  );
}

function ChapitreItem({
  chapitre,
  index,
  total,
  isOpen,
  onToggle,
  onMove,
  onEdit,
  onDelete,
  onAddFeuille,
  onEditFeuille,
  onDeleteFeuille,
  onMoveFeuille,
}: {
  chapitre: Chapitre & { feuilles?: FeuilleEntrainement[] };
  index: number;
  total: number;
  isOpen: boolean;
  onToggle: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddFeuille: () => void;
  onEditFeuille: (feuille: FeuilleEntrainement) => void;
  onDeleteFeuille: (id: string) => void;
  onMoveFeuille: (idx: number, direction: 'up' | 'down') => void;
}) {
  const feuilles = chapitre.feuilles || [];

  return (
    <div className="border border-pink-200 dark:border-pink-800 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-100 to-pink-50 dark:from-pink-900/30 dark:to-pink-800/20 cursor-pointer hover:from-pink-200 hover:to-pink-100 dark:hover:from-pink-900/40 dark:hover:to-pink-800/30 transition-all"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <IconChevron open={isOpen} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{chapitre.titre}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              {feuilles.length} feuille{feuilles.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <ItemActions
          onMoveUp={() => onMove('up')}
          onMoveDown={() => onMove('down')}
          onEdit={onEdit}
          onDelete={onDelete}
          canMoveUp={index > 0}
          canMoveDown={index < total - 1}
        />
      </div>

      <Collapse open={isOpen}>
        <div className="p-4 space-y-2 bg-white dark:bg-slate-900">
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={onAddFeuille}>
              <IconPlus />
              Ajouter une feuille
            </Button>
          </div>
          {feuilles.length === 0 ? (
            <p className="text-center text-slate-500 py-4">Aucune feuille</p>
          ) : (
            feuilles.map((feuille, idx) => (
              <FeuilleItem
                key={feuille.id}
                feuille={feuille}
                index={idx}
                total={feuilles.length}
                onMove={(dir) => onMoveFeuille(idx, dir)}
                onEdit={() => onEditFeuille(feuille)}
                onDelete={() => onDeleteFeuille(feuille.id)}
              />
            ))
          )}
        </div>
      </Collapse>
    </div>
  );
}

function SujetItem({
  sujet,
  index,
  total,
  isOpen,
  onToggle,
  onMove,
  onEdit,
  onDelete,
  onAddChapitre,
  onEditChapitre,
  onDeleteChapitre,
  onMoveChapitre,
  onAddFeuille,
  onEditFeuille,
  onDeleteFeuille,
  onMoveFeuille,
  openChapitres,
  onToggleChapitre,
}: {
  sujet: Sujet & { chapitres?: (Chapitre & { feuilles?: FeuilleEntrainement[] })[] };
  index: number;
  total: number;
  isOpen: boolean;
  onToggle: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddChapitre: () => void;
  onEditChapitre: (chapitre: Chapitre) => void;
  onDeleteChapitre: (id: string) => void;
  onMoveChapitre: (idx: number, direction: 'up' | 'down') => void;
  onAddFeuille: (chapitreId: string) => void;
  onEditFeuille: (feuille: FeuilleEntrainement) => void;
  onDeleteFeuille: (id: string) => void;
  onMoveFeuille: (chapitreId: string, idx: number, direction: 'up' | 'down') => void;
  openChapitres: Set<string>;
  onToggleChapitre: (id: string) => void;
}) {
  const chapitres = sujet.chapitres || [];

  return (
    <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 cursor-pointer hover:from-blue-200 hover:to-blue-100 dark:hover:from-blue-900/40 dark:hover:to-blue-800/30 transition-all"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <IconChevron open={isOpen} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{sujet.titre}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              {chapitres.length} chapitre{chapitres.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <ItemActions
          onMoveUp={() => onMove('up')}
          onMoveDown={() => onMove('down')}
          onEdit={onEdit}
          onDelete={onDelete}
          canMoveUp={index > 0}
          canMoveDown={index < total - 1}
        />
      </div>

      <Collapse open={isOpen}>
        <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={onAddChapitre}>
              <IconPlus />
              Ajouter un chapitre
            </Button>
          </div>
          {chapitres.length === 0 ? (
            <p className="text-center text-slate-500 py-4">Aucun chapitre</p>
          ) : (
            chapitres.map((chapitre, idx) => (
              <ChapitreItem
                key={chapitre.id}
                chapitre={chapitre}
                index={idx}
                total={chapitres.length}
                isOpen={openChapitres.has(chapitre.id)}
                onToggle={() => onToggleChapitre(chapitre.id)}
                onMove={(dir) => onMoveChapitre(idx, dir)}
                onEdit={() => onEditChapitre(chapitre)}
                onDelete={() => onDeleteChapitre(chapitre.id)}
                onAddFeuille={() => onAddFeuille(chapitre.id)}
                onEditFeuille={onEditFeuille}
                onDeleteFeuille={onDeleteFeuille}
                onMoveFeuille={(feuilleIdx, dir) => onMoveFeuille(chapitre.id, feuilleIdx, dir)}
              />
            ))
          )}
        </div>
      </Collapse>
    </div>
  );
}

function NiveauItem({
  niveau,
  index,
  total,
  isOpen,
  onToggle,
  onMove,
  onEdit,
  onDelete,
  onAddSujet,
  onEditSujet,
  onDeleteSujet,
  onMoveSujet,
  onAddChapitre,
  onEditChapitre,
  onDeleteChapitre,
  onMoveChapitre,
  onAddFeuille,
  onEditFeuille,
  onDeleteFeuille,
  onMoveFeuille,
  openSujets,
  onToggleSujet,
  openChapitres,
  onToggleChapitre,
}: {
  niveau: NiveauWithData;
  index: number;
  total: number;
  isOpen: boolean;
  onToggle: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSujet: () => void;
  onEditSujet: (sujet: Sujet) => void;
  onDeleteSujet: (id: string) => void;
  onMoveSujet: (idx: number, direction: 'up' | 'down') => void;
  onAddChapitre: (sujetId: string) => void;
  onEditChapitre: (chapitre: Chapitre) => void;
  onDeleteChapitre: (id: string) => void;
  onMoveChapitre: (sujetId: string, idx: number, direction: 'up' | 'down') => void;
  onAddFeuille: (chapitreId: string) => void;
  onEditFeuille: (feuille: FeuilleEntrainement) => void;
  onDeleteFeuille: (id: string) => void;
  onMoveFeuille: (chapitreId: string, idx: number, direction: 'up' | 'down') => void;
  openSujets: Set<string>;
  onToggleSujet: (id: string) => void;
  openChapitres: Set<string>;
  onToggleChapitre: (id: string) => void;
}) {
  const sujets = niveau.sujets || [];

  return (
    <div className="border-2 border-teal-300 dark:border-teal-700 rounded-xl overflow-hidden shadow-sm">
      <div
        className="flex items-center justify-between p-4 bg-gradient-to-r from-teal-100 to-teal-50 dark:from-teal-900/30 dark:to-teal-800/20 cursor-pointer hover:from-teal-200 hover:to-teal-100 dark:hover:from-teal-900/40 dark:hover:to-teal-800/30 transition-all"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <IconChevron open={isOpen} />
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-lg text-slate-800 dark:text-slate-100 truncate">{niveau.titre}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              {sujets.length} sujet{sujets.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <ItemActions
          onMoveUp={() => onMove('up')}
          onMoveDown={() => onMove('down')}
          onEdit={onEdit}
          onDelete={onDelete}
          canMoveUp={index > 0}
          canMoveDown={index < total - 1}
        />
      </div>

      <Collapse open={isOpen}>
        <div className="p-5 space-y-4 bg-white dark:bg-slate-900">
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={onAddSujet}>
              <IconPlus />
              Ajouter un sujet
            </Button>
          </div>
          {sujets.length === 0 ? (
            <p className="text-center text-slate-500 py-6">Aucun sujet</p>
          ) : (
            sujets.map((sujet, idx) => (
              <SujetItem
                key={sujet.id}
                sujet={sujet}
                index={idx}
                total={sujets.length}
                isOpen={openSujets.has(sujet.id)}
                onToggle={() => onToggleSujet(sujet.id)}
                onMove={(dir) => onMoveSujet(idx, dir)}
                onEdit={() => onEditSujet(sujet)}
                onDelete={() => onDeleteSujet(sujet.id)}
                onAddChapitre={() => onAddChapitre(sujet.id)}
                onEditChapitre={onEditChapitre}
                onDeleteChapitre={onDeleteChapitre}
                onMoveChapitre={(idx, dir) => onMoveChapitre(sujet.id, idx, dir)}
                onAddFeuille={onAddFeuille}
                onEditFeuille={onEditFeuille}
                onDeleteFeuille={onDeleteFeuille}
                onMoveFeuille={onMoveFeuille}
                openChapitres={openChapitres}
                onToggleChapitre={onToggleChapitre}
              />
            ))
          )}
        </div>
      </Collapse>
    </div>
  );
}

/* ---------- Page principale ---------- */
export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'bibliotheque' | 'demandes'>('bibliotheque');
  
  // États bibliothèque
  const [niveaux, setNiveaux] = useState<NiveauWithData[]>([]);
  const [openNiveaux, setOpenNiveaux] = useState<Set<string>>(new Set());
  const [openSujets, setOpenSujets] = useState<Set<string>>(new Set());
  const [openChapitres, setOpenChapitres] = useState<Set<string>>(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'niveau' | 'sujet' | 'chapitre' | 'feuille' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  
  // États demandes d'équipes
  const [demandes, setDemandes] = useState<DemandeCreation[]>([]);
  const [loadingDemandes, setLoadingDemandes] = useState(false);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  async function checkAdminAndLoadData() {
    setLoading(true);
    
    // Vérifier si l'utilisateur est admin
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert('Vous devez être connecté');
      window.location.href = '/';
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (profile?.role !== 'admin') {
      alert('⛔ Accès refusé : Cette page est réservée aux administrateurs');
      window.location.href = '/';
      return;
    }

    setIsAdmin(true);
    await Promise.all([loadData(), loadDemandes()]);
  }

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase
      .from('niveau')
      .select(
        `
        *,
        sujets:sujet (
          *,
          chapitres:chapitre (
            *,
            feuilles:feuille_entrainement (*)
          )
        )
      `
      )
      .order('ordre');

    if (!error && data) {
      // Tri des données
      data.forEach((niveau: any) => {
        niveau.sujets?.sort((a: any, b: any) => a.ordre - b.ordre);
        niveau.sujets?.forEach((sujet: any) => {
          sujet.chapitres?.sort((a: any, b: any) => a.ordre - b.ordre);
          sujet.chapitres?.forEach((chapitre: any) => {
            chapitre.feuilles?.sort((a: any, b: any) => a.ordre - b.ordre);
          });
        });
      });
      setNiveaux(data);
      // Ouvrir le premier niveau par défaut
      if (data.length > 0) {
        setOpenNiveaux(new Set([data[0].id]));
      }
    }
    setLoading(false);
  }

  async function loadDemandes() {
    setLoadingDemandes(true);
    try {
      const { data: demandesData } = await supabase
        .from('demande_creation_equipe')
        .select('*')
        .eq('statut', 'en_attente')
        .order('created_at', { ascending: false });

      if (demandesData) {
        const formatted = await Promise.all(demandesData.map(async (d: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', d.demandeur_id)
            .single();

          return {
            ...d,
            demandeur_nom: profile?.full_name || 'Utilisateur inconnu',
          };
        }));
        setDemandes(formatted);
      }
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
    }
    setLoadingDemandes(false);
  }

  async function handleApprouverDemande(demandeId: string) {
    if (!confirm('Approuver cette demande de création d\'équipe ?')) return;

    try {
      const { data, error } = await supabase.rpc('approuver_creation_equipe', {
        p_demande_id: demandeId
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.error);
        return;
      }

      alert('✅ Équipe créée avec succès !');
      loadDemandes();
    } catch (error: any) {
      console.error(error);
      alert('Erreur lors de l\'approbation: ' + error.message);
    }
  }

  async function handleRefuserDemande(demandeId: string) {
    const raison = prompt('Raison du refus :');
    if (!raison || !raison.trim()) return;

    try {
      const { data, error } = await supabase.rpc('refuser_creation_equipe', {
        p_demande_id: demandeId,
        p_raison_refus: raison
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.error);
        return;
      }

      alert('Demande refusée');
      loadDemandes();
    } catch (error: any) {
      console.error(error);
      alert('Erreur lors du refus: ' + error.message);
    }
  }

  async function moveItem(table: string, items: any[], index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;

    const item1 = items[index];
    const item2 = items[direction === 'up' ? index - 1 : index + 1];

    await supabase.from(table).update({ ordre: item2.ordre }).eq('id', item1.id);
    await supabase.from(table).update({ ordre: item1.ordre }).eq('id', item2.id);

    await loadData();
  }

  async function createItem(table: string, data: any) {
    const { error } = await supabase.from(table).insert([data]);
    if (!error) {
      await loadData();
      closeModal();
    }
  }

  async function updateItem(table: string, id: string, data: any) {
    const { error } = await supabase.from(table).update(data).eq('id', id);
    if (!error) {
      await loadData();
      closeModal();
    }
  }

  async function deleteItem(table: string, id: string, confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    
    // Si c'est une feuille, supprimer d'abord le PDF du storage
    if (table === 'feuille_entrainement') {
      const feuille = niveaux
        .flatMap(n => n.sujets || [])
        .flatMap(s => s.chapitres || [])
        .flatMap(c => c.feuilles || [])
        .find(f => f.id === id);
      
      if (feuille?.pdf_url) {
        await deletePdfFromStorage(feuille.pdf_url);
      }
    }
    
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) await loadData();
  }

  function openModal(type: 'niveau' | 'sujet' | 'chapitre' | 'feuille', item?: any, parent?: string) {
    setModalType(type);
    setEditingItem(item || null);
    setParentId(parent || null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalType(null);
    setEditingItem(null);
    setParentId(null);
  }

  function toggleSet(set: Set<string>, setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    const newSet = new Set(set);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setter(newSet);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-teal-500">
          <Loader />
          <span className="text-lg text-slate-800 dark:text-slate-100">Chargement...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight mb-2">
                <span className="text-slate-800 dark:text-white">Administration</span>
              </h1>
              <p className="text-slate-500 dark:text-slate-400">Gérez la bibliothèque et les demandes d'équipes</p>
            </div>
          </div>

          {/* Onglets */}
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('bibliotheque')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                activeTab === 'bibliotheque'
                  ? 'bg-teal-500 text-white shadow-lg'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              📚 Bibliothèque
            </button>
            <button
              onClick={() => setActiveTab('demandes')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors relative ${
                activeTab === 'demandes'
                  ? 'bg-teal-500 text-white shadow-lg'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              👥 Demandes d'équipes
              {demandes.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                  {demandes.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Contenu selon l'onglet */}
        {activeTab === 'bibliotheque' ? (
          <>
            <div className="mb-4">
              <Button onClick={() => openModal('niveau')}>
                <IconPlus />
                Nouveau niveau
              </Button>
            </div>

        {/* Contenu */}
        {niveaux.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700">
            <p className="text-slate-500 dark:text-slate-400 mb-4">Aucun niveau créé</p>
            <Button onClick={() => openModal('niveau')}>
              <IconPlus />
              Créer le premier niveau
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {niveaux.map((niveau, idx) => (
              <NiveauItem
                key={niveau.id}
                niveau={niveau}
                index={idx}
                total={niveaux.length}
                isOpen={openNiveaux.has(niveau.id)}
                onToggle={() => toggleSet(openNiveaux, setOpenNiveaux, niveau.id)}
                onMove={(dir) => moveItem('niveau', niveaux, idx, dir)}
                onEdit={() => openModal('niveau', niveau)}
                onDelete={() => deleteItem('niveau', niveau.id, 'Supprimer ce niveau et tout son contenu ?')}
                onAddSujet={() => openModal('sujet', undefined, niveau.id)}
                onEditSujet={(sujet) => openModal('sujet', sujet, niveau.id)}
                onDeleteSujet={(id) => deleteItem('sujet', id, 'Supprimer ce sujet et tout son contenu ?')}
                onMoveSujet={(idx, dir) => {
                  const sujets = niveau.sujets || [];
                  moveItem('sujet', sujets, idx, dir);
                }}
                onAddChapitre={(sujetId) => openModal('chapitre', undefined, sujetId)}
                onEditChapitre={(chapitre) => openModal('chapitre', chapitre, chapitre.sujet_id)}
                onDeleteChapitre={(id) => deleteItem('chapitre', id, 'Supprimer ce chapitre et tout son contenu ?')}
                onMoveChapitre={(sujetId, idx, dir) => {
                  const sujet = niveau.sujets?.find((s) => s.id === sujetId);
                  if (sujet?.chapitres) moveItem('chapitre', sujet.chapitres, idx, dir);
                }}
                onAddFeuille={(chapitreId) => openModal('feuille', undefined, chapitreId)}
                onEditFeuille={(feuille) => openModal('feuille', feuille, feuille.chapitre_id)}
                onDeleteFeuille={(id) => deleteItem('feuille_entrainement', id, 'Supprimer cette feuille ?')}
                onMoveFeuille={(chapitreId, idx, dir) => {
                  const chapitre = niveau.sujets
                    ?.flatMap((s) => s.chapitres || [])
                    .find((c) => c.id === chapitreId);
                  if (chapitre?.feuilles) moveItem('feuille_entrainement', chapitre.feuilles, idx, dir);
                }}
                openSujets={openSujets}
                onToggleSujet={(id) => toggleSet(openSujets, setOpenSujets, id)}
                openChapitres={openChapitres}
                onToggleChapitre={(id) => toggleSet(openChapitres, setOpenChapitres, id)}
              />
            ))}
          </div>
        )}
          </>
        ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border-2 border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        Demandes de création d'équipes
                      </h2>
                      {demandes.length > 0 && (
                        <span className="px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-semibold rounded-full">
                          {demandes.length} en attente
                        </span>
                      )}
                    </div>

                    {loadingDemandes ? (
                      <div className="text-center py-12">
                        <Loader />
                        <p className="mt-4 text-slate-600 dark:text-slate-400">Chargement...</p>
                      </div>
                    ) : demandes.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="text-6xl mb-4">✅</div>
                        <p className="text-lg font-medium">Aucune demande en attente</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {demandes.map(demande => (
                          <div key={demande.id} className="p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <h3 className="text-xl font-bold mb-1">{demande.nom_equipe}</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  Par : <span className="font-semibold">{demande.demandeur_nom}</span>
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {new Date(demande.created_at).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                                {demande.description && (
                                  <p className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-lg border">
                                    "{demande.description}"
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-3 pt-4 border-t">
                              <button
                                onClick={() => handleApprouverDemande(demande.id)}
                                className="flex-1 px-5 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg"
                              >
                                ✓ Approuver
                              </button>
                              <button
                                onClick={() => handleRefuserDemande(demande.id)}
                                className="flex-1 px-5 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg"
                              >
                                ✗ Refuser
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
      </div>

      {/* Modal */}
      {modalType && (
        <Modal
          isOpen={modalOpen}
          onClose={closeModal}
          title={
            editingItem
              ? `Modifier ${modalType === 'feuille' ? 'la feuille' : modalType === 'niveau' ? 'le niveau' : modalType === 'sujet' ? 'le sujet' : 'le chapitre'}`
              : `Nouveau${modalType === 'feuille' ? 'le feuille' : modalType === 'niveau' ? ' niveau' : modalType === 'sujet' ? ' sujet' : ' chapitre'}`
          }
        >
          <ItemForm
            type={modalType}
            initial={editingItem}
            parentId={parentId || undefined}
            onSave={(data) => {
              const table = modalType === 'feuille' ? 'feuille_entrainement' : modalType;
              return editingItem ? updateItem(table, editingItem.id, data) : createItem(table, data);
            }}
            onCancel={closeModal}
          />
        </Modal>
      )}
    </main>
  );
}