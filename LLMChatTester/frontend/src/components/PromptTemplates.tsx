import { useState, useEffect } from 'react';
import type { PromptTemplate } from '../types';

const STORAGE_KEY = 'llm-chat-tester-templates';

interface PromptTemplatesProps {
  onSelectTemplate: (prompt: string) => void;
  currentPrompt?: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function PromptTemplates({ onSelectTemplate, currentPrompt }: PromptTemplatesProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formCategory, setFormCategory] = useState('');

  // Load templates from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setTemplates(JSON.parse(stored));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Save templates to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  }, [templates]);

  const resetForm = () => {
    setFormName('');
    setFormPrompt('');
    setFormCategory('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!formName.trim() || !formPrompt.trim()) return;

    if (editingId) {
      setTemplates(prev =>
        prev.map(t =>
          t.id === editingId
            ? { ...t, name: formName.trim(), prompt: formPrompt.trim(), category: formCategory.trim() || undefined }
            : t
        )
      );
    } else {
      const newTemplate: PromptTemplate = {
        id: generateId(),
        name: formName.trim(),
        prompt: formPrompt.trim(),
        category: formCategory.trim() || undefined,
        createdAt: Date.now(),
      };
      setTemplates(prev => [...prev, newTemplate]);
    }
    resetForm();
  };

  const handleEdit = (template: PromptTemplate) => {
    setEditingId(template.id);
    setFormName(template.name);
    setFormPrompt(template.prompt);
    setFormCategory(template.category || '');
    setIsAdding(true);
  };

  const handleDelete = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (editingId === id) {
      resetForm();
    }
  };

  const handleSaveCurrentPrompt = () => {
    if (!currentPrompt?.trim()) return;
    setFormPrompt(currentPrompt);
    setFormName('');
    setFormCategory('');
    setEditingId(null);
    setIsAdding(true);
  };

  // Group templates by category
  const groupedTemplates = templates.reduce<Record<string, PromptTemplate[]>>((acc, template) => {
    const category = template.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(template);
    return acc;
  }, {});

  const categories = Object.keys(groupedTemplates).sort((a, b) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">Prompt Templates</h2>
          <div className="flex gap-2">
            {currentPrompt?.trim() && !isAdding && (
              <button
                onClick={handleSaveCurrentPrompt}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
              >
                Save Current
              </button>
            )}
            {!isAdding && (
              <button
                onClick={() => setIsAdding(true)}
                className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
              >
                + New Template
              </button>
            )}
          </div>
        </div>

        {/* Add/Edit Form */}
        {isAdding && (
          <div className="mb-3 p-3 bg-gray-750 rounded border border-gray-600">
            <div className="grid grid-cols-2 gap-3 mb-2">
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Template name"
                className="px-2 py-1 text-sm bg-gray-700 text-gray-200 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
              <input
                type="text"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="Category (optional)"
                className="px-2 py-1 text-sm bg-gray-700 text-gray-200 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <textarea
              value={formPrompt}
              onChange={(e) => setFormPrompt(e.target.value)}
              placeholder="Prompt text..."
              rows={3}
              className="w-full px-2 py-1 text-sm bg-gray-700 text-gray-200 rounded border border-gray-600 resize-none focus:border-blue-500 focus:outline-none mb-2"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!formName.trim() || !formPrompt.trim()}
                className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingId ? 'Update' : 'Save'}
              </button>
              <button
                onClick={resetForm}
                className="text-xs px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Templates List */}
        {templates.length === 0 && !isAdding ? (
          <p className="text-xs text-gray-500">No templates saved. Create one to get started.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => (
              <div key={category}>
                {categories.length > 1 && (
                  <div className="text-xs text-gray-500 mb-1">{category}</div>
                )}
                <div className="flex flex-wrap gap-2">
                  {groupedTemplates[category].map((template) => (
                    <div
                      key={template.id}
                      className="group relative"
                    >
                      <button
                        onClick={() => onSelectTemplate(template.prompt)}
                        className="text-xs px-3 py-1.5 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors pr-14"
                        title={template.prompt}
                      >
                        {template.name}
                      </button>
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(template);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-200"
                          title="Edit"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(template.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-400"
                          title="Delete"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
