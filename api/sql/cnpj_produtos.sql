-- cnpj_produtos.sql
-- Banco: MySQL
-- Módulo: CNPJ Produtos (ID 183)

CREATE TABLE IF NOT EXISTS cnpj_produtos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  module_id INT NOT NULL DEFAULT 183,
  user_id INT NOT NULL,

  cnpj VARCHAR(18) NOT NULL,
  nome_empresa VARCHAR(255) NOT NULL,
  nome_produto VARCHAR(255) NOT NULL,
  sku VARCHAR(120) NULL,
  categoria VARCHAR(120) NULL,
  codigo_barras VARCHAR(64) NULL,
  controlar_estoque TINYINT(1) NOT NULL DEFAULT 0,
  fotos_json JSON NULL,

  preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  estoque INT NOT NULL DEFAULT 0,
  status ENUM('ativo', 'inativo', 'rascunho') NOT NULL DEFAULT 'ativo',
  ativo TINYINT(1) NOT NULL DEFAULT 1,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_cnpj_produtos_user (user_id),
  INDEX idx_cnpj_produtos_module (module_id),
  INDEX idx_cnpj_produtos_cnpj (cnpj),
  INDEX idx_cnpj_produtos_codigo_barras (codigo_barras),
  INDEX idx_cnpj_produtos_status (status),
  INDEX idx_cnpj_produtos_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Para bases existentes (executar uma vez, se necessário):
-- ALTER TABLE cnpj_produtos ADD COLUMN codigo_barras VARCHAR(64) NULL AFTER categoria;
-- ALTER TABLE cnpj_produtos ADD COLUMN controlar_estoque TINYINT(1) NOT NULL DEFAULT 0 AFTER codigo_barras;
-- CREATE INDEX idx_cnpj_produtos_codigo_barras ON cnpj_produtos (codigo_barras);

-- Conferência rápida
SELECT * FROM cnpj_produtos WHERE ativo = 1 ORDER BY id DESC;