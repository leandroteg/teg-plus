import { useState, useEffect } from 'react'
import { X, Save, Loader2, Sparkles, Pencil } from 'lucide-react'
import AiDropZone from './AiDropZone'

type Mode = 'ai' | 'manual'

interface MagicModalProps {
  title: string
  isNew: boolean
  aiEnabled?: boolean
  showCnpjField?: boolean
  showCpfField?: boolean
  entityLabel: string
  onClose: () => void
  onSave: () => void
  saving: boolean
  onAiParse: (input: { type: string; content: string; base64?: string; filename?: string }) => void
  aiParsing: boolean
  aiDone?: boolean
  children: React.ReactNode
}

export default function MagicModal({
  title, isNew, aiEnabled = true, showCnpjField, showCpfField,
  entityLabel, onClose, onSave, saving,
  onAiParse, aiParsing, aiDone, children,
}: MagicModalProps) {
  const [mode, setMode] = useState<Mode>(isNew && aiEnabled ? 'ai' : 'manual')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // After AI finishes, show form fields
  const showForm = mode === 'manual' || aiDone

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-extrabold text-slate-800">{title}</h2>
            {aiEnabled && (
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setMode('ai')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    mode === 'ai'
                      ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Sparkles size={12} /> AI
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    mode === 'manual'
                      ? 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Pencil size={12} /> Manual
                </button>
              </div>
            )}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6">
          {mode === 'ai' && aiEnabled && (
            <AiDropZone
              onParse={onAiParse}
              parsing={aiParsing}
              entityLabel={entityLabel}
              showCnpjField={showCnpjField}
              showCpfField={showCpfField}
            />
          )}

          {showForm && (
            <div className={mode === 'ai' ? 'mt-6 pt-6 border-t border-slate-100' : ''}>
              {children}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold
              text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700
              text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
