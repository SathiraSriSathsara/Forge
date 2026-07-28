<?php
require_once dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/layout.php';
require_auth();
page_start('Repositories', 'repositories');
?>
<section id="repository-form" class="panel mb-6 p-5">
    <div class="mb-5"><h2 class="text-lg font-bold text-white">Clone or synchronize</h2><p class="text-sm text-slate-500">Existing copies are reset to the selected remote branch before the Docker image is built.</p></div>
    <form class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-form="repository">
        <div><label class="label" for="name">Local name</label><input class="field" id="name" name="name" placeholder="example-project" required></div>
        <div class="xl:col-span-2"><label class="label" for="url">HTTPS Git URL</label><input class="field" id="url" name="url" type="url" placeholder="https://github.com/org/repo.git" required></div>
        <div><label class="label" for="tockenID">Credential</label><select class="field" id="tockenID" name="tockenID" required><option value="">Loading credentials…</option></select></div>
        <div><label class="label" for="branch">Branch <span class="normal-case text-slate-600">(optional)</span></label><input class="field" id="branch" name="branch" placeholder="Remote default"></div>
        <div><label class="label" for="webhookSecret">Webhook secret</label><div class="flex gap-2"><input class="field" id="webhookSecret" name="webhookSecret" type="password" minlength="32" maxlength="255" required><button class="btn-secondary shrink-0 px-3" type="button" data-generate-secret>Generate</button></div></div>
        <div class="md:col-span-2 xl:col-span-3"><button class="btn-primary w-full sm:w-auto" type="submit">Start clone / sync and build</button><span class="ml-3 text-xs text-slate-500">This operation can take up to 150 seconds.</span></div>
    </form>
</section>
<section class="panel p-5">
    <div class="mb-4"><h2 class="text-lg font-bold text-white">Synchronized repositories</h2><p class="text-sm text-slate-500">Most recently updated first.</p></div>
    <div id="repositories-list"><div class="skeleton h-64"></div></div>
</section>
<?php page_end(); ?>
