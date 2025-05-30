import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../../../lib/db';
import Payment from '../../../../../../models/Payment';
import Order from '../../../../../../models/Order';
import Table from '../../../../../../models/Table';
import Settings from '../../../../../../models/Settings';
import { authenticateRequest, hasPermission } from '../../../../../../lib/auth';

// POST - Criar pagamento para mesa (todos os pedidos)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    await connectDB();

    // Verificar autenticação
    const user = await authenticateRequest(request);
    
    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Token inválido ou expirado' 
        },
        { status: 401 }
      );
    }

    // Verificar permissão
    if (!hasPermission(user, 'recepcionista') && !hasPermission(user, 'garcom')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Acesso negado' 
        },
        { status: 403 }
      );
    }

    const { tableId } = await params;
    const body = await request.json();
    const { paymentMethods, status = 'pago' } = body;

    // Validações
    if (!paymentMethods || paymentMethods.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Métodos de pagamento são obrigatórios' 
        },
        { status: 400 }
      );
    }

    // Validar status
    if (!['pendente', 'pago'].includes(status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Status deve ser "pendente" ou "pago"' 
        },
        { status: 400 }
      );
    }

    // Verificar se a mesa existe
    const table = await Table.findById(tableId);
    if (!table) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Mesa não encontrada' 
        },
        { status: 404 }
      );
    }

    // Buscar todos os pedidos não pagos da mesa (sessão atual)
    const orders = await Order.find({
      tableId: tableId,
      status: { $in: ['preparando', 'pronto', 'entregue'] } // Qualquer status não-pago e não-cancelado
    }).populate('waiterId', 'username');

    if (orders.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Não há pedidos pendentes para esta mesa' 
        },
        { status: 400 }
      );
    }

    // Verificar se já existe pagamento pendente (em processamento)
    const existingPayment = await Payment.findOne({
      tableId: tableId,
      status: 'pendente' // Apenas pagamentos pendentes bloqueiam novos pagamentos
    });

    if (existingPayment) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Já existe um pagamento para esta mesa' 
        },
        { status: 400 }
      );
    }

    // Calcular valor base de todos os pedidos (sem comissão)
    const baseAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const orderIds = orders.map(order => order._id);

    // Obter configurações de comissão
    const settings = await (Settings as any).getSettings();
    
    // Calcular comissão automaticamente
    const commissionAmount = settings.waiterCommissionEnabled 
      ? settings.calculateCommission(baseAmount)
      : 0;
    
    // Valor total incluindo comissão
    const totalAmount = baseAmount + commissionAmount;

    // Validar métodos de pagamento
    const totalMethodsAmount = paymentMethods.reduce((sum: number, method: any) => sum + method.amount, 0);
    
    if (Math.abs(totalMethodsAmount - totalAmount) > 0.01) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Total dos métodos de pagamento (${totalMethodsAmount.toFixed(2)}) não confere com o valor total da mesa (${totalAmount.toFixed(2)})${commissionAmount > 0 ? ` - incluindo ${settings.waiterCommissionPercentage}% de comissão (R$ ${commissionAmount.toFixed(2)})` : ''}` 
        },
        { status: 400 }
      );
    }

    // Validar métodos de pagamento individuais
    for (const method of paymentMethods) {
      if (!method.type || method.amount <= 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Todos os métodos de pagamento devem ter tipo e valor válidos' 
          },
          { status: 400 }
        );
      }

      const validMethods = ['dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'outro', 'pendente'];
      if (!validMethods.includes(method.type)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Método de pagamento inválido: ${method.type}` 
          },
          { status: 400 }
        );
      }
    }

    // Identificar o garçom responsável (primeiro pedido entregue)
    const waiterOrder = orders.find(order => order.waiterId);
    const waiterId = waiterOrder?.waiterId;

    // Criar registro de pagamento
    const payment = new Payment({
      tableId: tableId,
      orderIds: orderIds,
      baseAmount: baseAmount,
      totalAmount: totalAmount, // Será recalculado no middleware
      paymentMethods: paymentMethods,
      status: status,
      paidAt: new Date(),
      tableIdentification: table.identification,
      
      // Configurações de comissão
      waiterId: waiterId,
      waiterCommissionEnabled: settings.waiterCommissionEnabled,
      waiterCommissionPercentage: settings.waiterCommissionPercentage,
      waiterCommissionAmount: 0 // Será calculado automaticamente no middleware
    });

    await payment.save();

    // Atualizar status dos pedidos para pago apenas se o pagamento for finalizado
    if (status === 'pago') {
      await Order.updateMany(
        { _id: { $in: orderIds } },
        { status: 'pago', paymentId: payment._id }
      );
    }

    console.log('✅ Pagamento criado para mesa:', table.number);
    console.log('- Status do pagamento:', status);
    console.log('- Total de pedidos:', orders.length);
    console.log('- Valor base:', baseAmount.toFixed(2));
    if (commissionAmount > 0) {
      console.log('- Comissão do garçom:', `${settings.waiterCommissionPercentage}% = R$ ${commissionAmount.toFixed(2)}`);
    }
    console.log('- Valor total:', payment.totalAmount.toFixed(2));
    console.log('- Identificação da mesa:', table.identification || 'Sem identificação');
    if (status === 'pago') {
      console.log('- Pedidos atualizados para status "pago"');
    } else {
      console.log('- Pedidos mantiveram status original (pagamento pendente)');
    }
    console.log('- Comissão habilitada:', payment.waiterCommissionEnabled);
    if (payment.waiterCommissionEnabled && payment.waiterCommissionAmount > 0) {
      console.log('- Garçom:', waiterOrder?.waiterId?.username || 'Não identificado');
      console.log('- Percentual de comissão:', payment.waiterCommissionPercentage + '%');
      console.log('- Valor da comissão:', payment.waiterCommissionAmount.toFixed(2));
    }

    return NextResponse.json({
      success: true,
      data: {
        payment: payment,
        orders: orders,
        totalOrders: orders.length
      },
      message: 'Pagamento registrado com sucesso'
    }, { status: 201 });

  } catch (error) {
    console.error('Erro ao registrar pagamento da mesa:', error);
    
    if (error instanceof Error && error.name === 'ValidationError') {
      const mongooseError = error as any;
      const validationErrors: any = {};
      
      for (const field in mongooseError.errors) {
        validationErrors[field] = mongooseError.errors[field].message;
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Dados inválidos fornecidos',
          details: validationErrors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// GET - Obter resumo da conta da mesa
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    await connectDB();

    // Verificar autenticação
    const user = await authenticateRequest(request);
    
    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Token inválido ou expirado' 
        },
        { status: 401 }
      );
    }

    const { tableId } = await params;

    // Verificar se a mesa existe
    const table = await Table.findById(tableId);
    if (!table) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Mesa não encontrada' 
        },
        { status: 404 }
      );
    }

    // Buscar apenas pedidos da sessão atual (não pagos e não cancelados)
    const orders = await Order.find({
      tableId: tableId,
      status: { $in: ['preparando', 'pronto', 'entregue'] } // Apenas sessão atual
    }).populate('waiterId', 'username');

    // Obter configurações para taxa de serviço
    const settings = await (Settings as any).getSettings();

    // Separar pedidos por status
    const ordersByStatus = {
      preparando: orders.filter(o => o.status === 'preparando'),
      pronto: orders.filter(o => o.status === 'pronto'),
      entregue: orders.filter(o => o.status === 'entregue'),
      pago: [] // Não incluímos pedidos pagos na sessão atual
    };

    // Calcular totais apenas da sessão atual
    const baseAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    
    // Calcular comissão automaticamente
    const commissionAmount = settings.waiterCommissionEnabled 
      ? settings.calculateCommission(baseAmount)
      : 0;
    
    // Valor total incluindo comissão
    const totalAmountWithCommission = baseAmount + commissionAmount;
    
    const unpaidAmount = totalAmountWithCommission; // Valor total com comissão
    const paidAmount = 0; // Não há pedidos pagos na sessão atual

    // Verificar se já existe pagamento pendente (em processamento)
    const existingPayment = await Payment.findOne({
      tableId: tableId,
      status: 'pendente' // Apenas pagamentos pendentes bloqueiam novos pagamentos
    });

    return NextResponse.json({
      success: true,
      data: {
        table: table,
        orders: orders,
        ordersByStatus: ordersByStatus,
        summary: {
          totalOrders: orders.length,
          totalAmount: totalAmountWithCommission,
          baseAmount: baseAmount,
          waiterCommissionEnabled: settings.waiterCommissionEnabled,
          waiterCommissionPercentage: settings.waiterCommissionPercentage,
          waiterCommissionAmount: commissionAmount,
          unpaidAmount: unpaidAmount,
          paidAmount: paidAmount,
          canPayNow: unpaidAmount > 0 && !existingPayment
        },
        existingPayment: existingPayment
      },
      message: 'Resumo da conta obtido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao obter resumo da conta:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
} 