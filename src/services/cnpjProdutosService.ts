import { cookieUtils } from '@/utils/cookieUtils';
import { apiRequest as centralApiRequest, fetchApiConfig } from '@/config/api';

export type ProdutoStatus = 'ativo' | 'inativo' | 'rascunho';

export interface CnpjProduto {
  id: number;
  module_id: number;
  user_id: number;
  cnpj: string;
  nome_empresa: string;
  nome_produto: string;
  sku: string | null;
  categoria: string | null;
  codigo_barras?: string | null;
  controlar_estoque?: boolean | number;
  fotos?: string[];
  preco: number;
  estoque: number;
  status: ProdutoStatus;
  ativo: number;
  owner_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    await fetchApiConfig();

    let sessionToken = cookieUtils.get('session_token') || cookieUtils.get('api_session_token');
    if (!sessionToken) {
      sessionToken = localStorage.getItem('session_token') || localStorage.getItem('api_session_token');
    }

    if (!sessionToken) {
      return { success: false, error: 'Token de autorização não encontrado. Faça login novamente.' };
    }

    const isFormData = options.body instanceof FormData;

    const data = await centralApiRequest<any>(endpoint, {
      ...options,
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {}),
      },
    });

    return data as ApiResponse<T>;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

export const cnpjProdutosService = {
  async list(params: { limit?: number; offset?: number; search?: string; status?: ProdutoStatus | 'todos'; cnpj?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.limit !== undefined) qs.set('limit', String(params.limit));
    if (params.offset !== undefined) qs.set('offset', String(params.offset));
    if (params.search) qs.set('search', params.search);
    if (params.status && params.status !== 'todos') qs.set('status', params.status);
    if (params.cnpj) qs.set('cnpj', params.cnpj);

    const endpoint = `/cnpj-produtos/list${qs.toString() ? `?${qs.toString()}` : ''}`;
    return apiRequest<{ data: CnpjProduto[]; pagination: { total: number; limit: number; offset: number } }>(endpoint);
  },

  async criar(data: {
    module_id?: number;
    cnpj: string;
    nome_empresa: string;
    nome_produto: string;
    sku?: string;
    categoria?: string;
    codigo_barras?: string;
    controlar_estoque?: boolean;
    fotos?: string[];
    preco: number;
    estoque: number;
    status: ProdutoStatus;
  }) {
    return apiRequest<CnpjProduto>('/cnpj-produtos/criar', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async atualizar(data: {
    id: number;
    cnpj?: string;
    nome_empresa?: string;
    nome_produto?: string;
    sku?: string;
    categoria?: string;
    codigo_barras?: string;
    controlar_estoque?: boolean;
    fotos?: string[];
    preco?: number;
    estoque?: number;
    status?: ProdutoStatus;
  }) {
    return apiRequest<CnpjProduto>('/cnpj-produtos/atualizar', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async excluir(id: number) {
    return apiRequest<{ id: number }>('/cnpj-produtos/excluir', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  },

  async uploadFoto(file: File) {
    const formData = new FormData();
    formData.append('photo', file);

    return apiRequest<{ filename: string; url: string }>('/cnpj-produtos/upload-foto', {
      method: 'POST',
      body: formData,
    });
  },
};
