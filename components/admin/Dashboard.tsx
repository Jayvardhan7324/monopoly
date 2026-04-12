import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { LayoutGrid, LogOut, Globe, Trash2, Upload, Plus, Radio, Users, ShoppingBag, Ban, Shield, Coins, Edit2, X, Check, Package } from 'lucide-react';
import BoardBuilder from './BoardBuilder';
import type { CustomBoard } from './types';

interface UserRow {
  id: string; name: string; email: string; role: string | null;
  banned: boolean | null; banReason: string | null; createdAt: string | null; coins: number;
}
interface StoreItemRow {
  id: string; name: string; description: string; type: string;
  priceCoins: number; assetUrl: string | null; active: boolean; createdAt: string;
}
const ITEM_TYPES = ['avatar', 'board_skin', 'token', 'misc'];

interface Props {
  token: string;
  onLogout: () => void;
}

const Dashboard: React.FC<Props> = ({ token, onLogout }) => {
  const [boards, setBoards] = useState<CustomBoard[]>([]);
  const [activeBoard, setActiveBoard] = useState<CustomBoard | null>(null);
  const [editingBoard, setEditingBoard] = useState<CustomBoard | null>(null);
  const [tab, setTab] = useState('overview');

  // Users tab
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Store tab
  const [storeItems, setStoreItems] = useState<StoreItemRow[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItemRow | null>(null);
  const [itemForm, setItemForm] = useState({ name: '', description: '', type: 'avatar', priceCoins: 100, assetUrl: '' });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-admin-token': token,
  };

  const fetchBoards = async () => {
    try {
      const res = await fetch('/api/admin/boards', { headers });
      if (!res.ok) { toast.error('Session expired — please log in again'); return; }
      const data = await res.json();
      setBoards(data.boards || []);
      setActiveBoard(data.activeBoard || null);
    } catch {
      toast.error('Failed to load boards');
    }
  };

  useEffect(() => { fetchBoards(); }, []);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/admin/users', { headers });
      if (!res.ok) { toast.error('Failed to load users'); return; }
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch { toast.error('Failed to load users'); }
    finally { setUsersLoading(false); }
  };

  const updateUser = async (id: string, updates: Partial<UserRow>) => {
    try {
      await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers, body: JSON.stringify(updates) });
      toast.success('User updated');
      fetchUsers();
    } catch { toast.error('Failed to update user'); }
  };

  const fetchStoreItems = async () => {
    setStoreLoading(true);
    try {
      const res = await fetch('/api/admin/store/items', { headers });
      const data = await res.json();
      setStoreItems(data.items ?? []);
    } catch { toast.error('Failed to load store items'); }
    finally { setStoreLoading(false); }
  };

  const saveItem = async () => {
    if (!itemForm.name || !itemForm.type) { toast.error('Name and type are required'); return; }
    try {
      if (editingItem) {
        await fetch(`/api/admin/store/items/${editingItem.id}`, { method: 'PATCH', headers, body: JSON.stringify(itemForm) });
        toast.success('Item updated');
      } else {
        await fetch('/api/admin/store/items', { method: 'POST', headers, body: JSON.stringify(itemForm) });
        toast.success('Item created');
      }
      setShowItemForm(false); setEditingItem(null); setItemForm({ name: '', description: '', type: 'avatar', priceCoins: 100, assetUrl: '' });
      fetchStoreItems();
    } catch { toast.error('Failed to save item'); }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Deactivate this item?')) return;
    try {
      await fetch(`/api/admin/store/items/${id}`, { method: 'DELETE', headers });
      toast.success('Item deactivated');
      fetchStoreItems();
    } catch { toast.error('Failed to deactivate item'); }
  };

  useEffect(() => {
    if (tab === 'users') fetchUsers();
    if (tab === 'store') fetchStoreItems();
  }, [tab]);

  const pushBoard = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/boards/${id}/push`, { method: 'POST', headers });
      const data = await res.json();
      if (data.success) {
        toast.success('Board pushed to all players!');
        fetchBoards();
      }
    } catch {
      toast.error('Failed to push board');
    }
  };

  const deleteBoard = async (id: string) => {
    if (!confirm('Delete this board?')) return;
    try {
      await fetch(`/api/admin/boards/${id}`, { method: 'DELETE', headers });
      toast.success('Board deleted');
      fetchBoards();
    } catch {
      toast.error('Failed to delete board');
    }
  };

  const saveBoard = async (board: Omit<CustomBoard, 'id' | 'createdAt'>) => {
    try {
      if (editingBoard?.id) {
        await fetch(`/api/admin/boards/${editingBoard.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(board),
        });
        toast.success('Board updated!');
      } else {
        await fetch('/api/admin/boards', {
          method: 'POST',
          headers,
          body: JSON.stringify(board),
        });
        toast.success('Board saved!');
      }
      setEditingBoard(null);
      setTab('boards');
      fetchBoards();
    } catch {
      toast.error('Failed to save board');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">Cashly Admin</span>
            {activeBoard && (
              <>
                <Separator orientation="vertical" className="h-5 mx-1" />
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Radio className="h-3 w-3 text-green-500 animate-pulse" />
                  <span>{activeBoard.name} active</span>
                </div>
              </>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="builder">Board Builder</TabsTrigger>
            <TabsTrigger value="boards">
              Saved Boards
              {boards.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                  {boards.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Users
            </TabsTrigger>
            <TabsTrigger value="store">
              <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
              Store
            </TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Board</CardDescription>
                  <CardTitle className="text-xl">
                    {activeBoard ? activeBoard.name : 'Classic (default)'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={activeBoard ? 'default' : 'secondary'}>
                    {activeBoard ? `${activeBoard.tiles.length} tiles` : 'Built-in'}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Saved Boards</CardDescription>
                  <CardTitle className="text-xl">{boards.length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-muted-foreground">Custom configurations</span>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Quick Actions</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <Button size="sm" onClick={() => { setEditingBoard(null); setTab('builder'); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Board
                  </Button>
                  {boards.length > 0 && !activeBoard && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => pushBoard(boards[0].id)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Push Latest
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {activeBoard && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-green-500" />
                    <CardTitle>Live: {activeBoard.name}</CardTitle>
                  </div>
                  <CardDescription>
                    New games will use this board until you push a different one.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="outline">{activeBoard.boardSize}×{activeBoard.boardSize}</Badge>
                    <Badge variant="outline">{activeBoard.tiles.length} tiles</Badge>
                    <Badge variant="outline">
                      Pushed {new Date(activeBoard.createdAt).toLocaleDateString()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Board Builder ── */}
          <TabsContent value="builder">
            <BoardBuilder
              initialBoard={editingBoard}
              onSave={saveBoard}
              onCancel={() => { setEditingBoard(null); setTab('boards'); }}
            />
          </TabsContent>

          {/* ── Saved Boards ── */}
          <TabsContent value="boards">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Saved Boards</h2>
              <Button onClick={() => { setEditingBoard(null); setTab('builder'); }}>
                <Plus className="h-4 w-4 mr-2" />
                New Board
              </Button>
            </div>
            {boards.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  No boards saved yet. Create one in the Board Builder.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {boards.map(board => (
                  <Card key={board.id} className={activeBoard?.id === board.id ? 'border-primary/50' : ''}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{board.name}</p>
                            {activeBoard?.id === board.id && (
                              <Badge variant="default" className="text-xs">Live</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {board.boardSize}×{board.boardSize} · {board.tiles.length} tiles ·
                            Created {new Date(board.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setEditingBoard(board); setTab('builder'); }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => pushBoard(board.id)}
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Push
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteBoard(board.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          {/* ── Users ── */}
          <TabsContent value="users">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-xl font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> User Management</h2>
              <input
                className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring w-56"
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>
            {usersLoading ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Loading users…</CardContent></Card>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {['Name', 'Email', 'Role', 'Coins', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter(u => !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()))
                      .map((u, i) => (
                        <tr key={u.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          <td className="px-4 py-2.5 font-medium">{u.name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-2.5">
                            <select
                              value={u.role ?? 'user'}
                              onChange={e => updateUser(u.id, { role: e.target.value })}
                              className="bg-background border border-border rounded px-2 py-0.5 text-xs"
                            >
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1">
                              <Coins className="h-3.5 w-3.5 text-amber-500" />
                              <span>{u.coins}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant={u.banned ? 'destructive' : 'secondary'}>
                              {u.banned ? 'Banned' : 'Active'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1.5">
                              {u.banned ? (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateUser(u.id, { banned: false, banReason: null })}>
                                  <Check className="h-3 w-3 mr-1" /> Unban
                                </Button>
                              ) : (
                                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => {
                                  const reason = prompt('Ban reason?');
                                  if (reason !== null) updateUser(u.id, { banned: true, banReason: reason });
                                }}>
                                  <Ban className="h-3 w-3 mr-1" /> Ban
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">No users yet.</div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Store ── */}
          <TabsContent value="store">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2"><ShoppingBag className="h-5 w-5" /> Store Management</h2>
              <Button size="sm" onClick={() => { setEditingItem(null); setItemForm({ name: '', description: '', type: 'avatar', priceCoins: 100, assetUrl: '' }); setShowItemForm(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>

            {/* Item form */}
            {showItemForm && (
              <Card className="mb-4 border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{editingItem ? 'Edit Item' : 'New Item'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Name', key: 'name', type: 'text' },
                      { label: 'Description', key: 'description', type: 'text' },
                      { label: 'Asset URL', key: 'assetUrl', type: 'text' },
                    ].map(({ label, key, type }) => (
                      <div key={key}>
                        <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                        <input
                          type={type}
                          value={(itemForm as any)[key]}
                          onChange={e => setItemForm(f => ({ ...f, [key]: e.target.value }))}
                          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                      <select value={itemForm.type} onChange={e => setItemForm(f => ({ ...f, type: e.target.value }))}
                        className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-lg">
                        {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Price (coins)</label>
                      <input type="number" value={itemForm.priceCoins} min={0}
                        onChange={e => setItemForm(f => ({ ...f, priceCoins: Number(e.target.value) }))}
                        className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-lg" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" onClick={saveItem}><Check className="h-4 w-4 mr-1" />Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowItemForm(false); setEditingItem(null); }}>
                      <X className="h-4 w-4 mr-1" />Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {storeLoading ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Loading store items…</CardContent></Card>
            ) : storeItems.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                No store items yet. Create one above.
              </CardContent></Card>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {['Name', 'Type', 'Price', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {storeItems.map((item, i) => (
                      <tr key={item.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                        <td className="px-4 py-2.5 font-medium">
                          <div className="flex items-center gap-2">
                            {item.assetUrl && <img src={item.assetUrl} className="h-7 w-7 rounded object-cover border border-border" alt="" />}
                            <div>
                              <p>{item.name}</p>
                              {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><Badge variant="outline">{item.type}</Badge></td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1"><Coins className="h-3.5 w-3.5 text-amber-500" />{item.priceCoins}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={item.active ? 'default' : 'secondary'}>{item.active ? 'Active' : 'Hidden'}</Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                              setEditingItem(item);
                              setItemForm({ name: item.name, description: item.description, type: item.type, priceCoins: item.priceCoins, assetUrl: item.assetUrl ?? '' });
                              setShowItemForm(true);
                            }}>
                              <Edit2 className="h-3 w-3 mr-1" />Edit
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteItem(item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
