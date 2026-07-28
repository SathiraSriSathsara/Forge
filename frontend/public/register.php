<?php
require_once dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/layout.php';
redirect_if_authenticated();
page_start('Create account', 'register');
?>
<section class="panel w-full max-w-2xl overflow-hidden">
    <div class="border-b border-slate-800 p-6">
        <a class="mb-5 inline-flex items-center gap-3" href="/login.php"><span class="grid size-11 place-items-center rounded-xl bg-forge-500 font-black text-slate-950">FS</span><strong class="text-white">Forge Simplified</strong></a>
        <h1 class="text-2xl font-bold text-white">Create your account</h1>
        <p class="mt-1 text-sm text-slate-400">Registration is public in the current API configuration.</p>
    </div>
    <form class="grid gap-4 p-6 sm:grid-cols-2" data-form="register">
        <div><label class="label" for="firstName">First name</label><input class="field" id="firstName" name="firstName" maxlength="100" required></div>
        <div><label class="label" for="lastName">Last name</label><input class="field" id="lastName" name="lastName" maxlength="100" required></div>
        <div><label class="label" for="username">Username</label><input class="field" id="username" name="username" maxlength="100" autocomplete="username" required></div>
        <div><label class="label" for="email">Email</label><input class="field" id="email" name="email" maxlength="150" type="email" autocomplete="email" required></div>
        <div class="sm:col-span-2"><label class="label" for="password">Password</label><input class="field" id="password" name="password" type="password" autocomplete="new-password" required></div>
        <div class="flex items-center gap-3 sm:col-span-2"><button class="btn-primary flex-1" type="submit">Create account</button><a class="btn-secondary" href="/login.php">Back</a></div>
    </form>
</section>
<?php page_end(); ?>
