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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTableForm, setCreateTableForm] = useState({
    number: '',
    capacity: '4',
    currentCustomers: '',
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

  const createTable = async () => {
    if (!createTableForm.number || !createTableForm.capacity || !createTableForm.currentCustomers || !createTableForm.identification) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    if (parseInt(createTableForm.currentCustomers) > parseInt(createTableForm.capacity)) {
      alert('Número de clientes não pode exceder a capacidade da mesa');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: parseInt(createTableForm.number),
          capacity: parseInt(createTableForm.capacity),
          currentCustomers: parseInt(createTableForm.currentCustomers),
          identification: createTableForm.identification.trim()
        })
      });

      const data = await response.json();
      if (data.success) {
        await loadTables(); // Recarregar mesas
        setShowCreateModal(false);
        setCreateTableForm({
          number: '',
          capacity: '4',
          currentCustomers: '',
          identification: ''
        });
        alert('Mesa criada e ocupada com sucesso!');
      } else {
        alert('Erro ao criar mesa: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao criar mesa:', error);
      alert('Erro de conexão');
    }
  };

  const releaseTable = async (tableId: string) => {
    if (!confirm('Tem certeza que deseja liberar esta mesa? Ela será removida e só ficará no histórico de pagamentos.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tables/${tableId}/release`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        await loadTables(); // Recarregar mesas
        alert('Mesa liberada com sucesso!');
      } else {
        alert('Erro ao liberar mesa: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao liberar mesa:', error);
      alert('Erro de conexão');
    }
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
      <AnimatedPageContainer className="bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-950 dark:to-gray-800">
        <div className="min-h-screen flex items-center justify-center">
          <AnimatedCard variant="glass" padding="xl" className="text-center">
            <motion.div
              className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <motion.h2
              className="text-xl font-semibold text-gray-900 dark:text-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Carregando suas mesas...
            </motion.h2>
          </AnimatedCard>
        </div>
      </AnimatedPageContainer>
    );
  }

  return (
    <AnimatedPageContainer className="bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-950 dark:to-gray-800">
      <main className="min-h-screen p-4 pb-20">
        {/* Header */}
        <motion.div
          className="flex justify-between items-center mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
              Minhas Mesas
            </h1>
            <p className="text-gray-700 dark:text-gray-200 mt-1">
              Olá, {userName}! Gerencie suas mesas ativas
            </p>
          </div>
          <AnimatedButton
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            ➕ Nova Mesa
          </AnimatedButton>
        </motion.div>

        {/* Estatísticas */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <AnimatedCard variant="gradient" className="text-center">
            <div className="text-2xl font-bold text-white">{tables.length}</div>
            <div className="text-sm text-white opacity-90">Minhas Mesas</div>
          </AnimatedCard>
          <AnimatedCard variant="gradient" className="text-center">
            <div className="text-2xl font-bold text-white">
              {tables.filter(t => t.status === 'ocupada').length}
            </div>
            <div className="text-sm text-white opacity-90">Ocupadas</div>
          </AnimatedCard>
          <AnimatedCard variant="gradient" className="text-center">
            <div className="text-2xl font-bold text-white">
              {tables.reduce((acc, table) => acc + (table.currentCustomers || 0), 0)}
            </div>
            <div className="text-sm text-white opacity-90">Clientes</div>
          </AnimatedCard>
          <AnimatedCard variant="gradient" className="text-center">
            <div className="text-2xl font-bold text-white">
              R$ {(tables.length * 50).toFixed(2)}
            </div>
            <div className="text-sm text-white opacity-90">Estimativa</div>
          </AnimatedCard>
        </motion.div>

        {/* Lista de Mesas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {tables.length === 0 ? (
            <AnimatedCard variant="glass" padding="xl" className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🍽️</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Nenhuma mesa ativa
                </h3>
                <p className="text-gray-700 dark:text-gray-200 mb-4">
                  Crie uma nova mesa para começar a atender seus clientes
                </p>
                <AnimatedButton
                  variant="primary"
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 mx-auto"
                >
                  ➕ Criar Primeira Mesa
                </AnimatedButton>
              </motion.div>
            </AnimatedCard>
          ) : (
            <StaggeredGrid>
              {tables.map((table) => (
                <StaggeredItem key={table._id}>
                  <AnimatedCard variant="glass" className="h-full hover:shadow-xl transition-all duration-300">
                    {/* Header da Mesa */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getStatusColor(table.status)} flex items-center justify-center shadow-lg`}>
                          <span className="text-white font-bold text-lg">{table.number}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Mesa {table.number}</h3>
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getStatusColor(table.status)}`}>
                            <span>{getStatusIcon(table.status)}</span>
                            {getStatusText(table.status)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Informações da Mesa */}
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">Capacidade:</span>
                        <span className="font-medium text-gray-900 dark:text-white">👥 {table.capacity} pessoas</span>
                      </div>

                      {table.status === 'ocupada' && (
                        <>
                          {table.currentCustomers && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-700 dark:text-gray-300">Clientes:</span>
                              <span className="font-medium text-red-600 dark:text-red-400">🧑‍🤝‍🧑 {table.currentCustomers}</span>
                            </div>
                          )}
                          {table.identification && (
                            <div className="text-sm">
                              <span className="text-gray-700 dark:text-gray-300">Cliente:</span>
                              <p className="font-medium text-gray-900 dark:text-white mt-1">📝 {table.identification}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    {table.status === 'ocupada' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-2">
                          <Link href={`/garcom/pedido/${table._id}`} title="Fazer pedido para esta mesa">
                            <AnimatedButton variant="primary" size="sm" fullWidth>
                              🛍️ Fazer Pedido
                            </AnimatedButton>
                          </Link>
                        </div>

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
                            onClick={() => releaseTable(table._id)}
                          >
                            🔓 Liberar Mesa
                          </AnimatedButton>
                        </div>
                      </div>
                    )}
                  </AnimatedCard>
                </StaggeredItem>
              ))}
            </StaggeredGrid>
          )}
        </motion.div>
      </main>

      <GarcomBottomNav />

      {/* Modal de Criar Mesa */}
      <AnimatedModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="✨ Criar Nova Mesa"
        size="md"
        closeOnOverlayClick={false}
      >
        <form onSubmit={(e) => { e.preventDefault(); createTable(); }} className="space-y-4">
          <div>
            <label htmlFor="table-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Número da Mesa *
            </label>
            <input
              id="table-number"
              name="table-number"
              type="number"
              min="1"
              placeholder="Ex: 1, 2, 3..."
              value={createTableForm.number}
              onChange={(e) => setCreateTableForm({...createTableForm, number: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              autoFocus
              autoComplete="off"
              required
            />
          </div>

          <div>
            <label htmlFor="table-capacity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Capacidade da Mesa *
            </label>
            <select
              id="table-capacity"
              name="table-capacity"
              value={createTableForm.capacity}
              onChange={(e) => setCreateTableForm({...createTableForm, capacity: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              required
            >
              <option value="2">2 pessoas</option>
              <option value="4">4 pessoas</option>
              <option value="6">6 pessoas</option>
              <option value="8">8 pessoas</option>
              <option value="10">10 pessoas</option>
            </select>
          </div>

          <div>
            <label htmlFor="current-customers" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Número de Clientes *
            </label>
            <input
              id="current-customers"
              name="current-customers"
              type="number"
              min="1"
              max={createTableForm.capacity}
              placeholder="Quantos clientes na mesa?"
              value={createTableForm.currentCustomers}
              onChange={(e) => setCreateTableForm({...createTableForm, currentCustomers: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              autoComplete="off"
              required
            />
          </div>

          <div>
            <label htmlFor="customer-identification" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nome/Identificação do Cliente *
            </label>
            <input
              id="customer-identification"
              name="customer-identification"
              type="text"
              maxLength={100}
              placeholder="Ex: João Silva, Mesa do casal..."
              value={createTableForm.identification}
              onChange={(e) => setCreateTableForm({...createTableForm, identification: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              autoComplete="off"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setCreateTableForm({
                  number: '',
                  capacity: '4',
                  currentCustomers: '',
                  identification: ''
                });
              }}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              ✨ Criar Mesa
            </button>
          </div>
        </form>
      </AnimatedModal>
    </AnimatedPageContainer>
  );
} 