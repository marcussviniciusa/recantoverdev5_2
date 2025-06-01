import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectDB } from '../../../../../../lib/db';
import Order from '../../../../../../models/Order';
import Payment from '../../../../../../models/Payment';

const JWT_SECRET = process.env.JWT_SECRET || 'recanto_verde_super_secret_key_2025';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Permitir acesso para garçons e recepcionistas
      if (decoded.role !== 'garcom' && decoded.role !== 'recepcionista') {
        return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 });
      }
    } catch (error) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    // Conectar ao banco
    await connectDB();

    // Validar dados da requisição
    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return NextResponse.json({ 
        success: false, 
        error: 'Motivo do cancelamento é obrigatório e deve ter pelo menos 10 caracteres' 
      }, { status: 400 });
    }

    // Buscar o pedido
    const order = await Order.findById(params.id).populate('waiterId', 'username email');
    
    if (!order) {
      return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 });
    }

    // Verificar se já está cancelado
    if (order.status === 'cancelado') {
      return NextResponse.json({ success: false, error: 'Pedido já está cancelado' }, { status: 400 });
    }

    // Verificar se já foi entregue
    if (order.status === 'entregue') {
      return NextResponse.json({ 
        success: false, 
        error: 'Não é possível cancelar pedidos já entregues' 
      }, { status: 400 });
    }

    // Verificar se o pedido está incluído em algum pagamento
    const paymentWithOrder = await Payment.findOne({
      orderIds: order._id,
      status: { $in: ['pago', 'pendente'] }
    });

    if (paymentWithOrder) {
      return NextResponse.json({ 
        success: false, 
        error: 'Não é possível cancelar pedidos que já estão incluídos em um pagamento' 
      }, { status: 400 });
    }

    // Verificar permissões específicas
    if (decoded.role === 'garcom') {
      // Garçom só pode cancelar próprios pedidos
      if (order.waiterId._id.toString() !== decoded.userId) {
        return NextResponse.json({ 
          success: false, 
          error: 'Você só pode cancelar seus próprios pedidos' 
        }, { status: 403 });
      }
    }
    // Recepcionista pode cancelar qualquer pedido (sem restrição adicional)

    // Cancelar o pedido
    const cancelledOrder = await order.cancelOrder(decoded.userId, reason.trim());

    // Buscar dados atualizados com populate
    const updatedOrder = await Order.findById(cancelledOrder._id)
      .populate('waiterId', 'username email')
      .populate('cancelledBy', 'username email');

    console.log(`🚫 Pedido cancelado: ${order._id.toString().slice(-6)} por ${decoded.role} ${decoded.userId}`);
    console.log(`   Mesa: ${order.tableId}, Garçom: ${order.waiterId.username}, Motivo: "${reason.trim()}"`);

    return NextResponse.json({
      success: true,
      data: {
        order: updatedOrder
      },
      message: 'Pedido cancelado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao cancelar pedido:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
} 