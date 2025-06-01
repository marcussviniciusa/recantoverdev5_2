import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../../../lib/db';
import Table from '../../../../../../models/Table';
import { authenticateRequest } from '../../../../../../lib/auth';

// PUT - Liberar mesa (deleta a mesa)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    // Buscar mesa
    const table = await Table.findById(id);

    if (!table) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Mesa não encontrada' 
        },
        { status: 404 }
      );
    }

    // Verificar se é o garçom dono da mesa ou admin
    if (user.role === 'garcom' && table.assignedWaiter?.toString() !== user.id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Você só pode liberar suas próprias mesas' 
        },
        { status: 403 }
      );
    }

    // Verificar se a mesa está ocupada
    if (table.status !== 'ocupada') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Apenas mesas ocupadas podem ser liberadas' 
        },
        { status: 400 }
      );
    }

    // Deletar a mesa
    await Table.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Mesa liberada e removida com sucesso'
    });

  } catch (error) {
    console.error('Erro ao liberar mesa:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
} 