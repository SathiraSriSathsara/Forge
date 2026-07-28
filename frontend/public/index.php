<?php
require_once dirname(__DIR__) . '/includes/bootstrap.php';
header('Location: ' . (!empty($_SESSION['access_token']) ? '/dashboard.php' : '/login.php'));
exit;
