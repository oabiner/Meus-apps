import React, { useState } from 'react';
import { Settings, Plus, Edit2, Trash2, MapPin, Home, Coffee, Beer, Utensils, Music, Users, Sun, Moon, Zap, Star, LayoutGrid, CheckSquare } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button, Input, Modal, cn } from './ui';

export const icons = [
  { name: 'MapPin', icon: <MapPin className="h-4 w-4" /> },
  { name: 'Home', icon: <Home className="h-4 w-4" /> },
  { name: 'Coffee', icon: <Coffee className="h-4 w-4" /> },
  { name: 'Beer', icon: <Beer className="h-4 w-4" /> },
  { name: 'Utensils', icon: <Utensils className="h-4 w-4" /> },
  { name: 'Music', icon: <Music className="h-4 w-4" /> },
  { name: 'Users', icon: <Users className="h-4 w-4" /> },
  { name: 'Sun', icon: <Sun className="h-4 w-4" /> },
  { name: 'Moon', icon: <Moon className="h-4 w-4" /> },
  { name: 'Zap', icon: <Zap className="h-4 w-4" /> },
  { name: 'Star', icon: <Star className="h-4 w-4" /> },
  { name: 'LayoutGrid', icon: <LayoutGrid className="h-4 w-4" /> }
];

export const getIcon = (iconName: string) => {
  const found = icons.find(i => i.name === iconName);
  return found ? found.icon : <MapPin className="h-4 w-4" />;
};

export const TableManagement = React.memo(function TableManagement({ tables, sendWS, settings }: any) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const tableTypes = JSON.parse(settings.table_types || '[{"id":"salao","name":"Salão","color":"#10b981"},{"id":"gramado","name":"Gramado","color":"#3b82f6"}]');
  const billRequestedColor = settings.color_bill_requested || '#f59e0b';

  const [editingType, setEditingType] = useState<any>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#10b981');
  const [newTypeIcon, setNewTypeIcon] = useState('MapPin');

  const handleSaveTypes = (newTypes: any[]) => {
    sendWS('SETTINGS_UPDATE', { table_types: JSON.stringify(newTypes) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold dark:text-zinc-100">Gerenciar Mesas</h3>
        <div className="flex gap-2">
          <Button onClick={() => setIsConfigModalOpen(true)} variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" /> Áreas e Cores
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> Nova Mesa
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((table: any) => {
          const typeInfo = tableTypes.find((t: any) => t.id === table.type) || tableTypes[0];
          return (
            <div key={table.id} className="p-4 rounded-2xl border border-zinc-200 bg-white dark:bg-zinc-900 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 shadow-sm"
                >
                  {table.number}
                </div>
                <div>
                  <p className="font-bold dark:text-zinc-200">Mesa {table.number}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setEditingTable(table)}
                  className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => {
                    if (confirm(`Deseja realmente excluir a mesa ${table.number}?`)) {
                      sendWS('TABLE_DELETE_PERMANENT', { tableId: table.id });
                    }
                  }}
                  className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={isAddModalOpen || !!editingTable} onClose={() => { setIsAddModalOpen(false); setEditingTable(null); }} title={editingTable ? "Editar Mesa" : "Nova Mesa"}>
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const data = {
            number: parseInt(formData.get('number') as string),
            type: formData.get('type')
          };
          if (editingTable) {
            sendWS('TABLE_EDIT_PERMANENT', { tableId: editingTable.id, ...data });
          } else {
            sendWS('TABLE_ADD_PERMANENT', data);
          }
          setIsAddModalOpen(false);
          setEditingTable(null);
        }} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Número da Mesa</label>
            <Input name="number" type="number" defaultValue={editingTable?.number} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo/Área</label>
            <select name="type" defaultValue={editingTable ? editingTable.type : tableTypes[0]?.id} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
              {tableTypes.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full">{editingTable ? "Salvar Alterações" : "Criar Mesa"}</Button>
        </form>
      </Modal>

      <Modal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} title="Configurar Áreas e Cores">
        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase text-zinc-400">Áreas de Atendimento</h4>
            <div className="space-y-2">
              {tableTypes.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl border border-white shadow-sm flex items-center justify-center text-white" style={{ backgroundColor: t.color }}>
                      {getIcon(t.icon || 'MapPin')}
                    </div>
                    <span className="font-medium dark:text-zinc-200">{t.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => {
                      setEditingType(t);
                      setNewTypeName(t.name);
                      setNewTypeColor(t.color);
                      setNewTypeIcon(t.icon || 'MapPin');
                    }} className="p-1.5 text-zinc-400 hover:text-emerald-600">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {tableTypes.length > 1 && (
                      <button onClick={() => {
                        if (confirm(`Excluir área "${t.name}"? Mesas vinculadas precisarão ser reatribuídas.`)) {
                          handleSaveTypes(tableTypes.filter((type: any) => type.id !== t.id));
                        }
                      }} className="p-1.5 text-zinc-400 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 space-y-3">
              <h5 className="text-xs font-bold uppercase text-zinc-500">{editingType ? 'Editar Área' : 'Nova Área'}</h5>
              <div className="grid gap-3">
                <Input value={newTypeName} onChange={(e: any) => setNewTypeName(e.target.value)} placeholder="Nome da área (ex: Deck)" />
                <div className="flex items-center gap-3">
                  <input type="color" value={newTypeColor} onChange={(e) => setNewTypeColor(e.target.value)} className="h-10 w-20 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent cursor-pointer" />
                  <span className="text-xs text-zinc-500">Cor da área</span>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-zinc-500">Ícone</label>
                  <div className="grid grid-cols-6 gap-2">
                    {icons.map(i => (
                      <button
                        key={i.name}
                        onClick={() => setNewTypeIcon(i.name)}
                        className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                          newTypeIcon === i.name 
                            ? "bg-emerald-500 text-white shadow-lg" 
                            : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                        )}
                      >
                        {i.icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => {
                    if (!newTypeName.trim()) return;
                    if (editingType) {
                      handleSaveTypes(tableTypes.map((t: any) => t.id === editingType.id ? { ...t, name: newTypeName, color: newTypeColor, icon: newTypeIcon } : t));
                    } else {
                      handleSaveTypes([...tableTypes, { id: uuidv4(), name: newTypeName, color: newTypeColor, icon: newTypeIcon }]);
                    }
                    setEditingType(null);
                    setNewTypeName('');
                    setNewTypeColor('#10b981');
                    setNewTypeIcon('MapPin');
                  }} className="flex-1" size="sm">
                    {editingType ? 'Salvar' : 'Adicionar'}
                  </Button>
                  {editingType && (
                    <Button variant="outline" onClick={() => {
                      setEditingType(null);
                      setNewTypeName('');
                      setNewTypeColor('#10b981');
                      setNewTypeIcon('MapPin');
                    }} size="sm">Cancelar</Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <h4 className="text-sm font-bold uppercase text-zinc-400">Cores de Status</h4>
            <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full border border-white shadow-sm" style={{ backgroundColor: billRequestedColor }} />
                <span className="font-medium dark:text-zinc-200">Solicitação de Conta</span>
              </div>
              <input 
                type="color" 
                value={billRequestedColor} 
                onChange={(e) => sendWS('SETTINGS_UPDATE', { color_bill_requested: e.target.value })} 
                className="h-8 w-12 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent cursor-pointer" 
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
});
