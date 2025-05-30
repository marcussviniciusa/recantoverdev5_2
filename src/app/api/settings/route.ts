import { NextRequest, NextResponse } from 'next/server';
import connectDB from '../../../../lib/db';
import Settings from '../../../../models/Settings';
import { authenticateRequest, hasPermission } from '../../../../lib/auth';

// GET - Obter configurações do sistema
export async function GET(request: NextRequest) {
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

    // Apenas recepcionistas podem acessar configurações
    if (!hasPermission(user, 'recepcionista')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Acesso negado. Apenas recepcionistas podem ver configurações.' 
        },
        { status: 403 }
      );
    }

    // Obter configurações (criando se não existir)
    const settings = await (Settings as any).getSettings();

    return NextResponse.json({
      success: true,
      data: {
        settings
      },
      message: 'Configurações obtidas com sucesso'
    });

  } catch (error) {
    console.error('Erro ao obter configurações:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// PUT - Atualizar configurações do sistema
export async function PUT(request: NextRequest) {
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

    // Apenas recepcionistas podem atualizar configurações
    if (!hasPermission(user, 'recepcionista')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Acesso negado. Apenas recepcionistas podem alterar configurações.' 
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      waiterCommissionEnabled,
      waiterCommissionPercentage,
      restaurantName,
      currency,
      timezone
    } = body;

    // Validações
    if (waiterCommissionPercentage !== undefined) {
      if (waiterCommissionPercentage < 0 || waiterCommissionPercentage > 50) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Percentual de comissão deve estar entre 0% e 50%' 
          },
          { status: 400 }
        );
      }
    }

    // Obter configurações atuais
    let settings = await (Settings as any).getSettings();

    // Atualizar campos fornecidos
    if (waiterCommissionEnabled !== undefined) {
      settings.waiterCommissionEnabled = waiterCommissionEnabled;
    }
    
    if (waiterCommissionPercentage !== undefined) {
      settings.waiterCommissionPercentage = waiterCommissionPercentage;
    }
    
    if (restaurantName !== undefined) {
      settings.restaurantName = restaurantName;
    }
    
    if (currency !== undefined) {
      settings.currency = currency;
    }
    
    if (timezone !== undefined) {
      settings.timezone = timezone;
    }

    // Salvar configurações
    await settings.save();

    console.log('✅ Configurações atualizadas pelo usuário:', user.username);
    console.log('- Comissão habilitada:', settings.waiterCommissionEnabled);
    console.log('- Percentual de comissão:', settings.waiterCommissionPercentage + '%');

    return NextResponse.json({
      success: true,
      data: {
        settings
      },
      message: 'Configurações atualizadas com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    
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