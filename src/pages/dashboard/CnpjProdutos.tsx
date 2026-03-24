import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { Package, Plus, RefreshCw, Pencil, Trash2, Search, X, ScanLine } from 'lucide-react';
import DashboardTitleCard from '@/components/dashboard/DashboardTitleCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BarcodeScanner from '@/components/cnpj-produtos/BarcodeScanner';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cnpjProdutosService, type CnpjProduto, type ProdutoStatus } from '@/services/cnpjProdutosService';

const MODULE_ID = 183;

const PRODUCT_CATEGORIES = [
  'Alimentos e Bebidas',
  'Alimentos Naturais',
  'Artigos para Festas',
  'Artesanato',
  'Automotivo',
  'Bebidas',
  'Beleza e Cosméticos',
  'Brinquedos',
  'Calçados',
  'Casa e Decoração',
  'Celulares e Acessórios',
  'Climatização',
  'Construção',
  'Cozinha e Utilidades',
  'Eletrodomésticos',
  'Eletrônicos',
  'Embalagens',
  'Escritório',
  'Esportes',
  'Ferramentas',
  'Floricultura',
  'Games',
  'Higiene e Limpeza',
  'Informática',
  'Instrumentos Musicais',
  'Joias e Acessórios',
  'Livros e Papelaria',
  'Malas e Mochilas',
  'Materiais Elétricos',
  'Materiais Hidráulicos',
  'Móveis',
  'Moda Feminina',
  'Moda Infantil',
  'Moda Masculina',
  'Ótica',
  'Papelaria',
  'Perfumaria',
  'Pet Shop',
  'Produtos Digitais',
  'Saúde',
  'Saúde e Bem-estar',
  'Segurança',
  'Serviços',
  'Suplementos',
  'Telefonia',
  'Turismo',
  'Vestuário',
] as const;

const produtoSchema = z.object({
  cnpj: z.string().min(14, 'CNPJ deve conter 14 dígitos').max(18, 'CNPJ inválido'),
  nome_empresa: z.string().trim().min(2, 'Informe a empresa').max(255, 'Máximo de 255 caracteres'),
  nome_produto: z.string().trim().min(2, 'Informe o produto').max(255, 'Máximo de 255 caracteres'),
  sku: z.string().trim().max(120, 'Máximo de 120 caracteres').optional().or(z.literal('')),
  categoria: z.string().trim().max(120, 'Máximo de 120 caracteres').optional().or(z.literal('')),
  codigo_barras: z.string().trim().max(64, 'Máximo de 64 caracteres').optional().or(z.literal('')),
  controlar_estoque: z.boolean(),
  fotos: z.array(z.string().url('URL de foto inválida')).max(5, 'Máximo de 5 fotos'),
  preco: z.number().min(0, 'Preço não pode ser negativo'),
  estoque: z.number().int().min(0, 'Estoque não pode ser negativo'),
  status: z.enum(['ativo', 'inativo', 'rascunho']),
});

type ProdutoFormData = z.infer<typeof produtoSchema>;

const emptyForm: ProdutoFormData = {
  cnpj: '',
  nome_empresa: '',
  nome_produto: '',
  sku: '',
  categoria: '',
  codigo_barras: '',
  controlar_estoque: false,
  fotos: [],
  preco: 0,
  estoque: 0,
  status: 'ativo',
};

const statusLabel: Record<ProdutoStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  rascunho: 'Rascunho',
};

const CnpjProdutos = () => {
  const { profile, user } = useAuth();
  const isAdmin = profile?.user_role === 'admin' || profile?.user_role === 'suporte';

  const [produtos, setProdutos] = useState<CnpjProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | ProdutoStatus>('todos');

  const [formData, setFormData] = useState<ProdutoFormData>(emptyForm);
  const [productPhotos, setProductPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [editing, setEditing] = useState<CnpjProduto | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CnpjProduto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const userCnpj = formatCnpj(user?.cnpj || '');
  const userEmpresa = (user?.full_name || '').trim();

  const canUseUserCompanyData = userCnpj.replace(/\D/g, '').length === 14 && userEmpresa.length > 1;

  const loadProdutos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await cnpjProdutosService.list({
        limit: 200,
        offset: 0,
        search: search.trim() || undefined,
        status: statusFilter,
      });

      if (result.success && result.data) {
        setProdutos(result.data.data || []);
      } else {
        setProdutos([]);
        if (result.error) toast.error(result.error);
      }
    } catch {
      setProdutos([]);
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadProdutos();
  }, [loadProdutos]);

  const resumo = useMemo(() => {
    const total = produtos.length;
    const ativos = produtos.filter((p) => p.status === 'ativo').length;
    const rascunho = produtos.filter((p) => p.status === 'rascunho').length;
    const baixoEstoque = produtos.filter((p) => (p.controlar_estoque === true || p.controlar_estoque === 1) && p.estoque <= 5).length;

    return { total, ativos, rascunho, baixoEstoque };
  }, [produtos]);

  const resetForm = () => {
    setFormData({
      ...emptyForm,
      cnpj: userCnpj,
      nome_empresa: userEmpresa,
      fotos: [],
    });
    setProductPhotos([]);
    setEditing(null);
  };

  useEffect(() => {
    if (editing) return;
    setFormData((prev) => ({
      ...prev,
      cnpj: userCnpj,
      nome_empresa: userEmpresa,
    }));
  }, [editing, userCnpj, userEmpresa]);

  const handleUploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const incoming = Array.from(files);
    if (productPhotos.length + incoming.length > 5) {
      toast.error('Você pode adicionar no máximo 5 fotos por produto');
      return;
    }

    setUploadingPhotos(true);
    try {
      const uploadedUrls: string[] = [];

      for (const file of incoming) {
        const result = await cnpjProdutosService.uploadFoto(file);
        if (!result.success || !result.data?.url) {
          throw new Error(result.error || 'Falha ao enviar foto');
        }
        uploadedUrls.push(result.data.url);
      }

      setProductPhotos((prev) => [...prev, ...uploadedUrls]);
      toast.success('Fotos enviadas com sucesso');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar fotos');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleSave = async () => {
    if (!canUseUserCompanyData) {
      toast.error('Complete CNPJ e nome no menu Dados Pessoais antes de cadastrar produtos');
      return;
    }

    const payload = {
      ...formData,
      cnpj: userCnpj,
      nome_empresa: userEmpresa,
      estoque: formData.controlar_estoque ? formData.estoque : 0,
      fotos: productPhotos,
    };

    const parsed = produtoSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Dados inválidos');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const result = await cnpjProdutosService.atualizar({
          id: editing.id,
          ...parsed.data,
        });

        if (!result.success) {
          toast.error(result.error || 'Erro ao atualizar produto');
          return;
        }

        toast.success('Produto atualizado com sucesso');
      } else {
        const createPayload = {
          module_id: MODULE_ID,
          cnpj: parsed.data.cnpj,
          nome_empresa: parsed.data.nome_empresa,
          nome_produto: parsed.data.nome_produto,
          sku: parsed.data.sku,
          categoria: parsed.data.categoria,
          codigo_barras: parsed.data.codigo_barras,
          controlar_estoque: parsed.data.controlar_estoque,
          fotos: parsed.data.fotos,
          preco: parsed.data.preco,
          estoque: parsed.data.estoque,
          status: parsed.data.status,
        };

        const result = await cnpjProdutosService.criar({
          ...createPayload,
        });

        if (!result.success) {
          toast.error(result.error || 'Erro ao cadastrar produto');
          return;
        }

        toast.success('Produto cadastrado com sucesso');
      }

      resetForm();
      await loadProdutos();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (produto: CnpjProduto) => {
    setEditing(produto);
    setFormData({
      cnpj: produto.cnpj,
      nome_empresa: produto.nome_empresa,
      nome_produto: produto.nome_produto,
      sku: produto.sku || '',
      categoria: produto.categoria || '',
      codigo_barras: produto.codigo_barras || '',
      controlar_estoque: produto.controlar_estoque === true || produto.controlar_estoque === 1,
      fotos: produto.fotos || [],
      preco: Number(produto.preco || 0),
      estoque: Number(produto.estoque || 0),
      status: produto.status,
    });
    setProductPhotos(produto.fotos || []);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await cnpjProdutosService.excluir(deleteTarget.id);
      if (!result.success) {
        toast.error(result.error || 'Erro ao excluir produto');
        return;
      }

      toast.success('Produto excluído com sucesso');
      setDeleteTarget(null);
      await loadProdutos();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-1 sm:px-0">
      <DashboardTitleCard
        title="CNPJ Produtos"
        subtitle="Controle completo de produtos das empresas"
        icon={<Package className="h-4 w-4 sm:h-5 sm:w-5" />}
        right={
          <>
            <Badge variant="secondary" className="text-xs">
              Módulo #{MODULE_ID}
            </Badge>
            <Button variant="ghost" size="sm" onClick={loadProdutos} disabled={loading} className="h-8 w-8 p-0">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">{editing ? 'Editar Produto' : 'Cadastro de Produto'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cnpj">CNPJ *</Label>
                <Input id="cnpj" value={formData.cnpj} readOnly disabled placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="empresa">Empresa *</Label>
                <Input id="empresa" value={formData.nome_empresa} readOnly disabled placeholder="Nome da empresa" />
              </div>
            </div>

            {!canUseUserCompanyData && (
              <p className="text-sm text-destructive">
                Preencha CNPJ e nome da empresa em Dados Pessoais para liberar o cadastro de produtos.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="produto">Produto *</Label>
                <Input id="produto" value={formData.nome_produto} onChange={(e) => setFormData((prev) => ({ ...prev, nome_produto: e.target.value }))} placeholder="Nome do produto" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" value={formData.sku || ''} onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))} placeholder="Código interno" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="codigo_barras">Código de barras</Label>
                <Input
                  id="codigo_barras"
                  value={formData.codigo_barras || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, codigo_barras: e.target.value.replace(/\s+/g, '') }))}
                  placeholder="Ex: 7891234567890"
                />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" className="w-full md:w-auto" onClick={() => setScannerOpen(true)}>
                  <ScanLine className="h-4 w-4" />
                  Escanear
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="categoria">Categoria</Label>
                <Select value={formData.categoria || ''} onValueChange={(value) => setFormData((prev) => ({ ...prev, categoria: value }))}>
                  <SelectTrigger id="categoria">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preco">Preço (R$)</Label>
                <Input id="preco" type="number" step="0.01" min={0} value={formData.preco} onChange={(e) => setFormData((prev) => ({ ...prev, preco: Number(e.target.value) }))} />
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Controlar estoque</p>
                  <p className="text-xs text-muted-foreground">Habilite para informar a quantidade disponível.</p>
                </div>
                <Switch
                  checked={formData.controlar_estoque}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, controlar_estoque: checked, estoque: checked ? prev.estoque : 0 }))}
                />
              </div>

              {formData.controlar_estoque ? (
                <div className="space-y-1.5 max-w-[220px]">
                  <Label htmlFor="estoque">Quantidade em estoque</Label>
                  <Input id="estoque" type="number" min={0} value={formData.estoque} onChange={(e) => setFormData((prev) => ({ ...prev, estoque: Number(e.target.value) }))} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Estoque desativado para este produto.</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="fotos">Fotos do produto (até 5)</Label>
                <span className="text-xs text-muted-foreground">{productPhotos.length}/5</span>
              </div>
              <Input
                id="fotos"
                type="file"
                accept="image/*"
                multiple
                disabled={uploadingPhotos || productPhotos.length >= 5}
                onChange={(e) => {
                  handleUploadPhotos(e.target.files);
                  e.currentTarget.value = '';
                }}
              />
              {uploadingPhotos && <p className="text-xs text-muted-foreground">Enviando fotos...</p>}
              {productPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {productPhotos.map((photoUrl, index) => (
                    <div key={`${photoUrl}-${index}`} className="relative rounded-md border p-1">
                      <img
                        src={photoUrl}
                        alt={`Foto do produto ${index + 1}`}
                        loading="lazy"
                        className="w-full h-20 object-cover rounded"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => setProductPhotos((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value: ProdutoStatus) => setFormData((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
                  {saving ? (editing ? 'Atualizando...' : 'Salvando...') : editing ? 'Atualizar produto' : 'Cadastrar produto'}
                </Button>
                {editing && (
                  <Button variant="outline" onClick={resetForm} disabled={saving}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-semibold">{resumo.total}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm text-muted-foreground">Ativos</span>
              <span className="font-semibold">{resumo.ativos}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm text-muted-foreground">Rascunho</span>
              <span className="font-semibold">{resumo.rascunho}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm text-muted-foreground">Baixo estoque (≤ 5)</span>
              <span className="font-semibold">{resumo.baixoEstoque}</span>
            </div>
            <div className="pt-2 text-xs text-muted-foreground">
              {isAdmin ? 'Você está vendo produtos de todos os usuários.' : 'Você está vendo apenas seus produtos.'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">Gerenciamento de Produtos</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                   placeholder="Buscar por produto, empresa, SKU ou código"
                  className="pl-8 w-full sm:w-[280px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value: 'todos' | ProdutoStatus) => setStatusFilter(value)}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={loadProdutos} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                onClick={() => {
                  resetForm();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <Plus className="h-4 w-4" />
                Novo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando produtos...</div>
          ) : produtos.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Empresa / CNPJ</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((produto) => (
                  <TableRow key={produto.id}>
                    <TableCell className="font-medium">#{produto.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{produto.nome_empresa}</span>
                        <span className="text-xs text-muted-foreground">{produto.cnpj}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{produto.nome_produto}</span>
                        <span className="text-xs text-muted-foreground">{produto.sku || 'Sem SKU'}</span>
                        <span className="text-xs text-muted-foreground">{produto.codigo_barras || 'Sem código de barras'}</span>
                      </div>
                    </TableCell>
                    <TableCell>R$ {Number(produto.preco).toFixed(2).replace('.', ',')}</TableCell>
                    <TableCell>{produto.controlar_estoque === true || produto.controlar_estoque === 1 ? produto.estoque : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={produto.status === 'ativo' ? 'default' : 'secondary'}>{statusLabel[produto.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(produto)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(produto)} title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir produto</DialogTitle>
            <DialogDescription>
              Essa ação vai remover o produto da listagem ativa. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">{deleteTarget?.nome_produto}</div>
            <div className="text-muted-foreground">{deleteTarget?.nome_empresa}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Confirmar exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ler código de barras</DialogTitle>
            <DialogDescription>Use a câmera do celular para escanear e preencher automaticamente o campo.</DialogDescription>
          </DialogHeader>

          <BarcodeScanner
            onDetected={(value) => {
              setFormData((prev) => ({ ...prev, codigo_barras: value }));
              setScannerOpen(false);
              toast.success('Código de barras capturado');
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CnpjProdutos;
