'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

  useEffect(() => {
    // Verificar autenticação
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');

    if (!token || userRole !== 'garcom') {
      router.push('/auth/login?role=garcom');
      return;
    }

    setCurrentWaiterId(userId);
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
        if (!payment.tableId || typeof payment.tableId !== 'object') {
          return false;
        }
        
        return (
          payment.tableId.number?.toString().includes(searchTerm) ||
          (payment.tableIdentification && payment.tableIdentification.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (payment.tableId.identification && payment.tableId.identification.toLowerCase().includes(searchTerm.toLowerCase())) ||
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
      
      // Filtrar pagamentos válidos para o histórico
      const validPaidPayments = paidPayments.filter(p => 
        p.tableId && 
        typeof p.tableId === 'object' && 
        p.tableId.number !== undefined
      );
      
      console.log('📊 Pagamentos - Pagamentos válidos para histórico:', validPaidPayments.length);
      console.log('📊 Pagamentos - Pagamentos do garçom:', validPaidPayments.filter(p => 
        p.waiterId?.username === currentUsername
      ).length);
      
      // Log para debug do problema de identificação histórica
      validPaidPayments.forEach((p, index) => {
        if (p.waiterId?.username === currentUsername) {
          console.log(`  ${index + 1}. Mesa ${p.tableId.number}: ${p._id.slice(-6)} - R$ ${p.totalAmount}`);
          console.log(`    🔍 Identificação histórica: "${p.tableIdentification || 'VAZIO'}" vs atual: "${p.tableId.identification || 'VAZIO'}"`);
        }
      });
      
      setPaymentsHistory(validPaidPayments);

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando pagamentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link 
                href="/garcom/dashboard"
                className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3 hover:bg-gray-200"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Meus Pagamentos</h1>
                <p className="text-sm text-gray-500">
                  Controle das suas contas e comissões
                </p>
              </div>
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500"
            >
              🔄 Atualizar
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{myTotalPendente}</div>
              <div className="text-sm text-gray-600">Podem Pagar</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{myTotalEnviado}</div>
              <div className="text-sm text-gray-600">Enviados p/ Admin</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{myTotalPago}</div>
              <div className="text-sm text-gray-600">Pagos</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{formatCurrency(myValorTotal)}</div>
              <div className="text-sm text-gray-600">Total Vendido</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">{formatCurrency(myComissaoTotal)}</div>
              <div className="text-sm text-gray-600">Comissões</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('pendentes')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'pendentes'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Minhas Mesas ({myTables.length})
              </button>
              <button
                onClick={() => setActiveTab('historico')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'historico'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Histórico de Pagamentos ({myTotalPago})
              </button>
            </nav>
          </div>

          {/* Filtros */}
          <div className="p-6 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar
                </label>
                <input
                  type="text"
                  placeholder={activeTab === 'pendentes' ? "Mesa ou identificação..." : "Mesa, identificação ou ID..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {activeTab === 'historico' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data
                  </label>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              )}

              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setDateFilter('');
                  }}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-500"
                >
                  Limpar Filtros
                </button>
              </div>
            </div>
          </div>

          {/* Conteúdo das abas */}
          <div className="p-6">
            {activeTab === 'pendentes' ? (
              // Aba de Mesas
              <>
                {filteredTables.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma mesa encontrada</h3>
                    <p className="text-gray-600">
                      {searchTerm 
                        ? 'Tente ajustar os filtros.' 
                        : 'Você não tem mesas com pagamentos pendentes no momento.'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredTables.map((tableData) => (
                      <div key={tableData.table._id} className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                          {/* Informações da mesa */}
                          <div className="flex items-center gap-4 mb-4 lg:mb-0">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                              <span className="text-green-800 font-bold text-lg">{tableData.table.number}</span>
                            </div>
                            
                            <div>
                              <div className="text-lg font-semibold text-gray-900">
                                Mesa {tableData.table.number}
                              </div>
                              <div className="text-sm text-gray-500">
                                {tableData.table.identification && `${tableData.table.identification} • `}
                                {tableData.orderCount} pedido{tableData.orderCount !== 1 ? 's' : ''}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-xl font-bold text-green-600">
                                {formatCurrency(tableData.totalAmount)}
                              </div>
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(tableData)}`}>
                                {getStatusLabel(tableData)}
                              </span>
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="flex gap-2">
                            {tableData.canPay && !tableData.payment && (
                              <Link
                                href={`/garcom/conta/${tableData.table._id}`}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                              >
                                Fechar Conta
                              </Link>
                            )}
                            {tableData.payment?.status === 'pendente' && (
                              <span className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium">
                                ⏳ Aguardando Admin
                              </span>
                            )}
                            {tableData.payment?.status === 'pago' && (
                              <span className="px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
                                ✅ Pago
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              // Aba de Histórico
              <>
                {filteredPayments.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum pagamento encontrado</h3>
                    <p className="text-gray-600">
                      {searchTerm || dateFilter 
                        ? 'Tente ajustar os filtros.' 
                        : 'Você ainda não tem pagamentos no histórico.'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPayments.map((payment) => {
                      if (!payment.tableId || typeof payment.tableId !== 'object') {
                        return null;
                      }
                      
                      return (
                        <div
                          key={payment._id}
                          className="bg-gray-50 rounded-lg border border-gray-200 p-6"
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                            {/* Informações principais */}
                            <div className="flex items-center gap-6 mb-4 lg:mb-0">
                              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <span className="text-green-800 font-bold text-lg">{payment.tableId.number}</span>
                              </div>
                              
                              <div>
                                <div className="text-lg font-semibold text-gray-900">
                                  Mesa {payment.tableId.number}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {payment.tableIdentification && `${payment.tableIdentification} • `}
                                  ID: {payment._id.slice(-6)}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-xl font-bold text-green-600">
                                  {formatCurrency(payment.totalAmount)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {payment.orderIds.length} pedido{payment.orderIds.length !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>

                            {/* Data e comissão */}
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-900">
                                {formatDate(payment.paidAt)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatTime(payment.paidAt)}
                              </div>
                              {payment.waiterCommissionEnabled && payment.waiterCommissionAmount > 0 && (
                                <div className="text-sm font-bold text-purple-600 mt-1">
                                  💰 {formatCurrency(payment.waiterCommissionAmount)}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Métodos de pagamento */}
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="text-sm font-medium text-gray-900 mb-2">
                              Métodos de Pagamento:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {payment.paymentMethods.map((method, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {getMethodLabel(method.type)}: {formatCurrency(method.amount)}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Resumo do histórico */}
                {filteredPayments.length > 0 && (
                  <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-green-800 font-medium">Total de Pagamentos</div>
                        <div className="text-xl font-bold text-green-900">{filteredPayments.length}</div>
                      </div>
                      <div>
                        <div className="text-green-800 font-medium">Valor Total</div>
                        <div className="text-xl font-bold text-green-900">
                          {formatCurrency(filteredPayments.reduce((sum, payment) => sum + payment.totalAmount, 0))}
                        </div>
                      </div>
                      <div>
                        <div className="text-green-800 font-medium">Comissões</div>
                        <div className="text-xl font-bold text-green-900">
                          {formatCurrency(filteredPayments.reduce((sum, payment) => sum + (payment.waiterCommissionAmount || 0), 0))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex justify-around">
          <Link href="/garcom/dashboard" className="flex flex-col items-center py-2 px-4 text-gray-400">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">Dashboard</span>
          </Link>
          <Link href="/garcom/mesas" className="flex flex-col items-center py-2 px-4 text-gray-400">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            </svg>
            <span className="text-xs">Mesas</span>
          </Link>
          <Link href="/garcom/pedidos" className="flex flex-col items-center py-2 px-4 text-gray-400">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs">Pedidos</span>
          </Link>
          <button className="flex flex-col items-center py-2 px-4 text-green-600">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            <span className="text-xs font-medium">Pagamentos</span>
          </button>
        </div>
      </nav>
    </div>
  );
} 