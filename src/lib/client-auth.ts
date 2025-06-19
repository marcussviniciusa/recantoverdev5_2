/**
 * Utilitários de autenticação para o lado do cliente
 * Não importa modelos do Mongoose
 */

/**
 * Utilitário para fazer logout
 */
export const logout = () => {
  // Limpar todos os dados do usuário do localStorage
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userName');
  localStorage.removeItem('userEmail');
  
  // Redirecionar para login
  window.location.href = '/auth/login';
};

/**
 * Obter dados do usuário do localStorage
 */
export const getCurrentUser = () => {
  if (typeof window === 'undefined') return null;
  
  return {
    token: localStorage.getItem('token'),
    userId: localStorage.getItem('userId'),
    userRole: localStorage.getItem('userRole'),
    userName: localStorage.getItem('userName'),
    userEmail: localStorage.getItem('userEmail')
  };
};

/**
 * Verificar se o usuário está logado
 */
export const isAuthenticated = () => {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('token');
};

/**
 * Verificar se o usuário tem uma role específica
 */
export const hasRole = (role: 'garcom' | 'recepcionista') => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('userRole') === role;
}; 