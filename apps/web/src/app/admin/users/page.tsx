'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface User {
  id: string;
  username: string;
  role: string;
  isBanned: boolean;
  bannedAt: string | null;
  createdAt: string;
  avatarUrl: string | null;
}

interface UserPage {
  data: User[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [bannedFilter, setBannedFilter] = useState('');
  const [page, setPage] = useState(1);

  // Confirmation modal
  const [confirm, setConfirm] = useState<{ action: string; userId: string; username: string } | null>(null);
  const [roleModal, setRoleModal] = useState<{ userId: string; username: string; currentRole: string } | null>(null);
  const [newRole, setNewRole] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let result: UserPage;
      if (search.trim()) {
        result = await api(`/admin/users/search?q=${encodeURIComponent(search.trim())}&page=${page}&limit=20`);
      } else {
        const params = new URLSearchParams({ page: String(page), limit: '20' });
        if (roleFilter) params.set('role', roleFilter);
        if (bannedFilter) params.set('banned', bannedFilter);
        result = await api(`/admin/users?${params}`);
      }
      setUsers(result.data);
      setMeta(result.meta);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, bannedFilter, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, roleFilter, bannedFilter]);

  const handleBan = async (userId: string) => {
    try {
      await api(`/admin/users/${userId}/ban`, { method: 'PATCH' });
      toast.success('User banned');
      setConfirm(null);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to ban user');
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      await api(`/admin/users/${userId}/unban`, { method: 'PATCH' });
      toast.success('User unbanned');
      setConfirm(null);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to unban user');
    }
  };

  const handleRoleChange = async () => {
    if (!roleModal || !newRole) return;
    try {
      await api(`/admin/users/${roleModal.userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      toast.success(`Role changed to ${newRole}`);
      setRoleModal(null);
      setNewRole('');
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to change role');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Users</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text placeholder:text-claw-text-muted focus:outline-none focus:border-claw-accent w-64"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
        >
          <option value="">All roles</option>
          <option value="viewer">Viewer</option>
          <option value="creator">Creator</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={bannedFilter}
          onChange={(e) => setBannedFilter(e.target.value)}
          className="bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent"
        >
          <option value="">All statuses</option>
          <option value="false">Active</option>
          <option value="true">Banned</option>
        </select>
        <span className="text-xs text-claw-text-muted self-center ml-auto">
          {meta.total} user{meta.total !== 1 ? 's' : ''} found
        </span>
      </div>

      {/* Table */}
      <div className="border border-claw-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-claw-surface text-claw-text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Joined</th>
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
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-claw-text-muted">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-claw-card/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-claw-accent/20 flex items-center justify-center text-xs font-bold text-claw-accent shrink-0">
                          {u.username[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-claw-text">{u.username}</p>
                          <p className="text-xs text-claw-text-muted font-mono">{u.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                        u.role === 'creator' ? 'bg-claw-accent/20 text-claw-accent' :
                        'bg-claw-border text-claw-text-muted'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.isBanned ? (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
                          Banned
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-claw-text-muted text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setRoleModal({ userId: u.id, username: u.username, currentRole: u.role }); setNewRole(u.role); }}
                          className="px-2 py-1 text-xs border border-claw-border rounded hover:bg-claw-card transition-colors"
                          disabled={u.role === 'admin'}
                          title={u.role === 'admin' ? 'Cannot change admin role' : 'Change role'}
                        >
                          Role
                        </button>
                        {u.isBanned ? (
                          <button
                            onClick={() => setConfirm({ action: 'unban', userId: u.id, username: u.username })}
                            className="px-2 py-1 text-xs border border-green-500/30 text-green-400 rounded hover:bg-green-500/10 transition-colors"
                          >
                            Unban
                          </button>
                        ) : u.role !== 'admin' ? (
                          <button
                            onClick={() => setConfirm({ action: 'ban', userId: u.id, username: u.username })}
                            className="px-2 py-1 text-xs border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition-colors"
                          >
                            Ban
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-claw-text-muted">
            Page {meta.page} of {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-xs border border-claw-border rounded hover:bg-claw-card disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className="px-3 py-1 text-xs border border-claw-border rounded hover:bg-claw-card disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Ban/Unban confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setConfirm(null)}>
          <div className="bg-claw-surface border border-claw-border rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">
              {confirm.action === 'ban' ? 'Ban User' : 'Unban User'}
            </h3>
            <p className="text-sm text-claw-text-muted mb-4">
              {confirm.action === 'ban'
                ? `Are you sure you want to ban "${confirm.username}"? They will be immediately locked out of their account.`
                : `Are you sure you want to unban "${confirm.username}"? They will regain access to the platform.`
              }
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirm.action === 'ban' ? handleBan(confirm.userId) : handleUnban(confirm.userId)}
                className={`px-4 py-2 text-sm rounded font-medium transition-colors ${
                  confirm.action === 'ban'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {confirm.action === 'ban' ? 'Ban User' : 'Unban User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role change modal */}
      {roleModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setRoleModal(null)}>
          <div className="bg-claw-surface border border-claw-border rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Change Role</h3>
            <p className="text-sm text-claw-text-muted mb-4">
              Change role for <strong>{roleModal.username}</strong>
            </p>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full bg-claw-bg border border-claw-border rounded px-3 py-2 text-sm text-claw-text focus:outline-none focus:border-claw-accent mb-4"
            >
              <option value="viewer">Viewer</option>
              <option value="creator">Creator</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRoleModal(null)}
                className="px-4 py-2 text-sm border border-claw-border rounded hover:bg-claw-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleChange}
                disabled={newRole === roleModal.currentRole}
                className="px-4 py-2 text-sm bg-claw-accent hover:bg-claw-accent-hover text-white rounded font-medium disabled:opacity-40 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
