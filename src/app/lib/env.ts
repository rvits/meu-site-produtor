/**
 * Helper para carregar variáveis de ambiente de forma mais robusta
 * Isso resolve problemas com tokens que começam com $ sendo interpretados como variáveis vazias
 */

let asaasApiKeyCache: string | undefined = undefined;

/**
 * Lê o arquivo .env diretamente para evitar problemas com Next.js interpretando $ como variável
 */
function readEnvFile(): string | undefined {
  if (typeof window !== 'undefined') return undefined; // Não funciona no cliente
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Tentar .env.local primeiro (prioridade do Next.js)
    const envLocalPath = path.join(process.cwd(), '.env.local');
    const envPath = path.join(process.cwd(), '.env');
    
    let content = '';
    if (fs.existsSync(envLocalPath)) {
      content = fs.readFileSync(envLocalPath, 'utf8');
    } else if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    } else {
      return undefined;
    }
    
    // Procurar por ASAAS_API_KEY no conteúdo
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith('ASAAS_API_KEY=')) {
        const value = line.split('=').slice(1).join('='); // Juntar caso tenha = no token
        // Remover aspas se presentes
        return value.replace(/^["']|["']$/g, '').trim() || undefined;
      }
    }
  } catch (error) {
    console.warn('[env.ts] Erro ao ler arquivo .env:', error);
  }
  
  return undefined;
}

/**
 * Obtém uma variável de ambiente removendo aspas e espaços
 */
export function getEnv(key: string): string | undefined {
  // Para ASAAS_API_KEY, usar leitura direta do arquivo
  if (key === 'ASAAS_API_KEY') {
    if (asaasApiKeyCache === undefined) {
      asaasApiKeyCache = readEnvFile();
    }
    return asaasApiKeyCache;
  }
  
  // Para outras variáveis, usar process.env normal
  const value = process.env[key];
  if (!value) return undefined;
  // Remover aspas simples ou duplas do início e fim, e espaços
  return value.replace(/^["']|["']$/g, '').trim() || undefined;
}

/**
 * Obtém ASAAS_API_KEY de forma robusta
 */
export function getAsaasApiKey(): string | undefined {
  return getEnv('ASAAS_API_KEY');
}
