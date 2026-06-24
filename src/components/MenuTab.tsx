import React, { useState, useMemo } from 'react';
import { Search, Plus, ArrowLeft, Tags, Pencil, Trash2, Power, PowerOff, Printer, Edit2, Upload, Download, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button, Input, Modal, ConfirmModal, cn } from './ui';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.round((value || 0) * 100) / 100);
};

export const MenuTab = React.memo(function MenuTab({ menu, categories = [], details = [], canEdit, onAdd, onEdit, onWS, vibrate, currentUser }: any) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('alphabetical');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const filteredMenu = useMemo(() => {
    let items = menu.filter((item: any) => {
      if (search) {
        const normalizedSearch = search.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const normalizedName = item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return normalizedName.includes(normalizedSearch);
      }
      
      const matchesCategory = activeCategory ? item.type === activeCategory : true;
      const matchesGroup = (activeGroup && activeGroup !== 'ALL') ? item.category === activeGroup : true;
      
      return matchesCategory && matchesGroup;
    });
    
    switch (sortBy) {
      case 'alphabetical':
        items = [...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }));
        break;
      case 'recent':
        items = [...items].sort((a, b) => {
          const timeA = new Date(a.created_at || 0).getTime() || 0;
          const timeB = new Date(b.created_at || 0).getTime() || 0;
          if (timeB !== timeA) return timeB - timeA;
          return (b.id || "").toString().localeCompare((a.id || "").toString());
        });
        break;
      case 'active':
        items = items.filter((i: any) => i.active !== 0);
        break;
      case 'inactive':
        items = items.filter((i: any) => i.active === 0);
        break;
      case 'category':
        items = [...items].sort((a, b) => (a.type || '').localeCompare(b.type || ''));
        break;
      case 'group':
        items = [...items].sort((a, b) => (a.category || '').localeCompare(b.category || ''));
        break;
      case 'event':
        items = items.filter((i: any) => i.is_event_item === 1);
        break;
    }
    
    return items;
  }, [menu, search, activeCategory, activeGroup, sortBy]);

  const groupedMenu = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    filteredMenu.forEach(item => {
      const groupName = item.category || 'Outros';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(item);
    });
    // Sort group names by sort_order, but keep 'Outros' at the end
    return Object.keys(groups).sort((a, b) => {
      if (a === 'Outros') return 1;
      if (b === 'Outros') return -1;
      const groupA = details.find((g: any) => g.name === a);
      const groupB = details.find((g: any) => g.name === b);
      const orderA = groupA?.sort_order ?? 999;
      const orderB = groupB?.sort_order ?? 999;
      return orderA - orderB;
    }).map(key => ({
      name: key,
      items: groups[key].sort((a, b) => a.name.localeCompare(b.name))
    }));
  }, [filteredMenu, details]);

  const handleDownload = async () => {
    try {
      const userId = currentUser?.id || 'anonymous';
      const res = await fetch('/api/menu/export', {
        headers: { 'x-app-user-id': userId }
      });
      if (!res.ok) throw new Error("Erro ao baixar");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deck_serrinha_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download error:", e);
      toast.error('Erro ao baixar restaurante');
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Arquivo vazio");
        
        const content = JSON.parse(text);
        const userId = currentUser?.id || 'anonymous';
        
        const res = await fetch('/api/menu/import', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-app-user-id': userId
          },
          body: JSON.stringify(content)
        });
        if (res.ok) {
          toast.success('Restaurante importado com sucesso!');
          if (onWS) onWS('FULL_SYNC', {});
        } else {
          const errData = await res.json().catch(() => ({ message: 'Erro desconhecido' }));
          toast.error(`Erro ao importar: ${errData.message || 'Formato inválido'}`);
        }
      } catch (err: any) {
        console.error("Upload error:", err);
        toast.error(`Arquivo inválido: ${err.message || ''}`);
      }
    };
    reader.onerror = () => toast.error('Erro ao ler arquivo');
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const renderItemCard = (item: any) => (
    <div key={item.id} className={cn(
      "group relative flex items-center justify-between border-b border-zinc-100 bg-white py-2 px-3 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50 last:border-0",
      item.active === 0 && "opacity-60 bg-zinc-50 dark:bg-zinc-800/50"
    )}>
      <div className="flex items-center gap-3 flex-1">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{item.name}</h4>
            {item.active === 0 && <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">INATIVO</span>}
            {item.print_enabled !== 0 && <Printer className="h-3 w-3 text-emerald-500" />}
          </div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{item.type} &gt; {item.category} • {formatCurrency(item.price)}</p>
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => {
              if (vibrate) vibrate(10);
              onWS('MENU_TOGGLE_PRINT', { id: item.id, enabled: item.print_enabled === 0 });
            }}
            className={cn(
              "p-1.5 rounded transition-colors",
              item.print_enabled !== 0 ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
            title={item.print_enabled !== 0 ? "Impressão Ativada" : "Impressão Desativada"}
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onEdit(item)} className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => {
            setConfirmModal({
              isOpen: true,
              title: 'Excluir Item',
              message: `Deseja realmente excluir ${item.name}?`,
              onConfirm: () => {
                onWS('MENU_DELETE', { id: item.id });
                setConfirmModal({ ...confirmModal, isOpen: false });
              }
            });
          }} className="rounded p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <ConfirmModal 
        isOpen={confirmModal.isOpen} 
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })} 
        title={confirmModal.title} 
        message={confirmModal.message} 
        onConfirm={confirmModal.onConfirm} 
      />
      
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md dark:bg-zinc-950/80 py-2 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input 
                placeholder="Buscar no restaurante..." 
                className="pl-10" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <input 
                type="file" 
                id="menu-upload" 
                className="hidden" 
                accept=".json" 
                onChange={handleUpload} 
              />
              <Button variant="outline" onClick={() => document.getElementById('menu-upload')?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Importar
              </Button>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" /> Exportar
              </Button>
              <Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" /> Novo Produto</Button>
            </div>
          )}
        </div>

        {!search && activeCategory && (
          <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <button 
                onClick={() => { setActiveCategory(null); setActiveGroup(null); }} 
                className="hover:underline"
              >
                Restaurante
              </button>
              <ChevronRight className="h-4 w-4" />
              <span className="font-bold">{activeCategory}</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-3 text-xs font-bold bg-white dark:bg-zinc-900 shadow-sm border border-emerald-200 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50"
              onClick={() => {
                setActiveCategory(null);
                setActiveGroup(null);
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Voltar
            </Button>
          </div>
        )}
      </div>

      {search ? (
        <div className="rounded-xl border border-zinc-200 overflow-hidden dark:border-zinc-800">
          {filteredMenu.map(renderItemCard)}
          {filteredMenu.length === 0 && (
            <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
              Nenhum item encontrado para "{search}".
            </div>
          )}
        </div>
      ) : (
        <>
          {!activeCategory ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {categories.map((c: any) => {
                const count = menu.filter((m: any) => m.type === c.name).length;
                return (
                  <button 
                    key={c.id} 
                    onClick={() => setActiveCategory(c.name)}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition-all hover:border-emerald-500 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500"
                  >
                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{c.name}</span>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{count} itens</span>
                  </button>
                );
              })}
              {categories.length === 0 && (
                <div className="col-span-full py-12 text-center text-zinc-500 dark:text-zinc-400">
                  Nenhuma categoria cadastrada.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500">
                    Itens em {activeCategory}
                  </h3>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">({filteredMenu.length} itens)</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Organizar:</label>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 focus:outline-none"
                  >
                    <option value="alphabetical">Alfabética</option>
                    <option value="recent">Mais recentes</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                    <option value="category">Categorias</option>
                    <option value="group">Grupos</option>
                    <option value="event">Evento</option>
                  </select>
                </div>
              </div>

              {groupedMenu.map(({ name: groupName, items }: any) => (
                <div key={groupName} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1">
                      {groupName}
                    </h4>
                    <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                  <div className="rounded-xl border border-zinc-200 overflow-hidden dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    {items.map(renderItemCard)}
                  </div>
                </div>
              ))}
              {filteredMenu.length === 0 && (
                <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                  Nenhum item disponível nesta categoria.
                </div>
              )}
            </div>
          )}

          {!activeCategory && (
            <div className="mt-8 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-zinc-100 dark:border-zinc-800 pt-6">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Todos os Itens</h3>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Organizar por:</label>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="alphabetical">Alfabética</option>
                    <option value="recent">Mais recentes</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                    <option value="category">Categorias</option>
                    <option value="group">Grupos</option>
                    <option value="event">Evento</option>
                  </select>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 overflow-hidden dark:border-zinc-800 bg-white dark:bg-zinc-900">
                {filteredMenu.map(renderItemCard)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

