'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Plus, TrendingUp, TrendingDown, DollarSign, Package, Trash2, RefreshCcw, Pencil, BarChart3, Lock, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface PricePoint {
  date: string;
  price: number;
}

interface CS2Item {
  id: string;
  name: string;
  buyPrice: number;
  quantity: number;
  currentPrice: number;
  addedAt: string;
  priceHistory?: PricePoint[];
  imageUrl?: string;
}

// Dozwolone ID użytkowników Discord
const ALLOWED_USER_IDS = ['548177225661546496'];

export default function CS2InvestmentsPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<CS2Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CS2Item | null>(null);
  const [selectedItemForChart, setSelectedItemForChart] = useState<CS2Item | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    buyPrice: '',
    quantity: '1',
  });
  const [editForm, setEditForm] = useState({
    buyPrice: '',
    quantity: '',
  });

  // Generate item image URL
  const getItemImageUrl = async (itemName: string) => {
    try {
      const response = await fetch(`/api/cs2/image?itemName=${encodeURIComponent(itemName)}`);
      if (response.ok) {
        const data = await response.json();
        return data.imageUrl || null;
      }
    } catch (error) {
      console.error('Error fetching image:', error);
    }
    return null;
  };

  // Check if user is authorized
  const userId = (session?.user as any)?.id;
  const isAuthorized = ALLOWED_USER_IDS.includes(userId);

  // Load items from database
  const loadItems = async () => {
    try {
      const response = await fetch('/api/cs2/investments');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.items) {
          // Transform MongoDB documents to our format
          const transformedItems = data.items.map((item: any) => ({
            id: item._id,
            name: item.name,
            buyPrice: item.buyPrice,
            quantity: item.quantity,
            currentPrice: item.currentPrice,
            addedAt: item.addedAt,
            priceHistory: item.priceHistory?.map((ph: any) => ({
              date: ph.date,
              price: ph.price,
            })),
            imageUrl: item.imageUrl,
          }));
          setItems(transformedItems);
        }
      }
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadItems();
    }
  }, [isAuthorized]);

  // Fetch current prices
  const fetchPrices = async () => {
    setIsLoading(true);
    try {
      const updatedItems = await Promise.all(
        items.map(async (item) => {
          try {
            const response = await fetch(`/api/cs2/price?itemName=${encodeURIComponent(item.name)}`);
            if (response.ok) {
              const data = await response.json();
              const newPrice = data.price || item.currentPrice;
              const now = new Date().toISOString();
              
              // Update price history
              const priceHistory = item.priceHistory || [];
              priceHistory.push({ date: now, price: newPrice });
              const trimmedHistory = priceHistory.slice(-30);
              
              // Fetch image if not already present
              let imageUrl = item.imageUrl;
              if (!imageUrl) {
                imageUrl = await getItemImageUrl(item.name);
              }
              
              // Save to database
              await fetch('/api/cs2/investments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: item.id,
                  currentPrice: newPrice,
                  imageUrl,
                  addPriceHistory: { date: now, price: newPrice },
                }),
              });
              
              return { 
                ...item, 
                currentPrice: newPrice,
                priceHistory: trimmedHistory,
                imageUrl,
              };
            }
          } catch (error) {
            console.error(`Error fetching price for ${item.name}:`, error);
          }
          return item;
        })
      );
      setItems(updatedItems);
      setLastUpdated(new Date());
      toast.success('Ceny zaktualizowane!');
    } catch (error) {
      toast.error('Błąd podczas aktualizacji cen');
    } finally {
      setIsLoading(false);
    }
  };

  // Add new item
  const handleAddItem = async () => {
    if (!newItem.name || !newItem.buyPrice) {
      toast.error('Wypełnij wszystkie pola');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/cs2/price?itemName=${encodeURIComponent(newItem.name)}`);
      let currentPrice = parseFloat(newItem.buyPrice);
      
      if (response.ok) {
        const data = await response.json();
        currentPrice = data.price || currentPrice;
      }

      const now = new Date().toISOString();
      
      // Fetch image URL automatically
      const imageUrl = await getItemImageUrl(newItem.name) || undefined;
      
      // Save to database
      const saveResponse = await fetch('/api/cs2/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newItem.name,
          buyPrice: parseFloat(newItem.buyPrice),
          quantity: parseInt(newItem.quantity),
          currentPrice,
          addedAt: now,
          priceHistory: [{ date: now, price: currentPrice }],
          imageUrl,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save item');
      }

      const savedData = await saveResponse.json();
      
      const item: CS2Item = {
        id: savedData.item._id,
        name: savedData.item.name,
        buyPrice: savedData.item.buyPrice,
        quantity: savedData.item.quantity,
        currentPrice: savedData.item.currentPrice,
        addedAt: savedData.item.addedAt,
        priceHistory: savedData.item.priceHistory,
        imageUrl: savedData.item.imageUrl,
      };

      setItems([...items, item]);
      setNewItem({ name: '', buyPrice: '', quantity: '1' });
      setIsDialogOpen(false);
      toast.success('Przedmiot dodany!');
    } catch (error) {
      toast.error('Błąd podczas dodawania przedmiotu');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete item
  const handleDeleteItem = async (id: string) => {
    try {
      const response = await fetch(`/api/cs2/investments?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      setItems(items.filter(item => item.id !== id));
      toast.success('Przedmiot usunięty');
    } catch (error) {
      toast.error('Błąd podczas usuwania przedmiotu');
    }
  };

  // Open edit dialog
  const handleEditItem = (item: CS2Item) => {
    setEditingItem(item);
    setEditForm({
      buyPrice: item.buyPrice.toString(),
      quantity: item.quantity.toString(),
    });
    setIsEditDialogOpen(true);
  };

  // Save edited item
  const handleSaveEdit = async () => {
    if (!editingItem || !editForm.buyPrice || !editForm.quantity) {
      toast.error('Wypełnij wszystkie pola');
      return;
    }

    try {
      const response = await fetch('/api/cs2/investments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem.id,
          buyPrice: parseFloat(editForm.buyPrice),
          quantity: parseInt(editForm.quantity),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update item');
      }

      const updatedItems = items.map(item => {
        if (item.id === editingItem.id) {
          return {
            ...item,
            buyPrice: parseFloat(editForm.buyPrice),
            quantity: parseInt(editForm.quantity),
          };
        }
        return item;
      });

      setItems(updatedItems);
      setIsEditDialogOpen(false);
      setEditingItem(null);
      toast.success('Przedmiot zaktualizowany');
    } catch (error) {
      toast.error('Błąd podczas aktualizacji przedmiotu');
    }
  };

  // Calculate statistics
  const totalInvested = items.reduce((sum, item) => sum + (item.buyPrice * item.quantity), 0);
  const currentValue = items.reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0);
  const totalProfit = currentValue - totalInvested;
  const profitPercentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // Prepare chart data
  const portfolioChartData = items.length > 0 && items[0].priceHistory 
    ? items[0].priceHistory.map((point, idx) => {
        const totalValue = items.reduce((sum, item) => {
          const historyPoint = item.priceHistory?.[idx];
          return sum + (historyPoint ? historyPoint.price * item.quantity : item.currentPrice * item.quantity);
        }, 0);
        
        return {
          date: new Date(point.date).toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' }),
          value: totalValue,
          invested: totalInvested,
        };
      })
    : [];

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Ładowanie...</div>
      </div>
    );
  }

  // Not logged in
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900 border-slate-800">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                <LogIn className="h-8 w-8 text-slate-400" />
              </div>
            </div>
            <CardTitle className="text-white">CS2 Investment Tracker</CardTitle>
            <CardDescription className="text-slate-400">
              Zaloguj się przez Discord aby kontynuować
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => signIn('discord')}
              className="w-full bg-[#5865F2] hover:bg-[#4752C4]"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Zaloguj przez Discord
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authorized (wrong user)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900 border-slate-800">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center">
                <Lock className="h-8 w-8 text-red-400" />
              </div>
            </div>
            <CardTitle className="text-white">Brak dostępu</CardTitle>
            <CardDescription className="text-slate-400">
              Ta strona jest prywatna i dostępna tylko dla wybranych użytkowników.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-slate-500 text-sm">
              Zalogowany jako: {session.user?.name}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/dyzio.png" alt="DyzioBot" className="w-10 h-10 rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-white">
                CS2 Investment Tracker
              </h1>
              {lastUpdated && (
                <p className="text-slate-500 text-xs">
                  Ostatnia aktualizacja: {lastUpdated.toLocaleDateString('pl-PL')} o {lastUpdated.toLocaleTimeString('pl-PL')}
                </p>
              )}
            </div>
          </div>
          
          {/* Hidden Action Buttons */}
          <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-slate-500 hover:text-white hover:bg-slate-800"
                  title="Dodaj przedmiot"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-white">
                <DialogHeader>
                  <DialogTitle>Dodaj nowy przedmiot</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Wprowadź dane przedmiotu z CS2
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nazwa przedmiotu</Label>
                    <Input
                      id="name"
                      placeholder="np. AK-47 | Redline (Field-Tested)"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="buyPrice">Cena zakupu (zł)</Label>
                    <Input
                      id="buyPrice"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newItem.buyPrice}
                      onChange={(e) => setNewItem({ ...newItem, buyPrice: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="quantity">Ilość</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                </div>
                <DialogFooter>
                  <Button
                    onClick={handleAddItem}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Dodaj
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Button
              onClick={fetchPrices}
              disabled={isLoading || items.length === 0}
              variant="ghost"
              size="icon"
              className="text-slate-500 hover:text-white hover:bg-slate-800"
              title="Odśwież ceny"
            >
              <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle>Edytuj przedmiot</DialogTitle>
              <DialogDescription className="text-slate-400">
                Zaktualizuj dane przedmiotu
              </DialogDescription>
            </DialogHeader>
            {editingItem && (
              <>
                <div className="mb-4">
                  <p className="text-sm text-slate-400">Nazwa przedmiotu</p>
                  <p className="text-white font-medium">{editingItem.name}</p>
                </div>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="editBuyPrice">Cena zakupu (zł)</Label>
                    <Input
                      id="editBuyPrice"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={editForm.buyPrice}
                      onChange={(e) => setEditForm({ ...editForm, buyPrice: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editQuantity">Ilość</Label>
                    <Input
                      id="editQuantity"
                      type="number"
                      min="1"
                      value={editForm.quantity}
                      onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>

                </div>
              </>
            )}
            <DialogFooter>
              <Button
                onClick={handleSaveEdit}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Zapisz zmiany
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Item Chart Dialog */}
        <Dialog open={!!selectedItemForChart} onOpenChange={(open) => !open && setSelectedItemForChart(null)}>
          <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-3xl">
            <DialogHeader>
              <DialogTitle>Historia ceny - {selectedItemForChart?.name}</DialogTitle>
              <DialogDescription className="text-slate-400">
                Zmiana ceny w czasie
              </DialogDescription>
            </DialogHeader>
            {selectedItemForChart?.priceHistory && selectedItemForChart.priceHistory.length > 0 && (
              <div className="py-4">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={selectedItemForChart.priceHistory.map(point => ({
                    date: new Date(point.date).toLocaleDateString('pl-PL', { month: 'short', day: 'numeric', hour: '2-digit' }),
                    price: point.price,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                    />
                    <YAxis 
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8' }}
                      tickFormatter={(value) => `${value.toFixed(2)} zł`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                      formatter={(value: any) => [`${value.toFixed(2)} zł`, 'Cena']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      dot={{ fill: '#3b82f6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Zainwestowano</p>
                  <p className="text-lg font-bold text-white">{totalInvested.toFixed(2)} zł</p>
                </div>
                <DollarSign className="h-4 w-4 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Wartość</p>
                  <p className="text-lg font-bold text-white">{currentValue.toFixed(2)} zł</p>
                </div>
                <Package className="h-4 w-4 text-emerald-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Zysk/Strata</p>
                  <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} zł
                  </p>
                </div>
                {totalProfit >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">ROI</p>
                  <p className={`text-lg font-bold ${profitPercentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {profitPercentage >= 0 ? '+' : ''}{profitPercentage.toFixed(1)}%
                  </p>
                </div>
                {profitPercentage >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items List - NOW ABOVE CHART */}
        {items.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-800/50 mb-6">
            <CardContent className="pt-6">
              <div className="text-center text-slate-400 py-8">
                <Package className="mx-auto h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">Brak przedmiotów</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {items.map((item, index) => {
              const profit = (item.currentPrice - item.buyPrice) * item.quantity;
              const profitPercent = ((item.currentPrice - item.buyPrice) / item.buyPrice) * 100;
              const purchaseDate = new Date(item.addedAt);

              return (
                <Card key={item.id} className="bg-white/5 border-slate-800/50 hover:border-slate-700/50 transition-all group">
                  <CardContent className="p-4">
                    {/* Item Image */}
                    <div className="flex justify-center mb-3">
                      <div className="w-16 h-16 flex items-center justify-center">
                        {item.imageUrl ? (
                          <img 
                            src={item.imageUrl} 
                            alt={item.name} 
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Package className="h-10 w-10 text-slate-500" />
                        )}
                      </div>
                    </div>

                    {/* Item Name */}
                    <h3 className="text-sm font-medium text-white text-center mb-2 truncate">
                      {item.name}
                    </h3>

                    {/* Purchase Date */}
                    <p className="text-xs text-slate-500 text-center mb-2">
                      Zakupiono: {purchaseDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>

                    {/* Details */}
                    <div className="text-center text-xs text-slate-400 space-y-0.5 mb-3">
                      <p>Kupiono: {item.buyPrice.toFixed(2)} zł • Ilość: {item.quantity}</p>
                      <p>Aktualna cena: {item.currentPrice.toFixed(2)} zł</p>
                    </div>

                    {/* Profit/Loss */}
                    <div className="text-center">
                      <p className={`text-sm font-semibold ${profitPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {profitPercent >= 0 ? '▲' : '▼'} {Math.abs(profitPercent).toFixed(2)}% ({profit >= 0 ? '+' : ''}{profit.toFixed(2)} zł)
                      </p>
                    </div>

                    {/* Hidden Actions */}
                    <div className="flex justify-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        onClick={() => setSelectedItemForChart(item)}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-purple-400"
                      >
                        <BarChart3 className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={() => handleEditItem(item)}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-blue-400"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteItem(item.id)}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Portfolio Chart - NOW BELOW ITEMS */}
        {portfolioChartData.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Historia portfela
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={portfolioChartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                  />
                  <YAxis 
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(value) => `${value.toFixed(0)}`}
                    width={40}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => [`${value.toFixed(2)} zł`, 'Wartość']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fill="url(#colorValue)" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="invested" 
                    stroke="#6366f1" 
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
