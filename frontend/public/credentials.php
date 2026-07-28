<?php
require_once dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/layout.php';
require_auth();
page_start('Git credentials', 'credentials');
?>
<div class="grid gap-6 xl:grid-cols-[360px_1fr]">
    <section id="credential-form" class="panel self-start p-5">
        <h2 class="text-lg font-bold text-white">Add credential</h2>
        <p class="mt-1 text-sm text-slate-500">Tokens are encrypted by the API and never returned.</p>
        <form class="mt-5 space-y-4" data-form="credential">
            <div><label class="label" for="name">Label</label><input class="field" id="name" name="name" placeholder="GitHub automation" required></div>
            <div><label class="label" for="platform">Platform</label><select class="field" id="platform" name="platform" required><option value="github">GitHub</option><option value="gitea">Gitea</option></select></div>
            <div><label class="label" for="username">Git username</label><input class="field" id="username" name="username" autocomplete="username" required></div>
            <div><label class="label" for="tocken">Access token</label><input class="field" id="tocken" name="tocken" type="password" autocomplete="off" required><p class="mt-1.5 text-xs text-slate-600">Sent once over the protected server proxy.</p></div>
            <button class="btn-primary w-full" type="submit">Save credential</button>
        </form>
    </section>
    <section class="panel min-w-0 p-5">
        <div class="mb-4"><h2 class="text-lg font-bold text-white">Stored credentials</h2><p class="text-sm text-slate-500">Only safe metadata is displayed.</p></div>
        <div id="credentials-list"><div class="skeleton h-52"></div></div>
    </section>
</div>
<?php page_end(); ?>
