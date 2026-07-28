<?php
require_once dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/layout.php';
redirect_if_authenticated();
page_start('Sign in', 'login');
?>
<section class="panel w-full max-w-md overflow-hidden">
    <div class="border-b border-slate-800 p-6">
        <div class="mb-5 flex items-center gap-3">
            <span class="grid size-11 place-items-center rounded-xl bg-forge-500 font-black text-slate-950">FS</span>
            <div><h1 class="font-bold text-white">Forge Simplified</h1><p class="text-xs text-slate-500">Repository control plane</p></div>
        </div>
        <h2 class="text-2xl font-bold text-white">Welcome back</h2>
        <p class="mt-1 text-sm text-slate-400">Authenticate to manage builds, credentials, and users.</p>
    </div>
    <form class="space-y-4 p-6" data-form="login">
        <div><label class="label" for="email">Email</label><input class="field" id="email" name="email" type="email" autocomplete="email" required></div>
        <div><label class="label" for="password">Password</label><input class="field" id="password" name="password" type="password" autocomplete="current-password" required></div>
        <button class="btn-primary w-full" type="submit">Sign in</button>
        <p class="text-center text-sm text-slate-500">New here? <a class="font-semibold text-forge-400 hover:text-forge-300" href="/register.php">Create an account</a></p>
    </form>
</section>
<?php page_end(); ?>
