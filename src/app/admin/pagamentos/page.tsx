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
  assignedWaiter?: {
    username: string;
  };
}

interface Order {
  _id: string;
  tableId: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  waiterId: {
    username: string;
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
  baseAmount: number;
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

export default function AdminPagamentos() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pendentes' | 'historico'>('pendentes');
  const [tablesData, setTablesData] = useState<TableWithData[]>([]);
  const [paymentsHistory, setPaymentsHistory] = useState<Payment[]>([]);
  const [filteredTables, setFilteredTables] = useState<TableWithData[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [pendingPaymentToFinalize, setPendingPaymentToFinalize] = useState<Payment | null>(null);
  const [finalizePaymentMethods, setFinalizePaymentMethods] = useState<Array<{type: string, amount: number, description?: string}>>([]);
  const [submittingFinalize, setSubmittingFinalize] = useState(false);

  useEffect(() => {
    // Verificar autenticação
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'recepcionista') {
      router.push('/auth/login?role=recepcionista');
      return;
    }

    loadData();
  }, [router]);

  useEffect(() => {
    if (activeTab === 'pendentes') {
      filterTablesData();
    } else {
      filterPaymentsHistory();
    }
  }, [tablesData, paymentsHistory, statusFilter, searchTerm, dateFilter, activeTab]);

  const filterTablesData = () => {
    let filtered = tablesData;

    if (statusFilter) {
      if (statusFilter === 'pendente') {
        filtered = filtered.filter(td => 
          (td.canPay && !td.payment) || // Mesas que podem pagar mas ainda não têm pagamento
          (td.payment && td.payment.status === 'pendente') // Mesas com pagamentos pendentes
        );
      } else if (statusFilter === 'ocupada') {
        filtered = filtered.filter(td => td.table.status === 'ocupada');
      }
    }

    if (searchTerm) {
      filtered = filtered.filter(td => 
        td.table.number.toString().includes(searchTerm) ||
        (td.table.identification && td.table.identification.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (td.table.assignedWaiter && td.table.assignedWaiter.username.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredTables(filtered);
  };

  const filterPaymentsHistory = () => {
    let filtered = paymentsHistory;

    if (searchTerm) {
      filtered = filtered.filter(payment => {
        // Verificar se tableId existe e não é null
        if (!payment.tableId || typeof payment.tableId !== 'object') {
          return false;
        }
        
        return (
          payment.tableId.number?.toString().includes(searchTerm) ||
          // CORREÇÃO: Buscar também no campo tableIdentification (histórico)
          (payment.tableIdentification && payment.tableIdentification.toLowerCase().includes(searchTerm.toLowerCase())) ||
          // Manter busca no campo atual também (para compatibilidade)
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

      // Carregar histórico completo de pagamentos
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
        }
      }

      // Separar pagamentos por status primeiro
      const pendingPayments = payments.filter(p => p.status === 'pendente' || p.status === 'processando');
      const paidPayments = payments.filter(p => p.status === 'pago');

      // Criar mapa de pedidos já pagos (apenas de pagamentos CONCLUÍDOS)
      const paidOrderIds = new Set<string>();
      paidPayments.forEach(payment => {
        payment.orderIds.forEach(orderId => {
          paidOrderIds.add(orderId);
        });
      });

      // Criar mapa de pedidos em pagamentos pendentes
      const pendingOrderIds = new Set<string>();
      pendingPayments.forEach(payment => {
        payment.orderIds.forEach(orderId => {
          pendingOrderIds.add(orderId);
        });
      });

      console.log(`📊 Total de pagamentos carregados: ${payments.length}`);
      console.log(`📊 Pagamentos pendentes: ${pendingPayments.length}`);
      console.log(`📊 Pagamentos pagos: ${paidPayments.length}`);
      console.log(`📊 Pedidos já pagos: ${paidOrderIds.size}`);
      console.log(`📊 Pedidos em pagamentos pendentes: ${pendingOrderIds.size}`);

      // Organizar dados por mesa para pagamentos pendentes
      const tableMap = new Map<string, TableWithData>();

      // Inicializar mesas
      tablesData.data.tables.forEach((table: Table) => {
        tableMap.set(table._id, {
          table,
          orders: [],
          totalAmount: 0,
          orderCount: 0,
          canPay: false
        });
      });

      // Organizar pedidos por mesa (pedidos não pagos OU em pagamentos pendentes)
      ordersData.data.orders.forEach((order: Order) => {
        const tableData = tableMap.get(order.tableId);
        if (tableData) {
          // CORREÇÃO: Incluir pedidos que NÃO foram pagos OU estão em pagamentos pendentes
          if (!paidOrderIds.has(order._id)) {
            tableData.orders.push(order);
            if (order.status !== 'cancelado') {
              tableData.totalAmount += order.totalAmount;
              tableData.orderCount++;
            }
          }
        }
      });

      // Verificar se pode pagar (todos pedidos entregues e não pagos)
      tableMap.forEach((tableData) => {
        if (tableData.orders.length > 0) {
          const deliveredOrders = tableData.orders.filter(o => o.status === 'entregue');
          tableData.canPay = deliveredOrders.length > 0 && deliveredOrders.length === tableData.orders.length;
        }
      });

      // Adicionar apenas pagamentos realmente pendentes
      pendingPayments.forEach((payment) => {
        const tableId = typeof payment.tableId === 'string' ? payment.tableId : payment.tableId._id;
        const tableData = tableMap.get(tableId);
        if (tableData) {
          tableData.payment = payment;
          
          // CORREÇÃO: Para pagamentos pendentes, garantir que os pedidos sejam exibidos
          // Se a mesa tem pagamento pendente mas não tem pedidos carregados, carregar os pedidos do pagamento
          if (tableData.orderCount === 0 && payment.orderIds.length > 0) {
            // Buscar os pedidos específicos deste pagamento
            const paymentOrdersCount = payment.orderIds.length;
            tableData.orderCount = paymentOrdersCount;
            // Usar o valor total do pagamento se não tiver valor calculado dos pedidos
            if (tableData.totalAmount === 0) {
              tableData.totalAmount = payment.totalAmount;
            }
            console.log(`🔄 Mesa ${tableData.table.number}: Ajustado para mostrar ${paymentOrdersCount} pedidos do pagamento pendente`);
          }
          
          console.log(`➕ Adicionado pagamento pendente para mesa ${tableData.table.number}: ${payment._id}`);
        }
      });

      // Filtrar mesas relevantes com uma lógica melhorada
      const result = Array.from(tableMap.values()).filter(td => {
        // Mostrar mesa se:
        // 1. Tem pedidos ativos (não pagos)
        // 2. Tem pagamentos pendentes  
        // 3. Está ocupada MAS tem pedidos ativos
        return td.orders.length > 0 || td.payment;
      });

      // Log das mesas com pagamentos pendentes
      const tablesWithPendingPayments = result.filter(td => td.payment);
      console.log(`📋 Mesas com pagamentos pendentes: ${tablesWithPendingPayments.length}`);
      tablesWithPendingPayments.forEach(td => {
        console.log(`  Mesa ${td.table.number}: ${td.payment?._id} (${td.payment?.status}) - R$ ${td.payment?.totalAmount}`);
      });

      // Log das mesas filtradas
      console.log(`📋 Total de mesas exibidas: ${result.length}`);
      result.forEach(td => {
        console.log(`  Mesa ${td.table.number}: ${td.orderCount} pedidos ativos, ${td.canPay ? 'PODE PAGAR' : 'EM ANDAMENTO'}, Status: ${td.table.status}, Payment: ${td.payment ? `${td.payment._id} (${td.payment.status})` : 'Nenhum'}`);
      });

      setTablesData(result);
      
      // Filtrar apenas pagamentos PAGOS válidos (com tableId válido) para o histórico
      const validPaidPayments = paidPayments.filter(p => 
        p.tableId && 
        typeof p.tableId === 'object' && 
        p.tableId.number !== undefined
      );
      
      console.log(`📊 Pagamentos válidos no histórico: ${validPaidPayments.length}`);
      validPaidPayments.forEach((p, index) => {
        console.log(`  ${index + 1}. Mesa ${p.tableId.number}: ${p._id} - R$ ${p.totalAmount} (${new Date(p.paidAt).toLocaleString('pt-BR')})`);
        // Log para debug do problema de identificação histórica
        console.log(`    🔍 Identificação histórica: "${p.tableIdentification || 'VAZIO'}" vs atual: "${p.tableId.identification || 'VAZIO'}"`);
      });
      
      setPaymentsHistory(validPaidPayments);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentDetails = async (payment: Payment) => {
    try {
      setDetailsLoading(true);
      const token = localStorage.getItem('token');
      
      // Carregar detalhes dos pedidos do pagamento
      const ordersDetails = await Promise.all(
        payment.orderIds.map(async (orderId) => {
          const response = await fetch(`/api/orders/${orderId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            return data.data?.order || null;
          }
          return null;
        })
      );

      // Filtrar apenas pedidos válidos
      const validOrders = ordersDetails.filter(order => order !== null);

      setPaymentDetails({
        payment,
        orders: validOrders
      });
      
      setSelectedPayment(payment);
    } catch (error) {
      console.error('Erro ao carregar detalhes do pagamento:', error);
      alert('Erro ao carregar detalhes do pagamento');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedPayment(null);
    setPaymentDetails(null);
  };

  const openFinalizeModal = (payment: Payment) => {
    setPendingPaymentToFinalize(payment);
    setFinalizePaymentMethods([{ type: 'dinheiro', amount: payment.totalAmount }]);
    setShowFinalizeModal(true);
  };

  const closeFinalizeModal = () => {
    setPendingPaymentToFinalize(null);
    setFinalizePaymentMethods([]);
    setShowFinalizeModal(false);
  };

  const addFinalizePaymentMethod = () => {
    setFinalizePaymentMethods([...finalizePaymentMethods, { type: 'dinheiro', amount: 0 }]);
  };

  const updateFinalizePaymentMethod = (index: number, field: string, value: any) => {
    const updated = [...finalizePaymentMethods];
    updated[index] = { ...updated[index], [field]: value };
    setFinalizePaymentMethods(updated);
  };

  const removeFinalizePaymentMethod = (index: number) => {
    setFinalizePaymentMethods(finalizePaymentMethods.filter((_, i) => i !== index));
  };

  const getTotalFinalizePaid = () => {
    return finalizePaymentMethods.reduce((sum, method) => sum + method.amount, 0);
  };

  const getFinalizeChange = () => {
    if (!pendingPaymentToFinalize) return 0;
    const totalPaid = getTotalFinalizePaid();
    return Math.max(0, totalPaid - pendingPaymentToFinalize.totalAmount);
  };

  const isFinalizePaymentValid = () => {
    if (!pendingPaymentToFinalize) return false;
    const totalPaid = getTotalFinalizePaid();
    return totalPaid >= pendingPaymentToFinalize.totalAmount && finalizePaymentMethods.length > 0;
  };

  const finalizePendingPayment = async () => {
    if (!pendingPaymentToFinalize || !isFinalizePaymentValid()) {
      alert('Valor pago deve ser igual ou maior que o valor da conta');
      return;
    }

    setSubmittingFinalize(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/payments/finalize', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId: pendingPaymentToFinalize._id,
          paymentMethods: finalizePaymentMethods
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Pagamento finalizado com sucesso!');
        closeFinalizeModal();
        loadData(); // Recarregar dados
      } else {
        alert('Erro ao finalizar pagamento: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao finalizar pagamento:', error);
      alert('Erro de conexão');
    } finally {
      setSubmittingFinalize(false);
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
      'outro': 'Outro'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getStatusColor = (tableData: TableWithData) => {
    if (tableData.payment?.status === 'pago') {
      return 'bg-green-100 text-green-800';
    } else if (tableData.canPay) {
      return 'bg-yellow-100 text-yellow-800';
    } else if (tableData.orderCount > 0) {
      // Tem pedidos ativos mas ainda não pode pagar (preparando, etc)
      return 'bg-blue-100 text-blue-800';
    }
    // Mesa sem pedidos ativos - provavelmente já foi paga ou está disponível
    return 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (tableData: TableWithData) => {
    if (tableData.payment?.status === 'pago') {
      return 'Pago';
    } else if (tableData.canPay) {
      return 'Pode Pagar';
    } else if (tableData.orderCount > 0) {
      // Tem pedidos ativos mas ainda não pode pagar
      return 'Em Andamento';
    }
    // Mesa sem pedidos ativos
    return 'Sem Pedidos Ativos';
  };

  // Calcular estatísticas
  // CORREÇÃO: Incluir mesas com pagamentos pendentes no contador
  const totalPendente = tablesData.filter(td => 
    (td.canPay && !td.payment) || // Mesas que podem pagar mas ainda não têm pagamento
    (td.payment && td.payment.status === 'pendente') // Mesas com pagamentos pendentes
  ).length;
  
  // Log para debug do contador
  const mesasQuePodesPagar = tablesData.filter(td => td.canPay && !td.payment);
  const mesasComPagamentoPendente = tablesData.filter(td => td.payment && td.payment.status === 'pendente');
  console.log(`📊 CONTADOR - Mesas que podem pagar: ${mesasQuePodesPagar.length}`);
  console.log(`📊 CONTADOR - Mesas com pagamento pendente: ${mesasComPagamentoPendente.length}`);
  console.log(`📊 CONTADOR - Total pendente: ${totalPendente}`);
  
  const totalPago = paymentsHistory.length;
  const valorTotal = paymentsHistory.reduce((sum, payment) => sum + payment.totalAmount, 0);
  
  // CORREÇÃO: Incluir valor de pagamentos pendentes no cálculo
  const valorPendente = tablesData.filter(td => 
    (td.canPay && !td.payment) || 
    (td.payment && td.payment.status === 'pendente')
  ).reduce((sum, td) => {
    // Se tem pagamento pendente, usar o valor do pagamento, senão usar valor dos pedidos
    return sum + (td.payment?.status === 'pendente' ? td.payment.totalAmount : td.totalAmount);
  }, 0);
  
  const valorDia = paymentsHistory
    .filter(payment => {
      const today = new Date().toDateString();
      return new Date(payment.paidAt).toDateString() === today;
    })
    .reduce((sum, payment) => sum + payment.totalAmount, 0);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando pagamentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Central de Pagamentos</h1>
          <p className="mt-1 text-gray-600">
            Controle completo de pagamentos e histórico
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
        >
          🔄 Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{totalPendente}</p>
              <p className="text-sm text-gray-600">Mesas Pendentes</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{totalPago}</p>
              <p className="text-sm text-gray-600">Total Histórico</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(valorTotal)}</p>
              <p className="text-sm text-gray-600">Total Geral</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(valorDia)}</p>
              <p className="text-sm text-gray-600">Recebido Hoje</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(valorPendente)}</p>
              <p className="text-sm text-gray-600">Valor Pendente</p>
            </div>
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
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pagamentos Pendentes ({totalPendente})
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === 'historico'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Histórico de Pagamentos ({totalPago})
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
                placeholder={activeTab === 'pendentes' ? "Mesa, identificação ou garçom..." : "Mesa, identificação ou ID..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {activeTab === 'pendentes' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="ocupada">Em Andamento</option>
                  <option value="pendente">Pode Pagar</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data
                </label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
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
            // Aba de Pagamentos Pendentes
            <>
              {filteredTables.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma mesa encontrada</h3>
                  <p className="text-gray-600">
                    {searchTerm || statusFilter 
                      ? 'Tente ajustar os filtros.' 
                      : 'Não há mesas com pagamentos pendentes.'
                    }
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Mesa
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Identificação
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Garçom
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pedidos
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Valor Total
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredTables.map((tableData) => (
                        <tr key={tableData.table._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <span className="text-blue-800 font-bold text-sm">{tableData.table.number}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {tableData.table.identification || '-'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {tableData.table.currentCustomers ? `${tableData.table.currentCustomers} clientes` : ''}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {tableData.table.assignedWaiter?.username || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {tableData.payment?.status === 'pendente' 
                                ? `${tableData.payment.orderIds.length} pedidos`
                                : `${tableData.orderCount} pedidos`
                              }
                            </div>
                            <div className="text-sm text-gray-500">
                              {tableData.payment?.status === 'pendente' 
                                ? 'Em pagamento'
                                : `${tableData.orders.filter(o => o.status === 'entregue').length} entregues`
                              }
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">
                              {formatCurrency(tableData.payment?.status === 'pendente' ? tableData.payment.totalAmount : tableData.totalAmount)}
                            </div>
                            {tableData.payment?.status === 'pendente' && (
                              <div className="text-xs text-orange-600">
                                Pagamento Pendente
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              tableData.payment?.status === 'pendente' 
                                ? 'bg-orange-100 text-orange-800' 
                                : getStatusColor(tableData)
                            }`}>
                              {tableData.payment?.status === 'pendente' ? 'Pagamento Pendente' : getStatusLabel(tableData)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {tableData.canPay && !tableData.payment ? (
                              <Link
                                href={`/garcom/conta/${tableData.table._id}`}
                                className="text-blue-600 hover:text-blue-700 font-medium"
                              >
                                Processar Pagamento
                              </Link>
                            ) : tableData.payment?.status === 'pendente' ? (
                              <button
                                onClick={() => openFinalizeModal(tableData.payment!)}
                                className="text-green-600 hover:text-green-700 font-medium"
                              >
                                Finalizar Pagamento
                              </button>
                            ) : tableData.payment?.status === 'pago' ? (
                              <span className="text-gray-600">✓ Pago</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            // Aba de Histórico de Pagamentos
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
                      : 'Ainda não há pagamentos no histórico.'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPayments.map((payment) => {
                    // ✅ CORREÇÃO: Permitir pagamentos de mesas deletadas (histórico preservado)
                    // Se tableId é null (mesa deletada), ainda assim mostrar o pagamento
                    const tableDisplay = payment.tableId || {
                      _id: null,
                      number: null,
                      identification: payment.tableIdentification
                    };
                    
                    return (
                      <div
                        key={payment._id}
                        className="bg-gray-50 rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => loadPaymentDetails(payment)}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                          {/* Informações principais */}
                          <div className="flex items-center gap-6 mb-4 lg:mb-0">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                              <span className="text-green-800 font-bold text-lg">
                                {tableDisplay.number || '?'}
                              </span>
                            </div>
                            
                            <div>
                              <div className="text-lg font-semibold text-gray-900">
                                Mesa {tableDisplay.number || '?'}
                                {!tableDisplay.number && (
                                  <span className="text-xs text-gray-500 ml-2">(Mesa deletada)</span>
                                )}
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

                          {/* Data e hora */}
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">
                              {formatDate(payment.paidAt)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatTime(payment.paidAt)}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                loadPaymentDetails(payment);
                              }}
                              disabled={detailsLoading}
                              className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {detailsLoading ? 'Carregando...' : 'Ver Detalhes'}
                            </button>
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
                          {payment.changeAmount && payment.changeAmount > 0 && (
                            <div className="mt-2 text-sm text-blue-600">
                              Troco: {formatCurrency(payment.changeAmount)}
                            </div>
                          )}
                        </div>

                        {/* Indicador de clique */}
                        <div className="mt-3 text-center text-xs text-gray-400">
                          👆 Clique para ver detalhes completos
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Resumo do histórico */}
              {filteredPayments.length > 0 && (
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div className="text-blue-800 font-medium">
                      Resumo: {filteredPayments.length} pagamento{filteredPayments.length !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xl font-bold text-blue-900">
                      Total: {formatCurrency(filteredPayments.reduce((sum, payment) => sum + payment.totalAmount, 0))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de Detalhes do Pagamento */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header do Modal */}
            <div className="bg-blue-600 text-white p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">
                  Detalhes do Pagamento - Mesa {selectedPayment.tableId?.number || '?'}
                  {!selectedPayment.tableId?.number && (
                    <span className="text-sm text-blue-200 ml-2">(Mesa deletada)</span>
                  )}
                </h2>
                <p className="text-blue-100 mt-1">
                  {selectedPayment.tableIdentification && `${selectedPayment.tableIdentification} • `}
                  ID: {selectedPayment._id.slice(-6)}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-white hover:text-gray-200 text-2xl font-bold w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {detailsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <span className="ml-4 text-gray-600">Carregando detalhes...</span>
                </div>
              ) : paymentDetails ? (
                <div className="space-y-6">
                  {/* Resumo do Pagamento */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-green-800 mb-3">Resumo do Pagamento</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-green-600">Valor Total</div>
                        <div className="text-xl font-bold text-green-800">
                          {formatCurrency(selectedPayment.totalAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-green-600">Data/Hora</div>
                        <div className="font-medium text-green-800">
                          {formatDate(selectedPayment.paidAt)}
                        </div>
                        <div className="text-sm text-green-600">
                          {formatTime(selectedPayment.paidAt)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-green-600">Total de Pedidos</div>
                        <div className="text-xl font-bold text-green-800">
                          {selectedPayment.orderIds.length}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-green-600">Status</div>
                        <div className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Pago
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detalhamento do Valor com Comissão */}
                  {selectedPayment.waiterCommissionEnabled && selectedPayment.waiterCommissionAmount > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-blue-800 mb-3">💰 Detalhamento do Valor</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-blue-700">Valor dos pedidos:</span>
                          <span className="font-medium text-blue-900">{formatCurrency(selectedPayment.baseAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">Comissão do garçom ({selectedPayment.waiterCommissionPercentage}%):</span>
                          <span className="font-medium text-blue-900">{formatCurrency(selectedPayment.waiterCommissionAmount)}</span>
                        </div>
                        <div className="border-t border-blue-300 pt-1 mt-2">
                          <div className="flex justify-between">
                            <span className="font-medium text-blue-800">Total com comissão:</span>
                            <span className="font-bold text-blue-900">{formatCurrency(selectedPayment.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Métodos de Pagamento */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Métodos de Pagamento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedPayment.paymentMethods.map((method, index) => (
                        <div key={index} className="bg-white border border-gray-200 rounded p-3">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-800">
                              {getMethodLabel(method.type)}
                            </span>
                            <span className="text-lg font-bold text-gray-900">
                              {formatCurrency(method.amount)}
                            </span>
                          </div>
                          {method.description && (
                            <div className="text-sm text-gray-500 mt-1">{method.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                    {selectedPayment.changeAmount && selectedPayment.changeAmount > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="text-sm text-blue-600">Troco devolvido:</div>
                        <div className="text-lg font-bold text-blue-800">
                          {formatCurrency(selectedPayment.changeAmount)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Comissão do Garçom */}
                  {selectedPayment.waiterCommissionEnabled && selectedPayment.waiterCommissionAmount > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-purple-800 mb-3">Comissão do Garçom</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-sm text-purple-600">Garçom</div>
                          <div className="text-lg font-medium text-purple-800">
                            {selectedPayment.waiterId?.username || 'Não identificado'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-purple-600">Percentual</div>
                          <div className="text-lg font-bold text-purple-800">
                            {selectedPayment.waiterCommissionPercentage}%
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-purple-600">Valor da Comissão</div>
                          <div className="text-xl font-bold text-purple-900">
                            {formatCurrency(selectedPayment.waiterCommissionAmount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detalhes dos Pedidos */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Pedidos Incluídos ({paymentDetails.orders?.length || 0})
                      </h3>
                    </div>
                    
                    {paymentDetails.orders && paymentDetails.orders.length > 0 ? (
                      <div className="divide-y divide-gray-200">
                        {paymentDetails.orders.map((order: any, orderIndex: number) => (
                          <div key={order._id} className="p-4">
                            {/* Header do Pedido */}
                            <div className="flex justify-between items-center mb-3">
                              <div>
                                <div className="font-medium text-gray-900">
                                  Pedido #{orderIndex + 1} - ID: {order._id.slice(-6)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {order.waiterId?.username && `Garçom: ${order.waiterId.username} • `}
                                  {formatDateTime(order.createdAt)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-gray-900">
                                  {formatCurrency(order.totalAmount)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>

                            {/* Itens do Pedido */}
                            {order.items && order.items.length > 0 && (
                              <div className="bg-gray-50 rounded-lg p-3">
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Itens:</h4>
                                <div className="space-y-2">
                                  {order.items.map((item: any, itemIndex: number) => (
                                    <div key={itemIndex} className="flex justify-between items-center text-sm">
                                      <div className="flex-1">
                                        <span className="font-medium">{item.productName}</span>
                                        <span className="text-gray-500 ml-2">x{item.quantity}</span>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-medium">{formatCurrency(item.totalPrice)}</div>
                                        <div className="text-xs text-gray-500">
                                          {formatCurrency(item.unitPrice)} cada
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Observações do Pedido */}
                            {order.observations && (
                              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                <div className="text-sm text-yellow-600 font-medium">Observações:</div>
                                <div className="text-sm text-yellow-800">{order.observations}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-gray-500">
                        Não foi possível carregar os detalhes dos pedidos
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Erro ao carregar detalhes do pagamento
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Finalização de Pagamento Pendente */}
      {showFinalizeModal && pendingPaymentToFinalize && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
            {/* Header do Modal */}
            <div className="bg-green-600 text-white p-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">
                  Finalizar Pagamento
                </h2>
                <p className="text-green-100 mt-1">
                  Mesa {pendingPaymentToFinalize.tableId.number} • {formatCurrency(pendingPaymentToFinalize.totalAmount)}
                </p>
              </div>
              <button
                onClick={closeFinalizeModal}
                className="text-white hover:text-gray-200 text-2xl font-bold w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex justify-between">
                  <span>Total a pagar:</span>
                  <span className="font-bold">{formatCurrency(pendingPaymentToFinalize.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total pago:</span>
                  <span className="font-bold text-green-600">{formatCurrency(getTotalFinalizePaid())}</span>
                </div>
                {getFinalizeChange() > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Troco:</span>
                    <span className="font-bold">{formatCurrency(getFinalizeChange())}</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Métodos de Pagamento</h3>
                  <button
                    onClick={addFinalizePaymentMethod}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    + Adicionar
                  </button>
                </div>

                {finalizePaymentMethods.map((method, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                        <select
                          value={method.type}
                          onChange={(e) => updateFinalizePaymentMethod(index, 'type', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                          <option value="dinheiro">Dinheiro</option>
                          <option value="cartao_credito">Cartão de Crédito</option>
                          <option value="cartao_debito">Cartão de Débito</option>
                          <option value="pix">PIX</option>
                          <option value="outro">Outro</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={method.amount}
                          onChange={(e) => updateFinalizePaymentMethod(index, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
                      <input
                        type="text"
                        value={method.description || ''}
                        onChange={(e) => updateFinalizePaymentMethod(index, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        placeholder="Ex: Troco para R$ 50,00"
                      />
                    </div>

                    {finalizePaymentMethods.length > 1 && (
                      <button
                        onClick={() => removeFinalizePaymentMethod(index)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remover método
                      </button>
                    )}
                  </div>
                ))}

                {!isFinalizePaymentValid() && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                    ⚠️ O valor total pago deve ser igual ou maior que o valor da conta
                  </div>
                )}
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeFinalizeModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500"
              >
                Cancelar
              </button>
              <button
                onClick={finalizePendingPayment}
                disabled={!isFinalizePaymentValid() || submittingFinalize}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              >
                {submittingFinalize ? 'Finalizando...' : 'Finalizar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 