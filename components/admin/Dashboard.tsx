import React, { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  LayoutGrid, LogOut, Globe, Trash2, Upload, Plus, Radio, Users, ShoppingBag,
  Ban, Shield, Coins, Edit2, X, Check, Package, BarChart3, TrendingUp,
  UserCheck, UserX, Crown, Minus, RefreshCw, Flag, AlertCircle, Database,
  Megaphone, Eye, MousePointerClick, Image as ImageIcon, Code2, Power, ExternalLink, Sparkles,
} from 'lucide-react';
import BoardBuilder from './BoardBuilder';
import type { CustomBoard } from './types';
import {
  VISUAL_DEFAULTS,
  cacheVisualSettings,
  loadCachedVisualSettings,
  normalizeVisualSettings,
  type VisualSettings,
} from '@/services/visualSettings';

interface AdRow {
  id: string;
  name: string;
  placement: string;
  imageUrl: string | null;
  linkUrl: string | null;
  htmlSnippet: string | null;
  altText: string | null;
  weight: number;
  enabled: boolean;
  impressions: number;
  clicks: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

const PLACEMENT_LABELS: Record<string, string> = {
  lobby_top: 'Lobby — Top Banner',
  lobby_bottom: 'Lobby — Above Footer',
  lobby_sidebar: 'Lobby — Sidebar',
  game_sidebar: 'In-Game — Sidebar',
  game_footer: 'In-Game — Footer Bar',
  global_header: 'Global Header',
  global_footer: 'Global Footer',
  store_top: 'Store — Top of Page',
  profile_top: 'Profile — Top of Page',
};

interface UserRow {
  id: string; name: string; email: string; role: string | null;
  banned: boolean | null; banReason: string | null; createdAt: string | null; coins: number;
}
interface StoreItemRow {
  id: string; name: string; description: string; type: string;
  priceCoins: number; assetUrl: string | null; active: boolean; createdAt: string;
}
interface Analytics {
  totalUsers: number; totalGamesPlayed: number; totalWins: number;
  totalCoins: number; avgCoins: number; bannedCount: number;
  topEarners: { name: string; coins: number }[];
  recentUsers: { name: string; email: string; createdAt: string }[];
}

const ITEM_TYPES = ['avatar', 'board_skin', 'token', 'profile_pic', 'misc'];

// ── Visual settings ──────────────────────────────────────────────────────────
interface Props { token: string; onLogout: () => void; }

const Dashboard: React.FC<Props> = ({ token, onLogout }) => {
  const [boards, setBoards] = useState<CustomBoard[]>([]);
  const [activeBoard, setActiveBoard] = useState<CustomBoard | null>(null);
  const [editingBoard, setEditingBoard] = useState<CustomBoard | null>(null);
  const [tab, setTab] = useState('overview');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-admin-token': token };

  // Visual tab
  const [visual, setVisual] = useState<VisualSettings>(loadCachedVisualSettings);
  const [visualSaving, setVisualSaving] = useState(false);
  const visualSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visualSaveSeqRef = useRef(0);

  const persistVisual = (settings: VisualSettings) => {
    if (visualSaveTimerRef.current) clearTimeout(visualSaveTimerRef.current);
    const seq = ++visualSaveSeqRef.current;
    visualSaveTimerRef.current = setTimeout(async () => {
      setVisualSaving(true);
      try {
        const res = await fetch('/api/admin/visual-settings', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ settings }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error || 'Failed to save visual settings');
          return;
        }
        const saved = cacheVisualSettings(data.settings ?? settings);
        if (seq === visualSaveSeqRef.current) setVisual(saved);
      } catch {
        toast.error('Failed to save visual settings');
      } finally {
        if (seq === visualSaveSeqRef.current) setVisualSaving(false);
      }
    }, 250);
  };

  const updateVisual = (patch: Partial<VisualSettings>) => {
    setVisual(prev => {
      const next = normalizeVisualSettings({ ...prev, ...patch });
      cacheVisualSettings(next);
      persistVisual(next);
      return next;
    });
  };

  useEffect(() => () => {
    if (visualSaveTimerRef.current) clearTimeout(visualSaveTimerRef.current);
  }, []);

  // Users tab
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ name: '', coins: 0, role: 'user', banned: false, banReason: '', addCoins: '' });

  // Analytics tab
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Bug reports tab
  const [bugReports, setBugReports] = useState<any[]>([]);
  const [bugsLoading, setBugsLoading] = useState(false);

  // Ads tab
  const [ads, setAds] = useState<AdRow[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adPlacements, setAdPlacements] = useState<string[]>([]);
  const [adFilter, setAdFilter] = useState<string>('all');
  const [showAdForm, setShowAdForm] = useState(false);
  const [editingAd, setEditingAd] = useState<AdRow | null>(null);
  const blankAdForm = {
    name: '', placement: 'lobby_bottom', imageUrl: '', linkUrl: '',
    htmlSnippet: '', altText: '', weight: 1, enabled: true,
    startsAt: '', endsAt: '',
  };
  const [adForm, setAdForm] = useState(blankAdForm);

  // DB health probe
  const [dbTest, setDbTest] = useState<null | {
    ok: boolean;
    dbUrlHost?: string;
    dbVersion?: string;
    checks: Array<{ name: string; ok: boolean; ms: number; detail?: string }>;
    tableCounts?: Record<string, number | string>;
    error?: string;
  }>(null);
  const [dbTestLoading, setDbTestLoading] = useState(false);

  const runDbTest = async () => {
    setDbTestLoading(true);
    setDbTest(null);
    try {
      const res = await fetch('/api/admin/db-test', { method: 'POST', headers });
      const data = await res.json().catch(() => null);
      if (!data) { setDbTest({ ok: false, checks: [], error: `HTTP ${res.status}` }); return; }
      setDbTest(data);
      if (data.ok) toast.success('Database healthy');
      else toast.error('Database checks failed — see details');
    } catch (e: any) {
      setDbTest({ ok: false, checks: [], error: e?.message ?? 'Network error' });
      toast.error('Failed to reach /api/admin/db-test');
    } finally {
      setDbTestLoading(false);
    }
  };

  // Store tab
  const [storeItems, setStoreItems] = useState<StoreItemRow[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItemRow | null>(null);
  const [itemForm, setItemForm] = useState({ name: '', description: '', type: 'avatar', priceCoins: 100, assetUrl: '', active: true });

  const fetchVisual = async () => {
    try {
      const res = await fetch('/api/admin/visual-settings', { headers });
      if (!res.ok) return;
      const data = await res.json();
      const settings = cacheVisualSettings(data.settings);
      setVisual(settings);
    } catch {}
  };

  const fetchBoards = async () => {
    try {
      const res = await fetch('/api/admin/boards', { headers });
      if (!res.ok) { toast.error('Session expired — please log in again'); return; }
      const data = await res.json();
      setBoards(data.boards || []);
      setActiveBoard(data.activeBoard || null);
    } catch { toast.error('Failed to load boards'); }
  };
  useEffect(() => { fetchBoards(); fetchVisual(); }, []);

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

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch('/api/admin/analytics', { headers });
      if (!res.ok) { toast.error('Failed to load analytics'); return; }
      const data = await res.json();
      setAnalytics(data);
    } catch { toast.error('Failed to load analytics'); }
    finally { setAnalyticsLoading(false); }
  };

  const updateUser = async (id: string, updates: Record<string, any>) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers, body: JSON.stringify(updates) });
      if (!res.ok) throw new Error();
      toast.success('User updated');
      fetchUsers();
    } catch { toast.error('Failed to update user'); }
  };

  const saveUserEdit = async () => {
    if (!editingUser) return;
    const updates: Record<string, any> = {
      name: editForm.name,
      role: editForm.role,
      banned: editForm.banned,
      banReason: editForm.banned ? editForm.banReason : null,
      coins: editForm.coins,
    };
    if (editForm.addCoins !== '' && Number(editForm.addCoins) !== 0) {
      updates.addCoins = Number(editForm.addCoins);
      delete updates.coins;
    }
    await updateUser(editingUser.id, updates);
    setEditingUser(null);
  };

  const openEditUser = (u: UserRow) => {
    setEditingUser(u);
    setEditForm({ name: u.name || '', coins: u.coins || 0, role: u.role || 'user', banned: u.banned || false, banReason: u.banReason || '', addCoins: '' });
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
    if (!Number.isFinite(Number(itemForm.priceCoins)) || Number(itemForm.priceCoins) < 0) {
      toast.error('Price must be a non-negative number'); return;
    }
    try {
      const res = editingItem
        ? await fetch(`/api/admin/store/items/${editingItem.id}`, { method: 'PATCH', headers, body: JSON.stringify(itemForm) })
        : await fetch('/api/admin/store/items', { method: 'POST', headers, body: JSON.stringify(itemForm) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to save item');
        return;
      }
      toast.success(editingItem ? 'Item updated' : 'Item created');
      setShowItemForm(false); setEditingItem(null);
      setItemForm({ name: '', description: '', type: 'avatar', priceCoins: 100, assetUrl: '', active: true });
      fetchStoreItems();
    } catch { toast.error('Failed to save item'); }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Deactivate this item?')) return;
    try {
      const res = await fetch(`/api/admin/store/items/${id}`, { method: 'DELETE', headers });
      if (!res.ok) { toast.error('Failed to deactivate item'); return; }
      toast.success('Item deactivated');
      fetchStoreItems();
    } catch { toast.error('Failed to deactivate item'); }
  };

  const fetchBugReports = async () => {
    setBugsLoading(true);
    try {
      const res = await fetch('/api/admin/bug-reports', { headers });
      const data = await res.json();
      setBugReports(data.reports ?? []);
    } catch { toast.error('Failed to load bug reports'); }
    finally { setBugsLoading(false); }
  };

  const updateBugStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/admin/bug-reports/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ status }) });
      toast.success('Status updated');
      fetchBugReports();
    } catch { toast.error('Failed to update status'); }
  };

  const fetchAds = async () => {
    setAdsLoading(true);
    try {
      const res = await fetch('/api/admin/ads', { headers });
      if (!res.ok) { toast.error('Failed to load ads'); return; }
      const data = await res.json();
      setAds(data.ads ?? []);
      setAdPlacements(data.placements ?? Object.keys(PLACEMENT_LABELS));
    } catch { toast.error('Failed to load ads'); }
    finally { setAdsLoading(false); }
  };

  const openAdForm = (ad: AdRow | null) => {
    setEditingAd(ad);
    if (ad) {
      setAdForm({
        name: ad.name,
        placement: ad.placement,
        imageUrl: ad.imageUrl ?? '',
        linkUrl: ad.linkUrl ?? '',
        htmlSnippet: ad.htmlSnippet ?? '',
        altText: ad.altText ?? '',
        weight: ad.weight,
        enabled: ad.enabled,
        startsAt: ad.startsAt ? ad.startsAt.slice(0, 16) : '',
        endsAt: ad.endsAt ? ad.endsAt.slice(0, 16) : '',
      });
    } else {
      setAdForm(blankAdForm);
    }
    setShowAdForm(true);
  };

  const saveAd = async () => {
    if (!adForm.name.trim()) { toast.error('Name required'); return; }
    if (!adForm.placement) { toast.error('Placement required'); return; }
    if (!adForm.imageUrl.trim() && !adForm.htmlSnippet.trim()) {
      toast.error('Provide either an image URL or HTML snippet');
      return;
    }
    const body: Record<string, any> = {
      name: adForm.name,
      placement: adForm.placement,
      imageUrl: adForm.imageUrl || null,
      linkUrl: adForm.linkUrl || null,
      htmlSnippet: adForm.htmlSnippet || null,
      altText: adForm.altText || null,
      weight: Number(adForm.weight) || 1,
      enabled: adForm.enabled,
      startsAt: adForm.startsAt || null,
      endsAt: adForm.endsAt || null,
    };
    try {
      const res = editingAd
        ? await fetch(`/api/admin/ads/${editingAd.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
        : await fetch('/api/admin/ads', { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to save ad');
        return;
      }
      toast.success(editingAd ? 'Ad updated' : 'Ad created');
      setShowAdForm(false);
      setEditingAd(null);
      fetchAds();
    } catch { toast.error('Failed to save ad'); }
  };

  const toggleAdEnabled = async (ad: AdRow) => {
    try {
      const res = await fetch(`/api/admin/ads/${ad.id}`, {
        method: 'PATCH', headers, body: JSON.stringify({ enabled: !ad.enabled }),
      });
      if (!res.ok) { toast.error('Failed to toggle'); return; }
      toast.success(!ad.enabled ? 'Ad enabled' : 'Ad paused');
      fetchAds();
    } catch { toast.error('Failed to toggle'); }
  };

  const deleteAd = async (id: string) => {
    if (!confirm('Delete this ad permanently?')) return;
    try {
      const res = await fetch(`/api/admin/ads/${id}`, { method: 'DELETE', headers });
      if (!res.ok) { toast.error('Failed to delete'); return; }
      toast.success('Ad deleted');
      fetchAds();
    } catch { toast.error('Failed to delete'); }
  };

  useEffect(() => {
    if (tab === 'users') fetchUsers();
    if (tab === 'store') fetchStoreItems();
    if (tab === 'analytics') fetchAnalytics();
    if (tab === 'bugs') fetchBugReports();
    if (tab === 'ads') fetchAds();
    if (tab === 'visual') fetchVisual();
  }, [tab]);

  const pushBoard = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/boards/${id}/push`, { method: 'POST', headers });
      const data = await res.json();
      if (data.success) { toast.success('Board pushed to all players!'); fetchBoards(); }
    } catch { toast.error('Failed to push board'); }
  };

  const deleteBoard = async (id: string) => {
    if (!confirm('Delete this board?')) return;
    try {
      const res = await fetch(`/api/admin/boards/${id}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to delete board');
        return;
      }
      toast.success('Board deleted');
      fetchBoards();
    } catch { toast.error('Failed to delete board'); }
  };

  const saveBoard = async (board: Omit<CustomBoard, 'id' | 'createdAt'>) => {
    try {
      if (editingBoard?.id) {
        await fetch(`/api/admin/boards/${editingBoard.id}`, { method: 'PUT', headers, body: JSON.stringify(board) });
        toast.success('Board updated!');
      } else {
        await fetch('/api/admin/boards', { method: 'POST', headers, body: JSON.stringify(board) });
        toast.success('Board saved!');
      }
      setEditingBoard(null); setTab('boards'); fetchBoards();
    } catch { toast.error('Failed to save board'); }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <LayoutGrid className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-base bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">Cashly Admin</span>
              <span className="text-[10px] text-muted-foreground font-mono tracking-wide">control panel</span>
            </div>
            {activeBoard && (
              <>
                <Separator orientation="vertical" className="h-6 mx-2" />
                <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  <Radio className="h-3 w-3 animate-pulse" />
                  <span className="font-medium">{activeBoard.name}</span>
                </div>
              </>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" />Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />Analytics
            </TabsTrigger>
            <TabsTrigger value="builder">Board Builder</TabsTrigger>
            <TabsTrigger value="boards">
              Saved Boards
              {boards.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">{boards.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-3.5 w-3.5 mr-1.5" />Users
            </TabsTrigger>
            <TabsTrigger value="store">
              <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />Store
            </TabsTrigger>
            <TabsTrigger value="bugs">
              <Flag className="h-3.5 w-3.5 mr-1.5" />Bug Reports
              {bugReports.filter(b => b.status === 'open').length > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                  {bugReports.filter(b => b.status === 'open').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ads">
              <Megaphone className="h-3.5 w-3.5 mr-1.5" />Ads
              {ads.filter(a => a.enabled).length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                  {ads.filter(a => a.enabled).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="visual">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />Visual
            </TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <Card className="relative overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
                <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
                <CardHeader className="pb-2 relative">
                  <div className="flex items-center justify-between">
                    <CardDescription>Active Board</CardDescription>
                    <Globe className="h-4 w-4 text-emerald-400" />
                  </div>
                  <CardTitle className="text-xl">{activeBoard ? activeBoard.name : 'Classic (default)'}</CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <Badge variant={activeBoard ? 'default' : 'secondary'}>
                    {activeBoard ? `${activeBoard.tiles.length} tiles` : 'Built-in'}
                  </Badge>
                </CardContent>
              </Card>
              <Card className="relative overflow-hidden border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-transparent">
                <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl" />
                <CardHeader className="pb-2 relative">
                  <div className="flex items-center justify-between">
                    <CardDescription>Saved Boards</CardDescription>
                    <LayoutGrid className="h-4 w-4 text-indigo-400" />
                  </div>
                  <CardTitle className="text-3xl font-black">{boards.length}</CardTitle>
                </CardHeader>
                <CardContent className="relative"><span className="text-sm text-muted-foreground">Custom configurations</span></CardContent>
              </Card>
              <Card className="relative overflow-hidden border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/5 to-transparent">
                <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-fuchsia-500/10 blur-2xl" />
                <CardHeader className="pb-2 relative"><CardDescription>Quick Actions</CardDescription></CardHeader>
                <CardContent className="flex flex-col gap-2 relative">
                  <Button size="sm" onClick={() => { setEditingBoard(null); setTab('builder'); }}>
                    <Plus className="h-4 w-4 mr-2" />New Board
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setTab('ads')}>
                    <Megaphone className="h-4 w-4 mr-2" />Manage Ads
                  </Button>
                  {boards.length > 0 && !activeBoard && (
                    <Button size="sm" variant="outline" onClick={() => pushBoard(boards[0].id)}>
                      <Upload className="h-4 w-4 mr-2" />Push Latest
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
                  <CardDescription>New games will use this board until you push a different one.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="outline">{activeBoard.boardSize}×{activeBoard.boardSize}</Badge>
                    <Badge variant="outline">{activeBoard.tiles.length} tiles</Badge>
                    <Badge variant="outline">Pushed {new Date(activeBoard.createdAt).toLocaleDateString()}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── DB health probe ── */}
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      <CardTitle>Database Health</CardTitle>
                    </div>
                    <CardDescription>
                      Runs connect → read → write → transaction rollback → row counts against the configured <code>DATABASE_URL</code>.
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={runDbTest} disabled={dbTestLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${dbTestLoading ? 'animate-spin' : ''}`} />
                    {dbTestLoading ? 'Testing…' : 'Run DB Test'}
                  </Button>
                </div>
              </CardHeader>
              {dbTest && (
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap text-sm">
                    <Badge variant={dbTest.ok ? 'default' : 'destructive'}>
                      {dbTest.ok ? 'All checks passed' : 'Failures detected'}
                    </Badge>
                    {dbTest.dbUrlHost && <span className="text-muted-foreground">host: <code>{dbTest.dbUrlHost}</code></span>}
                    {dbTest.dbVersion && <span className="text-muted-foreground truncate max-w-[40ch]" title={dbTest.dbVersion}>{dbTest.dbVersion}</span>}
                  </div>
                  {dbTest.error && <div className="text-sm text-destructive">Error: {dbTest.error}</div>}
                  <div className="divide-y rounded-md border">
                    {dbTest.checks.map((c, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 text-sm">
                        {c.ok
                          ? <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          : <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs font-semibold">{c.name}</div>
                          {c.detail && <div className="text-muted-foreground break-words">{c.detail}</div>}
                        </div>
                        <span className="text-muted-foreground tabular-nums shrink-0">{c.ms}ms</span>
                      </div>
                    ))}
                  </div>
                  {dbTest.tableCounts && Object.keys(dbTest.tableCounts).length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2">Table row counts</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs font-mono">
                        {Object.entries(dbTest.tableCounts).map(([name, count]) => (
                          <div key={name} className="flex justify-between gap-2 px-2 py-1 rounded bg-muted/40">
                            <span className="truncate">{name}</span>
                            <span className="tabular-nums text-muted-foreground">{String(count)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* ── Analytics ── */}
          <TabsContent value="analytics">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Analytics</h2>
              <Button size="sm" variant="outline" onClick={fetchAnalytics} disabled={analyticsLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />Refresh
              </Button>
            </div>
            {analyticsLoading && !analytics ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Loading analytics…</CardContent></Card>
            ) : analytics ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                  {[
                    { label: 'Total Users', value: analytics.totalUsers, icon: <Users className="h-5 w-5 text-indigo-400" />, color: 'text-indigo-400' },
                    { label: 'Total Games Played', value: analytics.totalGamesPlayed, icon: <TrendingUp className="h-5 w-5 text-emerald-400" />, color: 'text-emerald-400' },
                    { label: 'Total Wins', value: analytics.totalWins, icon: <Crown className="h-5 w-5 text-amber-400" />, color: 'text-amber-400' },
                    { label: 'Avg Coins / User', value: analytics.avgCoins, icon: <Coins className="h-5 w-5 text-yellow-400" />, color: 'text-yellow-400' },
                    { label: 'Total Coins in Circulation', value: analytics.totalCoins.toLocaleString(), icon: <Coins className="h-5 w-5 text-orange-400" />, color: 'text-orange-400' },
                    { label: 'Banned Users', value: analytics.bannedCount, icon: <UserX className="h-5 w-5 text-rose-400" />, color: 'text-rose-400' },
                    { label: 'Active Users', value: analytics.totalUsers - analytics.bannedCount, icon: <UserCheck className="h-5 w-5 text-green-400" />, color: 'text-green-400' },
                    { label: 'Win Rate', value: analytics.totalGamesPlayed > 0 ? `${((analytics.totalWins / analytics.totalGamesPlayed) * 100).toFixed(1)}%` : '—', icon: <Shield className="h-5 w-5 text-purple-400" />, color: 'text-purple-400' },
                  ].map((stat, i) => (
                    <Card key={i}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardDescription>{stat.label}</CardDescription>
                          {stat.icon}
                        </div>
                        <CardTitle className={`text-2xl ${stat.color}`}>{stat.value}</CardTitle>
                      </CardHeader>
                    </Card>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Coins className="h-4 w-4 text-amber-400" /> Top Coin Holders
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analytics.topEarners.map((e, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-muted-foreground w-4">#{i + 1}</span>
                              <span className="text-sm font-medium">{e.name || 'Unknown'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Coins className="h-3.5 w-3.5 text-amber-500" />
                              <span className="text-sm font-bold text-amber-400">{e.coins}</span>
                            </div>
                          </div>
                        ))}
                        {analytics.topEarners.length === 0 && <p className="text-sm text-muted-foreground">No data yet</p>}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4 text-indigo-400" /> Recent Sign-Ups
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {analytics.recentUsers.map((u, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                            <div>
                              <p className="text-sm font-medium">{u.name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                            </span>
                          </div>
                        ))}
                        {analytics.recentUsers.length === 0 && <p className="text-sm text-muted-foreground">No users yet</p>}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Click Refresh to load analytics.</CardContent></Card>
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
                <Plus className="h-4 w-4 mr-2" />New Board
              </Button>
            </div>
            {boards.length === 0 ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground">No boards saved yet. Create one in the Board Builder.</CardContent></Card>
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
                            {activeBoard?.id === board.id && <Badge variant="default" className="text-xs">Live</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {board.boardSize}×{board.boardSize} · {board.tiles.length} tiles · Created {new Date(board.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setEditingBoard(board); setTab('builder'); }}>Edit</Button>
                        <Button variant="default" size="sm" onClick={() => pushBoard(board.id)}>
                          <Upload className="h-4 w-4 mr-1" />Push
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteBoard(board.id)}>
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

            {/* User Edit Modal */}
            {editingUser && (
              <Card className="mb-4 border-primary/40 bg-primary/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Edit2 className="h-4 w-4" /> Editing: {editingUser.name}
                    </CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => setEditingUser(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block font-medium">Display Name</label>
                      <Input
                        value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Display name"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block font-medium">Role</label>
                      <select
                        value={editForm.role}
                        onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                        <option value="moderator">moderator</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block font-medium">Set Coins Directly</label>
                      <Input
                        type="number"
                        min={0}
                        value={editForm.coins}
                        onChange={e => setEditForm(f => ({ ...f, coins: Number(e.target.value), addCoins: '' }))}
                        placeholder="Exact coin amount"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block font-medium">Add / Remove Coins</label>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditForm(f => ({ ...f, addCoins: String(Number(f.addCoins || 0) - 10) }))}
                          className="px-2.5 py-2 bg-muted border border-border rounded-lg text-sm hover:bg-muted/80 transition-colors"
                        ><Minus className="h-3.5 w-3.5" /></button>
                        <Input
                          type="number"
                          value={editForm.addCoins}
                          onChange={e => setEditForm(f => ({ ...f, addCoins: e.target.value, coins: editingUser.coins }))}
                          placeholder="+/- amount"
                          className="flex-1"
                        />
                        <button
                          onClick={() => setEditForm(f => ({ ...f, addCoins: String(Number(f.addCoins || 0) + 10) }))}
                          className="px-2.5 py-2 bg-muted border border-border rounded-lg text-sm hover:bg-muted/80 transition-colors"
                        ><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">Current: {editingUser.coins} coins</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block font-medium">Account Status</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditForm(f => ({ ...f, banned: !f.banned }))}
                          className={`px-3 py-2 text-sm rounded-lg border font-medium transition-colors ${editForm.banned ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'}`}
                        >
                          {editForm.banned ? <><Ban className="h-3.5 w-3.5 inline mr-1" />Banned</> : <><Check className="h-3.5 w-3.5 inline mr-1" />Active</>}
                        </button>
                      </div>
                    </div>
                    {editForm.banned && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block font-medium">Ban Reason</label>
                        <Input
                          value={editForm.banReason}
                          onChange={e => setEditForm(f => ({ ...f, banReason: e.target.value }))}
                          placeholder="Reason for ban"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveUserEdit}><Check className="h-4 w-4 mr-1" />Save Changes</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingUser(null)}>
                      <X className="h-4 w-4 mr-1" />Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {usersLoading ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Loading users…</CardContent></Card>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {['Name', 'Email', 'Role', 'Coins', 'Status', 'Joined', 'Actions'].map(h => (
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
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{u.email}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="text-xs">{u.role || 'user'}</Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1">
                              <Coins className="h-3.5 w-3.5 text-amber-500" />
                              <span className="font-mono font-bold">{u.coins}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant={u.banned ? 'destructive' : 'secondary'}>
                              {u.banned ? 'Banned' : 'Active'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEditUser(u)}>
                                <Edit2 className="h-3 w-3 mr-1" />Edit
                              </Button>
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
              <Button size="sm" onClick={() => { setEditingItem(null); setItemForm({ name: '', description: '', type: 'avatar', priceCoins: 100, assetUrl: '', active: true }); setShowItemForm(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>

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
                        <input type={type} value={(itemForm as any)[key]} onChange={e => setItemForm(f => ({ ...f, [key]: e.target.value }))}
                          className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring" />
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
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Store visibility</label>
                      <Button
                        type="button"
                        size="sm"
                        variant={itemForm.active ? 'default' : 'outline'}
                        className="w-full justify-center"
                        onClick={() => setItemForm(f => ({ ...f, active: !f.active }))}
                      >
                        <Power className="h-3.5 w-3.5 mr-1.5" />
                        {itemForm.active ? 'Enabled' : 'Disabled'}
                      </Button>
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
                <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />No store items yet.
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
                              setItemForm({ name: item.name, description: item.description, type: item.type, priceCoins: item.priceCoins, assetUrl: item.assetUrl ?? '', active: item.active });
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
          {/* ── Bug Reports ── */}
          <TabsContent value="bugs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Flag className="h-5 w-5 text-rose-400" /> Bug Reports
              </h2>
              <Button size="sm" variant="outline" onClick={fetchBugReports} disabled={bugsLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${bugsLoading ? 'animate-spin' : ''}`} />Refresh
              </Button>
            </div>

            {bugsLoading ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Loading bug reports…</CardContent></Card>
            ) : bugReports.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />No bug reports yet.
              </CardContent></Card>
            ) : (
              <div className="flex flex-col gap-3">
                {bugReports.map(report => (
                  <Card key={report.id} className={report.status === 'open' ? 'border-rose-500/30' : 'opacity-60'}>
                    <CardContent className="py-4 px-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant={report.status === 'open' ? 'destructive' : report.status === 'resolved' ? 'default' : 'secondary'}>
                              {report.status}
                            </Badge>
                            <span className="font-bold text-sm text-white truncate">{report.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words mb-2">{report.description}</p>
                          {report.imageUrl && (
                            <a href={report.imageUrl} target="_blank" rel="noopener noreferrer" className="inline-block mb-2">
                              <img src={report.imageUrl} alt="Bug screenshot" className="max-h-40 max-w-xs rounded-lg border border-slate-700 object-contain" />
                            </a>
                          )}
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                            <span>{report.createdAt ? new Date(report.createdAt).toLocaleString() : '—'}</span>
                            {report.ip && <span className="font-mono">IP: {report.ip}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {report.status !== 'resolved' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-400 border-emerald-500/30 hover:border-emerald-500"
                              onClick={() => updateBugStatus(report.id, 'resolved')}>
                              <Check className="h-3 w-3 mr-1" />Resolve
                            </Button>
                          )}
                          {report.status !== 'wontfix' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-slate-400"
                              onClick={() => updateBugStatus(report.id, 'wontfix')}>
                              <X className="h-3 w-3 mr-1" />Won't fix
                            </Button>
                          )}
                          {report.status !== 'open' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-rose-400 border-rose-500/30"
                              onClick={() => updateBugStatus(report.id, 'open')}>
                              Reopen
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Ads ── */}
          <TabsContent value="ads">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-fuchsia-400" /> Ad Management
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Control creatives shown across the app. Pause, schedule, and track impressions per slot.</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={fetchAds} disabled={adsLoading}>
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${adsLoading ? 'animate-spin' : ''}`} />Refresh
                </Button>
                <Button size="sm" onClick={() => openAdForm(null)}>
                  <Plus className="h-4 w-4 mr-1.5" />New Ad
                </Button>
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid gap-3 md:grid-cols-4 mb-5">
              {[
                { label: 'Total Ads', value: ads.length, icon: <Megaphone className="h-4 w-4" />, color: 'text-fuchsia-400 border-fuchsia-500/20 from-fuchsia-500/5' },
                { label: 'Active', value: ads.filter(a => a.enabled).length, icon: <Power className="h-4 w-4" />, color: 'text-emerald-400 border-emerald-500/20 from-emerald-500/5' },
                { label: 'Impressions', value: ads.reduce((s, a) => s + (a.impressions || 0), 0).toLocaleString(), icon: <Eye className="h-4 w-4" />, color: 'text-indigo-400 border-indigo-500/20 from-indigo-500/5' },
                { label: 'Clicks', value: ads.reduce((s, a) => s + (a.clicks || 0), 0).toLocaleString(), icon: <MousePointerClick className="h-4 w-4" />, color: 'text-amber-400 border-amber-500/20 from-amber-500/5' },
              ].map((s, i) => (
                <Card key={i} className={`bg-gradient-to-br to-transparent ${s.color}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardDescription>{s.label}</CardDescription>
                      <span className={s.color.split(' ')[0]}>{s.icon}</span>
                    </div>
                    <CardTitle className="text-2xl font-black tabular-nums">{s.value}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {/* Placement filter chips */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button
                onClick={() => setAdFilter('all')}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${adFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
              >
                All ({ads.length})
              </button>
              {(adPlacements.length ? adPlacements : Object.keys(PLACEMENT_LABELS)).map(p => {
                const count = ads.filter(a => a.placement === p).length;
                return (
                  <button
                    key={p}
                    onClick={() => setAdFilter(p)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${adFilter === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                  >
                    {PLACEMENT_LABELS[p] || p} ({count})
                  </button>
                );
              })}
            </div>

            {/* Ad form */}
            {showAdForm && (
              <Card className="mb-5 border-fuchsia-500/30 bg-fuchsia-500/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {editingAd ? <><Edit2 className="h-4 w-4" /> Editing: {editingAd.name}</> : <><Plus className="h-4 w-4" /> New Ad</>}
                    </CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => { setShowAdForm(false); setEditingAd(null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block font-medium">Name (internal)</label>
                      <Input value={adForm.name} onChange={e => setAdForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Summer promo" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block font-medium">Placement</label>
                      <select
                        value={adForm.placement}
                        onChange={e => setAdForm(f => ({ ...f, placement: e.target.value }))}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg"
                      >
                        {(adPlacements.length ? adPlacements : Object.keys(PLACEMENT_LABELS)).map(p => (
                          <option key={p} value={p}>{PLACEMENT_LABELS[p] || p}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-muted-foreground mb-1 block font-medium flex items-center gap-1.5">
                        <ImageIcon className="h-3 w-3" /> Image URL
                      </label>
                      <Input value={adForm.imageUrl} onChange={e => setAdForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://… (PNG/JPG/SVG/GIF)" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block font-medium">Click-through URL</label>
                      <Input value={adForm.linkUrl} onChange={e => setAdForm(f => ({ ...f, linkUrl: e.target.value }))} placeholder="https://…" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block font-medium">Alt text</label>
                      <Input value={adForm.altText} onChange={e => setAdForm(f => ({ ...f, altText: e.target.value }))} placeholder="Accessibility text" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-muted-foreground mb-1 block font-medium flex items-center gap-1.5">
                        <Code2 className="h-3 w-3" /> HTML snippet (overrides image — for ad networks like AdSense)
                      </label>
                      <textarea
                        value={adForm.htmlSnippet}
                        onChange={e => setAdForm(f => ({ ...f, htmlSnippet: e.target.value }))}
                        placeholder="<script>… or <ins class=&quot;adsbygoogle&quot; …>"
                        rows={3}
                        className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block font-medium">Weight (rotation)</label>
                      <Input type="number" min={0} value={adForm.weight} onChange={e => setAdForm(f => ({ ...f, weight: Number(e.target.value) }))} />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => setAdForm(f => ({ ...f, enabled: !f.enabled }))}
                        className={`px-3 py-2 text-sm rounded-lg border font-medium transition-colors w-full ${adForm.enabled ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-500/10 border-slate-500/40 text-slate-400'}`}
                      >
                        <Power className="h-3.5 w-3.5 inline mr-1.5" />
                        {adForm.enabled ? 'Enabled' : 'Paused'}
                      </button>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block font-medium">Starts at (optional)</label>
                      <Input type="datetime-local" value={adForm.startsAt} onChange={e => setAdForm(f => ({ ...f, startsAt: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block font-medium">Ends at (optional)</label>
                      <Input type="datetime-local" value={adForm.endsAt} onChange={e => setAdForm(f => ({ ...f, endsAt: e.target.value }))} />
                    </div>
                  </div>

                  {/* Live preview */}
                  {(adForm.imageUrl || adForm.htmlSnippet) && (
                    <div className="mb-3 rounded-lg border border-dashed border-border p-3 bg-background/40">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-semibold">Live preview</p>
                      {adForm.imageUrl && !adForm.htmlSnippet && (
                        <img src={adForm.imageUrl} alt={adForm.altText} className="max-h-32 rounded" />
                      )}
                      {adForm.htmlSnippet && (
                        <div className="text-xs text-muted-foreground italic">HTML snippet preview disabled in admin (renders live on the site).</div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveAd}><Check className="h-4 w-4 mr-1" />Save Ad</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowAdForm(false); setEditingAd(null); }}>
                      <X className="h-4 w-4 mr-1" />Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {adsLoading ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Loading ads…</CardContent></Card>
            ) : ads.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Megaphone className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>No ads yet — create one to start placing creatives across the app.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {ads
                  .filter(a => adFilter === 'all' || a.placement === adFilter)
                  .map(ad => {
                    const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0.0';
                    return (
                      <Card key={ad.id} className={`group transition-all ${ad.enabled ? 'border-border hover:border-fuchsia-500/40' : 'opacity-60 border-dashed'}`}>
                        <CardContent className="p-4">
                          <div className="flex gap-3">
                            <div className="shrink-0 h-20 w-28 rounded-md border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                              {ad.imageUrl ? (
                                <img src={ad.imageUrl} alt={ad.altText || ad.name} className="h-full w-full object-cover" />
                              ) : ad.htmlSnippet ? (
                                <Code2 className="h-6 w-6 text-muted-foreground" />
                              ) : (
                                <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="font-semibold text-sm truncate">{ad.name}</p>
                                <Badge variant={ad.enabled ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                                  {ad.enabled ? 'LIVE' : 'PAUSED'}
                                </Badge>
                              </div>
                              <Badge variant="outline" className="text-[10px] mb-2">
                                {PLACEMENT_LABELS[ad.placement] || ad.placement}
                              </Badge>
                              <div className="grid grid-cols-3 gap-1 text-[11px] mb-2">
                                <div className="flex items-center gap-1">
                                  <Eye className="h-3 w-3 text-indigo-400" />
                                  <span className="font-mono tabular-nums">{ad.impressions.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <MousePointerClick className="h-3 w-3 text-amber-400" />
                                  <span className="font-mono tabular-nums">{ad.clicks.toLocaleString()}</span>
                                </div>
                                <div className="text-muted-foreground font-mono">CTR {ctr}%</div>
                              </div>
                              {ad.linkUrl && (
                                <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 hover:underline truncate flex items-center gap-1">
                                  <ExternalLink className="h-2.5 w-2.5" />
                                  <span className="truncate">{ad.linkUrl}</span>
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1.5 mt-3 pt-3 border-t border-border">
                            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => toggleAdEnabled(ad)}>
                              <Power className="h-3 w-3 mr-1" />{ad.enabled ? 'Pause' : 'Resume'}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => openAdForm(ad)}>
                              <Edit2 className="h-3 w-3 mr-1" />Edit
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteAd(ad.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}
          </TabsContent>

          {/* ── Visual ── */}
          <TabsContent value="visual">
            <div className="max-w-xl space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-violet-400" />Particle Settings
                  </CardTitle>
                  <CardDescription>Control the falling particle effect on the home screen.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-1.5">
                    <span className="text-sm text-muted-foreground">Shape</span>
                    <div className="flex gap-2 mt-1">
                      {(['circle', 'snowflake'] as const).map(shape => (
                        <button
                          key={shape}
                          onClick={() => updateVisual({ particleShape: shape })}
                          className={`flex-1 py-1.5 rounded-md border text-sm capitalize transition-colors ${visual.particleShape === shape ? 'bg-violet-600 border-violet-500 text-white' : 'border-border text-muted-foreground hover:border-violet-500'}`}
                        >
                          {shape === 'circle' ? '● Circle' : '❄ Snowflake'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {[
                    { key: 'particleCount' as const, label: 'Count', min: 10, max: 400, step: 5, fmt: (v: number) => `${v}` },
                    { key: 'particleSpeed' as const, label: 'Speed', min: 0.1, max: 5, step: 0.1, fmt: (v: number) => `${v.toFixed(1)}x` },
                    { key: 'particleSize' as const, label: 'Size', min: 0.2, max: 4, step: 0.1, fmt: (v: number) => `${v.toFixed(1)}x` },
                    { key: 'particleOpacity' as const, label: 'Opacity', min: 0, max: 1, step: 0.01, fmt: (v: number) => `${Math.round(v * 100)}%` },
                    { key: 'particleFadeZone' as const, label: 'Fade-out start (% of screen height)', min: 0.05, max: 0.9, step: 0.01, fmt: (v: number) => `${Math.round(v * 100)}%` },
                  ].map(({ key, label, min, max, step, fmt }) => (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-mono text-xs text-foreground">{fmt(visual[key] as number)}</span>
                      </div>
                      <input
                        type="range" min={min} max={max} step={step}
                        value={visual[key] as number}
                        onChange={e => updateVisual({ [key]: parseFloat(e.target.value) })}
                        className="w-full accent-violet-500"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-indigo-400" />Glow Settings
                  </CardTitle>
                  <CardDescription>Control the top-of-screen light bloom on the home screen.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {[
                    { key: 'glowOpacity' as const, label: 'Opacity', min: 0, max: 1, step: 0.01, fmt: (v: number) => `${Math.round(v * 100)}%` },
                    { key: 'glowWidth' as const, label: 'Width (px)', min: 300, max: 2000, step: 10, fmt: (v: number) => `${v}px` },
                    { key: 'glowHeight' as const, label: 'Height (px)', min: 100, max: 1200, step: 10, fmt: (v: number) => `${v}px` },
                    { key: 'glowY' as const, label: 'Y offset (px, negative = up)', min: -600, max: 200, step: 5, fmt: (v: number) => `${v}px` },
                  ].map(({ key, label, min, max, step, fmt }) => (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-mono text-xs text-foreground">{fmt(visual[key] as number)}</span>
                      </div>
                      <input
                        type="range" min={min} max={max} step={step}
                        value={visual[key] as number}
                        onChange={e => updateVisual({ [key]: parseFloat(e.target.value) })}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Button variant="outline" onClick={() => updateVisual(VISUAL_DEFAULTS)}>
                {visualSaving ? 'Saving...' : 'Reset to Defaults'}
              </Button>
            </div>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
