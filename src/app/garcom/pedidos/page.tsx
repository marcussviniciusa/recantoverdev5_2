'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import AnimatedCard from '../../../components/ui/AnimatedCard';
import AnimatedButton from '../../../components/ui/AnimatedButton';
import GarcomBottomNav from '../../../components/ui/GarcomBottomNav';
import { AnimatedPageContainer, StaggeredGrid, StaggeredItem } from '../../../components/ui/PageTransition';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';

interface Order {
  _id: string;
  tableId: {
    _id: string;
    number: number;
  };
  waiterId: {
    username: string;
  };
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    observations?: string;
  }>;
  status: 'preparando' | 'pronto' | 'entregue' | 'cancelado';
  totalAmount: number;
  observations?: string;
  estimatedTime?: number;
  createdAt: string;
  updatedAt: string;
}

export default function GarcomPedidos() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [filter, setFilter] = useState<string>('todos');

  useEffect(() => {
    // Verificar autenticação
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const storedUserName = localStorage.getItem('userName');

    if (!token || userRole !== 'garcom') {
      router.push('/auth/login?role=garcom');
      return;
    }

    setUserName(storedUserName || '');
    loadOrders();
  }, [router]);

  const loadOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setOrders(data.data.orders);
      }
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();
      if (data.success) {
        await loadOrders(); // Recarregar pedidos
      } else {
        alert('Erro ao atualizar pedido: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao atualizar pedido:', error);
      alert('Erro de conexão');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'preparando': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'pronto': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'entregue': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'cancelado': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'preparando': return <ClockIcon className="w-4 h-4" />;
      case 'pronto': return <CheckCircleIcon className="w-4 h-4" />;
      case 'entregue': return <CheckCircleIcon className="w-4 h-4" />;
      case 'cancelado': return <ExclamationTriangleIcon className="w-4 h-4" />;
      default: return <ClockIcon className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'preparando': return 'Preparando';
      case 'pronto': return 'Pronto';
      case 'entregue': return 'Entregue';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'todos') return true;
    return order.status === filter;
  });

  const getOrderStats = () => {
    return {
      total: orders.length,
      preparando: orders.filter(o => o.status === 'preparando').length,
      pronto: orders.filter(o => o.status === 'pronto').length,
      entregue: orders.filter(o => o.status === 'entregue').length
    };
  };

  const stats = getOrderStats();

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <AnimatedPageContainer className="bg-gradient-to-br from-primary-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="min-h-screen flex items-center justify-center pb-24">
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
              Carregando pedidos...
            </motion.h2>
          </AnimatedCard>
        </div>
        <GarcomBottomNav />
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
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Meus Pedidos</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">👨‍🍳 {userName}</p>
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
                onClick={loadOrders}
                className="font-medium"
              >
                🔄 Atualizar
              </AnimatedButton>
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        {/* Stats */}
        <motion.div
          className="mb-8"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <StaggeredGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4" staggerDelay={0.1}>
            {[
              { title: 'Total', value: stats.total, color: 'from-blue-600 to-blue-700', bgColor: 'bg-blue-50 dark:bg-blue-900/20', textColor: 'text-blue-600 dark:text-blue-400' },
              { title: 'Preparando', value: stats.preparando, color: 'from-amber-600 to-amber-700', bgColor: 'bg-amber-50 dark:bg-amber-900/20', textColor: 'text-amber-600 dark:text-amber-400' },
              { title: 'Prontos', value: stats.pronto, color: 'from-green-600 to-green-700', bgColor: 'bg-green-50 dark:bg-green-900/20', textColor: 'text-green-600 dark:text-green-400' },
              { title: 'Entregues', value: stats.entregue, color: 'from-purple-600 to-purple-700', bgColor: 'bg-purple-50 dark:bg-purple-900/20', textColor: 'text-purple-600 dark:text-purple-400' },
            ].map((stat, index) => (
              <StaggeredItem key={stat.title}>
                <AnimatedCard
                  variant="default"
                  padding="lg"
                  className={`${stat.bgColor} border-0 h-full`}
                  hoverable={true}
                >
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${stat.textColor}`}>{stat.value}</p>
                    <p className={`text-sm font-medium ${stat.textColor} opacity-80`}>{stat.title}</p>
                  </div>
                </AnimatedCard>
              </StaggeredItem>
            ))}
          </StaggeredGrid>
        </motion.div>

        {/* Filters */}
        <motion.div
          className="mb-6"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <FunnelIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtrar por status:</span>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'preparando', label: 'Preparando' },
              { key: 'pronto', label: 'Prontos' },
              { key: 'entregue', label: 'Entregues' },
              { key: 'cancelado', label: 'Cancelados' },
            ].map((filterOption) => (
              <AnimatedButton
                key={filterOption.key}
                variant={filter === filterOption.key ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilter(filterOption.key)}
                className="whitespace-nowrap"
              >
                {filterOption.label}
              </AnimatedButton>
            ))}
          </div>
        </motion.div>

        {/* Orders List */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          {filteredOrders.length === 0 ? (
            <AnimatedCard variant="default" padding="xl" className="text-center">
              <div className="text-gray-500 dark:text-gray-400">
                <p className="text-lg font-medium mb-2">Nenhum pedido encontrado</p>
                <p className="text-sm">
                  {filter === 'todos' 
                    ? 'Você ainda não tem pedidos registrados.'
                    : `Não há pedidos com status "${getStatusText(filter)}".`
                  }
                </p>
              </div>
            </AnimatedCard>
          ) : (
            <StaggeredGrid className="space-y-4" staggerDelay={0.1}>
              {filteredOrders.map((order, index) => (
                <StaggeredItem key={order._id}>
                  <AnimatedCard variant="default" padding="lg" hoverable={true}>
                    <div className="space-y-4">
                      {/* Header do pedido */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center shadow-lg">
                            <span className="text-gray-900 font-bold text-lg">{order.tableId.number}</span>
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                              Mesa {order.tableId.number}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {formatTime(order.createdAt)} • {order.waiterId.username}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                            {getStatusIcon(order.status)}
                            {getStatusText(order.status)}
                          </span>
                        </div>
                      </div>

                      {/* Items do pedido */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Itens do Pedido:</h4>
                        <div className="space-y-2">
                          {order.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex items-center justify-between text-sm">
                              <div className="flex-1">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {item.quantity}x {item.productName}
                                </span>
                                {item.observations && (
                                  <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                                    Obs: {item.observations}
                                  </p>
                                )}
                              </div>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {formatCurrency(item.totalPrice)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Footer do pedido */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
                          <span className="font-bold text-lg text-gray-900 dark:text-white">
                            {formatCurrency(order.totalAmount)}
                          </span>
                        </div>
                        
                        {/* Botões de ação */}
                        <div className="flex gap-2">
                          {order.status === 'preparando' && (
                            <AnimatedButton
                              variant="success"
                              size="sm"
                              onClick={() => updateOrderStatus(order._id, 'pronto')}
                            >
                              ✅ Marcar como Pronto
                            </AnimatedButton>
                          )}
                          {order.status === 'pronto' && (
                            <AnimatedButton
                              variant="primary"
                              size="sm"
                              onClick={() => updateOrderStatus(order._id, 'entregue')}
                            >
                              🚚 Marcar como Entregue
                            </AnimatedButton>
                          )}
                        </div>
                      </div>
                    </div>
                  </AnimatedCard>
                </StaggeredItem>
              ))}
            </StaggeredGrid>
          )}
        </motion.div>
      </main>

      <GarcomBottomNav />
    </AnimatedPageContainer>
  );
} 