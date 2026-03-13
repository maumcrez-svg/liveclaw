'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/edit form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', iconUrl: '', imageUrl: '' });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [confirm, setConfirm] = useState<Category | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Category[]>('/categories');
      setCategories(data);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', slug: '', iconUrl: '', imageUrl: '' });
    setFormOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      iconUrl: cat.iconUrl || '',
      imageUrl: cat.imageUrl || '',
    });
    setFormOpen(true);
  };

  const handleSlugify = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      slug: editing ? f.slug : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error('Name and slug are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        iconUrl: form.iconUrl.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
      };
      if (editing) {
        await api(`/categories/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast.success('Category updated');
      } else {
        await api('/categories', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Category created');
      }
      setFormOpen(false);
      fetchCategories();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/categories/${id}`, { method: 'DELETE' });
      toast.success('Category deleted');
      setConfirm(null);
      fetchCategories();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete category');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-claw-accent hover:bg-claw-accent-hover text-white text-sm font-medium rounded transition-colors"
        >
          + New Category
        </button>
      </div>

      {/* Table */}
      <div className="border border-claw-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-claw-surface text-claw-text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Slug</th>
                <th className="text-left px-4 py-3">Icon</th>
                <th className="text-left px-4 py-3">Image</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-claw-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="w-6 h-6 border-2 border-claw-accent border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-claw-text-muted">
                    No categories yet.
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-claw-card/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {cat.iconUrl ? (
                          <img src={cat.iconUrl} alt="" className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-claw-border flex items-center justify-center text-xs text-claw-text-muted">
                            ?
                          </div>
                        )}
                        <span className="font-medium text-claw-text">{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-claw-text-muted font-mono">{cat.slug}</td>
                    <td className="px-4 py-3">
                      {cat.iconUrl ? (
                        <span className="text-xs text-green-400">Set</span>
                      ) : (
                        <span className="text-xs text-yellow-400">Missing</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {cat.imageUrl ? (
                        <span className="text-xs text-green-400">Set</span>
                      ) : (
                        <span className="text-xs text-yellow-400">Missing</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(cat)}
                          className="px-2 py-1 text-xs border border-claw-border rounded hover:bg-claw-card transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirm(cat)}
                          className="px-2 py-1 text-xs border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setFormOpen(false)}>
          <div className="bg-claw-surface border border-claw-border rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editing ? 'Edit Category' : 'New Category'}</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleSlugify(e.target.value)}
                  required
                  className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  required
                  pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                  title="Lowercase letters, numbers, and hyphens only"
                  className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text font-mono focus:outline-none focus:border-claw-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Icon URL</label>
                <input
                  type="text"
                  value={form.iconUrl}
                  onChange={(e) => setForm((f) => ({ ...f, iconUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:border-claw-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Image URL</label>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:border-claw-accent"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-claw-accent hover:bg-claw-accent-hover text-white rounded font-medium disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setConfirm(null)}>
          <div className="bg-claw-surface border border-claw-border rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Delete Category</h3>
            <p className="text-sm text-claw-text-muted mb-4">
              Are you sure you want to delete <strong>"{confirm.name}"</strong>? Agents using this category will lose their category assignment.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirm.id)}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
