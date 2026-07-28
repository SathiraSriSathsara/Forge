<?php
declare(strict_types=1);

function page_start(string $title, string $active = ''): void
{
    $user = $_SESSION['user'] ?? null;
    $authenticated = is_array($user);
    $nav = [
        'dashboard' => ['/dashboard.php', 'Overview', '⌁'],
        'repositories' => ['/repositories.php', 'Repositories', '◇'],
        'credentials' => ['/credentials.php', 'Credentials', '◈'],
        'users' => ['/users.php', 'Users', '◎'],
    ];
    ?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="<?= htmlspecialchars(csrf_token()) ?>">
    <title><?= htmlspecialchars($title) ?> · Forge Simplified</title>
    <link rel="stylesheet" href="/assets/app.css">
    <script defer src="/assets/vendor/sweetalert2.all.min.js"></script>
    <script defer src="/assets/app.js"></script>
</head>
<body data-page="<?= htmlspecialchars($active) ?>">
<?php if ($authenticated): ?>
    <div class="min-h-screen lg:flex">
        <aside id="sidebar" class="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-800 bg-slate-950/95 p-4 lg:block">
            <a href="/dashboard.php" class="mb-8 flex items-center gap-3 px-2">
                <span class="grid size-10 place-items-center rounded-xl bg-forge-500 font-black text-slate-950">FS</span>
                <span><strong class="block text-white">Forge Simplified</strong><small class="text-slate-500">Control plane</small></span>
            </a>
            <nav class="space-y-1" aria-label="Primary navigation">
                <?php foreach ($nav as $key => [$href, $label, $icon]): ?>
                    <a class="nav-link <?= $active === $key ? 'nav-link-active' : '' ?>" href="<?= $href ?>">
                        <span aria-hidden="true"><?= $icon ?></span><?= $label ?>
                    </a>
                <?php endforeach; ?>
            </nav>
            <div class="absolute inset-x-4 bottom-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
                <p class="truncate text-sm font-semibold text-white"><?= htmlspecialchars(($user['firstName'] ?? '') . ' ' . ($user['lastName'] ?? '')) ?></p>
                <p class="truncate text-xs text-slate-500"><?= htmlspecialchars($user['email'] ?? '') ?></p>
                <button class="mt-3 text-xs font-semibold text-red-400 hover:text-red-300" data-logout>Sign out</button>
            </div>
        </aside>
        <div class="min-w-0 flex-1 lg:pl-64">
            <header class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/85 px-4 backdrop-blur lg:px-8">
                <button id="menu-toggle" class="btn-secondary px-3 lg:hidden" aria-label="Open navigation">☰</button>
                <div><p class="text-xs uppercase tracking-[.2em] text-forge-400">Workspace</p><h1 class="font-bold text-white"><?= htmlspecialchars($title) ?></h1></div>
                <span id="api-indicator" class="badge border-slate-700 bg-slate-900 text-slate-400">● API checking</span>
            </header>
            <main class="p-4 lg:p-8">
<?php else: ?>
    <main class="grid min-h-screen place-items-center p-4">
<?php endif;
}

function page_end(): void
{
    $authenticated = !empty($_SESSION['user']);
    echo $authenticated ? '</main></div></div>' : '</main>';
    echo '</body></html>';
}

function empty_state(string $title, string $copy): void
{
    echo '<div class="rounded-xl border border-dashed border-slate-700 p-10 text-center"><p class="font-semibold text-white">'
        . htmlspecialchars($title) . '</p><p class="mt-1 text-sm text-slate-500">' . htmlspecialchars($copy) . '</p></div>';
}
