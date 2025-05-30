/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';

interface Table {
  _id: string;
  number: number;
  capacity: number;
  status: 'livre' | 'ocupada' | 'reservada';
  currentCustomers?: number;
  identification?: string;
  orderCount?: number;
  revenue?: number;
}

interface Order {
  _id: string;
  tableId: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

interface RestaurantMapProps {
  onTableClick?: (table: Table) => void;
  refreshInterval?: number;
}

export default function RestaurantMap({ onTableClick, refreshInterval = 10000 }: RestaurantMapProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Hook de animação para pulsação global
  const pulseAnimation = useSpring(1, {
    stiffness: 400,
    damping: 30,
  });

  // Animar a pulsação
  useEffect(() => {
    const interval = setInterval(() => {
      pulseAnimation.set(pulseAnimation.get() === 1 ? 1.02 : 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const [tablesRes, ordersRes] = await Promise.all([
        fetch('/api/tables', { headers }),
        fetch('/api/orders', { headers })
      ]);

      const tablesData = await tablesRes.json();
      const ordersData = await ordersRes.json();

      if (tablesData.success && ordersData.success) {
        // Processar dados das mesas com estatísticas
        const processedTables = tablesData.data.tables.map((table: Table) => {
          const tableOrders = ordersData.data.orders.filter((order: Order) => 
            order.tableId === table._id && order.status !== 'cancelado'
          );
          
          const revenue = tableOrders.reduce((sum: number, order: Order) => 
            sum + order.totalAmount, 0
          );

          return {
            ...table,
            orderCount: tableOrders.length,
            revenue
          };
        });

        setTables(processedTables);
        setOrders(ordersData.data.orders);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Erro ao carregar dados do mapa:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [loadData, refreshInterval]);

  const getTableColor = (table: Table) => {
    switch (table.status) {
      case 'ocupada':
        return {
          bg: 'from-red-400 to-red-600',
          border: 'border-red-500',
          shadow: 'shadow-red-500/50'
        };
      case 'reservada':
        return {
          bg: 'from-yellow-400 to-yellow-600',
          border: 'border-yellow-500',
          shadow: 'shadow-yellow-500/50'
        };
      default:
        return {
          bg: 'from-green-400 to-green-600',
          border: 'border-green-500',
          shadow: 'shadow-green-500/50'
        };
    }
  };

  const getTableSize = (capacity: number) => {
    if (capacity <= 2) return 'w-16 h-16';
    if (capacity <= 4) return 'w-20 h-20';
    if (capacity <= 6) return 'w-24 h-24';
    return 'w-28 h-28';
  };

  const getGridPosition = (index: number, total: number) => {
    const cols = Math.ceil(Math.sqrt(total));
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    return {
      gridColumn: col + 1,
      gridRow: row + 1,
    };
  };

  const handleTableClick = (table: Table) => {
    setSelectedTable(selectedTable === table._id ? null : table._id);
    onTableClick?.(table);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-center h-96">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
          />
          <span className="ml-4 text-lg text-gray-600">Carregando mapa do restaurante...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header do Mapa */}
      <motion.div 
        className="bg-gradient-to-r from-blue-600 to-purple-600 p-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">
              🗺️ Mapa do Restaurante
            </h3>
            <p className="text-blue-100">
              Visualização em tempo real • {tables.length} mesas
            </p>
          </div>
          <div className="text-right">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-3 h-3 bg-green-400 rounded-full mb-1"
            />
            <p className="text-xs text-blue-100">
              Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Legenda */}
      <motion.div 
        className="px-6 py-4 bg-gray-50 border-b"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-center space-x-8 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gradient-to-br from-green-400 to-green-600 rounded mr-2"></div>
            <span className="text-gray-700">Livre</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gradient-to-br from-red-400 to-red-600 rounded mr-2"></div>
            <span className="text-gray-700">Ocupada</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded mr-2"></div>
            <span className="text-gray-700">Reservada</span>
          </div>
        </div>
      </motion.div>

      {/* Área do Mapa */}
      <div className="p-8">
        <div 
          className="grid gap-6 min-h-[500px] justify-items-center"
          style={{
            gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(tables.length))}, 1fr)`,
          }}
        >
          <AnimatePresence>
            {tables.map((table, index) => {
              const colors = getTableColor(table);
              const isSelected = selectedTable === table._id;
              
              return (
                <motion.div
                  key={table._id}
                  layout
                  initial={{ opacity: 0, scale: 0, rotate: -180 }}
                  animate={{ 
                    opacity: 1, 
                    scale: isSelected ? 1.1 : 1,
                    rotate: 0
                  }}
                  whileHover={{ 
                    scale: 1.05,
                    rotateY: 10,
                  }}
                  whileTap={{ scale: 0.95 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                    delay: index * 0.1
                  }}
                  className={`
                    ${getTableSize(table.capacity)}
                    relative cursor-pointer group
                  `}
                  onClick={() => handleTableClick(table)}
                >
                  {/* Mesa */}
                  <motion.div
                    className={`
                      w-full h-full rounded-xl border-2 
                      bg-gradient-to-br ${colors.bg} ${colors.border}
                      shadow-lg ${colors.shadow}
                      flex flex-col items-center justify-center
                      transition-all duration-300
                      ${isSelected ? 'shadow-2xl ring-4 ring-white' : ''}
                    `}
                    animate={{
                      boxShadow: table.status === 'ocupada' 
                        ? ['0 0 20px rgba(239, 68, 68, 0.5)', '0 0 30px rgba(239, 68, 68, 0.8)', '0 0 20px rgba(239, 68, 68, 0.5)']
                        : undefined
                    }}
                    transition={{
                      duration: 2,
                      repeat: table.status === 'ocupada' ? Infinity : 0,
                    }}
                  >
                    {/* Número da Mesa */}
                    <motion.span 
                      className="text-lg font-bold text-white"
                      animate={{ scale: isSelected ? [1, 1.2, 1] : 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      {table.number}
                    </motion.span>
                    
                    {/* Capacidade */}
                    <span className="text-xs text-white/80">
                      {table.capacity}p
                    </span>

                    {/* Indicador de Pedidos */}
                    {table.orderCount && table.orderCount > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg"
                      >
                        {table.orderCount}
                      </motion.div>
                    )}

                    {/* Indicador de Receita */}
                    {table.revenue && table.revenue > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold shadow-lg whitespace-nowrap"
                      >
                        R$ {table.revenue.toFixed(0)}
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Tooltip */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        className="absolute top-full mt-4 left-1/2 transform -translate-x-1/2 z-10"
                      >
                        <div className="bg-gray-900 text-white rounded-lg p-4 shadow-2xl min-w-[200px]">
                          <div className="text-center">
                            <h4 className="font-bold text-lg mb-2">Mesa {table.number}</h4>
                            <div className="space-y-1 text-sm">
                              <p>Capacidade: {table.capacity} pessoas</p>
                              <p>Status: <span className="capitalize font-semibold">{table.status}</span></p>
                              {table.identification && (
                                <p>Cliente: {table.identification}</p>
                              )}
                              {table.currentCustomers && (
                                <p>Ocupação: {table.currentCustomers}/{table.capacity}</p>
                              )}
                              {table.orderCount && table.orderCount > 0 && (
                                <p>Pedidos: {table.orderCount}</p>
                              )}
                              {table.revenue && table.revenue > 0 && (
                                <p>Receita: R$ {table.revenue.toFixed(2)}</p>
                              )}
                            </div>
                          </div>
                          {/* Seta do tooltip */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Estatísticas em tempo real */}
        <motion.div 
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-4 text-center">
            <motion.div
              className="text-2xl font-bold"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {tables.filter(t => t.status === 'livre').length}
            </motion.div>
            <div className="text-green-100">Mesas Livres</div>
          </div>
          
          <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg p-4 text-center">
            <motion.div
              className="text-2xl font-bold"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            >
              {tables.filter(t => t.status === 'ocupada').length}
            </motion.div>
            <div className="text-red-100">Mesas Ocupadas</div>
          </div>
          
          <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg p-4 text-center">
            <motion.div
              className="text-2xl font-bold"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: 1 }}
            >
              {tables.filter(t => t.status === 'reservada').length}
            </motion.div>
            <div className="text-yellow-100">Mesas Reservadas</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
} 