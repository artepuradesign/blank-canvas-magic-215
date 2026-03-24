<?php
// src/models/CnpjProdutos.php

require_once __DIR__ . '/BaseModel.php';

class CnpjProdutos extends BaseModel {
    protected $table = 'cnpj_produtos';

    public function __construct($db) {
        parent::__construct($db);
    }

    public function listProdutos(int $userId, bool $isAdmin, int $limit = 50, int $offset = 0, ?string $search = null, ?string $status = null, ?string $cnpj = null): array {
        $where = ['p.ativo = 1'];
        $params = [];

        if (!$isAdmin) {
            $where[] = 'p.user_id = ?';
            $params[] = $userId;
        }

        if ($search) {
            $where[] = '(p.nome_produto LIKE ? OR p.nome_empresa LIKE ? OR p.sku LIKE ? OR p.categoria LIKE ? OR p.codigo_barras LIKE ?)';
            $searchLike = '%' . $search . '%';
            $params[] = $searchLike;
            $params[] = $searchLike;
            $params[] = $searchLike;
            $params[] = $searchLike;
            $params[] = $searchLike;
        }

        if ($status) {
            $where[] = 'p.status = ?';
            $params[] = $status;
        }

        if ($cnpj) {
            $where[] = 'REPLACE(REPLACE(REPLACE(p.cnpj, ".", ""), "/", ""), "-", "") = ?';
            $params[] = preg_replace('/\D+/', '', $cnpj);
        }

        $whereSql = 'WHERE ' . implode(' AND ', $where);
        $query = "SELECT p.*, u.full_name AS owner_name
                  FROM {$this->table} p
                  LEFT JOIN users u ON u.id = p.user_id
                  {$whereSql}
                  ORDER BY p.id DESC
                  LIMIT ? OFFSET ?";

        $params[] = (int)$limit;
        $params[] = (int)$offset;

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function countProdutos(int $userId, bool $isAdmin, ?string $search = null, ?string $status = null, ?string $cnpj = null): int {
        $where = ['ativo = 1'];
        $params = [];

        if (!$isAdmin) {
            $where[] = 'user_id = ?';
            $params[] = $userId;
        }

        if ($search) {
            $where[] = '(nome_produto LIKE ? OR nome_empresa LIKE ? OR sku LIKE ? OR categoria LIKE ? OR codigo_barras LIKE ?)';
            $searchLike = '%' . $search . '%';
            $params[] = $searchLike;
            $params[] = $searchLike;
            $params[] = $searchLike;
            $params[] = $searchLike;
            $params[] = $searchLike;
        }

        if ($status) {
            $where[] = 'status = ?';
            $params[] = $status;
        }

        if ($cnpj) {
            $where[] = 'REPLACE(REPLACE(REPLACE(cnpj, ".", ""), "/", ""), "-", "") = ?';
            $params[] = preg_replace('/\D+/', '', $cnpj);
        }

        $whereSql = 'WHERE ' . implode(' AND ', $where);
        $query = "SELECT COUNT(*) as count FROM {$this->table} {$whereSql}";

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return (int)($row['count'] ?? 0);
    }

    public function findByIdForUser(int $id, int $userId, bool $isAdmin): ?array {
        $query = "SELECT p.*, u.full_name AS owner_name
                  FROM {$this->table} p
                  LEFT JOIN users u ON u.id = p.user_id
                  WHERE p.id = ? AND p.ativo = 1";
        $params = [$id];

        if (!$isAdmin) {
            $query .= ' AND p.user_id = ?';
            $params[] = $userId;
        }

        $query .= ' LIMIT 1';

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    public function createProduto(array $data, int $userId): int {
        $query = "INSERT INTO {$this->table}
            (module_id, user_id, cnpj, nome_empresa, nome_produto, sku, categoria, codigo_barras, controlar_estoque, fotos_json, preco, estoque, status, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)";

        $stmt = $this->db->prepare($query);
        $stmt->execute([
            (int)($data['module_id'] ?? 183),
            $userId,
            $data['cnpj'],
            $data['nome_empresa'],
            $data['nome_produto'],
            $data['sku'] ?? null,
            $data['categoria'] ?? null,
            $data['codigo_barras'] ?? null,
            (int)($data['controlar_estoque'] ?? 0),
            $data['fotos_json'] ?? null,
            (float)$data['preco'],
            (int)$data['estoque'],
            $data['status'],
        ]);

        return (int)$this->db->lastInsertId();
    }

    public function updateProduto(int $id, array $fields): bool {
        $sets = [];
        $params = [];

        $allowedFields = ['cnpj', 'nome_empresa', 'nome_produto', 'sku', 'categoria', 'codigo_barras', 'controlar_estoque', 'fotos_json', 'preco', 'estoque', 'status'];

        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $fields)) {
                $sets[] = "{$field} = ?";
                $params[] = $fields[$field];
            }
        }

        if (empty($sets)) {
            return false;
        }

        $params[] = $id;
        $query = "UPDATE {$this->table} SET " . implode(', ', $sets) . ", updated_at = NOW() WHERE id = ?";
        $stmt = $this->db->prepare($query);
        return $stmt->execute($params);
    }

    public function deleteProduto(int $id): bool {
        $query = "UPDATE {$this->table} SET ativo = 0, status = 'inativo', updated_at = NOW() WHERE id = ?";
        $stmt = $this->db->prepare($query);
        return $stmt->execute([$id]);
    }
}
