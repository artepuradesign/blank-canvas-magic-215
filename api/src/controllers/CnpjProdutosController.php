<?php
// src/controllers/CnpjProdutosController.php

require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../models/CnpjProdutos.php';

class CnpjProdutosController {
    private $db;
    private $model;

    public function __construct($db) {
        $this->db = $db;
        $this->model = new CnpjProdutos($db);
    }

    public function listProdutos() {
        try {
            $userId = (int)(AuthMiddleware::getCurrentUserId() ?? 0);
            if ($userId <= 0) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $isAdmin = $this->isAdminOrSupport($userId);
            $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 50;
            $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

            $search = isset($_GET['search']) ? trim((string)$_GET['search']) : null;
            $status = isset($_GET['status']) ? trim((string)$_GET['status']) : null;
            $cnpj = isset($_GET['cnpj']) ? trim((string)$_GET['cnpj']) : null;

            if ($status && !in_array($status, ['ativo', 'inativo', 'rascunho'], true)) {
                Response::error('Status inválido', 400);
                return;
            }

            $rows = $this->model->listProdutos($userId, $isAdmin, $limit, $offset, $search, $status, $cnpj);
            $rows = array_map([$this, 'normalizeProdutoRow'], $rows);
            $total = $this->model->countProdutos($userId, $isAdmin, $search, $status, $cnpj);

            Response::success([
                'data' => $rows,
                'pagination' => [
                    'total' => $total,
                    'limit' => $limit,
                    'offset' => $offset,
                ],
            ], 'Produtos carregados com sucesso');
        } catch (Exception $e) {
            Response::error('Erro ao listar produtos: ' . $e->getMessage(), 500);
        }
    }

    public function criar() {
        try {
            $userId = (int)(AuthMiddleware::getCurrentUserId() ?? 0);
            if ($userId <= 0) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $input = $this->readJsonInput();
            if (!$input) {
                Response::error('Dados inválidos', 400);
                return;
            }

            $companyData = $this->getUserCompanyData($userId);
            if (empty($companyData['cnpj']) || empty($companyData['nome_empresa'])) {
                Response::error('Preencha CNPJ e nome da empresa em Dados Pessoais para cadastrar produtos', 400);
                return;
            }

            $input['cnpj'] = $companyData['cnpj'];
            $input['nome_empresa'] = $companyData['nome_empresa'];

            $payload = $this->validatePayload($input, false);
            $newId = $this->model->createProduto($payload, $userId);
            $created = $this->model->findByIdForUser($newId, $userId, true);
            $created = $created ? $this->normalizeProdutoRow($created) : null;

            Response::success($created, 'Produto cadastrado com sucesso', 201);
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 400);
        } catch (Exception $e) {
            Response::error('Erro ao cadastrar produto: ' . $e->getMessage(), 500);
        }
    }

    public function atualizar() {
        try {
            $userId = (int)(AuthMiddleware::getCurrentUserId() ?? 0);
            if ($userId <= 0) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $isAdmin = $this->isAdminOrSupport($userId);
            $input = $this->readJsonInput();
            if (!$input || !isset($input['id'])) {
                Response::error('id é obrigatório', 400);
                return;
            }

            $id = (int)$input['id'];
            if ($id <= 0) {
                Response::error('id inválido', 400);
                return;
            }

            $existing = $this->model->findByIdForUser($id, $userId, $isAdmin);
            if (!$existing) {
                Response::error('Produto não encontrado ou sem permissão', 404);
                return;
            }

            $companyData = $this->getUserCompanyData($userId);
            if (!empty($companyData['cnpj']) && !empty($companyData['nome_empresa'])) {
                $input['cnpj'] = $companyData['cnpj'];
                $input['nome_empresa'] = $companyData['nome_empresa'];
            }

            $payload = $this->validatePayload($input, true);
            if (empty($payload)) {
                Response::error('Nenhum campo válido para atualizar', 400);
                return;
            }

            $this->model->updateProduto($id, $payload);
            $updated = $this->model->findByIdForUser($id, $userId, $isAdmin);
            $updated = $updated ? $this->normalizeProdutoRow($updated) : null;

            Response::success($updated, 'Produto atualizado com sucesso');
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 400);
        } catch (Exception $e) {
            Response::error('Erro ao atualizar produto: ' . $e->getMessage(), 500);
        }
    }

    public function excluir() {
        try {
            $userId = (int)(AuthMiddleware::getCurrentUserId() ?? 0);
            if ($userId <= 0) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            $isAdmin = $this->isAdminOrSupport($userId);
            $input = $this->readJsonInput();
            if (!$input || !isset($input['id'])) {
                Response::error('id é obrigatório', 400);
                return;
            }

            $id = (int)$input['id'];
            if ($id <= 0) {
                Response::error('id inválido', 400);
                return;
            }

            $existing = $this->model->findByIdForUser($id, $userId, $isAdmin);
            if (!$existing) {
                Response::error('Produto não encontrado ou sem permissão', 404);
                return;
            }

            $this->model->deleteProduto($id);
            Response::success(['id' => $id], 'Produto excluído com sucesso');
        } catch (Exception $e) {
            Response::error('Erro ao excluir produto: ' . $e->getMessage(), 500);
        }
    }

    public function uploadFoto() {
        try {
            $userId = (int)(AuthMiddleware::getCurrentUserId() ?? 0);
            if ($userId <= 0) {
                Response::error('Usuário não autenticado', 401);
                return;
            }

            if (!isset($_FILES['photo']) || !is_array($_FILES['photo'])) {
                Response::error('Arquivo de foto é obrigatório', 400);
                return;
            }

            $file = $_FILES['photo'];
            if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                Response::error('Erro ao enviar arquivo', 400);
                return;
            }

            $allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
            if (!in_array((string)($file['type'] ?? ''), $allowedMime, true)) {
                Response::error('Formato inválido. Use JPEG, PNG, GIF ou WebP', 400);
                return;
            }

            $maxSize = 5 * 1024 * 1024;
            if ((int)($file['size'] ?? 0) > $maxSize) {
                Response::error('Arquivo muito grande. Máximo permitido: 5MB', 400);
                return;
            }

            $uploadDir = __DIR__ . '/../../arquivosupload/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }

            $extension = strtolower((string)pathinfo((string)($file['name'] ?? ''), PATHINFO_EXTENSION));
            if (!in_array($extension, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)) {
                $extension = 'jpg';
            }

            $fileName = 'produto_' . $userId . '_' . date('YmdHis') . '_' . bin2hex(random_bytes(4)) . '.' . $extension;
            $targetPath = $uploadDir . $fileName;

            if (!move_uploaded_file((string)$file['tmp_name'], $targetPath)) {
                Response::error('Falha ao salvar arquivo no servidor', 500);
                return;
            }

            Response::success([
                'filename' => $fileName,
                'url' => $this->buildUploadFileUrl($fileName),
            ], 'Foto enviada com sucesso');
        } catch (Exception $e) {
            Response::error('Erro ao enviar foto: ' . $e->getMessage(), 500);
        }
    }

    private function readJsonInput(): ?array {
        $raw = file_get_contents('php://input');
        if (!$raw) {
            return null;
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    private function validatePayload(array $input, bool $partial = false): array {
        $result = [];

        $requiredFields = ['cnpj', 'nome_empresa', 'nome_produto'];
        if (!$partial) {
            foreach ($requiredFields as $field) {
                if (!isset($input[$field]) || trim((string)$input[$field]) === '') {
                    throw new InvalidArgumentException("{$field} é obrigatório");
                }
            }
        }

        if (array_key_exists('cnpj', $input)) {
            $digits = preg_replace('/\D+/', '', (string)$input['cnpj']);
            if (strlen($digits) !== 14) {
                throw new InvalidArgumentException('CNPJ deve conter 14 dígitos');
            }
            $result['cnpj'] = $this->formatCnpj($digits);
        }

        if (array_key_exists('nome_empresa', $input)) {
            $nomeEmpresa = trim((string)$input['nome_empresa']);
            if ($nomeEmpresa === '' || mb_strlen($nomeEmpresa) > 255) {
                throw new InvalidArgumentException('nome_empresa inválido');
            }
            $result['nome_empresa'] = $nomeEmpresa;
        }

        if (array_key_exists('nome_produto', $input)) {
            $nomeProduto = trim((string)$input['nome_produto']);
            if ($nomeProduto === '' || mb_strlen($nomeProduto) > 255) {
                throw new InvalidArgumentException('nome_produto inválido');
            }
            $result['nome_produto'] = $nomeProduto;
        }

        if (array_key_exists('sku', $input)) {
            $sku = trim((string)$input['sku']);
            $result['sku'] = $sku === '' ? null : mb_substr($sku, 0, 120);
        }

        if (array_key_exists('categoria', $input)) {
            $categoria = trim((string)$input['categoria']);
            $result['categoria'] = $categoria === '' ? null : mb_substr($categoria, 0, 120);
        }

        $controlarEstoque = null;
        if (array_key_exists('controlar_estoque', $input)) {
            $rawControlar = $input['controlar_estoque'];
            $isTrue = $rawControlar === true || $rawControlar === 1 || $rawControlar === '1' || $rawControlar === 'true';
            $isFalse = $rawControlar === false || $rawControlar === 0 || $rawControlar === '0' || $rawControlar === 'false';

            if (!$isTrue && !$isFalse) {
                throw new InvalidArgumentException('controlar_estoque inválido');
            }

            $controlarEstoque = $isTrue;
            $result['controlar_estoque'] = $controlarEstoque ? 1 : 0;
        } elseif (!$partial) {
            $controlarEstoque = false;
            $result['controlar_estoque'] = 0;
        }

        if (array_key_exists('codigo_barras', $input)) {
            $codigoBarras = preg_replace('/\s+/', '', trim((string)$input['codigo_barras']));
            if ($codigoBarras !== '' && mb_strlen($codigoBarras) > 64) {
                throw new InvalidArgumentException('codigo_barras deve ter no máximo 64 caracteres');
            }
            $result['codigo_barras'] = $codigoBarras === '' ? null : $codigoBarras;
        }

        if (array_key_exists('fotos', $input)) {
            if (!is_array($input['fotos'])) {
                throw new InvalidArgumentException('fotos deve ser uma lista');
            }

            $fotos = array_values(array_filter(array_map(function ($url) {
                $val = trim((string)$url);
                return $val !== '' ? mb_substr($val, 0, 500) : null;
            }, $input['fotos'])));

            if (count($fotos) > 5) {
                throw new InvalidArgumentException('Máximo de 5 fotos por produto');
            }

            $result['fotos_json'] = empty($fotos) ? null : json_encode($fotos, JSON_UNESCAPED_UNICODE);
        }

        if (array_key_exists('preco', $input)) {
            $preco = (float)$input['preco'];
            if ($preco < 0) {
                throw new InvalidArgumentException('preco não pode ser negativo');
            }
            $result['preco'] = round($preco, 2);
        } elseif (!$partial) {
            $result['preco'] = 0;
        }

        if (array_key_exists('estoque', $input)) {
            $estoque = (int)$input['estoque'];
            if ($estoque < 0) {
                throw new InvalidArgumentException('estoque não pode ser negativo');
            }
            $result['estoque'] = $estoque;
        } elseif (!$partial) {
            $result['estoque'] = 0;
        }

        if ($controlarEstoque === false) {
            $result['estoque'] = 0;
        }

        if (array_key_exists('status', $input)) {
            $status = trim((string)$input['status']);
            if (!in_array($status, ['ativo', 'inativo', 'rascunho'], true)) {
                throw new InvalidArgumentException('status inválido');
            }
            $result['status'] = $status;
        } elseif (!$partial) {
            $result['status'] = 'ativo';
        }

        if (array_key_exists('module_id', $input)) {
            $result['module_id'] = (int)$input['module_id'] > 0 ? (int)$input['module_id'] : 183;
        } elseif (!$partial) {
            $result['module_id'] = 183;
        }

        return $result;
    }

    private function isAdminOrSupport(int $userId): bool {
        $stmt = $this->db->prepare('SELECT user_role FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $role = $row['user_role'] ?? '';

        return in_array($role, ['admin', 'suporte'], true);
    }

    private function formatCnpj(string $digits): string {
        return substr($digits, 0, 2) . '.' .
            substr($digits, 2, 3) . '.' .
            substr($digits, 5, 3) . '/' .
            substr($digits, 8, 4) . '-' .
            substr($digits, 12, 2);
    }

    private function normalizeProdutoRow(array $row): array {
        $row['codigo_barras'] = !empty($row['codigo_barras']) ? (string)$row['codigo_barras'] : null;
        $row['controlar_estoque'] = ((int)($row['controlar_estoque'] ?? 0)) === 1;

        $fotos = [];
        if (!empty($row['fotos_json'])) {
            $decoded = json_decode((string)$row['fotos_json'], true);
            if (is_array($decoded)) {
                $fotos = array_values(array_filter($decoded, fn($item) => is_string($item) && trim($item) !== ''));
            }
        }

        $row['fotos'] = $fotos;
        return $row;
    }

    private function getUserCompanyData(int $userId): array {
        $stmt = $this->db->prepare('SELECT cnpj, full_name FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $digits = preg_replace('/\D+/', '', (string)($row['cnpj'] ?? ''));
        if (strlen($digits) !== 14) {
            return ['cnpj' => null, 'nome_empresa' => null];
        }

        $nomeEmpresa = trim((string)($row['full_name'] ?? ''));
        return [
            'cnpj' => $this->formatCnpj($digits),
            'nome_empresa' => $nomeEmpresa !== '' ? mb_substr($nomeEmpresa, 0, 255) : null,
        ];
    }

    private function buildUploadFileUrl(string $filename): string {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'api.apipainel.com.br';
        return $scheme . '://' . $host . '/api/upload/serve?file=' . rawurlencode($filename);
    }
}
