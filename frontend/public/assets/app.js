(() => {
  "use strict";

  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || "";
  const page = document.body.dataset.page;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[char]);
  const formatDate = (value) => value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Never";
  const shortCommit = (value) => value ? String(value).slice(0, 10) : "—";
  const formData = (form) => Object.fromEntries(new FormData(form).entries());
  const setBusy = (form, busy) => {
    form.querySelectorAll("button, input, select").forEach((element) => {
      element.disabled = busy;
    });
  };

  async function request(action, data = {}) {
    let response;
    try {
      response = await fetch("/actions/api.php", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ action, data }),
      });
    } catch {
      throw { message: "Could not reach the frontend service. Check your connection." };
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw { message: "The server returned an unreadable response." };
    }
    if (!response.ok || body.success === false) {
      if (body.sessionExpired) {
        await Swal.fire({ icon: "warning", title: "Session expired", text: body.message, confirmButtonColor: "#10b981" });
        location.href = "/login.php";
      }
      throw body;
    }
    return body;
  }

  function errorText(error) {
    const details = Array.isArray(error.errors)
      ? error.errors.map((item) => `${item.field ? `${item.field}: ` : ""}${item.message}`).join("\n")
      : "";
    return [error.message || "Something went wrong", details].filter(Boolean).join("\n\n");
  }

  async function notifyError(error) {
    await Swal.fire({
      icon: "error",
      title: "Request failed",
      text: errorText(error),
      confirmButtonColor: "#10b981",
      background: "#0f172a",
      color: "#e2e8f0",
    });
  }

  async function notifySuccess(message) {
    return Swal.fire({
      icon: "success",
      title: "Done",
      text: message,
      timer: 1800,
      showConfirmButton: false,
      background: "#0f172a",
      color: "#e2e8f0",
    });
  }

  document.querySelector("#menu-toggle")?.addEventListener("click", () => {
    document.querySelector("#sidebar")?.classList.toggle("hidden");
  });

  document.querySelectorAll("[data-logout]").forEach((button) => button.addEventListener("click", async () => {
    const result = await Swal.fire({
      title: "Sign out?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sign out",
      confirmButtonColor: "#10b981",
      background: "#0f172a",
      color: "#e2e8f0",
    });
    if (!result.isConfirmed) return;
    try {
      const body = await request("logout");
      location.href = body.redirect;
    } catch (error) {
      notifyError(error);
    }
  }));

  async function checkHealth() {
    const indicator = document.querySelector("#api-indicator");
    if (!indicator) return;
    try {
      await request("health");
      indicator.className = "badge border-emerald-800 bg-emerald-950/60 text-emerald-400";
      indicator.textContent = "● API online";
    } catch {
      indicator.className = "badge border-red-900 bg-red-950/60 text-red-400";
      indicator.textContent = "● API offline";
    }
  }

  function bindSimpleForm(name, action, afterSuccess) {
    const form = document.querySelector(`[data-form="${name}"]`);
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = formData(form);
      setBusy(form, true);
      try {
        const body = await request(action, payload);
        await notifySuccess(body.message);
        if (body.data?.redirect || body.redirect) {
          location.href = body.data?.redirect || body.redirect;
          return;
        }
        form.reset();
        await afterSuccess?.(body);
      } catch (error) {
        await notifyError(error);
      } finally {
        setBusy(form, false);
      }
    });
  }

  function renderRepositories(items, compact = false) {
    if (!items.length) return '<div class="rounded-xl border border-dashed border-slate-700 p-10 text-center"><p class="font-semibold text-white">No repositories yet</p><p class="mt-1 text-sm text-slate-500">Clone your first repository to see it here.</p></div>';
    const visible = compact ? items.slice(0, 5) : items;
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Repository</th><th>Branch / commit</th>${compact ? "" : "<th>Credential</th><th>Image</th>"}<th>Updated</th></tr></thead><tbody>${visible.map((repo) => `
      <tr>
        <td><p class="font-semibold text-white">${esc(repo.name)}</p><p class="max-w-sm truncate text-xs text-slate-500" title="${esc(repo.url)}">${esc(repo.url)}</p>${compact ? "" : `<p class="mt-1 max-w-sm truncate font-mono text-[11px] text-slate-600" title="${esc(repo.savedLocation)}">${esc(repo.savedLocation)}</p>`}</td>
        <td><span class="badge border-sky-900 bg-sky-950/60 text-sky-300">${esc(repo.branch)}</span><p class="mt-1 font-mono text-xs text-slate-500">${esc(shortCommit(repo.lastCommit))}</p></td>
        ${compact ? "" : `<td>${repo.credential ? `<p class="text-white">${esc(repo.credential.name)}</p><p class="text-xs text-slate-500">${esc(repo.credential.platform)} · ${esc(repo.credential.username)}</p>` : '<span class="text-slate-600">Missing</span>'}</td><td><p class="font-mono text-xs text-forge-400">${esc(repo.imageName)}</p><p class="mt-1 text-[11px] text-slate-600">${esc(repo.webhookEndpoint)}</p></td>`}
        <td class="whitespace-nowrap text-xs text-slate-500">${esc(formatDate(repo.lastUpdated))}</td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  async function loadDashboard() {
    try {
      const body = await request("dashboard");
      const { users, credentials, repositories, partialFailure } = body.data;
      const cards = [
        ["Repositories", repositories.length, "Synchronized projects", "text-forge-400"],
        ["Credentials", credentials.length, "Encrypted Git identities", "text-sky-400"],
        ["Users", users.length, "Management accounts", "text-violet-400"],
        ["Build status", repositories.length ? "Ready" : "Idle", partialFailure ? "Some data unavailable" : "Services responding", partialFailure ? "text-amber-400" : "text-emerald-400"],
      ];
      document.querySelector("#stats").innerHTML = cards.map(([label, value, note, color]) => `<article class="panel p-5"><p class="text-xs font-semibold uppercase tracking-wider text-slate-500">${label}</p><p class="mt-3 text-3xl font-black ${color}">${esc(value)}</p><p class="mt-1 text-xs text-slate-600">${note}</p></article>`).join("");
      document.querySelector("#recent-repositories").innerHTML = renderRepositories(repositories, true);
    } catch (error) {
      document.querySelector("#stats").innerHTML = `<div class="panel p-5 sm:col-span-2 xl:col-span-4 text-red-400">${esc(errorText(error))}</div>`;
      document.querySelector("#recent-repositories").innerHTML = '<p class="text-sm text-slate-500">Repository data is unavailable.</p>';
    }
  }

  async function loadCredentials() {
    const container = document.querySelector("#credentials-list");
    try {
      const body = await request("list_credentials");
      const items = body.data || [];
      container.innerHTML = items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Platform</th><th>Username</th><th>Added</th><th></th></tr></thead><tbody>${items.map((item) => `<tr><td class="font-semibold text-white">${esc(item.name)}</td><td><span class="badge ${item.platform === "github" ? "border-violet-900 bg-violet-950/60 text-violet-300" : "border-orange-900 bg-orange-950/60 text-orange-300"}">${esc(item.platform)}</span></td><td>${esc(item.username)}</td><td class="whitespace-nowrap text-xs text-slate-500">${esc(formatDate(item.createdAt))}</td><td class="text-right"><button class="btn-danger" data-delete-credential="${item.id}" data-name="${esc(item.name)}">Delete</button></td></tr>`).join("")}</tbody></table></div>` : '<div class="rounded-xl border border-dashed border-slate-700 p-10 text-center"><p class="font-semibold text-white">No credentials stored</p><p class="mt-1 text-sm text-slate-500">Add a GitHub or Gitea credential to begin.</p></div>';
    } catch (error) {
      container.innerHTML = `<p class="text-red-400">${esc(errorText(error))}</p>`;
    }
  }

  document.addEventListener("click", async (event) => {
    const credentialButton = event.target.closest("[data-delete-credential]");
    if (credentialButton) {
      const result = await Swal.fire({ title: `Delete ${credentialButton.dataset.name}?`, text: "Repositories may prevent deletion while they reference this credential.", icon: "warning", showCancelButton: true, confirmButtonText: "Delete", confirmButtonColor: "#dc2626", background: "#0f172a", color: "#e2e8f0" });
      if (!result.isConfirmed) return;
      try {
        const body = await request("delete_credential", { id: credentialButton.dataset.deleteCredential });
        await notifySuccess(body.message);
        loadCredentials();
      } catch (error) { notifyError(error); }
    }
  });

  async function loadRepositories() {
    const container = document.querySelector("#repositories-list");
    try {
      const [repos, credentials] = await Promise.all([request("list_repositories"), request("list_credentials")]);
      container.innerHTML = renderRepositories(repos.data || []);
      const select = document.querySelector('[name="tockenID"]');
      const items = credentials.data || [];
      select.innerHTML = items.length
        ? `<option value="">Select a credential</option>${items.map((item) => `<option value="${item.id}">${esc(item.name)} · ${esc(item.platform)} · ${esc(item.username)}</option>`).join("")}`
        : '<option value="">Add a credential first</option>';
    } catch (error) {
      container.innerHTML = `<p class="text-red-400">${esc(errorText(error))}</p>`;
    }
  }

  document.querySelector("[data-generate-secret]")?.addEventListener("click", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    document.querySelector('[name="webhookSecret"]').value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  });

  const repositoryForm = document.querySelector('[data-form="repository"]');
  repositoryForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formData(repositoryForm);
    setBusy(repositoryForm, true);
    Swal.fire({ title: "Synchronizing repository", html: "Git operations and the Docker build are running.<br><small>This may take up to 150 seconds.</small>", allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading(), background: "#0f172a", color: "#e2e8f0" });
    try {
      const body = await request("clone_repository", payload);
      const result = body.data;
      await Swal.fire({
        icon: "success",
        title: body.message,
        html: `<div class="text-left text-sm"><p><b>Action:</b> ${esc(result.action)}</p><p><b>Branch:</b> ${esc(result.branch)}</p><p><b>Commit:</b> <code>${esc(shortCommit(result.lastCommit))}</code></p><p><b>Image:</b> <code>${esc(result.imageName)}</code></p><p><b>Webhook:</b> <code>${esc(result.webhookEndpoint)}</code></p><p class="mt-2 text-slate-400">${esc(result.dockerBuild?.message || "Build completed")}</p></div>`,
        confirmButtonColor: "#10b981", background: "#0f172a", color: "#e2e8f0",
      });
      repositoryForm.reset();
      loadRepositories();
    } catch (error) {
      Swal.close();
      notifyError(error);
    } finally {
      setBusy(repositoryForm, false);
    }
  });

  let usersCache = [];
  async function loadUsers() {
    const container = document.querySelector("#users-list");
    try {
      const body = await request("list_users");
      usersCache = body.data || [];
      container.innerHTML = usersCache.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>User</th><th>Username</th><th>Created</th><th></th></tr></thead><tbody>${usersCache.map((user) => `<tr><td><p class="font-semibold text-white">${esc(user.firstName)} ${esc(user.lastName)}</p><p class="text-xs text-slate-500">${esc(user.email)}</p></td><td>@${esc(user.username)}</td><td class="whitespace-nowrap text-xs text-slate-500">${esc(formatDate(user.createdAt))}</td><td><div class="flex justify-end gap-2"><button class="btn-secondary px-3 py-2" data-edit-user="${user.id}">Edit</button><button class="btn-danger" data-delete-user="${user.id}" data-name="${esc(user.firstName)} ${esc(user.lastName)}">Delete</button></div></td></tr>`).join("")}</tbody></table></div>` : '<div class="rounded-xl border border-dashed border-slate-700 p-10 text-center"><p class="font-semibold text-white">No users found</p></div>';
    } catch (error) {
      container.innerHTML = `<p class="text-red-400">${esc(errorText(error))}</p>`;
    }
  }

  const userForm = document.querySelector('[data-form="user"]');
  function resetUserForm() {
    if (!userForm) return;
    userForm.reset();
    userForm.elements.id.value = "";
    userForm.querySelector("[data-password-field]").classList.remove("hidden");
    userForm.elements.password.required = true;
    document.querySelector("#user-form-title").textContent = "Create user";
    document.querySelector("[data-user-submit]").textContent = "Create user";
    document.querySelector("[data-cancel-user-edit]").classList.add("hidden");
  }

  document.querySelector("[data-cancel-user-edit]")?.addEventListener("click", resetUserForm);
  userForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formData(userForm);
    const editing = Boolean(payload.id);
    setBusy(userForm, true);
    try {
      const body = await request(editing ? "update_user" : "create_user", payload);
      await notifySuccess(body.message);
      resetUserForm();
      loadUsers();
    } catch (error) { notifyError(error); } finally { setBusy(userForm, false); }
  });

  document.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit-user]");
    if (edit && userForm) {
      const user = usersCache.find((item) => String(item.id) === edit.dataset.editUser);
      if (!user) return;
      ["id", "firstName", "lastName", "username", "email"].forEach((key) => { userForm.elements[key].value = user[key]; });
      userForm.querySelector("[data-password-field]").classList.add("hidden");
      userForm.elements.password.required = false;
      document.querySelector("#user-form-title").textContent = "Edit user";
      document.querySelector("[data-user-submit]").textContent = "Save changes";
      document.querySelector("[data-cancel-user-edit]").classList.remove("hidden");
      userForm.scrollIntoView({ behavior: "smooth" });
    }
    const remove = event.target.closest("[data-delete-user]");
    if (remove) {
      const result = await Swal.fire({ title: `Delete ${remove.dataset.name}?`, text: "This action cannot be undone. Deleting your own account will sign you out.", icon: "warning", showCancelButton: true, confirmButtonText: "Delete user", confirmButtonColor: "#dc2626", background: "#0f172a", color: "#e2e8f0" });
      if (!result.isConfirmed) return;
      try {
        const body = await request("delete_user", { id: remove.dataset.deleteUser });
        await notifySuccess(body.message);
        if (body.redirect) location.href = body.redirect;
        else loadUsers();
      } catch (error) { notifyError(error); }
    }
  });

  bindSimpleForm("login", "login");
  bindSimpleForm("register", "register", () => { location.href = "/login.php"; });
  bindSimpleForm("credential", "create_credential", loadCredentials);

  if (page === "dashboard") loadDashboard();
  if (page === "credentials") loadCredentials();
  if (page === "repositories") loadRepositories();
  if (page === "users") loadUsers();
  if (!["login", "register"].includes(page)) checkHealth();
})();
