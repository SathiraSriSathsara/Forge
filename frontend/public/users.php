<?php
require_once dirname(__DIR__) . '/includes/bootstrap.php';
require_once dirname(__DIR__) . '/includes/layout.php';
require_auth();
page_start('Users', 'users');
?>
<section id="user-form" class="panel mb-6 p-5">
    <div class="mb-5 flex items-start justify-between"><div><h2 id="user-form-title" class="text-lg font-bold text-white">Create user</h2><p class="text-sm text-slate-500">All users currently receive the same management access.</p></div><button class="btn-secondary hidden" type="button" data-cancel-user-edit>Cancel edit</button></div>
    <form class="grid gap-4 md:grid-cols-2 xl:grid-cols-5" data-form="user">
        <input name="id" type="hidden">
        <div><label class="label" for="firstName">First name</label><input class="field" id="firstName" name="firstName" maxlength="100" required></div>
        <div><label class="label" for="lastName">Last name</label><input class="field" id="lastName" name="lastName" maxlength="100" required></div>
        <div><label class="label" for="username">Username</label><input class="field" id="username" name="username" maxlength="100" required></div>
        <div><label class="label" for="email">Email</label><input class="field" id="email" name="email" type="email" maxlength="150" required></div>
        <div data-password-field><label class="label" for="password">Password</label><input class="field" id="password" name="password" type="password" autocomplete="new-password" required></div>
        <div class="md:col-span-2 xl:col-span-5"><button class="btn-primary" type="submit"><span data-user-submit>Create user</span></button></div>
    </form>
</section>
<section class="panel p-5">
    <div class="mb-4"><h2 class="text-lg font-bold text-white">User directory</h2><p class="text-sm text-slate-500">Profiles are ordered by newest account first.</p></div>
    <div id="users-list"><div class="skeleton h-64"></div></div>
</section>
<?php page_end(); ?>
