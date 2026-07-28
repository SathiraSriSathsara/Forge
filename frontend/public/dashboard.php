<?php
require_once dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/layout.php';
require_auth();
page_start('Overview', 'dashboard');
?>
<section class="mb-8">
    <p class="text-sm text-slate-400">Good to see you, <?= htmlspecialchars($_SESSION['user']['firstName'] ?? 'operator') ?>.</p>
    <h2 class="mt-1 text-2xl font-bold text-white">Your forge at a glance</h2>
</section>
<div id="stats" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <?php for ($i = 0; $i < 4; $i++): ?><div class="panel p-5"><div class="skeleton h-4 w-24"></div><div class="skeleton mt-4 h-9 w-16"></div></div><?php endfor; ?>
</div>
<div class="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
    <section class="panel p-5"><div class="mb-4 flex items-center justify-between"><h3 class="font-bold text-white">Recent repositories</h3><a class="text-sm font-semibold text-forge-400" href="/repositories.php">View all</a></div><div id="recent-repositories"><div class="skeleton h-36"></div></div></section>
    <aside class="panel p-5"><h3 class="font-bold text-white">Quick actions</h3><div class="mt-4 grid gap-3"><a class="btn-primary" href="/repositories.php#repository-form">Clone or sync repository</a><a class="btn-secondary" href="/credentials.php#credential-form">Add Git credential</a><a class="btn-secondary" href="/users.php#user-form">Create user</a></div><p class="mt-5 border-t border-slate-800 pt-4 text-xs leading-5 text-amber-300/80">All authenticated users can manage every record. The API does not currently provide roles or ownership.</p></aside>
</div>
<?php page_end(); ?>
