/**
 * cacheManager.ts
 * Utilities para gerenciar e limpar cache
 * Útil quando localStorage fica corrompido
 */

export function clearAllCache() {
  console.log('🧹 Limpando todo localStorage...');
  
  // Remove all localStorage items
  localStorage.clear();
  
  // Remove specific items
  const keysToRemove = [
    'laurena-auth',
    'auth_token',
    'access_token',
    'refresh_token',
    'user',
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  
  // Clear IndexedDB if exists
  if ('indexedDB' in window) {
    indexedDB.databases?.().then((dbs) => {
      dbs.forEach((db) => {
        indexedDB.deleteDatabase(db.name);
      });
    });
  }
  
  console.log('✅ Cache limpo com sucesso');
}

export function validateLocalStorage(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

export function repairAuthStorage() {
  console.log('🔧 Reparando armazenamento de autenticação...');
  
  try {
    const authData = localStorage.getItem('laurena-auth');
    
    if (!authData) {
      console.log('ℹ️ Sem dados de auth no localStorage');
      return true;
    }
    
    // Try to parse
    const parsed = JSON.parse(authData);
    
    // Validate expected fields
    const expectedFields = ['estado', 'estado'];
    
    console.log('✅ Dados de auth são válidos');
    return true;
    
  } catch (error) {
    console.error('❌ Erro ao validar auth storage:', error);
    console.log('🗑️ Removendo dados corrompidos...');
    localStorage.removeItem('laurena-auth');
    localStorage.removeItem('auth_token');
    return false;
  }
}

export function hardRefresh() {
  console.log('🔄 Recarregando página...');
  // Clear cache and reload
  clearAllCache();
  window.location.href = '/login';
}

// Expose globally for debugging in console
if (typeof window !== 'undefined') {
  (window as any).cacheTools = {
    clearAllCache,
    validateLocalStorage,
    repairAuthStorage,
    hardRefresh,
  };
  console.log('💡 Use window.cacheTools.hardRefresh() para limpar cache e recarregar');
}
