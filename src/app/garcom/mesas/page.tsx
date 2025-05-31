'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSocket } from '../../../lib/socket';
import AnimatedButton from '../../../components/ui/AnimatedButton';
import AnimatedCard from '../../../components/ui/AnimatedCard';
import AnimatedModal from '../../../components/ui/AnimatedModal';
import GarcomBottomNav from '../../../components/ui/GarcomBottomNav';
import { AnimatedPageContainer, StaggeredGrid, StaggeredItem } from '../../../components/ui/PageTransition';

interface Table {
  _id: string;
  number: number;
  capacity: number;
  status: 'disponivel' | 'ocupada' | 'reservada' | 'manutencao';
  currentCustomers?: number;
  identification?: string;
  assignedWaiter?: {
    username: string;
    email: string;
  };
  openedAt?: string;
}

export default function GarcomMesas() {
  const router = useRouter();
  const { connect, disconnect, socket } = useSocket();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [openTableForm, setOpenTableForm] = useState({
    customers: '',
    identification: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const storedUserName = localStorage.getItem('userName');
    const userId = localStorage.getItem('userId');

    if (!token || userRole !== 'garcom') {
      router.push('/auth/login?role=garcom');
      return;
    }

    setUserName(storedUserName || 'Garçom');

    // Carregar mesas apenas uma vez
    loadTables();

    // Configurar Socket.IO apenas se tiver dados de autenticação
    if (token && userRole === 'garcom' && userId) {
      const userData = {
        id: userId,
        role: userRole,
        username: storedUserName || 'Garçom'
      };
      
      connect(userData);
    }

    return () => {
      if (socket) {
        disconnect();
      }
    };
  }, []);

  const loadTables = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tables', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setTables(data.data.tables);
      }
    } catch (error) {
      console.error('Erro ao carregar mesas:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTableStatus = async (tableId: string, status: string, currentCustomers?: number, identification?: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tables/${tableId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          status, 
          currentCustomers,
          identification,
          assignedWaiter: status === 'ocupada' ? localStorage.getItem('userId') : undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        await loadTables(); // Recarregar mesas
        setShowOpenModal(false);
        setOpenTableForm({ customers: '', identification: '' });
      } else {
        alert('Erro ao atualizar mesa: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao atualizar mesa:', error);
      alert('Erro de conexão');
    }
  };

  const openTableModal = (table: Table) => {
    setSelectedTable(table);
    setShowOpenModal(true);
  };

  const handleOpenTable = () => {
    if (!selectedTable || !openTableForm.customers || parseInt(openTableForm.customers) <= 0) {
      alert('Por favor, informe o número de clientes válido');
      return;
    }

    if (parseInt(openTableForm.customers) > selectedTable.capacity) {
      alert(`Número de clientes não pode exceder a capacidade da mesa (${selectedTable.capacity})`);
      return;
    }

    updateTableStatus(
      selectedTable._id, 
      'ocupada', 
      parseInt(openTableForm.customers),
      openTableForm.identification || undefined
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'disponivel': return 'from-green-400 to-green-500 text-white';
      case 'ocupada': return 'from-red-400 to-red-500 text-white';
      case 'reservada': return 'from-amber-400 to-amber-500 text-white';
      case 'manutencao': return 'from-gray-400 to-gray-500 text-white';
      default: return 'from-gray-400 to-gray-500 text-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'disponivel': return '✅';
      case 'ocupada': return '🔴';
      case 'reservada': return '⏰';
      case 'manutencao': return '🔧';
      default: return '❓';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'disponivel': return 'Disponível';
      case 'ocupada': return 'Ocupada';
      case 'reservada': return 'Reservada';
      case 'manutencao': return 'Manutenção';
      default: return status;
    }
  };

  const logout = () => {
    localStorage.clear();
    router.push('/');
  };

  if (loading) {
    return (
      <AnimatedPageContainer className="bg-gradient-to-br from-primary-50 to-green-50 dark:from-gray-900 dark:to-gray-800">
        <div className="min-h-screen flex items-center justify-center">
          <AnimatedCard variant="glass" padding="xl" className="text-center">
            <motion.div
              className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <motion.h2
              className="text-xl font-semibold text-gray-800 dark:text-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Carregando mesas...
            </motion.h2>
          </AnimatedCard>
        </div>
      </AnimatedPageContainer>
    );
  }

  return (
    <AnimatedPageContainer className="bg-gradient-to-br from-primary-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <motion.header
        className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-white/20 shadow-lg sticky top-0 z-40"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <motion.div
              className="flex items-center"
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-green-700 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-lg font-bold">RV</span>
              </div>
              <div className="ml-4">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Recanto Verde</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">👨‍🍳 Garçom - {userName}</p>
              </div>
            </motion.div>

            <motion.div
              className="flex items-center gap-3"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <AnimatedButton
                variant="secondary"
                size="sm"
                onClick={logout}
                className="font-medium"
              >
                🚪 Sair
              </AnimatedButton>
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        {/* Stats Summary */}
        <motion.div
          className="mb-8"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Disponíveis', count: tables.filter(t => t.status === 'disponivel').length, color: 'from-green-400 to-green-500', icon: '✅' },
              { label: 'Ocupadas', count: tables.filter(t => t.status === 'ocupada').length, color: 'from-red-400 to-red-500', icon: '🔴' },
              { label: 'Reservadas', count: tables.filter(t => t.status === 'reservada').length, color: 'from-amber-400 to-amber-500', icon: '⏰' },
              { label: 'Manutenção', count: tables.filter(t => t.status === 'manutencao').length, color: 'from-gray-400 to-gray-500', icon: '🔧' },
            ].map((stat, index) => (
              <AnimatedCard
                key={stat.label}
                variant="glass"
                padding="md"
                className={`bg-gradient-to-br ${stat.color} text-white border-0`}
                delay={0.1 * index}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm font-medium">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.count}</p>
                  </div>
                  <span className="text-2xl">{stat.icon}</span>
                </div>
              </AnimatedCard>
            ))}
          </div>
        </motion.div>

        {/* Tables Grid */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              🪑 Mesas ({tables.length})
            </h2>
            <AnimatedButton
              variant="secondary"
              size="sm"
              onClick={loadTables}
              className="font-medium"
            >
              🔄 Atualizar
            </AnimatedButton>
          </div>

          <StaggeredGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" staggerDelay={0.1}>
            {tables.map((table) => (
              <StaggeredItem key={table._id}>
                <AnimatedCard
                  variant="default"
                  padding="lg"
                  hoverable={true}
                  clickable={table.status === 'disponivel'}
                  onClick={table.status === 'disponivel' ? () => openTableModal(table) : undefined}
                  className="h-full"
                >
                  {/* Table Status Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Mesa {table.number}
                    </h3>
                    <motion.span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getStatusColor(table.status)}`}
                      whileHover={{ scale: 1.05 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      {getStatusIcon(table.status)} {getStatusText(table.status)}
                    </motion.span>
                  </div>

                  {/* Table Info */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Capacidade:</span>
                      <span className="font-medium text-gray-900 dark:text-white">👥 {table.capacity} pessoas</span>
                    </div>

                    {table.status === 'ocupada' && (
                      <>
                        {table.currentCustomers && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Clientes:</span>
                            <span className="font-medium text-red-600">🧑‍🤝‍🧑 {table.currentCustomers}</span>
                          </div>
                        )}
                        {table.identification && (
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Identificação:</span>
                            <p className="font-medium text-gray-900 dark:text-white mt-1">📝 {table.identification}</p>
                          </div>
                        )}
                        {table.assignedWaiter && (
                          <div className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Garçom:</span>
                            <p className="font-medium text-primary-600">👨‍🍳 {table.assignedWaiter.username}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-6 space-y-2">
                    {table.status === 'disponivel' && (
                      <AnimatedButton
                        variant="success"
                        size="sm"
                        fullWidth
                        onClick={() => openTableModal(table)}
                      >
                        ✅ Abrir Mesa
                      </AnimatedButton>
                    )}

                    {table.status === 'ocupada' && (
                      <div className="space-y-3">
                        {/* Botões principais - primeira linha */}
                        <div className="grid grid-cols-2 gap-2">
                          <Link href={`/garcom/pedido/${table._id}`} title="Criar novo pedido para esta mesa">
                            <AnimatedButton variant="primary" size="sm" fullWidth>
                              ➕ Novo Pedido
                            </AnimatedButton>
                          </Link>
                          <Link href={`/garcom/pedidos?mesa=${table.number}`} title="Ver todos os pedidos desta mesa">
                            <AnimatedButton variant="secondary" size="sm" fullWidth>
                              📋 Ver Pedidos
                            </AnimatedButton>
                          </Link>
                        </div>
                        
                        {/* Botões de finalização - segunda linha */}
                        <div className="grid grid-cols-2 gap-2">
                          <Link href={`/garcom/conta/${table._id}`} title="Fechar conta e processar pagamento">
                            <AnimatedButton variant="warning" size="sm" fullWidth>
                              💰 Fechar Conta
                            </AnimatedButton>
                          </Link>
                          <AnimatedButton
                            variant="danger"
                            size="sm"
                            fullWidth
                            onClick={() => updateTableStatus(table._id, 'disponivel')}
                          >
                            🔓 Liberar Mesa
                          </AnimatedButton>
                        </div>
                      </div>
                    )}

                    {table.status === 'reservada' && (
                      <AnimatedButton
                        variant="warning"
                        size="sm"
                        fullWidth
                        onClick={() => updateTableStatus(table._id, 'ocupada', 1)}
                      >
                        ⏰ Confirmar Reserva
                      </AnimatedButton>
                    )}
                  </div>
                </AnimatedCard>
              </StaggeredItem>
            ))}
          </StaggeredGrid>
        </motion.div>
      </main>

      {/* Open Table Modal */}
      <AnimatedModal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        title={`Abrir Mesa ${selectedTable?.number}`}
        size="md"
      >
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <span className="text-lg">ℹ️</span>
              <div>
                <h4 className="font-medium">Mesa {selectedTable?.number}</h4>
                <p className="text-sm">Capacidade máxima: {selectedTable?.capacity} pessoas</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Número de Clientes *
            </label>
            <input
              type="number"
              min="1"
              max={selectedTable?.capacity}
              value={openTableForm.customers}
              onChange={(e) => setOpenTableForm({...openTableForm, customers: e.target.value})}
              className="
                w-full px-4 py-3 border border-gray-300 dark:border-gray-600 
                rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                transition-all duration-200
              "
              placeholder="Ex: 2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Identificação (opcional)
            </label>
            <input
              type="text"
              value={openTableForm.identification}
              onChange={(e) => setOpenTableForm({...openTableForm, identification: e.target.value})}
              className="
                w-full px-4 py-3 border border-gray-300 dark:border-gray-600 
                rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                transition-all duration-200
              "
              placeholder="Ex: João Silva, Mesa VIP..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <AnimatedButton
              variant="secondary"
              fullWidth
              onClick={() => setShowOpenModal(false)}
            >
              ❌ Cancelar
            </AnimatedButton>
            <AnimatedButton
              variant="success"
              fullWidth
              onClick={handleOpenTable}
            >
              ✅ Abrir Mesa
            </AnimatedButton>
          </div>
        </div>
      </AnimatedModal>

      <GarcomBottomNav />
    </AnimatedPageContainer>
  );
} 