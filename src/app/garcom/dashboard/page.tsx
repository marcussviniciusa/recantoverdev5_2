'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSocket } from '../../../lib/socket';
import AnimatedCard from '../../../components/ui/AnimatedCard';
import AnimatedButton from '../../../components/ui/AnimatedButton';
import GarcomBottomNav from '../../../components/ui/GarcomBottomNav';
import { AnimatedPageContainer, StaggeredGrid, StaggeredItem } from '../../../components/ui/PageTransition';
import { 
  BellIcon, 
  TableCellsIcon, 
  DocumentTextIcon, 
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface Table {
  _id: string;
  number: number;
  capacity: number;
  status: 'disponivel' | 'ocupada' | 'reservada' | 'manutencao';
}

interface Order {
  _id: string;
  tableId: {
    _id: string;
    number: number;
  };
  waiterId: {
    _id: string;
    username: string;
  };
  status: 'pendente' | 'preparando' | 'pronto' | 'entregue';
  totalAmount: number;
  items: {
    productName: string;
    quantity: number;
  }[];
  createdAt: string;
}

export default function GarcomDashboard() {
  const [myTables, setMyTables] = useState<Table[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const { notifications, unreadCount } = useSocket();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const storedUserName = localStorage.getItem('userName');

    if (!token || userRole !== 'garcom') {
      window.location.href = '/auth/login?role=garcom';
      return;
    }

    setUserName(storedUserName || 'Garçom');
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      
      const [tablesRes, ordersRes] = await Promise.all([
        fetch('/api/tables', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/orders', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (tablesRes.ok) {
        const tablesData = await tablesRes.json();
        if (tablesData.success) {
          setMyTables(tablesData.data.tables || []);
        }
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        if (ordersData.success) {
          const myOrdersList = ordersData.data.orders.filter((order: any) => {
            const orderWaiterId = typeof order.waiterId === 'object' ? order.waiterId._id : order.waiterId;
            return orderWaiterId === userId;
          });
          setMyOrders(myOrdersList);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar automaticamente a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Estatísticas rápidas
  const stats = {
    totalTables: myTables.length,
    occupiedTables: myTables.filter(t => t.status === 'ocupada').length,
    freeTables: myTables.filter(t => t.status === 'disponivel').length,
    pendingOrders: myOrders.filter(o => o.status === 'pendente').length,
    preparingOrders: myOrders.filter(o => o.status === 'preparando').length,
    readyOrders: myOrders.filter(o => o.status === 'pronto').length,
    todayRevenue: myOrders
      .filter(o => {
        const today = new Date().toDateString();
        const orderDate = new Date(o.createdAt).toDateString();
        return today === orderDate;
      })
      .reduce((sum, order) => sum + order.totalAmount, 0)
  };

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
              Carregando dashboard...
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
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">👨‍🍳 {userName}</p>
              </div>
            </motion.div>

            <motion.div
              className="flex items-center gap-3"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              {unreadCount > 0 && (
                <motion.div
                  className="relative"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <BellIcon className="w-6 h-6 text-amber-600" />
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        {/* Welcome Section */}
        <motion.div
          className="mb-8"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="text-center mb-8">
            <motion.h2
              className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-green-600 bg-clip-text text-transparent mb-2"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              Bem-vindo de volta! 👋
            </motion.h2>
            <motion.p
              className="text-gray-600 dark:text-gray-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              Aqui está um resumo do seu dia
            </motion.p>
          </div>

          {/* Notificações */}
          {unreadCount > 0 && (
            <AnimatedCard variant="gradient" padding="lg" className="mb-6 border-l-4 border-amber-500">
              <div className="flex items-center gap-3">
                <ExclamationTriangleIcon className="w-6 h-6 text-amber-600" />
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                    Você tem {unreadCount} notificação{unreadCount > 1 ? 'ões' : ''} não lida{unreadCount > 1 ? 's' : ''}
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Verifique novos pedidos e atualizações importantes
                  </p>
                </div>
              </div>
            </AnimatedCard>
          )}
        </motion.div>

        {/* Stats Cards */}
        <StaggeredGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" staggerDelay={0.1}>
          {[
            { 
              title: 'Total de Mesas', 
              value: stats.totalTables, 
              icon: TableCellsIcon, 
              color: 'from-blue-600 to-blue-700',
              bgColor: 'bg-blue-50 dark:bg-blue-900/20',
              textColor: 'text-blue-600 dark:text-blue-400'
            },
            { 
              title: 'Mesas Ocupadas', 
              value: stats.occupiedTables, 
              icon: CheckCircleIcon, 
              color: 'from-green-600 to-green-700',
              bgColor: 'bg-green-50 dark:bg-green-900/20',
              textColor: 'text-green-600 dark:text-green-400'
            },
            { 
              title: 'Pedidos Pendentes', 
              value: stats.pendingOrders, 
              icon: ClockIcon, 
              color: 'from-amber-600 to-amber-700',
              bgColor: 'bg-amber-50 dark:bg-amber-900/20',
              textColor: 'text-amber-600 dark:text-amber-400'
            },
            { 
              title: 'Receita Hoje', 
              value: formatCurrency(stats.todayRevenue), 
              icon: CurrencyDollarIcon, 
              color: 'from-purple-600 to-purple-700',
              bgColor: 'bg-purple-50 dark:bg-purple-900/20',
              textColor: 'text-purple-600 dark:text-purple-400',
              isMonetary: true
            },
          ].map((stat, index) => (
            <StaggeredItem key={stat.title}>
              <AnimatedCard
                variant="default"
                padding="lg"
                className={`${stat.bgColor} border-0 h-full`}
                hoverable={true}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${stat.textColor} opacity-80`}>
                      {stat.title}
                    </p>
                    <p className={`text-2xl font-bold ${stat.textColor} ${stat.isMonetary ? 'text-lg' : ''}`}>
                      {stat.value}
                    </p>
                  </div>
                  <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </AnimatedCard>
            </StaggeredItem>
          ))}
        </StaggeredGrid>

        {/* Quick Actions */}
        <motion.div
          className="mb-8"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">🚀 Ações Rápidas</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { href: '/garcom/mesas', label: 'Gerenciar Mesas', icon: '🪑', color: 'primary' },
              { href: '/garcom/pedidos', label: 'Ver Pedidos', icon: '📋', color: 'secondary' },
              { href: '/garcom/pagamentos', label: 'Pagamentos', icon: '💰', color: 'warning' },
              { href: '#refresh', label: 'Atualizar', icon: '🔄', color: 'success', onClick: fetchData },
            ].map((action, index) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + index * 0.1, duration: 0.3 }}
              >
                {action.href === '#refresh' ? (
                  <AnimatedButton
                    variant={action.color as any}
                    size="lg"
                    fullWidth
                    onClick={action.onClick}
                    className="h-20 flex-col"
                  >
                    <span className="text-2xl mb-1">{action.icon}</span>
                    <span className="text-sm">{action.label}</span>
                  </AnimatedButton>
                ) : (
                  <Link href={action.href}>
                    <AnimatedButton
                      variant={action.color as any}
                      size="lg"
                      fullWidth
                      className="h-20 flex-col"
                    >
                      <span className="text-2xl mb-1">{action.icon}</span>
                      <span className="text-sm">{action.label}</span>
                    </AnimatedButton>
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Orders */}
        {myOrders.length > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">📋 Pedidos Recentes</h3>
            <div className="space-y-3">
              {myOrders.slice(0, 5).map((order, index) => (
                <AnimatedCard
                  key={order._id}
                  variant="default"
                  padding="md"
                  delay={index * 0.1}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-700 to-primary-900 rounded-lg flex items-center justify-center shadow-lg">
                        <span className="text-gray-900 font-bold">{order.tableId.number}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Mesa {order.tableId.number}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatTime(order.createdAt)} • {formatCurrency(order.totalAmount)}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      order.status === 'pronto' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : order.status === 'preparando'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </AnimatedCard>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      <GarcomBottomNav />
    </AnimatedPageContainer>
  );
} 