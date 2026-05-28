import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  rvcModel: string;
  indexFile: string;
  onChange: (key: 'rvcModel' | 'indexFile', value: string) => void;
}

interface Models {
  pth: string[];
  index: string[];
}

export function SettingsPanel({ open, onClose, rvcModel, indexFile, onChange }: Props) {
  const [models, setModels] = useState<Models>({ pth: [], index: [] });

  useEffect(() => {
    fetch(`${API_BASE_URL}/models`)
      .then(r => r.json())
      .then(setModels)
      .catch(() => {});
  }, []);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
      />
      <div className="fixed top-0 left-0 h-full w-72 bg-gray-900 border-r border-gray-700 shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="font-semibold text-gray-200 text-sm flex items-center gap-2">
            <span>🎤</span> Voice Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-lg leading-none p-1 rounded transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
          <div>
            <label className="block text-gray-400 mb-1.5 text-xs font-semibold uppercase tracking-wider">
              RVC Model (.pth)
            </label>
            <select
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
              value={rvcModel}
              onChange={e => onChange('rvcModel', e.target.value)}
            >
              <option value="">(デフォルト)</option>
              {models.pth.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            {models.pth.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">models/rvc/ にモデルが見つかりません</p>
            )}
          </div>

          <div>
            <label className="block text-gray-400 mb-1.5 text-xs font-semibold uppercase tracking-wider">
              Index File (.index)
            </label>
            <select
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
              value={indexFile}
              onChange={e => onChange('indexFile', e.target.value)}
            >
              <option value="">(なし)</option>
              {models.index.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="pt-2 border-t border-gray-700">
            <p className="text-xs text-gray-500 leading-relaxed">
              「音声分離」ステップ実行前にボイスモデルを選択してください。
              変更後は「音声分離」ステップを再実行することで反映されます。
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
