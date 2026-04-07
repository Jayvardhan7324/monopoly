import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { LayoutGrid, LogOut, Globe, Trash2, Upload, Plus, Radio } from 'lucide-react';
import BoardBuilder from './BoardBuilder';
import type { CustomBoard } from './types';

interface Props {
  token: string;
  onLogout: () => void;
}

const Dashboard: React.FC<Props> = ({ token, onLogout }) => {
  const [boards, setBoards] = useState<CustomBoard[]>([]);
  const [activeBoard, setActiveBoard] = useState<CustomBoard | null>(null);
  const [editingBoard, setEditingBoard] = useState<CustomBoard | null>(null);
  const [tab, setTab] = useState('overview');

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
            <span className="font-semibold text-lg">Richup Admin</span>
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
          <TabsList className="mb-6">
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
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
