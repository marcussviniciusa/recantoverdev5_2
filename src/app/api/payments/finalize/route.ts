import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../../lib/db';
import Payment from '../../../../../models/Payment';
import Order from '../../../../../models/Order';
import { authenticateRequest, hasPermission } from '../../../../../lib/auth';

// PATCH - Finalizar pagamento pendente
export async function PATCH(request: NextRequest) {
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

    // Verificar permissão (apenas admin/recepcionista)
    if (!hasPermission(user, 'recepcionista')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Acesso negado - apenas administradores podem finalizar pagamentos' 
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { paymentId, paymentMethods } = body;

    // Validações
    if (!paymentId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ID do pagamento é obrigatório' 
        },
        { status: 400 }
      );
    }

    if (!paymentMethods || paymentMethods.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Métodos de pagamento são obrigatórios' 
        },
        { status: 400 }
      );
    }

    // Buscar o pagamento pendente
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Pagamento não encontrado' 
        },
        { status: 404 }
      );
    }

    // Verificar se está pendente
    if (payment.status !== 'pendente') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Pagamento não está pendente' 
        },
        { status: 400 }
      );
    }

    // Validar métodos de pagamento
    const totalMethodsAmount = paymentMethods.reduce((sum: number, method: any) => sum + method.amount, 0);
    
    if (Math.abs(totalMethodsAmount - payment.totalAmount) > 0.01) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Total dos métodos de pagamento (${totalMethodsAmount.toFixed(2)}) não confere com o valor do pagamento (${payment.totalAmount.toFixed(2)})` 
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

    // Calcular troco se necessário
    const changeAmount = Math.max(0, totalMethodsAmount - payment.totalAmount);

    // Atualizar o pagamento
    payment.status = 'pago';
    payment.paymentMethods = paymentMethods;
    payment.paidAt = new Date();
    payment.changeAmount = changeAmount;
    
    await payment.save();

    // Atualizar status dos pedidos para pago
    await Order.updateMany(
      { _id: { $in: payment.orderIds } },
      { status: 'pago', paymentId: payment._id }
    );

    console.log('✅ Pagamento finalizado pelo admin:', payment._id);
    console.log('- Mesa:', payment.tableId);
    console.log('- Valor total:', payment.totalAmount);
    console.log('- Métodos de pagamento atualizados');
    console.log('- Troco:', changeAmount);
    console.log('- Pedidos atualizados para status "pago"');

    return NextResponse.json({
      success: true,
      data: {
        payment: payment
      },
      message: 'Pagamento finalizado com sucesso'
    }, { status: 200 });

  } catch (error) {
    console.error('Erro ao finalizar pagamento:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
} 