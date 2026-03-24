<?php
// src/routes/cnpj_produtos.php - Rotas para CNPJ Produtos (módulo 183)

require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middleware/CorsMiddleware.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../controllers/CnpjProdutosController.php';

$corsMiddleware = new CorsMiddleware();
$corsMiddleware->handle();

$authMiddleware = new AuthMiddleware($db);
if (!$authMiddleware->handle()) {
    exit;
}

$controller = new CnpjProdutosController($db);
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

switch ($method) {
    case 'GET':
        if (strpos($path, '/cnpj-produtos/list') !== false || $path === '/cnpj-produtos') {
            $controller->listProdutos();
        } else {
            Response::notFound('Endpoint não encontrado');
        }
        break;

    case 'POST':
        if (strpos($path, '/cnpj-produtos/upload-foto') !== false) {
            $controller->uploadFoto();
        } elseif (strpos($path, '/cnpj-produtos/criar') !== false) {
            $controller->criar();
        } else {
            Response::notFound('Endpoint não encontrado');
        }
        break;

    case 'PUT':
        if (strpos($path, '/cnpj-produtos/atualizar') !== false) {
            $controller->atualizar();
        } else {
            Response::notFound('Endpoint não encontrado');
        }
        break;

    case 'DELETE':
        if (strpos($path, '/cnpj-produtos/excluir') !== false) {
            $controller->excluir();
        } else {
            Response::notFound('Endpoint não encontrado');
        }
        break;

    default:
        Response::methodNotAllowed('Método não permitido');
        break;
}
