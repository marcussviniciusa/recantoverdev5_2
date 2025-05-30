'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Settings {
  _id: string;
  waiterCommissionEnabled: boolean;
  waiterCommissionPercentage: number;
  restaurantName?: string;
  currency?: string;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Estados do formulário
  const [waiterCommissionEnabled, setWaiterCommissionEnabled] = useState(false);
  const [waiterCommissionPercentage, setWaiterCommissionPercentage] = useState(10);
  const [restaurantName, setRestaurantName] = useState('');

  useEffect(() => {
    // Verificar autenticação
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'recepcionista') {
      router.push('/auth/login?role=recepcionista');
      return;
    }

    loadSettings();
  }, [router]);

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        const settingsData = data.data.settings;
        setSettings(settingsData);
        
        // Preencher formulário
        setWaiterCommissionEnabled(settingsData.waiterCommissionEnabled || false);
        setWaiterCommissionPercentage(settingsData.waiterCommissionPercentage || 10);
        setRestaurantName(settingsData.restaurantName || '');
      } else {
        setError('Erro ao carregar configurações: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setError('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const token = localStorage.getItem('token');
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          waiterCommissionEnabled,
          waiterCommissionPercentage,
          restaurantName
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSettings(data.data.settings);
        setSuccess('Configurações salvas com sucesso!');
        
        // Limpar mensagem de sucesso após 3 segundos
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Erro ao salvar configurações: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setError('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Configurações do Sistema</h1>
        <p className="text-gray-600 mt-2">
          Gerencie as configurações gerais do restaurante
        </p>
      </div>

      {/* Mensagens */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-green-800">{success}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configurações de Comissão */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-blue-50 px-6 py-4 border-b border-blue-200">
            <h2 className="text-xl font-semibold text-blue-900">Comissão dos Garçons</h2>
            <p className="text-blue-700 text-sm mt-1">
              Configure a comissão automática para os garçons
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Toggle Comissão */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">
                  Comissão Habilitada
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Ativar cálculo automático de comissão nos pagamentos
                </p>
              </div>
              <button
                onClick={() => setWaiterCommissionEnabled(!waiterCommissionEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  waiterCommissionEnabled 
                    ? 'bg-blue-600' 
                    : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    waiterCommissionEnabled 
                      ? 'translate-x-6' 
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Percentual da Comissão */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Percentual da Comissão
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="0.5"
                  value={waiterCommissionPercentage}
                  onChange={(e) => setWaiterCommissionPercentage(Number(e.target.value))}
                  disabled={!waiterCommissionEnabled}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {waiterCommissionPercentage}%
                  </div>
                  <div className="text-xs text-gray-500">0% - 50%</div>
                </div>
              </div>
              
              {/* Exemplo de cálculo */}
              {waiterCommissionEnabled && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <strong>Exemplo:</strong> Em um pagamento de R$ 100,00, 
                    o garçom receberá {formatCurrency(100 * waiterCommissionPercentage / 100)} de comissão.
                  </div>
                </div>
              )}
            </div>

            {/* Status atual */}
            <div className="pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                <strong>Status atual:</strong>{' '}
                <span className={waiterCommissionEnabled ? 'text-green-600' : 'text-gray-600'}>
                  {waiterCommissionEnabled 
                    ? `Ativada (${waiterCommissionPercentage}%)` 
                    : 'Desativada'
                  }
                </span>
              </div>
              {waiterCommissionEnabled && (
                <div className="text-xs text-gray-500 mt-1">
                  A comissão será calculada automaticamente em todos os novos pagamentos
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Configurações Gerais */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Configurações Gerais</h2>
            <p className="text-gray-700 text-sm mt-1">
              Informações básicas do restaurante
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Nome do Restaurante */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Nome do Restaurante
              </label>
              <input
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="Digite o nome do restaurante"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Informações do Sistema */}
            {settings && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Informações do Sistema</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div>
                    <strong>Moeda:</strong> {settings.currency || 'BRL'}
                  </div>
                  <div>
                    <strong>Fuso Horário:</strong> {settings.timezone || 'America/Sao_Paulo'}
                  </div>
                  <div>
                    <strong>Última Atualização:</strong>{' '}
                    {new Date(settings.updatedAt).toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="mt-8 flex justify-between items-center">
        <button
          onClick={() => router.back()}
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-500"
        >
          Voltar
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
} 