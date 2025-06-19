'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import AnimatedCard from '../../../components/ui/AnimatedCard';
import AnimatedButton from '../../../components/ui/AnimatedButton';
import GarcomBottomNav from '../../../components/ui/GarcomBottomNav';
import GarcomHeader from '../../../components/ui/GarcomHeader';
import { AnimatedPageContainer, StaggeredGrid, StaggeredItem } from '../../../components/ui/PageTransition';
import { 
  CreditCardIcon,
  ClockIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  FunnelIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface Table {
  _id: string;
  number: number;
  capacity: number;
  status: string;
  currentCustomers?: number;
  identification?: string;
}

interface Order {
  _id: string;
  tableId: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  waiterId: {
    _id: string;
    username: string;
    email: string;
  };
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

interface Payment {
  _id: string;
  tableId: {
    _id: string;
    number: number;
    identification?: string;
  };
  orderIds: string[];
  totalAmount: number;
  paymentMethods: Array<{
    type: string;
    amount: number;
    description?: string;
  }>;
  status: string;
  paidAt: string;
  tableIdentification?: string;
  changeAmount?: number;
  
  // Campos de comissão
  waiterId?: {
    _id: string;
    username: string;
  };
  waiterCommissionEnabled: boolean;
  waiterCommissionPercentage: number;
  waiterCommissionAmount: number;
}

interface TableWithData {
  table: Table;
  orders: Order[];
  payment?: Payment;
  totalAmount: number;
  orderCount: number;
  canPay: boolean;
}

export default function GarcomPagamentos() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pendentes' | 'historico'>('pendentes');
  const [tablesData, setTablesData] = useState<TableWithData[]>([]);
  const [paymentsHistory, setPaymentsHistory] = useState<Payment[]>([]);
  const [filteredTables, setFilteredTables] = useState<TableWithData[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentWaiterId, setCurrentWaiterId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // Verificar autenticação
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');
    const storedUserName = localStorage.getItem('userName');

    if (!token || userRole !== 'garcom') {
      router.push('/auth/login?role=garcom');
      return;
    }

    setCurrentWaiterId(userId);
    setUserName(storedUserName || 'Garçom');
    loadData();
  }, [router]);

  useEffect(() => {
    if (activeTab === 'pendentes') {
      filterTablesData();
    } else {
      filterPaymentsHistory();
    }
  }, [tablesData, paymentsHistory, searchTerm, dateFilter, activeTab]);

  const filterTablesData = () => {
    let filtered = tablesData;

    if (searchTerm) {
      filtered = filtered.filter(td => 
        td.table.number.toString().includes(searchTerm) ||
        (td.table.identification && td.table.identification.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredTables(filtered);
  };

  const filterPaymentsHistory = () => {
    let filtered = paymentsHistory.filter(payment => 
      // Filtrar apenas pagamentos do garçom atual
      payment.waiterId?.username === localStorage.getItem('userName')
    );

    if (searchTerm) {
      filtered = filtered.filter(payment => {
        // ✅ CORREÇÃO: Incluir pagamentos de mesas deletadas no histórico
        // Se tableId for null, usar tableIdentification para busca
        const tableNumber = payment.tableId?.number?.toString() || '';
        const tableIdentification = payment.tableIdentification || '';
        const originalIdentification = payment.tableId?.identification || '';
        
        return (
          tableNumber.includes(searchTerm) ||
          tableIdentification.toLowerCase().includes(searchTerm.toLowerCase()) ||
          originalIdentification.toLowerCase().includes(searchTerm.toLowerCase()) ||
          payment._id.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      filtered = filtered.filter(payment => {
        const paymentDate = new Date(payment.paidAt);
        return paymentDate >= filterDate && paymentDate < nextDay;
      });
    }

    setFilteredPayments(filtered);
  };

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      const currentUsername = localStorage.getItem('userName');
      console.log('📊 Pagamentos - Carregando dados para garçom:', currentUsername);
      
      // Carregar mesas
      const tablesResponse = await fetch('/api/tables', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const tablesData = await tablesResponse.json();
      if (!tablesData.success) {
        throw new Error('Erro ao carregar mesas');
      }
      console.log('📊 Pagamentos - Mesas carregadas:', tablesData.data.tables.length);

      // Carregar pedidos
      const ordersResponse = await fetch('/api/orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const ordersData = await ordersResponse.json();
      if (!ordersData.success) {
        throw new Error('Erro ao carregar pedidos');
      }
      console.log('📊 Pagamentos - Pedidos carregados:', ordersData.data.orders.length);

      // Carregar histórico de pagamentos
      const paymentsResponse = await fetch('/api/payments', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      let payments: Payment[] = [];
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        if (paymentsData.success) {
          payments = paymentsData.data.payments || [];
          console.log('📊 Pagamentos - Pagamentos carregados:', payments.length);
        } else {
          console.log('❌ Pagamentos - Erro ao carregar:', paymentsData.error);
        }
      } else {
        console.log('❌ Pagamentos - Resposta não OK:', paymentsResponse.status);
      }

      // Separar pagamentos por status
      const pendingPayments = payments.filter(p => p.status === 'pendente' || p.status === 'processando');
      const paidPayments = payments.filter(p => p.status === 'pago');

      // Criar mapa de pedidos já pagos
      const paidOrderIds = new Set<string>();
      paidPayments.forEach(payment => {
        payment.orderIds.forEach(orderId => {
          paidOrderIds.add(orderId);
        });
      });

      // Organizar dados por mesa
      const tableMap = new Map<string, TableWithData>();

      // Inicializar mesas
      tablesData.data.tables.forEach((table: Table) => {
        console.log('🔍 Pagamentos - Mesa:', table.number, 'identificação:', table.identification);
        tableMap.set(table._id, {
          table,
          orders: [],
          totalAmount: 0,
          orderCount: 0,
          canPay: false
        });
      });

      // Organizar pedidos por mesa (apenas pedidos não pagos)
      ordersData.data.orders.forEach((order: Order) => {
        console.log('🔍 Pagamentos - Pedido:', order._id.slice(-6), 'waiterId:', order.waiterId);
        const tableData = tableMap.get(order.tableId);
        if (tableData) {
          // Só adicionar pedidos que não foram pagos
          if (!paidOrderIds.has(order._id)) {
            tableData.orders.push(order);
            if (order.status !== 'cancelado') {
              tableData.totalAmount += order.totalAmount;
              tableData.orderCount++;
            }
          }
        }
      });

      // Verificar se pode pagar
      tableMap.forEach((tableData) => {
        if (tableData.orders.length > 0) {
          const deliveredOrders = tableData.orders.filter(o => o.status === 'entregue');
          tableData.canPay = deliveredOrders.length > 0 && deliveredOrders.length === tableData.orders.length;
        }
      });

      // Adicionar pagamentos pendentes
      pendingPayments.forEach((payment) => {
        const tableId = typeof payment.tableId === 'string' ? payment.tableId : payment.tableId._id;
        const tableData = tableMap.get(tableId);
        if (tableData) {
          tableData.payment = payment;
        }
      });

      // Filtrar mesas relevantes - agora vamos filtrar por pedidos do garçom
      const currentUserId = localStorage.getItem('userId');
      const result = Array.from(tableMap.values()).filter(td => {
        // Filtrar mesas que têm pedidos do garçom atual ou pagamentos do garçom atual
        const hasMyOrders = td.orders.some(order => {
          return order.waiterId._id === currentUserId;
        });
        const hasMyPayment = td.payment && td.payment.waiterId && td.payment.waiterId._id === currentUserId;
        
        return hasMyOrders || hasMyPayment || (td.orders.length > 0 || td.payment);
      });

      console.log('📊 Pagamentos - Mesas relevantes total:', result.length);
      console.log('📊 Pagamentos - Mesas com pedidos do garçom:', result.filter(td => {
        return td.orders.some(order => {
          return order.waiterId._id === currentUserId;
        });
      }).length);

      setTablesData(result);
      
      // ✅ CORREÇÃO: Incluir TODOS os pagamentos para preservar histórico
      // Não filtrar pagamentos de mesas deletadas - histórico deve ser preservado
      console.log('📊 Pagamentos - Todos os pagamentos preservados:', paidPayments.length);
      console.log('📊 Pagamentos - Pagamentos do garçom:', paidPayments.filter(p => 
        p.waiterId?.username === currentUsername
      ).length);
      
      // Log para debug - incluindo mesas deletadas
      paidPayments.forEach((p, index) => {
        if (p.waiterId?.username === currentUsername) {
          const tableNumber = p.tableId?.number || '?';
          const isDeleted = !p.tableId?.number;
          console.log(`  ${index + 1}. Mesa ${tableNumber}${isDeleted ? ' (deletada)' : ''}: ${p._id.slice(-6)} - R$ ${p.totalAmount}`);
          console.log(`    🔍 Identificação histórica: "${p.tableIdentification || 'VAZIO'}"`);
        }
      });
      
      setPaymentsHistory(paidPayments);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMethodLabel = (type: string) => {
    const labels = {
      'dinheiro': 'Dinheiro',
      'cartao_debito': 'Cartão de Débito',
      'cartao_credito': 'Cartão de Crédito',
      'pix': 'PIX',
      'pendente': 'Pendente (Admin)',
      'outro': 'Outro'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getStatusColor = (tableData: TableWithData) => {
    if (tableData.payment?.status === 'pago') {
      return 'bg-green-100 text-green-800';
    } else if (tableData.payment?.status === 'pendente') {
      return 'bg-yellow-100 text-yellow-800';
    } else if (tableData.canPay) {
      return 'bg-blue-100 text-blue-800';
    } else if (tableData.orderCount > 0) {
      return 'bg-orange-100 text-orange-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (tableData: TableWithData) => {
    if (tableData.payment?.status === 'pago') {
      return 'Pago';
    } else if (tableData.payment?.status === 'pendente') {
      return 'Enviado p/ Admin';
    } else if (tableData.canPay) {
      return 'Pode Pagar';
    } else if (tableData.orderCount > 0) {
      return 'Em Andamento';
    }
    return 'Sem Pedidos';
  };

  // Calcular estatísticas do garçom
  const myTables = filteredTables;
  const myTotalPendente = myTables.filter(td => td.canPay && !td.payment).length;
  const myTotalEnviado = myTables.filter(td => td.payment?.status === 'pendente').length;
  const myTotalPago = filteredPayments.length;
  const myValorTotal = filteredPayments.reduce((sum, payment) => sum + payment.totalAmount, 0);
  const myComissaoTotal = filteredPayments.reduce((sum, payment) => sum + (payment.waiterCommissionAmount || 0), 0);

  if (loading) {
    return (
      <AnimatedPageContainer className="bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800">
        <div className="min-h-screen flex items-center justify-center pb-24">
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
              Carregando pagamentos...
            </motion.h2>
          </AnimatedCard>
        </div>
        <GarcomBottomNav />
      </AnimatedPageContainer>
    );
  }

  return (
    <AnimatedPageContainer className="bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800">
      {/* Header */}
      <GarcomHeader title="Pagamentos" userName={userName} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        {/* Stats */}
        <motion.div
          className="mb-8"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <StaggeredGrid className="grid grid-cols-2 lg:grid-cols-5 gap-4" staggerDelay={0.1}>
            {[
              { 
                title: 'Podem Pagar', 
                value: myTotalPendente, 
                icon: ClockIcon, 
                color: 'from-blue-600 to-blue-700',
                bgColor: 'bg-blue-50 dark:bg-blue-900/20',
                textColor: 'text-blue-600 dark:text-blue-400'
              },
              { 
                title: 'Enviados p/ Admin', 
                value: myTotalEnviado, 
                icon: CreditCardIcon, 
                color: 'from-amber-600 to-amber-700',
                bgColor: 'bg-amber-50 dark:bg-amber-900/20',
                textColor: 'text-amber-600 dark:text-amber-400'
              },
              { 
                title: 'Pagos', 
                value: myTotalPago, 
                icon: CheckCircleIcon, 
                color: 'from-green-600 to-green-700',
                bgColor: 'bg-green-50 dark:bg-green-900/20',
                textColor: 'text-green-600 dark:text-green-400'
              },
              { 
                title: 'Total Vendido', 
                value: formatCurrency(myValorTotal), 
                icon: CurrencyDollarIcon, 
                color: 'from-purple-600 to-purple-700',
                bgColor: 'bg-purple-50 dark:bg-purple-900/20',
                textColor: 'text-purple-600 dark:text-purple-400',
                isMonetary: true
              },
              { 
                title: 'Comissões', 
                value: formatCurrency(myComissaoTotal), 
                icon: CurrencyDollarIcon, 
                color: 'from-indigo-600 to-indigo-700',
                bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
                textColor: 'text-indigo-600 dark:text-indigo-400',
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
                      <p className={`text-xl font-bold ${stat.textColor} ${stat.isMonetary ? 'text-lg' : ''}`}>
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
        </motion.div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Tabs */}
          <motion.div
            className="mb-8"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <AnimatedCard variant="default" padding="none" className="overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex">
                  <motion.button
                    onClick={() => setActiveTab('pendentes')}
                    className={`py-4 px-6 text-sm font-medium border-b-2 flex-1 transition-all duration-300 ${
                      activeTab === 'pendentes'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="flex items-center gap-2">
                      <ClockIcon className="w-4 h-4" />
                      Minhas Mesas ({myTables.length})
                    </span>
                  </motion.button>
                  <motion.button
                    onClick={() => setActiveTab('historico')}
                    className={`py-4 px-6 text-sm font-medium border-b-2 flex-1 transition-all duration-300 ${
                      activeTab === 'historico'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircleIcon className="w-4 h-4" />
                      Histórico ({myTotalPago})
                    </span>
                  </motion.button>
                </nav>
              </div>

              {/* Filtros */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <MagnifyingGlassIcon className="w-4 h-4 inline mr-1" />
                      Buscar
                    </label>
                    <input
                      type="text"
                      placeholder={activeTab === 'pendentes' ? "Mesa ou identificação..." : "Mesa, identificação ou ID..."}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="
                        w-full px-4 py-3 border border-gray-300 dark:border-gray-600 
                        rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                        transition-all duration-200
                      "
                    />
                  </div>

                  {activeTab === 'historico' && (
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <CalendarDaysIcon className="w-4 h-4 inline mr-1" />
                        Data
                      </label>
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="
                          w-full px-4 py-3 border border-gray-300 dark:border-gray-600 
                          rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm
                          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                          transition-all duration-200
                        "
                      />
                    </div>
                  )}

                  <div className="flex items-end">
                    <AnimatedButton
                      variant="secondary"
                      size="lg"
                      fullWidth
                      onClick={() => {
                        setSearchTerm('');
                        setDateFilter('');
                      }}
                      className="h-12"
                    >
                      <XMarkIcon className="w-4 h-4 mr-2" />
                      Limpar Filtros
                    </AnimatedButton>
                  </div>
                </div>
              </div>

              {/* Conteúdo das abas */}
              <motion.div
                className="p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                {activeTab === 'pendentes' ? (
                  // Aba de Mesas
                  <>
                    {filteredTables.length === 0 ? (
                      <AnimatedCard variant="default" padding="xl" className="text-center">
                        <div className="text-gray-500 dark:text-gray-400">
                          <CreditCardIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhuma mesa encontrada</h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            {searchTerm 
                              ? 'Tente ajustar os filtros.' 
                              : 'Você não tem mesas com pagamentos pendentes no momento.'
                            }
                          </p>
                        </div>
                      </AnimatedCard>
                    ) : (
                      <StaggeredGrid className="space-y-4" staggerDelay={0.1}>
                        {filteredTables.map((tableData, index) => (
                          <StaggeredItem key={tableData.table._id}>
                            <AnimatedCard variant="default" padding="lg" hoverable={true}>
                              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                                {/* Informações da mesa */}
                                <div className="flex items-center gap-4 mb-4 lg:mb-0">
                                  <div className="w-12 h-12 bg-gradient-to-br from-primary-700 to-primary-900 rounded-xl flex items-center justify-center shadow-lg">
                                    <span className="text-gray-900 font-bold text-lg">{tableData.table.number}</span>
                                  </div>
                                  
                                  <div>
                                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                      Mesa {tableData.table.number}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      {tableData.table.identification && `${tableData.table.identification} • `}
                                      {tableData.orderCount} pedido{tableData.orderCount !== 1 ? 's' : ''}
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <div className="text-xl font-bold text-primary-600 dark:text-primary-400">
                                      {formatCurrency(tableData.totalAmount)}
                                    </div>
                                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(tableData)}`}>
                                      {getStatusLabel(tableData)}
                                    </span>
                                  </div>
                                </div>

                                {/* Ações */}
                                <div className="flex gap-2">
                                  {tableData.canPay && !tableData.payment && (
                                    <Link href={`/garcom/conta/${tableData.table._id}`}>
                                      <AnimatedButton variant="primary" size="sm">
                                        💰 Fechar Conta
                                      </AnimatedButton>
                                    </Link>
                                  )}
                                  {tableData.payment?.status === 'pendente' && (
                                    <AnimatedButton variant="warning" size="sm" disabled>
                                      ⏳ Aguardando Admin
                                    </AnimatedButton>
                                  )}
                                  {tableData.payment?.status === 'pago' && (
                                    <AnimatedButton variant="success" size="sm" disabled>
                                      ✅ Pago
                                    </AnimatedButton>
                                  )}
                                </div>
                              </div>
                            </AnimatedCard>
                          </StaggeredItem>
                        ))}
                      </StaggeredGrid>
                    )}
                  </>
                ) : (
                  // Aba de Histórico
                  <>
                    {filteredPayments.length === 0 ? (
                      <AnimatedCard variant="default" padding="xl" className="text-center">
                        <div className="text-gray-500 dark:text-gray-400">
                          <CheckCircleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhum pagamento encontrado</h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            {searchTerm || dateFilter 
                              ? 'Tente ajustar os filtros.' 
                              : 'Você ainda não tem pagamentos no histórico.'
                            }
                          </p>
                        </div>
                      </AnimatedCard>
                    ) : (
                      <>
                        <StaggeredGrid className="space-y-4 mb-6" staggerDelay={0.1}>
                          {filteredPayments.map((payment, index) => {
                            // ✅ CORREÇÃO: Permitir pagamentos de mesas deletadas (histórico preservado)
                            const tableDisplay = payment.tableId || {
                              _id: null,
                              number: null,
                              identification: payment.tableIdentification
                            };
                            
                            return (
                              <StaggeredItem key={payment._id}>
                                <AnimatedCard variant="default" padding="lg" hoverable={true}>
                                  <div className="space-y-4">
                                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                                      {/* Informações principais */}
                                      <div className="flex items-center gap-6 mb-4 lg:mb-0">
                                        <div className="w-12 h-12 bg-gradient-to-br from-primary-700 to-primary-900 rounded-xl flex items-center justify-center shadow-lg">
                                          <span className="text-gray-900 font-bold text-lg">
                                            {tableDisplay.number || '?'}
                                          </span>
                                        </div>
                                        
                                        <div>
                                          <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                            Mesa {tableDisplay.number || '?'}
                                            {!tableDisplay.number && (
                                              <span className="text-xs text-gray-500 ml-2">(Mesa deletada)</span>
                                            )}
                                          </div>
                                          <div className="text-sm text-gray-500 dark:text-gray-400">
                                            {payment.tableIdentification && `${payment.tableIdentification} • `}
                                            ID: {payment._id.slice(-6)}
                                          </div>
                                        </div>

                                        <div className="text-right">
                                          <div className="text-xl font-bold text-primary-600 dark:text-primary-400">
                                            {formatCurrency(payment.totalAmount)}
                                          </div>
                                          <div className="text-sm text-gray-500 dark:text-gray-400">
                                            {payment.orderIds.length} pedido{payment.orderIds.length !== 1 ? 's' : ''}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Data e comissão */}
                                      <div className="text-right">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                          {formatDate(payment.paidAt)}
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                          {formatTime(payment.paidAt)}
                                        </div>
                                        {payment.waiterCommissionEnabled && payment.waiterCommissionAmount > 0 && (
                                          <div className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-1">
                                            💰 {formatCurrency(payment.waiterCommissionAmount)}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Métodos de pagamento */}
                                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                      <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                                        Métodos de Pagamento:
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {payment.paymentMethods.map((method, methodIndex) => (
                                          <span
                                            key={methodIndex}
                                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                          >
                                            {getMethodLabel(method.type)}: {formatCurrency(method.amount)}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </AnimatedCard>
                              </StaggeredItem>
                            );
                          })}
                        </StaggeredGrid>

                        {/* Resumo do histórico */}
                        <AnimatedCard variant="gradient" padding="lg" className="bg-gradient-to-r from-primary-50 to-green-50 dark:from-primary-900/30 dark:to-green-900/30 border border-primary-200 dark:border-primary-800">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                            <div>
                              <div className="text-primary-800 dark:text-primary-200 font-medium">Total de Pagamentos</div>
                              <div className="text-xl font-bold text-primary-900 dark:text-primary-100">{filteredPayments.length}</div>
                            </div>
                            <div>
                              <div className="text-primary-800 dark:text-primary-200 font-medium">Valor Total</div>
                              <div className="text-xl font-bold text-primary-900 dark:text-primary-100">
                                {formatCurrency(filteredPayments.reduce((sum, payment) => sum + payment.totalAmount, 0))}
                              </div>
                            </div>
                            <div>
                              <div className="text-primary-800 dark:text-primary-200 font-medium">Comissões</div>
                              <div className="text-xl font-bold text-primary-900 dark:text-primary-100">
                                {formatCurrency(filteredPayments.reduce((sum, payment) => sum + (payment.waiterCommissionAmount || 0), 0))}
                              </div>
                            </div>
                          </div>
                        </AnimatedCard>
                      </>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatedCard>
          </motion.div>
        </div>
      </main>

      <GarcomBottomNav />
    </AnimatedPageContainer>
  );
} 