(function () {
  "use strict";

  const TABLES = {
    inventory: "hct_inventory_items",
    pieces: "hct_inventory_pieces",
    transactions: "hct_inventory_transactions",
    vr: "hct_vr_assets",
    requests: "hct_requests",
    requestHistory: "hct_request_history",
    audit: "hct_audit_logs",
    rooms: "hct_rooms"
  };

  const DEFAULT_ROOMS = [
    { code: "5F-ICU", floor: "5th Floor", name: "Intensive Care Unit (ICU)", short: "ICU", icon: "&#x1F3E5;" },
    { code: "5F-AHA", floor: "5th Floor", name: "American Heart Association (AHA)", short: "AHA", icon: "&#x2665;" },
    { code: "5F-OR", floor: "5th Floor", name: "Operating Room (OR)", short: "OR", icon: "&#x2695;" },
    { code: "5F-DR", floor: "5th Floor", name: "Delivery Room (DR)", short: "DR", icon: "&#x1F476;" },
    { code: "3F-ICU", floor: "3rd Floor", name: "Intensive Care Unit (ICU)", short: "ICU", icon: "&#x1F3E5;" },
    { code: "3F-OR", floor: "3rd Floor", name: "Operating Room (OR)", short: "OR", icon: "&#x2695;" },
    { code: "3F-DR", floor: "3rd Floor", name: "Delivery Room (DR)", short: "DR", icon: "&#x1F476;" },
    { code: "3F-VR", floor: "3rd Floor", name: "Virtual Reality (VR)", short: "VR", icon: "&#x25A3;" },
    { code: "3F-CG", floor: "3rd Floor", name: "Caregiving", short: "Caregiving", icon: "&#x267F;" },
    { code: "3F-EMS", floor: "3rd Floor", name: "EMS", short: "EMS", icon: "&#x26D1;" },
    { code: "CSR", floor: "Central Supply", name: "Central Supply Room", short: "CSR", icon: "&#x1F4E6;" }
  ];
  let ROOMS = DEFAULT_ROOMS.slice();

  const ITEM_OPTIONS = {
    ICU: ["Hospital Bed", "Cardiac Monitor", "Defibrillator", "Infusion Pump", "Syringe Pump", "Ventilator", "Oxygen Tank", "Suction Machine", "ECG Machine", "Crash Cart", "IV Stand", "Pulse Oximeter", "Adult Manikin", "Pediatric Manikin", "Neonatal Manikin"],
    OR: ["Operating Table", "Surgical Light", "Mayo Stand", "Instrument Tray", "Anesthesia Machine", "Electrocautery Machine", "Suction Apparatus", "Surgical Instrument Sets", "Back Table", "OR Stools"],
    DR: ["Delivery Bed", "Infant Warmer", "Fetal Doppler", "Delivery Instrument Set", "Newborn Scale", "Resuscitation Equipment", "Obstetric Manikins"],
    AHA: ["CPR Manikins", "AED Trainers", "BVM Devices", "Airway Trainers", "CPR Feedback Devices"],
    EMS: ["Spine Board", "Scoop Stretcher", "Cervical Collar", "Ambulance Equipment", "Trauma Kits", "Splints", "Extrication Devices"],
    Caregiving: ["Wheelchair", "Walker", "Cane", "Bedside Commode", "Patient Transfer Equipment"],
    VR: ["VR Headset", "VR Controller", "Charging Dock", "VR Sensors", "VR Computer/Workstation", "VR Accessories"],
    CSR: ["Hospital Bed", "Cardiac Monitor", "Defibrillator", "Infusion Pump", "Syringe Pump", "Ventilator", "Oxygen Tank", "Suction Machine", "ECG Machine", "Crash Cart", "IV Stand", "Pulse Oximeter", "Operating Table", "Surgical Light", "Mayo Stand", "Instrument Tray", "Delivery Bed", "Infant Warmer", "CPR Manikins", "AED Trainers", "Spine Board", "Wheelchair", "VR Headset", "VR Controller"]
  };

  const CATEGORIES = ["Equipment", "Consumable", "Furniture", "Medical Supply", "Simulation Material", "Technology", "Other"];
  const UNITS = ["Piece(s)", "Box(es)", "Set(s)", "Pack(s)", "Bottle(s)", "Other"];
  const STATUSES = ["Functional", "Not Functional", "Under Repair", "Missing"];
  const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
  const REQUEST_TYPES = ["Deployment", "Procurement"];
  const REQUEST_STATUSES = ["Pending", "Approved", "Released", "Denied", "Returned"];
  const TRANSACTION_TYPES = ["Stock In", "Stock Out", "Transfer", "Return"];
  const ROLES = [
    { value: "viewer", label: "Viewer" },
    { value: "student_staff", label: "Student/Staff" },
    { value: "room_custodian", label: "Room Custodian" },
    { value: "supply_officer", label: "Supply Officer" },
    { value: "admin", label: "Admin" }
  ];

  const state = {
    view: "home",
    viewArg: null,
    loading: true,
    dbReady: false,
    supabase: null,
    channel: null,
    authUser: loadAuthUser(),
    profile: loadProfile(),
    data: {
      inventory: [],
      pieces: [],
      transactions: [],
      vr: [],
      requests: [],
      requestHistory: [],
      audit: [],
      rooms: []
    },
    filters: {
      search: "",
      category: "All",
      status: "All",
      sort: "last_updated_desc",
      requestStatus: "All",
      requestType: "All"
    }
  };

 const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastEl = document.getElementById("toast");
  let filterRenderTimer = null;
  let notificationAudioContext = null;

  init();

  async function init() {
    document.body.classList.toggle("dark", localStorage.getItem("hct-theme") === "dark");
    initSupabase();
    await loadAuthSession();
    validateStoredLocalAuth();
    await loadData();
    processDeepLink();
    wireRealtime();
    render();
  }

  function initSupabase() {
    const cfg = window.HCT_SUPABASE_CONFIG || {};
    if (window.supabase && cfg.url && cfg.anonKey && !cfg.url.includes("YOUR_")) {
      state.supabase = window.supabase.createClient(cfg.url, cfg.anonKey);
      state.dbReady = true;
    }
  }

  async function loadAuthSession() {
    if (!state.supabase?.auth) return;
    try {
      const { data } = await state.supabase.auth.getSession();
      const user = data?.session?.user;
      if (user) applyAuthUser(user);
      else {
        state.authUser = null;
        localStorage.removeItem("hct-auth-user");
      }
    } catch (error) {
      console.warn(error);
    }
  }

  function validateStoredLocalAuth() {
    if (state.supabase || !state.authUser?.email) return;
    const account = loadLocalAccounts()[String(state.authUser.email).toLowerCase()];
    if (account) return;
    state.authUser = null;
    localStorage.removeItem("hct-auth-user");
  }

  async function saveAuth(event, mode) {
    event.preventDefault();
    const form = new FormData(event.target);
    const email = clean(form.get("email"));
    const password = String(form.get("password") || "");
    const name = clean(form.get("name")) || email;
    const role = form.get("role") || state.profile.role || "student_staff";
    const assignedRoom = form.get("assignedRoom") || state.profile.assignedRoom || "All";
    if (!email || !password) return notify("Email and password are required.");
    const localAccounts = loadLocalAccounts();

    if (state.supabase?.auth) {
      try {
        const result = mode === "signup"
          ? await state.supabase.auth.signUp({ email, password, options: { data: { name, role, assignedRoom } } })
          : await state.supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        if (result.data?.user) applyAuthUser(result.data.user, { name, role, assignedRoom });
        notify(mode === "signup" ? "Account created. Check email confirmation if Supabase requires it." : "Logged in.");
        await loadData();
        navigate("home");
        return;
      } catch (error) {
        notify(error.message || "Supabase Auth is not ready. Saving local profile instead.");
      }
    }

    if (mode === "login") {
      const account = localAccounts[email.toLowerCase()];
      if (!account || account.password !== password) return notify("Create an account first, then log in with that account.");
      state.authUser = { email, name: account.name || email };
      state.profile = { ...state.profile, name: account.name || email, role: account.role || "student_staff", assignedRoom: account.assignedRoom || "All" };
      localStorage.setItem("hct-auth-user", JSON.stringify(state.authUser));
      localStorage.setItem("hct-profile", JSON.stringify(state.profile));
      notify("Logged in.");
      await loadData();
      navigate("home");
      return;
    }

    localAccounts[email.toLowerCase()] = { email, password, name, role, assignedRoom };
    saveLocalAccounts(localAccounts);
    state.authUser = { email, name };
    state.profile = { ...state.profile, name, role, assignedRoom };
    localStorage.setItem("hct-auth-user", JSON.stringify(state.authUser));
    localStorage.setItem("hct-profile", JSON.stringify(state.profile));
    notify(mode === "signup" ? "Local account profile created." : "Logged in locally.");
    await loadData();
    navigate("home");
  }

  function applyAuthUser(user, fallback) {
    const metadata = user.user_metadata || {};
    state.authUser = { id: user.id, email: user.email, name: metadata.name || fallback?.name || user.email };
    state.profile = {
      ...state.profile,
      name: metadata.name || fallback?.name || state.profile.name || user.email,
      role: metadata.role || fallback?.role || state.profile.role || "student_staff",
      assignedRoom: metadata.assignedRoom || fallback?.assignedRoom || state.profile.assignedRoom || "All"
    };
    localStorage.setItem("hct-auth-user", JSON.stringify(state.authUser));
    localStorage.setItem("hct-profile", JSON.stringify(state.profile));
  }

  async function signOut() {
    if (state.supabase?.auth) {
      try {
        await state.supabase.auth.signOut();
      } catch (error) {
        console.warn(error);
      }
    }
    state.authUser = null;
    localStorage.removeItem("hct-auth-user");
    notify("Signed out.");
    await loadData();
    navigate("login");
  }

  async function loadData() {
    state.loading = true;
    if (state.supabase && !state.authUser) {
      state.data = emptyData();
      syncRooms();
      state.loading = false;
      return;
    }
    if (!state.supabase) {
      state.data = loadLocalData();
      syncRooms();
      state.loading = false;
      return;
    }

    try {
      const [inventory, pieces, transactions, vr, requests, requestHistory, audit, rooms] = await withTimeout(Promise.all([
        state.supabase.from(TABLES.inventory).select("*").order("last_updated", { ascending: false }),
        state.supabase.from(TABLES.pieces).select("*").order("piece_number", { ascending: true }),
        state.supabase.from(TABLES.transactions).select("*").order("created_at", { ascending: false }),
        state.supabase.from(TABLES.vr).select("*").order("updated_at", { ascending: false }),
        state.supabase.from(TABLES.requests).select("*").order("created_at", { ascending: false }),
        state.supabase.from(TABLES.requestHistory).select("*").order("created_at", { ascending: false }),
        state.supabase.from(TABLES.audit).select("*").order("created_at", { ascending: false }).limit(300),
        state.supabase.from(TABLES.rooms).select("*").order("floor", { ascending: true }).order("name", { ascending: true })
      ]), 3500, "Supabase connection timed out");
      const errored = [inventory, pieces, transactions, vr, requests, requestHistory, audit, rooms].find((result) => result.error);
      if (errored) throw errored.error;
      state.data.inventory = inventory.data || [];
      state.data.pieces = pieces.data || [];
      state.data.transactions = transactions.data || [];
      state.data.vr = vr.data || [];
      state.data.requests = requests.data || [];
      state.data.requestHistory = requestHistory.data || [];
      state.data.audit = audit.data || [];
      state.data.rooms = rooms.data || [];
      syncRooms();
      state.dbReady = true;
    } catch (error) {
      state.dbReady = false;
      state.data = loadLocalData();
      syncRooms();
      notify("Supabase is not ready yet. Using this browser only until the schema is installed.");
      console.warn(error);
    } finally {
      state.loading = false;
    }
  }

  function wireRealtime() {
    if (!state.supabase || state.channel) return;
    let channel = state.supabase.channel("hct-inventory-live");
    Object.values(TABLES).forEach((table) => {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        notify(`${tableLabel(table)} updated.`);
        loadData().then(() => render({ restoreFilterFocus: true }));
      });
    });
    state.channel = channel.subscribe();
  }

  function render(options = {}) {
    const focus = options.restoreFilterFocus ? activeFilterFocus() : null;
    app.innerHTML = `
      ${topbar()}
      <main class="page">
        ${state.loading ? "" : breadcrumbNav()}
        ${state.loading ? loadingState("Loading inventory system", "Fetching shared records.") : route()}
      </main>
    `;
    bindGlobalEvents();
    bindViewEvents();
    restoreFilterFocus(focus);
  }

  function topbar() {
    const authed = Boolean(state.authUser);
    const navItems = authed ? [
      ["home", "Home"],
      ["dashboard", "Dashboard"],
      ["all", "All Inventory"],
      ["vr", "VR Registry"],
      ["deploymentRequests", "Deployment Requests"],
      ["procurementRequests", "Procurement Requests"],
      ["audit", "Audit Log"],
      ["deleted", "Restore"]
    ] : [];
    const dbText = state.dbReady ? "Real-time sync" : "Local preview only";
    const authText = authed ? escapeHtml(state.authUser.email || state.authUser.name || "Signed in") : "Sign in required";
    return `
      <header class="topbar">
        <div class="brand">
          <img class="brand-logo" src="${document.body.classList.contains("dark") ? "hct-logo-teal.png" : "hct-logo-navy.png"}" alt="HCT Institute logo">
          <div>
            <h1>HCT Institute</h1>
            <span>${dbText} - ${escapeHtml(currentRoleLabel())} - ${authText}</span>
          </div>
        </div>
        <nav class="nav" aria-label="Main navigation">
          ${navItems.map(([view, label]) => `<button class="${state.view === view ? "active" : ""}" data-view="${view}">${label}</button>`).join("")}
          ${authed ? `<button data-sign-out>Sign Out</button>` : `<button class="${state.view === "login" ? "active" : ""}" data-view="login">Login</button><button class="${state.view === "signup" ? "active" : ""}" data-view="signup">Sign Up</button>`}
        </nav>
        <div class="top-actions">
          ${authed ? `<button class="icon-button cart-button" data-cart-open title="Deployment cart">${deploymentCartCount()}</button>` : ""}
          ${authed ? `<button class="icon-button" data-profile title="Access profile">&#x263A;</button>` : ""}
          <button class="icon-button" data-theme title="Toggle dark mode">&#x25D0;</button>
        </div>
      </header>
    `;
  }

  function route() {
    if (!state.authUser && state.view !== "signup") return authView("login");
    if (state.view === "home") return homeView();
    if (state.view === "floor") return floorView(state.viewArg);
    if (state.view === "room") return inventoryView(state.viewArg);
    if (state.view === "all") return inventoryView(null);
    if (state.view === "dashboard") return dashboardView();
    if (state.view === "vr") return vrView();
    if (state.view === "itemDetail") return itemDetailView(state.viewArg);
    if (state.view === "pieceDetail") return pieceDetailView(state.viewArg);
    if (state.view === "vrDetail") return vrDetailView(state.viewArg);
    if (state.view === "requests" || state.view === "deploymentRequests") return requestsView("Deployment");
    if (state.view === "procurementRequests") return requestsView("Procurement");
    if (state.view === "audit") return auditView();
    if (state.view === "deleted") return deletedView();
    if (state.view === "login") return authView("login");
    if (state.view === "signup") return authView("signup");
    return homeView();
  }

  function homeView() {
    const floors = [
      { key: "5th Floor", title: "5th Floor", icon: "&#x1F3E5;", text: "ICU, AHA, OR, and DR inventory areas." },
      { key: "3rd Floor", title: "3rd Floor", icon: "&#x2695;", text: "ICU, OR, DR, VR, Caregiving, and EMS rooms." },
      { key: "Central Supply", title: "Central Supply Room", icon: "&#x1F4E6;", text: "Main stockroom for stored supplies and equipment.", room: "CSR" }
    ];
    return `
      <section class="hero">
        <div class="hero-panel">
          <div class="eyebrow">HCT Institute</div>
          <h2>HCT Inventory System</h2>
          <p>Smarter Inventory Control at Your Fingertips</p>
        </div>
        ${profileCard()}
      </section>
      <section class="quick-actions">
        <button class="btn primary" data-add-request="Deployment" ${canCreateRequest() ? "" : "disabled"}>New Deployment Request</button>
        <button class="btn" data-view="deploymentRequests">View Deployment Requests</button>
      </section>
      <section class="grid-cards">
        ${floors.map((floor) => summaryCard(floor)).join("")}
      </section>
    `;
  }

  function authView(mode) {
    const isSignup = mode === "signup";
    return `
      <section class="hero">
        <div class="hero-panel auth-hero">
          <img src="hct-logo-teal.png" alt="HCT Institute logo">
          <div>
            <div class="eyebrow">HCT Institute</div>
            <h2>${isSignup ? "Create an inventory account." : "Login to HCT Inventory."}</h2>
            <p>${isSignup ? "Create a profile with the role you use in the inventory system." : "Use your HCT inventory account, or continue with your saved local profile while testing."}</p>
          </div>
        </div>
        <aside class="profile-card">
          <h3>${isSignup ? "Sign Up" : "Login"}</h3>
          <form id="auth-form" class="form-grid">
            ${isSignup ? field("Full Name", `<input name="name" required value="${escapeAttr(state.profile.name)}" placeholder="Your name">`, true) : ""}
            ${field("Email", `<input type="email" name="email" required value="${escapeAttr(state.authUser?.email || "")}" placeholder="name@hct.edu">`, true)}
            ${field("Password", `<input type="password" name="password" required minlength="6" placeholder="At least 6 characters">`, true)}
            ${isSignup ? field("Role", `<select name="role">${ROLES.filter((role) => role.value !== "viewer").map((role) => `<option value="${role.value}" ${role.value === state.profile.role ? "selected" : ""}>${role.label}</option>`).join("")}</select>`, true) : ""}
            ${isSignup ? field("Assigned Room", `<select name="assignedRoom">${optionHtml(["All"].concat(ROOMS.map((room) => room.code)), state.profile.assignedRoom, roomLabel)}</select>`, true) : ""}
            <div class="field full"><button class="btn primary" type="submit">${isSignup ? "Create Account" : "Login"}</button></div>
          </form>
          <p class="muted">${state.supabase ? "Uses Supabase Auth when email/password sign-in is enabled." : "Local preview mode is active until Supabase is connected."}</p>
        </aside>
      </section>
    `;
  }

  function itemDetailView(id) {
    const item = findById(state.data.inventory, id);
    if (!item) return sectionHead("Item Not Found", "The scanned inventory item could not be found in the current database.", `<button class="btn" data-view="home">Home</button>`);
    return `
      ${sectionHead(item.item_name, "Scanned inventory item record.", `<button class="btn" data-room="${item.room_code}">Open Room</button><button class="btn primary" data-qr-item="${item.id}">Print Label</button>`)}
      <section class="analytics-grid">
        <div class="mini-panel"><h3>Asset Details</h3><p><b>Asset Tag:</b> ${escapeHtml(item.asset_tag || "No asset tag")}</p><p><b>Room:</b> ${escapeHtml(roomLabel(item.room_code))}</p><p><b>Status:</b> ${statusBadge(item.functional_status)}</p><p><b>Quantity:</b> ${Number(item.quantity || 0)} ${escapeHtml(item.unit_measure || "")}</p></div>
        <div class="mini-panel"><h3>Record</h3><p><b>Category:</b> ${escapeHtml(item.category)}</p><p><b>Date Added:</b> ${dateOnly(item.date_added)}</p><p><b>Last Updated:</b> ${dateTime(item.last_updated)}</p><p>${escapeHtml(item.remarks || "")}</p></div>
      </section>
      ${scannedActionPanel(item)}
    `;
  }

  function pieceDetailView(id) {
    const piece = findPiece(id);
    const item = piece ? findById(state.data.inventory, piece.inventory_item_id) : null;
    if (!piece || !item) return sectionHead("Piece Not Found", "The scanned inventory piece could not be found in the current database.", `<button class="btn" data-view="home">Home</button>`);
    return `
      ${sectionHead(piece.asset_tag || item.item_name, "Scanned inventory piece record.", `<button class="btn" data-room="${item.room_code}">Open Room</button><button class="btn primary" data-qr-piece="${piece.id}">Print Label</button>`)}
      <section class="panel"><div class="panel-body detail-grid">
        <div class="mini-panel"><h3>Piece Details</h3><p><b>Item:</b> ${escapeHtml(item.item_name)}</p><p><b>Asset Tag:</b> ${escapeHtml(piece.asset_tag || "")}</p><p><b>Serial:</b> ${escapeHtml(piece.serial_number || "")}</p></div>
        <div class="mini-panel"><h3>Location</h3><p><b>Room:</b> ${escapeHtml(roomLabel(piece.current_room_code || item.room_code))}</p><p><b>Origin:</b> ${escapeHtml(roomLabel(piece.origin_room_code || item.room_code))}</p><p><b>Transferred:</b> ${dateTime(piece.transferred_at)}</p></div>
      </div></section>
      ${scannedActionPanel(item, piece)}
    `;
  }

  function vrDetailView(id) {
    const asset = findById(state.data.vr, id);
    if (!asset) return sectionHead("VR Asset Not Found", "The scanned VR asset could not be found in the current database.", `<button class="btn" data-view="home">Home</button>`);
    return `
      ${sectionHead(asset.vr_number, "Scanned VR asset record.", `<button class="btn" data-room="${asset.assigned_room_code}">Open Room</button><button class="btn primary" data-qr-vr="${asset.id}">Print Label</button><button class="btn danger" data-delete-vr="${asset.id}" ${canManageVr() ? "" : "disabled"}>Delete</button>`)}
      <section class="analytics-grid">
        <div class="mini-panel"><h3>VR Details</h3><p><b>VR Number:</b> ${escapeHtml(asset.vr_number)}</p><p><b>Serial Number:</b> ${escapeHtml(asset.vr_serial_number || "")}</p><p><b>Room:</b> ${escapeHtml(roomLabel(asset.assigned_room_code))}</p><p><b>Status:</b> ${statusBadge(asset.functional_status)}</p></div>
        <div class="mini-panel"><h3>Device</h3><p><b>Brand:</b> ${escapeHtml(asset.brand || "")}</p><p><b>Model:</b> ${escapeHtml(asset.model || "")}</p><p><b>Last Maintenance:</b> ${dateOnly(asset.last_maintenance_date)}</p><p>${escapeHtml(asset.notes || "")}</p></div>
      </section>
      <section class="detail-actions"><button class="btn primary" data-cart-vr="${asset.id}">Add to Deployment Request</button></section>
    `;
  }

  function floorView(floorName) {
    const rooms = ROOMS.filter((room) => room.floor === floorName);
    const addAction = ["5th Floor", "3rd Floor"].includes(floorName) ? `<button class="btn primary" data-add-room="${floorName}" ${canManageRooms() ? "" : "disabled"}>Add Room</button>` : "";
    return `
      ${sectionHead(floorName, "Select a room to open its dedicated inventory page.", `<button class="btn" data-view="home">Back</button>${addAction}`)}
      <section class="grid-cards room-grid">
        ${rooms.map((room) => roomCard(room)).join("")}
      </section>
    `;
  }

  function inventoryView(roomCode) {
    const room = roomCode ? getRoom(roomCode) : null;
    const items = filteredInventory(roomCode, false);
    const title = room ? room.name : "All Inventory";
    const canAdd = room ? canEditInventory(room.code) : canEditAnyInventory();
    const actions = `
      <button class="btn" data-qr-room="${room ? room.code : "ALL"}">Room QR</button>
      ${room ? `<button class="btn" data-print-room="${room.code}">Print Room Report</button>` : ""}
      <button class="btn" data-export="inventory">Excel</button>
      <button class="btn" data-pdf="inventory">PDF</button>
      <button class="btn primary" data-add-item="${room ? room.code : ""}" ${canAdd ? "" : "disabled"}>Add Item</button>
    `;
    return `
      ${sectionHead(title, room ? `${room.floor} inventory database` : "Search and export records from every room.", actions)}
      ${inventoryToolbar()}
      <section class="panel">
        ${items.length ? inventoryTable(items, true) : emptyState("No inventory records yet", "Add items after the Supabase schema is installed or while previewing locally.")}
      </section>
      ${roomCode ? transactionsPanel(roomCode) : ""}
    `;
  }

  function dashboardView() {
    const active = activeInventory();
    const requests = activeRequests();
    const totals = {
      items: active.length,
      functional: active.filter((item) => item.functional_status === "Functional").length,
      nonFunctional: active.filter((item) => item.functional_status === "Not Functional").length,
      pending: requests.filter((request) => request.status === "Pending").length,
      approved: requests.filter((request) => request.status === "Approved").length
    };
    return `
      ${sectionHead("Dashboard", "Live overview of HCT inventory, room distribution, status, and request activity.", `<button class="btn" data-export="dashboard">Export</button>`)}
      <section class="dashboard-grid">
        ${statTile(totals.items, "Total Inventory Items")}
        ${statTile(totals.functional, "Functional Equipment")}
        ${statTile(totals.nonFunctional, "Non-Functional Equipment")}
        ${statTile(totals.pending, "Pending Requests")}
        ${statTile(totals.approved, "Approved Requests")}
      </section>
      <section class="analytics-grid">
        ${barPanel("Inventory by Room", groupCount(active, "room_code", roomLabel))}
        ${barPanel("Inventory by Floor", groupCount(active, "floor_name"))}
        ${barPanel("Functional Status", groupCount(active, "functional_status"))}
        ${barPanel("Inventory by Category", groupCount(active, "category"))}
        ${recentPanel("Recently Updated Items", active.slice(0, 8), "item")}
        ${recentPanel("Recently Submitted Requests", requests.slice(0, 8), "request")}
      </section>
    `;
  }

  function vrView() {
    const items = filteredVr();
    return `
      ${sectionHead("VR Asset Registry", "Track every VR headset individually by VR number, serial number, brand, model, room, and maintenance date.", `<button class="btn" data-export="vr">Excel</button><button class="btn" data-pdf="vr">PDF</button><button class="btn primary" data-add-vr ${canManageVr() ? "" : "disabled"}>Add VR Asset</button>`)}
      <div class="toolbar">
        <input class="searchbox" data-filter="search" value="${escapeAttr(state.filters.search)}" placeholder="Search VR number, serial number, brand, or model">
        <select data-filter="status">${optionHtml(["All"].concat(STATUSES), state.filters.status)}</select>
      </div>
      <section class="panel">
        ${items.length ? vrTable(items) : emptyState("No VR assets yet", "Register VR headsets when they are ready to be tracked.")}
      </section>
    `;
  }

 function requestsView(type) {
    const requests = filteredRequests(type);
    const canCreate = canCreateRequest();
    const isDeployment = type === "Deployment";
    return `
      ${sectionHead(`${type} Requests`, isDeployment ? "Build deployment requests from scanned items or inventory-backed selections." : "Type procurement requests for items that are not yet part of the inventory.", `<button class="btn" data-export="requests">Excel</button><button class="btn" data-pdf="requests">PDF</button><button class="btn primary" data-add-request="${type}" ${canCreate ? "" : "disabled"}>New ${type} Request</button>`)}
      <div class="segmented request-tabs">
        <button data-view="deploymentRequests" class="${isDeployment ? "active" : ""}">Deployment</button>
        <button data-view="procurementRequests" class="${!isDeployment ? "active" : ""}">Procurement</button>
      </div>
      <div class="toolbar">
        <input class="searchbox" data-filter="search" value="${escapeAttr(state.filters.search)}" placeholder="Search requester, department, item, reason">
        <select data-filter="requestStatus">${optionHtml(["All"].concat(REQUEST_STATUSES), state.filters.requestStatus)}</select>
      </div>
      <section class="panel">
        ${requests.length ? requestsTable(requests) : emptyState("No requests submitted yet", "Requests created by students, staff, custodians, or supply officers will appear here.")}
      </section>
    `;
  }

  function auditView() {
    const rows = state.data.audit;
    return `
      ${sectionHead("Audit Log", "Application activity showing action type, record type, old value, new value, changed by, and timestamp.", `<button class="btn" data-export="audit">Excel</button>`)}
      <section class="panel">
        ${rows.length ? auditTable(rows) : emptyState("No audit events yet", "Changes, exports, approvals, releases, deletes, and restores are logged here.")}
      </section>
    `;
  }

  function deletedView() {
    const rows = state.data.inventory.filter((item) => item.deleted_at);
    const requestRows = state.data.requests.filter((request) => request.deleted_at);
    const vrRows = state.data.vr.filter((asset) => asset.deleted_at);
    const pieceRows = state.data.pieces.filter((piece) => piece.deleted_at);
    const total = rows.length + requestRows.length + vrRows.length + pieceRows.length;
    return `
      ${sectionHead("Deleted Inventory", "Soft-deleted records can be restored or permanently deleted by an Admin.", `<button class="btn danger" data-purge-soft-deletes ${isAdmin() && total ? "" : "disabled"}>Delete All Soft-Deletes</button>`)}
      <section class="panel">
        ${rows.length ? inventoryTable(rows, false, true) : emptyState("No deleted records", "Deleted inventory will appear here for restore review.")}
      </section>
      <section class="analytics-grid deleted-summary">
        ${softDeletedPanel("Deleted Requests", requestRows.map((row) => `${row.requester_name || "Request"} - ${row.item_requested || ""}`))}
        ${softDeletedPanel("Deleted VR Assets", vrRows.map((row) => `${row.vr_number || "VR"} - ${row.vr_serial_number || ""}`))}
        ${softDeletedPanel("Deleted Pieces", pieceRows.map((row) => `${row.asset_tag || "Piece"} - ${row.serial_number || ""}`))}
      </section>
    `;
  }

  function profileCard() {
    return `
      <aside class="profile-card">
        <h3>Access profile</h3>
        <div class="form-grid">
          <label class="field full"><span>Name</span><input data-profile-field="name" value="${escapeAttr(state.profile.name)}" placeholder="Guest user"></label>
          <label class="field full"><span>Role</span><input value="${escapeAttr(currentRoleLabel())}" disabled></label>
          <label class="field full"><span>Assigned room</span><input value="${escapeAttr(roomLabel(state.profile.assignedRoom) || "All")}" disabled></label>
        </div>
      </aside>
    `;
  }

  function summaryCard(floor) {
    const roomCodes = floor.room ? [floor.room] : ROOMS.filter((room) => room.floor === floor.key).map((room) => room.code);
    const items = activeInventory().filter((item) => roomCodes.includes(item.room_code));
    const pending = state.data.requests.filter((request) => request.status === "Pending").length;
    const target = floor.room ? `data-room="${floor.room}"` : `data-floor="${floor.key}"`;
    return `
      <button class="big-card" ${target}>
        <span class="card-icon">${floor.icon}</span>
        <h3>${escapeHtml(floor.title)}</h3>
        <p>${escapeHtml(floor.text)}</p>
        <div class="stats-row">
          ${miniStat(items.length, "Items")}
          ${miniStat(items.filter((item) => item.functional_status === "Functional").length, "Functional")}
          ${miniStat(pending, "Pending")}
        </div>
      </button>
    `;
  }

  function roomCard(room) {
    const items = activeInventory().filter((item) => item.room_code === room.code);
    return `
      <button class="big-card" data-room="${room.code}">
        <span class="card-icon">${room.icon}</span>
        <h3>${escapeHtml(room.name)}</h3>
        <p>${escapeHtml(room.floor)} dedicated inventory database.</p>
        <div class="stats-row">
          ${miniStat(items.length, "Items")}
          ${miniStat(items.filter((item) => item.functional_status === "Functional").length, "Functional")}
          ${miniStat(items.filter((item) => item.functional_status !== "Functional").length, "Issues")}
        </div>
      </button>
    `;
  }

  function inventoryToolbar() {
    return `
      <div class="toolbar">
        <input class="searchbox" data-filter="search" value="${escapeAttr(state.filters.search)}" placeholder="Search item, category, room, tag, or remarks">
        <select data-filter="category">${optionHtml(["All"].concat(CATEGORIES), state.filters.category)}</select>
        <select data-filter="status">${optionHtml(["All"].concat(STATUSES), state.filters.status)}</select>
        <select data-filter="sort">
          ${optionHtml([
            ["last_updated_desc", "Recently updated"],
            ["name_asc", "Item name"],
            ["quantity_desc", "Quantity high to low"],
            ["status_asc", "Status"]
          ], state.filters.sort)}
        </select>
      </div>
    `;
  }

  function inventoryTable(items, showActions, deletedMode) {
    return `
      <div class="table-wrap">
        <table data-table="inventory">
          <thead><tr>
            <th>Item</th><th>Category</th><th>Qty</th><th>Status</th><th>Room</th><th>Asset Tag</th><th>Dates</th><th>Remarks</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${items.map((item) => {
              const pieces = inventoryPieces(item);
              const isVirtualVr = Boolean(item.virtual_vr_asset);
              const qrButton = isVirtualVr ? `<button class="btn" data-qr-vr="${item.vr_asset_id}">QR</button>` : `<button class="btn" data-qr-item="${item.id}">QR</button>`;
              return `
              <tr>
                <td><b>${escapeHtml(item.item_name)}</b><br><span class="muted">${escapeHtml(item.unit_measure || "")}</span>${pieces.length ? `<br><span class="muted">${pieces.length} piece record(s)</span>` : ""}</td>
                <td>${badge(item.category)}</td>
                <td class="compact-cell"><b>${Number(item.quantity || 0)}</b></td>
                <td>${statusBadge(item.functional_status)}</td>
                <td>${escapeHtml(roomLabel(item.room_code))}<br><span class="muted">${escapeHtml(item.location_detail || "")}</span></td>
                <td>${escapeHtml(item.asset_tag || "")}</td>
                <td><span class="muted">Added</span> ${dateOnly(item.date_added)}<br><span class="muted">Updated</span> ${dateTime(item.last_updated)}</td>
                <td>${escapeHtml(item.remarks || "")}</td>
                <td class="table-actions">
                  ${qrButton}
                  ${deletedMode ? `<button class="btn success" data-restore-item="${item.id}" ${isAdmin() ? "" : "disabled"}>Restore</button>` : ""}
                  ${showActions && !isVirtualVr ? `<button class="btn success" data-add-stock="${item.id}" ${canTransact(item) ? "" : "disabled"}>Add Stock</button><button class="btn" data-transaction="${item.id}" ${canTransact(item) ? "" : "disabled"}>Move</button><button class="btn" data-edit-item="${item.id}" ${canEditInventory(item.room_code) ? "" : "disabled"}>Edit</button><button class="btn danger" data-delete-item="${item.id}" ${isAdmin() ? "" : "disabled"}>Delete</button>` : ""}
                  ${showActions && isVirtualVr ? `<button class="btn" data-edit-vr="${item.vr_asset_id}" ${canManageVr() ? "" : "disabled"}>Edit VR</button>` : ""}
                </td>
              </tr>
              ${pieces.map((piece, index) => pieceTableRow(item, piece, index, showActions && !deletedMode)).join("")}
            `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function pieceTableRow(item, piece, index, showActions) {
    const transferred = piece.transferred_at ? `Transferred ${dateTime(piece.transferred_at)}` : "Not transferred";
    const origin = piece.origin_room_code ? `Origin: ${roomLabel(piece.origin_room_code)}` : `Origin: ${roomLabel(item.room_code)}`;
    return `
      <tr class="piece-row">
        <td><span class="piece-indent">Piece ${Number(piece.piece_number || index + 1)}</span></td>
        <td colspan="2"><span class="piece-tag">${escapeHtml(piece.asset_tag || pieceTag(item, index + 1))}</span></td>
        <td>${statusBadge(piece.functional_status || item.functional_status)}</td>
        <td>${escapeHtml(origin)}<br><span class="muted">${escapeHtml(transferred)}</span></td>
        <td>${escapeHtml(piece.serial_number || "")}</td>
        <td><span class="muted">Added</span> ${dateOnly(piece.date_added || item.date_added)}<br><span class="muted">Updated</span> ${dateTime(piece.updated_at || piece.created_at || item.last_updated)}</td>
        <td>${escapeHtml(piece.remarks || "")}</td>
        <td class="table-actions">
          <button class="btn" data-qr-piece="${piece.id}">QR</button>
          ${showActions ? `<button class="btn" data-move-piece="${piece.id}" ${canTransact(item) ? "" : "disabled"}>Move</button><button class="btn" data-edit-piece="${piece.id}" ${canEditInventory(item.room_code) ? "" : "disabled"}>Edit</button><button class="btn danger" data-delete-piece="${piece.id}" ${isAdmin() ? "" : "disabled"}>Delete</button>` : ""}
        </td>
      </tr>
    `;
  }

  function transactionsPanel(roomCode) {
    const rows = state.data.transactions.filter((row) => row.source_room_code === roomCode || row.destination_room_code === roomCode || row.room_code === roomCode).slice(0, 12);
    return `
      <section class="panel" style="margin-top:16px">
        <div class="panel-body">
          <h3>Inventory Transaction History</h3>
          ${rows.length ? `
            <div class="table-wrap">
              <table>
                <thead><tr><th>Type</th><th>Item</th><th>Qty</th><th>From</th><th>To</th><th>By</th><th>Date</th><th>Notes</th></tr></thead>
                <tbody>${rows.map((row) => `<tr><td>${badge(row.transaction_type)}</td><td>${escapeHtml(row.item_name || "")}</td><td>${Number(row.quantity || 0)}</td><td>${escapeHtml(roomLabel(row.source_room_code))}</td><td>${escapeHtml(roomLabel(row.destination_room_code))}</td><td>${escapeHtml(row.changed_by || "")}</td><td>${dateTime(row.created_at)}</td><td>${escapeHtml(row.notes || "")}</td></tr>`).join("")}</tbody>
              </table>
            </div>` : emptyState("No movement history yet", "Stock in, stock out, transfer, and return activity will be tracked here.")}
        </div>
      </section>
    `;
  }

  function vrTable(rows) {
    return `
      <div class="table-wrap">
        <table data-table="vr">
          <thead><tr><th>VR Number</th><th>Serial</th><th>Brand / Model</th><th>Assigned Room</th><th>Status</th><th>Maintenance</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>${rows.map((row) => `
            <tr>
              <td><b>${escapeHtml(row.vr_number)}</b></td>
              <td>${escapeHtml(row.vr_serial_number || "")}</td>
              <td>${escapeHtml(row.brand || "")}<br><span class="muted">${escapeHtml(row.model || "")}</span></td>
              <td>${escapeHtml(roomLabel(row.assigned_room_code))}</td>
              <td>${statusBadge(row.functional_status)}</td>
              <td>${dateOnly(row.last_maintenance_date)}</td>
              <td>${escapeHtml(row.notes || "")}</td>
              <td class="table-actions"><button class="btn" data-qr-vr="${row.id}">QR</button><button class="btn" data-edit-vr="${row.id}" ${canManageVr() ? "" : "disabled"}>Edit</button><button class="btn danger" data-delete-vr="${row.id}" ${canManageVr() ? "" : "disabled"}>Delete</button></td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function requestsTable(rows) {
    return `
      <div class="table-wrap">
        <table data-table="requests">
          <thead><tr><th>Requester</th><th>Type</th><th>Department</th><th>Designation</th><th>Duration</th><th>Items</th><th>Qty</th><th>Status</th><th>Date</th><th>Superior</th><th>Actions</th></tr></thead>
          <tbody>${rows.map((row) => `
            <tr>
              <td><b>${escapeHtml(row.requester_name)}</b></td>
              <td>${badge(row.request_type || "Deployment")}</td>
              <td>${escapeHtml(row.department_program || "")}</td>
              <td>${escapeHtml(row.designation || "")}</td>
              <td>${escapeHtml(row.deployment_duration || "")}</td>
              <td>${requestItemsSummary(row)}</td>
              <td>${Number(row.quantity_requested || 0)}</td>
              <td>${requestBadge(row.status)}</td>
              <td>${dateOnly(row.date_requested)}</td>
              <td>${escapeHtml(row.immediate_superior || "")}</td>
              <td class="table-actions"><button class="btn" data-print-request="${row.id}">Print</button><button class="btn" data-docx-request="${row.id}">DOCX</button><button class="btn" data-history-request="${row.id}">History</button><button class="btn" data-edit-request="${row.id}" ${canEditRequest(row) ? "" : "disabled"}>Edit</button><button class="btn danger" data-delete-request="${row.id}" ${canDeleteRequest(row) ? "" : "disabled"}>Delete</button></td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function auditTable(rows) {
    return `
      <div class="table-wrap">
        <table data-table="audit">
          <thead><tr><th>Action</th><th>Record Type</th><th>Changed By</th><th>Timestamp</th><th>Old Value</th><th>New Value</th></tr></thead>
          <tbody>${rows.map((row) => `
            <tr>
              <td>${badge(row.action_type)}</td>
              <td>${escapeHtml(row.record_type || "")}</td>
              <td>${escapeHtml(row.changed_by || "")}<br><span class="muted">${escapeHtml(row.changed_role || "")}</span></td>
              <td>${dateTime(row.created_at)}</td>
              <td><div class="audit-value">${escapeHtml(auditSummary(row.old_value))}</div></td>
              <td><div class="audit-value">${escapeHtml(auditSummary(row.new_value))}</div></td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function bindGlobalEvents() {
    app.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.view, button.dataset.crumbArg)));
    app.querySelector("[data-theme]")?.addEventListener("click", toggleTheme);
    app.querySelector("[data-profile]")?.addEventListener("click", openProfileModal);
    app.querySelector("[data-cart-open]")?.addEventListener("click", openDeploymentCartModal);
    app.querySelector("[data-sign-out]")?.addEventListener("click", signOut);
    app.querySelectorAll("[data-profile-field]").forEach((field) => field.addEventListener("change", updateProfileFromField));
  }

  function bindViewEvents() {
    app.querySelectorAll("[data-floor]").forEach((el) => el.addEventListener("click", () => navigate("floor", el.dataset.floor)));
    app.querySelectorAll("[data-room]").forEach((el) => el.addEventListener("click", () => navigate("room", el.dataset.room)));
    app.querySelectorAll("[data-filter]").forEach((field) => field.addEventListener("input", () => {
      state.filters[field.dataset.filter] = field.value;
      render();
    }));
    app.querySelectorAll("[data-add-item]").forEach((el) => el.addEventListener("click", () => openInventoryModal(null, el.dataset.addItem || state.viewArg || "CSR")));
    app.querySelectorAll("[data-add-stock]").forEach((el) => el.addEventListener("click", () => openAddStockModal(findById(state.data.inventory, el.dataset.addStock))));
    app.querySelectorAll("[data-edit-item]").forEach((el) => el.addEventListener("click", () => openInventoryModal(findById(state.data.inventory, el.dataset.editItem))));
    app.querySelectorAll("[data-delete-item]").forEach((el) => el.addEventListener("click", () => softDeleteItem(el.dataset.deleteItem)));
    app.querySelectorAll("[data-restore-item]").forEach((el) => el.addEventListener("click", () => restoreItem(el.dataset.restoreItem)));
    app.querySelectorAll("[data-transaction]").forEach((el) => el.addEventListener("click", () => openTransactionModal(findById(state.data.inventory, el.dataset.transaction))));
    app.querySelectorAll("[data-move-piece]").forEach((el) => el.addEventListener("click", () => openPieceMoveModal(findPiece(el.dataset.movePiece))));
    app.querySelectorAll("[data-edit-piece]").forEach((el) => el.addEventListener("click", () => openPieceModal(findPiece(el.dataset.editPiece))));
    app.querySelectorAll("[data-delete-piece]").forEach((el) => el.addEventListener("click", () => deletePiece(el.dataset.deletePiece)));
    app.querySelectorAll("[data-add-request]").forEach((el) => el.addEventListener("click", () => openRequestModal(null, el.dataset.addRequest || currentRequestType() || "Deployment")));
    app.querySelectorAll("[data-edit-request]").forEach((el) => el.addEventListener("click", () => openRequestModal(findById(state.data.requests, el.dataset.editRequest))));
    app.querySelectorAll("[data-print-request]").forEach((el) => el.addEventListener("click", () => printDeploymentRequest(findById(state.data.requests, el.dataset.printRequest))));
    app.querySelectorAll("[data-history-request]").forEach((el) => el.addEventListener("click", () => openRequestHistory(el.dataset.historyRequest)));
    app.querySelectorAll("[data-add-vr]").forEach((el) => el.addEventListener("click", () => openVrModal()));
    app.querySelectorAll("[data-edit-vr]").forEach((el) => el.addEventListener("click", () => openVrModal(findById(state.data.vr, el.dataset.editVr))));
    app.querySelectorAll("[data-qr-item]").forEach((el) => el.addEventListener("click", () => openQr("Inventory Item", itemQrPayload(findById(state.data.inventory, el.dataset.qrItem)))));
    app.querySelectorAll("[data-qr-piece]").forEach((el) => el.addEventListener("click", () => openQr("Inventory Piece", pieceQrPayload(findPiece(el.dataset.qrPiece)))));
    app.querySelectorAll("[data-qr-vr]").forEach((el) => el.addEventListener("click", () => openQr("VR Asset", vrQrPayload(findById(state.data.vr, el.dataset.qrVr)))));
    app.querySelectorAll("[data-qr-room]").forEach((el) => el.addEventListener("click", () => openQr("Room Inventory", roomQrPayload(el.dataset.qrRoom))));
    app.querySelectorAll("[data-print-room]").forEach((el) => el.addEventListener("click", () => printRoomReport(el.dataset.printRoom)));
    app.querySelectorAll("[data-export]").forEach((el) => el.addEventListener("click", () => exportView(el.dataset.export)));
    app.querySelectorAll("[data-pdf]").forEach((el) => el.addEventListener("click", () => exportPdf(el.dataset.pdf)));
    app.querySelector("#auth-form")?.addEventListener("submit", (event) => saveAuth(event, state.view));
    app.querySelectorAll("[data-add-room]").forEach((el) => el.addEventListener("click", () => openRoomModal(el.dataset.addRoom)));
    app.querySelectorAll("[data-delete-request]").forEach((el) => el.addEventListener("click", () => softDeleteRequest(el.dataset.deleteRequest)));
    app.querySelectorAll("[data-docx-request]").forEach((el) => el.addEventListener("click", () => downloadDeploymentRequestDocx(findById(state.data.requests, el.dataset.docxRequest))));
    app.querySelectorAll("[data-delete-vr]").forEach((el) => el.addEventListener("click", () => softDeleteVr(el.dataset.deleteVr)));
    app.querySelectorAll("[data-purge-soft-deletes]").forEach((el) => el.addEventListener("click", purgeSoftDeletes));
    app.querySelectorAll("[data-move-scanned-item]").forEach((el) => el.addEventListener("click", () => openTransactionModal(findById(state.data.inventory, el.dataset.moveScannedItem), "Transfer")));
    app.querySelectorAll("[data-cart-item]").forEach((el) => el.addEventListener("click", () => addItemToDeploymentCart(findById(state.data.inventory, el.dataset.cartItem))));
    app.querySelectorAll("[data-cart-piece]").forEach((el) => el.addEventListener("click", () => addPieceToDeploymentCart(findPiece(el.dataset.cartPiece))));
    app.querySelectorAll("[data-cart-vr]").forEach((el) => el.addEventListener("click", () => addVrToDeploymentCart(findById(state.data.vr, el.dataset.cartVr))));
  }

  function navigate(view, arg) {
    state.view = view;
    state.viewArg = arg || null;
    state.filters.search = "";
    render();
  }

  function processDeepLink() {
    const params = new URLSearchParams(location.search);
    const room = params.get("room");
    const item = params.get("item");
    const piece = params.get("piece");
    const vr = params.get("vr");
    if (room) {
      state.view = room === "ALL" ? "all" : "room";
      state.viewArg = room === "ALL" ? null : room;
    } else if (item) {
      state.view = "itemDetail";
      state.viewArg = item;
    } else if (piece) {
      state.view = "pieceDetail";
      state.viewArg = piece;
    } else if (vr) {
      state.view = "vrDetail";
      state.viewArg = vr;
    }
  }

  function openInventoryModal(item, defaultRoomCode) {
    const roomCode = item?.room_code || defaultRoomCode || "CSR";
    const room = getRoom(roomCode) || getRoom("CSR");
    const suggestions = Array.from(new Set([...(ITEM_OPTIONS[room.short] || []), ...(ITEM_OPTIONS.CSR || [])])).sort();
    const linkedVr = item?.id ? state.data.vr.find((asset) => asset.inventory_item_id === item.id) : null;
    const hasSuggestedName = suggestions.includes(item?.item_name || "");
    const showVrTracking = shouldShowVrTracking(room.code, item?.item_name || "", linkedVr);
    openModal(`${item ? "Edit" : "Add"} Inventory Item`, `
      <form id="inventory-form" class="modal-body">
        <div class="form-grid">
          ${field("Item Name", `<select name="item_select"><option value="">Select common item</option>${optionHtml(suggestions, hasSuggestedName ? item.item_name : "")}</select>`)}
          ${field("Manual New Item", `<input name="custom_item_name" value="${escapeAttr(hasSuggestedName ? "" : item?.item_name || "")}" placeholder="Type here if item is not listed">`)}
          ${field("Category", `<select name="category">${optionHtml(CATEGORIES, item?.category || "Equipment")}</select>`)}
          ${field("Quantity", `<input type="number" min="0" step="1" name="quantity" required value="${escapeAttr(item?.quantity ?? 1)}">`)}
          ${field("Unit of Measure", `<select name="unit_measure">${optionHtml(UNITS, item?.unit_measure || "Piece(s)")}</select>`)}
          ${field("Functional Status", `<select name="functional_status">${optionHtml(STATUSES, item?.functional_status || "Functional")}</select>`)}
          ${field("Location/Room", `<select name="room_code">${optionHtml(ROOMS.map((r) => r.code), room.code, roomLabel)}</select>`)}
          ${field("Asset Tag Number", `<input name="asset_tag" value="${escapeAttr(item?.asset_tag || nextAssetTag(room.code))}" placeholder="HCT-5F-ICU-0001">`)}
          ${field("Date Added", `<input type="date" name="date_added" value="${escapeAttr(dateInput(item?.date_added) || today())}">`)}
          ${field("Remarks", `<textarea name="remarks">${escapeHtml(item?.remarks || "")}</textarea>`, true)}
          <div class="vr-tracking-fields ${showVrTracking ? "" : "hidden"}" data-vr-tracking-fields>
            <div class="field full"><span>VR Headset Tracking</span><p class="muted">Complete these fields when the inventory item is an individual VR Headset.</p></div>
            ${field("VR Number", `<input name="vr_number" value="${escapeAttr(linkedVr?.vr_number || "")}" placeholder="VR-001">`)}
            ${field("VR Serial Number", `<input name="vr_serial_number" value="${escapeAttr(linkedVr?.vr_serial_number || "")}">`)}
            ${field("Brand", `<input name="vr_brand" value="${escapeAttr(linkedVr?.brand || "")}">`)}
            ${field("Model", `<input name="vr_model" value="${escapeAttr(linkedVr?.model || "")}">`)}
            ${field("Last Maintenance Date", `<input type="date" name="vr_last_maintenance_date" value="${escapeAttr(dateInput(linkedVr?.last_maintenance_date) || "")}">`)}
            ${field("VR Notes", `<textarea name="vr_notes">${escapeHtml(linkedVr?.notes || "")}</textarea>`, true)}
          </div>
        </div>
      </form>
      <div class="modal-actions">
        <button class="btn" data-close-modal>Cancel</button>
        <button class="btn primary" form="inventory-form">Save</button>
      </div>
    `);
    const formEl = document.getElementById("inventory-form");
    formEl.addEventListener("submit", (event) => saveInventory(event, item));
    formEl.querySelector('[name="room_code"]')?.addEventListener("change", () => toggleVrTrackingFields(formEl));
    formEl.querySelector('[name="item_select"]')?.addEventListener("change", () => toggleVrTrackingFields(formEl));
    formEl.querySelector('[name="custom_item_name"]')?.addEventListener("input", () => toggleVrTrackingFields(formEl));
  }

  function shouldShowVrTracking(roomCode, itemName, linkedVr) {
    return Boolean(linkedVr) || roomCode === "3F-VR" || clean(itemName).toLowerCase().includes("vr headset");
  }

  function toggleVrTrackingFields(formEl) {
    const roomCode = formEl.querySelector('[name="room_code"]')?.value || "";
    const itemName = clean(formEl.querySelector('[name="custom_item_name"]')?.value) || clean(formEl.querySelector('[name="item_select"]')?.value);
    formEl.querySelector("[data-vr-tracking-fields]")?.classList.toggle("hidden", !shouldShowVrTracking(roomCode, itemName, false));
  }

  async function saveInventory(event, existing) {
    event.preventDefault();
    const form = new FormData(event.target);
    const room = getRoom(form.get("room_code"));
    const selectedName = clean(form.get("custom_item_name")) || clean(form.get("item_select"));
    const payload = {
      item_name: selectedName,
      category: form.get("category"),
      quantity: Number(form.get("quantity") || 0),
      unit_measure: form.get("unit_measure"),
      functional_status: form.get("functional_status"),
      room_code: room.code,
      room_name: room.name,
      floor_name: room.floor,
      location_detail: room.name,
      asset_tag: clean(form.get("asset_tag")),
      date_added: form.get("date_added") || today(),
      last_updated: new Date().toISOString(),
      remarks: clean(form.get("remarks"))
    };
    if (!payload.item_name) return notify("Item name is required.");
    let saved;
    if (existing) saved = await updateRecord(TABLES.inventory, existing.id, payload, "edited", "inventory item", existing);
    else {
      saved = await insertRecord(TABLES.inventory, payload, "created", "inventory item");
      if (saved) await createTransaction({ item: saved, transaction_type: "Stock In", quantity: payload.quantity, source_room_code: null, destination_room_code: payload.room_code, notes: "Initial stock entry" }, false);
    }
    if (saved) {
      const oldQty = Number(existing?.quantity || 0);
      const newQty = Number(saved.quantity || 0);
      if (!existing && newQty > 0) await createPiecesForItem(saved, newQty, { reason: "Initial stock entry" });
      if (existing && newQty > oldQty) await createPiecesForItem(saved, newQty - oldQty, { reason: "Quantity increased" });
      await saveLinkedVrAsset(saved, form);
    }
    closeModal();
    await loadData();
    render();
  }

  function approvedDeploymentRefs() {
    const lockedPieceIds = new Set();
    const lockedItemIds = new Set();
    activeRequests()
      .filter((r) => r.request_type !== "Procurement" && (r.status === "Approved" || r.status === "Released"))
      .forEach((r) => {
        parseRequestItems(r).forEach((item) => {
          if (item.inventory_piece_id) lockedPieceIds.add(item.inventory_piece_id);
          else if (item.inventory_item_id) lockedItemIds.add(item.inventory_item_id);
        });
      });
    return { lockedPieceIds, lockedItemIds };
  }

  function requestInventoryOptions() {
    const { lockedPieceIds, lockedItemIds } = approvedDeploymentRefs();
    const options = [];
    activeInventory().forEach((inventoryItem) => {
      const linkedVr = state.data.vr.find((asset) => asset.inventory_item_id === inventoryItem.id);
      const pieces = inventoryPieces(inventoryItem);
      if (pieces.length) {
        pieces.filter((piece) => !lockedPieceIds.has(piece.id)).forEach((piece) => options.push({
          value: `piece:${piece.id}`,
          inventory_item_id: inventoryItem.id,
          inventory_piece_id: piece.id,
          item_name: inventoryItem.item_name,
          quantity_available: 1,
          asset_tag: piece.asset_tag || inventoryItem.asset_tag || "",
          serial_number: piece.serial_number || linkedVr?.vr_serial_number || "",
          room_code: piece.current_room_code || inventoryItem.room_code
        }));
        return;
      }
      if (Number(inventoryItem.quantity || 0) <= 0) return;
      if (lockedItemIds.has(inventoryItem.id)) return;
      options.push({
        value: `item:${inventoryItem.id}`,
        inventory_item_id: inventoryItem.id,
        inventory_piece_id: "",
        item_name: inventoryItem.item_name,
        quantity_available: Number(inventoryItem.quantity || 0),
        asset_tag: inventoryItem.asset_tag || "",
        serial_number: linkedVr?.vr_serial_number || "",
        room_code: inventoryItem.room_code
      });
    });
    virtualVrInventoryRows().forEach((vrItem) => {
      if (lockedItemIds.has(vrItem.id) || lockedPieceIds.has(vrItem.inventory_piece_id)) return;
      options.push({
        value: `vr:${vrItem.vr_asset_id}`,
        inventory_item_id: vrItem.id,
        inventory_piece_id: vrItem.inventory_piece_id || "",
        item_name: vrItem.item_name,
        quantity_available: 1,
        asset_tag: vrItem.asset_tag || "",
        serial_number: vrItem.serial_number || "",
        room_code: vrItem.room_code
      });
    });
    return options.sort((a, b) => `${a.item_name} ${a.asset_tag}`.localeCompare(`${b.item_name} ${b.asset_tag}`));
  }

  function requestOptionHtml(options, selectedValue) {
    return options.map((option) => {
      const label = `${option.item_name} | Qty ${Number(option.quantity_available || 0)} | ${option.asset_tag || "No asset tag"} | ${roomLabel(option.room_code)}${option.serial_number ? ` | SN ${option.serial_number}` : ""}`;
      return `<option value="${escapeAttr(option.value)}" ${option.value === selectedValue ? "selected" : ""}
        data-item-name="${escapeAttr(option.item_name)}"
        data-quantity-available="${escapeAttr(option.quantity_available)}"
        data-asset-tag="${escapeAttr(option.asset_tag)}"
        data-serial-number="${escapeAttr(option.serial_number)}"
        data-room-code="${escapeAttr(option.room_code)}"
        data-inventory-item-id="${escapeAttr(option.inventory_item_id)}"
        data-inventory-piece-id="${escapeAttr(option.inventory_piece_id)}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function findRequestSelection(item, options) {
    if (item.inventory_piece_id) return options.find((option) => option.inventory_piece_id === item.inventory_piece_id)?.value || "";
    if (item.inventory_item_id) return options.find((option) => option.inventory_item_id === item.inventory_item_id)?.value || "";
    if (item.asset_tag) return options.find((option) => option.asset_tag === item.asset_tag)?.value || "";
    if (item.serial_number) return options.find((option) => option.serial_number === item.serial_number)?.value || "";
    return options.find((option) => option.item_name === item.item_name)?.value || "";
  }

  function requestItemRow(item = {}) {
    const options = requestInventoryOptions();
    const selectedValue = findRequestSelection(item, options);
    const selected = options.find((option) => option.value === selectedValue) || {};
    return `
      <div class="request-cart-row" data-request-row>
        <select name="request_inventory_ref" required data-request-picker>
          <option value="">Select item from global inventory</option>
          ${requestOptionHtml(options, selectedValue)}
        </select>
        <input type="hidden" name="request_item_name" value="${escapeAttr(item.item_name || selected.item_name || "")}">
        <input type="hidden" name="request_inventory_item_id" value="${escapeAttr(item.inventory_item_id || selected.inventory_item_id || "")}">
        <input type="hidden" name="request_inventory_piece_id" value="${escapeAttr(item.inventory_piece_id || selected.inventory_piece_id || "")}">
        <input type="number" min="1" step="1" name="request_item_quantity" required value="${escapeAttr(item.quantity || 1)}" max="${escapeAttr(selected.quantity_available || "")}" aria-label="Quantity">
        <input name="request_item_asset" value="${escapeAttr(item.asset_tag || selected.asset_tag || "")}" placeholder="Asset tag" readonly>
        <input name="request_item_serial" value="${escapeAttr(item.serial_number || selected.serial_number || "")}" placeholder="Serial number" readonly>
        <input name="request_item_room" value="${escapeAttr(roomLabel(item.room_code || selected.room_code) || "")}" placeholder="Room" readonly>
        <input type="hidden" name="request_item_room_code" value="${escapeAttr(item.room_code || selected.room_code || "")}">
        <button class="btn danger" type="button" data-remove-request-row>Delete</button>
      </div>
    `;
  }

  function addRequestItemRow(item) {
    const container = modalRoot.querySelector("[data-request-items]");
    if (!container) return;
    container.insertAdjacentHTML("beforeend", requestItemRow(item));
    bindRequestRows(container.lastElementChild);
  }

  function bindRequestRows(scope = modalRoot) {
    scope.querySelectorAll("[data-request-picker]").forEach((select) => {
      select.addEventListener("change", () => applyRequestSelection(select.closest("[data-request-row]")));
      if (select.value) applyRequestSelection(select.closest("[data-request-row]"), true);
    });
    scope.querySelectorAll("[data-remove-request-row]").forEach((button) => button.addEventListener("click", (event) => removeRequestItemRow(event.currentTarget)));
  }

  function applyRequestSelection(row, preserveQuantity) {
    if (!row) return;
    const select = row.querySelector("[data-request-picker]");
    const option = select?.selectedOptions?.[0];
    if (!option || !option.value) return;
    const available = Number(option.dataset.quantityAvailable || 1);
    const quantity = row.querySelector('[name="request_item_quantity"]');
    row.querySelector('[name="request_item_name"]').value = option.dataset.itemName || "";
    row.querySelector('[name="request_inventory_item_id"]').value = option.dataset.inventoryItemId || "";
    row.querySelector('[name="request_inventory_piece_id"]').value = option.dataset.inventoryPieceId || "";
    row.querySelector('[name="request_item_asset"]').value = option.dataset.assetTag || "";
    row.querySelector('[name="request_item_serial"]').value = option.dataset.serialNumber || "";
    row.querySelector('[name="request_item_room"]').value = roomLabel(option.dataset.roomCode || "");
    row.querySelector('[name="request_item_room_code"]').value = option.dataset.roomCode || "";
    quantity.max = available || "";
    if (!preserveQuantity || Number(quantity.value || 0) > available) quantity.value = Math.max(1, Math.min(Number(quantity.value || 1), available || 1));
  }

  function removeRequestItemRow(button) {
    const rows = modalRoot.querySelectorAll("[data-request-row]");
    if (rows.length <= 1) return notify("At least one item is required.");
    button.closest("[data-request-row]")?.remove();
  }

  function collectRequestItems() {
    return Array.from(modalRoot.querySelectorAll("[data-request-row]")).map((row) => ({
      item_name: clean(row.querySelector('[name="request_item_name"]')?.value),
      quantity: Number(row.querySelector('[name="request_item_quantity"]')?.value || 0),
      serial_number: clean(row.querySelector('[name="request_item_serial"]')?.value),
      asset_tag: clean(row.querySelector('[name="request_item_asset"]')?.value),
      room_code: clean(row.querySelector('[name="request_item_room_code"]')?.value),
      inventory_item_id: clean(row.querySelector('[name="request_inventory_item_id"]')?.value),
      inventory_piece_id: clean(row.querySelector('[name="request_inventory_piece_id"]')?.value)
    })).filter((item) => item.item_name && item.quantity > 0);
  }

  function parseRequestItems(request) {
    if (Array.isArray(request?.request_items) && request.request_items.length) return request.request_items;
    return [{
      item_name: request?.item_requested || "",
      quantity: Number(request?.quantity_requested || 1),
      serial_number: request?.serial_number || "",
      asset_tag: request?.asset_tag || "",
      room_code: request?.room_code || "",
      inventory_item_id: request?.inventory_item_id || "",
      inventory_piece_id: request?.inventory_piece_id || ""
    }];
  }

  function requestItemsSummary(request) {
    const items = parseRequestItems(request).filter((item) => item.item_name);
    return items.length ? items.map((item) => `<div><b>${escapeHtml(item.item_name)}</b><br><span class="muted">Qty ${Number(item.quantity || 0)}${item.asset_tag ? ` - ${escapeHtml(item.asset_tag)}` : ""}${item.serial_number ? ` - SN ${escapeHtml(item.serial_number)}` : ""}${item.room_code ? ` - ${escapeHtml(roomLabel(item.room_code))}` : ""}</span></div>`).join("") : escapeHtml(request.item_requested || "");
  }

  async function saveLinkedVrAsset(item, form) {
    const vrNumber = clean(form.get("vr_number"));
    const isHeadset = item.item_name.toLowerCase().includes("vr headset");
    if (!isHeadset && !vrNumber) return;
    const existing = state.data.vr.find((asset) => asset.inventory_item_id === item.id || (vrNumber && asset.vr_number === vrNumber));
    const payload = {
      inventory_item_id: item.id,
      vr_number: vrNumber || nextVrNumber(),
      vr_serial_number: clean(form.get("vr_serial_number")) || null,
      brand: clean(form.get("vr_brand")),
      model: clean(form.get("vr_model")),
      assigned_room_code: item.room_code,
      functional_status: item.functional_status,
      last_maintenance_date: form.get("vr_last_maintenance_date") || null,
      notes: clean(form.get("vr_notes")),
      updated_at: new Date().toISOString()
    };
    if (existing) await updateRecord(TABLES.vr, existing.id, payload, "edited", "VR asset", existing);
    else await insertRecord(TABLES.vr, payload, "created", "VR asset");
  }

  function openAddStockModal(item) {
    if (!item) return;
    openModal("Add Stock", `
      <form id="stock-form" class="modal-body">
        <div class="form-grid">
          ${field("Item", `<input value="${escapeAttr(item.item_name)}" disabled>`)}
          ${field("Current Quantity", `<input value="${Number(item.quantity || 0)} ${escapeAttr(item.unit_measure || "")}" disabled>`)}
          ${field("Quantity to Add", `<input type="number" min="1" step="1" name="quantity" required value="1">`)}
          ${field("Date Added", `<input type="date" name="date_added" value="${today()}">`)}
          ${field("Notes", `<textarea name="notes" placeholder="Supplier, receiving note, or stock source"></textarea>`, true)}
        </div>
      </form>
      <div class="modal-actions">
        <button class="btn" data-close-modal>Cancel</button>
        <button class="btn primary" form="stock-form">Add Stock</button>
      </div>
    `);
    document.getElementById("stock-form").addEventListener("submit", (event) => saveAddStock(event, item));
  }

  async function saveAddStock(event, item) {
    event.preventDefault();
    const form = new FormData(event.target);
    const quantity = Number(form.get("quantity") || 0);
    if (quantity <= 0) return notify("Quantity must be greater than zero.");
    const oldItem = { ...item };
    const nextQty = Number(item.quantity || 0) + quantity;
    const saved = await updateRecord(TABLES.inventory, item.id, { quantity: nextQty, last_updated: new Date().toISOString() }, "edited", "inventory item", oldItem, { movement: "Add Stock" });
    if (!saved) return;
    await createPiecesForItem(saved, quantity, { date_added: form.get("date_added") || today(), reason: clean(form.get("notes")) || "Stock added" });
    await createTransaction({ item: saved, transaction_type: "Stock In", quantity, source_room_code: null, destination_room_code: saved.room_code, notes: clean(form.get("notes")) || "Stock added" }, false);
    closeModal();
    await loadData();
    render();
  }

  function openPieceModal(piece) {
    if (!piece) return;
    const item = findById(state.data.inventory, piece.inventory_item_id);
    openModal("Edit Piece", `
      <form id="piece-form" class="modal-body">
        <div class="form-grid">
          ${field("Item", `<input value="${escapeAttr(item?.item_name || "Inventory item")}" disabled>`)}
          ${field("Piece Number", `<input type="number" min="1" step="1" name="piece_number" value="${escapeAttr(piece.piece_number || 1)}">`)}
          ${field("Asset Tag", `<input name="asset_tag" required value="${escapeAttr(piece.asset_tag || "")}">`)}
          ${field("Serial Number", `<input name="serial_number" value="${escapeAttr(piece.serial_number || "")}">`)}
          ${field("Date Added", `<input type="date" name="date_added" value="${escapeAttr(dateInput(piece.date_added) || today())}">`)}
          ${field("Functional Status", `<select name="functional_status">${optionHtml(STATUSES, piece.functional_status || item?.functional_status || "Functional")}</select>`)}
          ${field("Remarks", `<textarea name="remarks">${escapeHtml(piece.remarks || "")}</textarea>`, true)}
        </div>
      </form>
      <div class="modal-actions">
        <button class="btn" data-close-modal>Cancel</button>
        <button class="btn primary" form="piece-form">Save Piece</button>
      </div>
    `);
    document.getElementById("piece-form").addEventListener("submit", (event) => savePiece(event, piece));
  }

  async function savePiece(event, piece) {
    event.preventDefault();
    const form = new FormData(event.target);
    const payload = {
      piece_number: Number(form.get("piece_number") || piece.piece_number || 1),
      asset_tag: clean(form.get("asset_tag")),
      serial_number: clean(form.get("serial_number")) || null,
      date_added: form.get("date_added") || today(),
      functional_status: form.get("functional_status"),
      remarks: clean(form.get("remarks")),
      updated_at: new Date().toISOString()
    };
    if (!payload.asset_tag) return notify("Asset tag is required.");
    await updateRecord(TABLES.pieces, piece.id, payload, "edited", "inventory piece", piece);
    closeModal();
    await loadData();
    render();
  }

  function openPieceMoveModal(piece) {
    if (!piece) return;
    const item = findById(state.data.inventory, piece.inventory_item_id);
    if (!item) return;
    openModal("Move Piece", `
      <form id="piece-move-form" class="modal-body">
        <div class="form-grid">
          ${field("Piece", `<input value="${escapeAttr(piece.asset_tag || "")}" disabled>`)}
          ${field("From", `<input value="${escapeAttr(roomLabel(item.room_code))}" disabled>`)}
          ${field("To", `<select name="destination_room_code" required>${optionHtml(ROOMS.map((r) => r.code).filter((code) => code !== item.room_code), "", roomLabel)}</select>`)}
          ${field("Notes", `<textarea name="notes" placeholder="Reason, receiving room, or handoff notes"></textarea>`, true)}
        </div>
      </form>
      <div class="modal-actions">
        <button class="btn" data-close-modal>Cancel</button>
        <button class="btn primary" form="piece-move-form">Move Piece</button>
      </div>
    `);
    document.getElementById("piece-move-form").addEventListener("submit", (event) => savePieceMove(event, item, piece));
  }

  async function savePieceMove(event, item, piece) {
    event.preventDefault();
    const form = new FormData(event.target);
    const destination = form.get("destination_room_code");
    if (!destination) return notify("Destination room is required.");
    await movePieces(item, [piece], destination, clean(form.get("notes")) || "Piece transferred");
    closeModal();
    await loadData();
    render();
  }

  async function deletePiece(id) {
    const piece = findPiece(id);
    const item = piece ? findById(state.data.inventory, piece.inventory_item_id) : null;
    if (!piece || !item || !confirm("Delete this piece and reduce the item quantity by 1?")) return;
    await updateRecord(TABLES.pieces, piece.id, { deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }, "deleted", "inventory piece", piece);
    await updateRecord(TABLES.inventory, item.id, { quantity: Math.max(0, Number(item.quantity || 0) - 1), last_updated: new Date().toISOString() }, "edited", "inventory item", item, { movement: "Piece deleted" });
    await loadData();
    render();
  }

  function openTransactionModal(item) {
    if (!item) return;
    openModal("Inventory Transaction", `
      <form id="transaction-form" class="modal-body">
        <div class="form-grid">
          ${field("Item", `<input value="${escapeAttr(item.item_name)}" disabled>`)}
          ${field("Available Quantity", `<input value="${Number(item.quantity || 0)} ${escapeAttr(item.unit_measure || "")}" disabled>`)}
          ${field("Transaction Type", `<select name="transaction_type">${optionHtml(TRANSACTION_TYPES, "Stock Out")}</select>`)}
          ${field("Quantity", `<input type="number" min="1" step="1" name="quantity" required value="1">`)}
          ${field("From", `<select name="source_room_code">${optionHtml([""].concat(ROOMS.map((r) => r.code)), item.room_code, roomLabel)}</select>`)}
          ${field("To", `<select name="destination_room_code">${optionHtml([""].concat(ROOMS.map((r) => r.code)), "", roomLabel)}</select>`)}
          ${field("Notes", `<textarea name="notes" placeholder="Reason, receiving department, shelf, or handoff notes"></textarea>`, true)}
        </div>
      </form>
      <div class="modal-actions">
        <button class="btn" data-close-modal>Cancel</button>
        <button class="btn primary" form="transaction-form">Record Movement</button>
      </div>
    `);
    document.getElementById("transaction-form").addEventListener("submit", (event) => saveTransaction(event, item));
  }

  async function saveTransaction(event, item) {
    event.preventDefault();
    const form = new FormData(event.target);
    const tx = {
      item,
      transaction_type: form.get("transaction_type"),
      quantity: Number(form.get("quantity") || 0),
      source_room_code: form.get("source_room_code") || item.room_code,
      destination_room_code: form.get("destination_room_code") || null,
      notes: clean(form.get("notes"))
    };
    if (tx.quantity <= 0) return notify("Quantity must be greater than zero.");
    await createTransaction(tx, true);
    closeModal();
    await loadData();
    render();
  }

  async function createTransaction(tx, adjustQuantity) {
    const item = tx.item;
    const quantity = Number(tx.quantity || 0);
    const oldItem = { ...item };
    let nextQty = Number(item.quantity || 0);
    if (adjustQuantity) {
      if (tx.transaction_type === "Transfer" && tx.destination_room_code) {
        if (nextQty - quantity < 0) return notify("Movement cannot reduce quantity below zero.");
        await movePieces(item, await takePiecesForMove(item, quantity), tx.destination_room_code, tx.notes || "Inventory transfer");
        return;
      }
      if (tx.transaction_type === "Stock In" || tx.transaction_type === "Return") nextQty += quantity;
      if (tx.transaction_type === "Stock Out") nextQty -= quantity;
      if (nextQty < 0) return notify("Movement cannot reduce quantity below zero.");
      const savedItem = await updateRecord(TABLES.inventory, item.id, { quantity: nextQty, last_updated: new Date().toISOString() }, "edited", "inventory item", oldItem, { movement: tx.transaction_type });
      if (tx.transaction_type === "Stock In" || tx.transaction_type === "Return") await createPiecesForItem(savedItem || item, quantity, { reason: tx.transaction_type });
    }
    const payload = {
      inventory_item_id: item.id,
      item_name: item.item_name,
      transaction_type: tx.transaction_type,
      quantity,
      unit_measure: item.unit_measure,
      room_code: item.room_code,
      source_room_code: tx.source_room_code,
      destination_room_code: tx.destination_room_code,
      notes: tx.notes || "",
      changed_by: profileName(),
      changed_role: currentRoleLabel()
    };
    await insertRecord(TABLES.transactions, payload, "created", "inventory transaction", false);
  }

  async function receiveTransfer(item, quantity, destinationRoomCode, transferredAssetTag) {
    const room = getRoom(destinationRoomCode);
    const existing = activeInventory().find((row) => row.room_code === destinationRoomCode && row.item_name.toLowerCase() === item.item_name.toLowerCase() && row.category === item.category && row.unit_measure === item.unit_measure);
    if (existing) {
      return updateRecord(TABLES.inventory, existing.id, { quantity: Number(existing.quantity || 0) + quantity, last_updated: new Date().toISOString() }, "edited", "inventory item", existing, { movement: "Transfer received" });
    }
    return insertRecord(TABLES.inventory, {
        item_name: item.item_name,
        category: item.category,
        quantity,
        unit_measure: item.unit_measure,
        functional_status: item.functional_status,
        room_code: room.code,
        room_name: room.name,
        floor_name: room.floor,
        location_detail: room.name,
        asset_tag: transferredAssetTag || nextAssetTag(room.code),
        date_added: today(),
        last_updated: new Date().toISOString(),
        remarks: `Transferred from ${roomLabel(item.room_code)}`
      }, "created", "inventory item");
  }

  async function takePiecesForMove(item, quantity) {
    let pieces = inventoryPieces(item).slice(0, quantity);
    if (pieces.length < quantity) {
      await createPiecesForItem(item, quantity - pieces.length, { reason: "Created for transfer" });
      await loadData();
      pieces = inventoryPieces(item).slice(0, quantity);
    }
    return pieces;
  }

  async function movePieces(item, pieces, destinationRoomCode, notes) {
    const quantity = pieces.length || 1;
    const oldItem = { ...item };
    const room = getRoom(destinationRoomCode);
    if (Number(item.quantity || 0) <= quantity) {
      const movedItem = await updateRecord(TABLES.inventory, item.id, {
        room_code: room.code,
        room_name: room.name,
        floor_name: room.floor,
        location_detail: room.name,
        asset_tag: item.asset_tag,
        last_updated: new Date().toISOString(),
        remarks: [item.remarks, `Transferred from ${roomLabel(oldItem.room_code)}`].filter(Boolean).join(" | ")
      }, "edited", "inventory item", oldItem, { movement: "Transfer sent" });
      if (!movedItem) return;
      for (const piece of pieces) {
        await updateRecord(TABLES.pieces, piece.id, {
          inventory_item_id: movedItem.id,
          current_room_code: destinationRoomCode,
          origin_room_code: piece.origin_room_code || oldItem.room_code,
          transferred_at: new Date().toISOString(),
          remarks: [piece.remarks, notes].filter(Boolean).join(" | "),
          updated_at: new Date().toISOString()
        }, "transferred", "inventory piece", piece);
      }
      await createTransaction({ item: oldItem, transaction_type: "Transfer", quantity, source_room_code: oldItem.room_code, destination_room_code: destinationRoomCode, notes }, false);
      return;
    }
    const destinationItem = await receiveTransfer(item, quantity, destinationRoomCode, pieces[0]?.asset_tag || null);
    if (!destinationItem) return;
    if (Number(item.quantity || 0) >= quantity && destinationItem.id !== item.id) {
      await updateRecord(TABLES.inventory, item.id, { quantity: Math.max(0, Number(item.quantity || 0) - quantity), last_updated: new Date().toISOString() }, "edited", "inventory item", oldItem, { movement: "Transfer sent" });
    }
    for (const piece of pieces) {
      await updateRecord(TABLES.pieces, piece.id, {
        inventory_item_id: destinationItem.id,
        current_room_code: destinationRoomCode,
        origin_room_code: piece.origin_room_code || item.room_code,
        transferred_at: new Date().toISOString(),
        remarks: [piece.remarks, notes].filter(Boolean).join(" | "),
        updated_at: new Date().toISOString()
      }, "transferred", "inventory piece", piece);
    }
    await createTransaction({ item, transaction_type: "Transfer", quantity, source_room_code: item.room_code, destination_room_code: destinationRoomCode, notes }, false);
  }

  function openRequestModal(request, defaultType) {
    const requestType = request?.request_type || defaultType || currentRequestType() || "Deployment";
    const cartItems = !request && requestType === "Deployment" ? loadDeploymentCart() : [];
    const items = request ? parseRequestItems(request) : (cartItems.length ? cartItems : [{}]);
    openModal(`${request ? "Edit" : "New"} Request`, `
      <form id="request-form" class="modal-body">
        <div class="form-grid">
          ${field("Requester Name", `<input name="requester_name" required value="${escapeAttr(request?.requester_name || profileName())}">`)}
          ${field("Department/Program", `<input name="department_program" required value="${escapeAttr(request?.department_program || "Education")}">`)}
          ${field("Position", `<input name="position" required value="${escapeAttr(request?.position || "Simulationist")}">`)}
          ${field("Date Requested", `<input type="date" name="date_requested" value="${escapeAttr(dateInput(request?.date_requested) || today())}">`)}
          ${field("Designation", `<input name="designation" required value="${escapeAttr(request?.designation || "")}" placeholder="Deployment area or activity">`)}
          ${requestType === "Deployment" ? field("Duration of Deployment", `<input name="deployment_duration" required value="${escapeAttr(request?.deployment_duration || "")}" placeholder="Example: June 10-12, 2026 or 3 days">`) : ""}
          ${field("Immediate Superior", `<input name="immediate_superior" required value="${escapeAttr(request?.immediate_superior || "")}">`)}
          ${field("Request Type", `<input value="${escapeAttr(requestType)}" disabled><input type="hidden" name="request_type" value="${escapeAttr(requestType)}">`)}
          ${field("Request Status", `<select name="status" ${isAdmin() ? "" : "disabled"}>${optionHtml(REQUEST_STATUSES, request?.status || "Pending")}</select>`)}
          <div class="field full">
            <span>Items to Request</span>
            <div class="request-cart" data-request-items>
              ${items.map((item) => requestItemRow(item)).join("")}
            </div>
            <button class="btn success" type="button" data-add-request-row>Add Item</button>
          </div>
        </div>
      </form>
      <div class="modal-actions">
        <button class="btn" data-close-modal>Cancel</button>
        <button class="btn primary" form="request-form">Save Request</button>
      </div>
    `);
    document.getElementById("request-form").addEventListener("submit", (event) => saveRequest(event, request));
    modalRoot.querySelector("[data-add-request-row]")?.addEventListener("click", () => addRequestItemRow());
    bindRequestRows();
  }

  async function saveRequest(event, existing) {
    event.preventDefault();
    const form = new FormData(event.target);
    const requestItems = collectRequestItems();
    if (!requestItems.length) return notify("Add at least one requested item.");
    const quantity = requestItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const payload = {
      requester_name: clean(form.get("requester_name")),
      department_program: clean(form.get("department_program")),
      position: clean(form.get("position")),
      date_requested: form.get("date_requested") || today(),
      designation: clean(form.get("designation")),
      deployment_duration: clean(form.get("deployment_duration")),
      immediate_superior: clean(form.get("immediate_superior")),
      item_requested: requestItems.map((item) => item.item_name).join(", "),
      quantity_requested: quantity,
      request_items: requestItems,
      request_type: form.get("request_type") || "Deployment",
      reason: clean(form.get("designation")) || "Deployment request",
      priority_level: "Medium",
      status: isAdmin() ? form.get("status") : (existing?.status || "Pending"),
      updated_at: new Date().toISOString()
    };
    let saved;
    if (existing) saved = await updateRecord(TABLES.requests, existing.id, payload, statusAction(existing.status, payload.status), "request", existing);
    else saved = await insertRecord(TABLES.requests, payload, "created", "request");
    if (saved) await addRequestHistory(saved.id, existing?.status || null, payload.status, payload.reason);
    if (saved && payload.request_type === "Deployment" && payload.status === "Approved") await markApprovedDeploymentItems(saved);
    if (saved && !existing && payload.request_type === "Deployment") clearDeploymentCart();
    closeModal();
    await loadData();
    render();
  }

  function openVrModal(asset) {
    openModal(`${asset ? "Edit" : "Add"} VR Asset`, `
      <form id="vr-form" class="modal-body">
        <div class="form-grid">
          ${field("VR Number", `<input name="vr_number" required value="${escapeAttr(asset?.vr_number || nextVrNumber())}" placeholder="VR-001">`)}
          ${field("VR Serial Number", `<input name="vr_serial_number" value="${escapeAttr(asset?.vr_serial_number || "")}">`)}
          ${field("Brand", `<input name="brand" value="${escapeAttr(asset?.brand || "")}">`)}
          ${field("Model", `<input name="model" value="${escapeAttr(asset?.model || "")}">`)}
          ${field("Assigned Room", `<select name="assigned_room_code">${optionHtml(ROOMS.map((r) => r.code), asset?.assigned_room_code || "3F-VR", roomLabel)}</select>`)}
          ${field("Functional Status", `<select name="functional_status">${optionHtml(STATUSES, asset?.functional_status || "Functional")}</select>`)}
          ${field("Last Maintenance Date", `<input type="date" name="last_maintenance_date" value="${escapeAttr(dateInput(asset?.last_maintenance_date) || "")}">`)}
          ${field("Notes", `<textarea name="notes">${escapeHtml(asset?.notes || "")}</textarea>`, true)}
        </div>
      </form>
      <div class="modal-actions">
        <button class="btn" data-close-modal>Cancel</button>
        <button class="btn primary" form="vr-form">Save VR Asset</button>
      </div>
    `);
    document.getElementById("vr-form").addEventListener("submit", (event) => saveVr(event, asset));
  }

  async function saveVr(event, existing) {
    event.preventDefault();
    const form = new FormData(event.target);
    let payload = {
      vr_number: clean(form.get("vr_number")),
      vr_serial_number: clean(form.get("vr_serial_number")),
      brand: clean(form.get("brand")),
      model: clean(form.get("model")),
      assigned_room_code: form.get("assigned_room_code"),
      functional_status: form.get("functional_status"),
      last_maintenance_date: form.get("last_maintenance_date") || null,
      notes: clean(form.get("notes")),
      updated_at: new Date().toISOString()
    };
    const linked = await ensureInventoryForVr(payload, existing);
    if (linked?.item) payload = { ...payload, inventory_item_id: linked.item.id };
    if (linked?.piece) payload = { ...payload, inventory_piece_id: linked.piece.id };
    if (existing) await updateRecord(TABLES.vr, existing.id, payload, "edited", "VR asset", existing);
    else await insertRecord(TABLES.vr, payload, "created", "VR asset");
    closeModal();
    await loadData();
    render();
  }

  async function ensureInventoryForVr(vrPayload, existingVr) {
    const room = getRoom(vrPayload.assigned_room_code || "3F-VR") || getRoom("3F-VR");
    const assetTag = makeVrAssetTag(vrPayload);
    const itemPayload = {
      item_name: "VR Headset",
      category: "Technology",
      quantity: 1,
      unit_measure: "Piece(s)",
      functional_status: vrPayload.functional_status || "Functional",
      room_code: room.code,
      room_name: room.name,
      floor_name: room.floor,
      location_detail: room.name,
      asset_tag: assetTag,
      date_added: today(),
      last_updated: new Date().toISOString(),
      remarks: [vrPayload.brand, vrPayload.model, vrPayload.notes].filter(Boolean).join(" - ")
    };
    let item = existingVr?.inventory_item_id ? findById(state.data.inventory, existingVr.inventory_item_id) : null;
    if (!item) item = activeInventory().find((row) => row.asset_tag === assetTag || (row.item_name === "VR Headset" && row.room_code === room.code && row.remarks?.includes(vrPayload.vr_number)));
    if (item) {
      item = await updateRecord(TABLES.inventory, item.id, { ...itemPayload, date_added: item.date_added || today() }, "edited", "inventory item", item, { movement: "VR registry sync" });
    } else {
      item = await insertRecord(TABLES.inventory, itemPayload, "created", "inventory item");
      if (item) await createTransaction({ item, transaction_type: "Stock In", quantity: 1, source_room_code: null, destination_room_code: item.room_code, notes: "Created from VR registry" }, false);
    }
    if (!item) return null;
    let piece = inventoryPieces(item)[0];
    if (!piece) {
      const pieces = await createPiecesForItem(item, 1, { serial_number: vrPayload.vr_serial_number || null, reason: `VR registry ${vrPayload.vr_number}` });
      piece = pieces[0];
    } else {
      piece = await updateRecord(TABLES.pieces, piece.id, {
        asset_tag: piece.asset_tag || assetTag,
        serial_number: vrPayload.vr_serial_number || piece.serial_number || null,
        current_room_code: room.code,
        functional_status: vrPayload.functional_status || piece.functional_status,
        remarks: `VR registry ${vrPayload.vr_number}`,
        updated_at: new Date().toISOString()
      }, "edited", "inventory piece", piece, { movement: "VR registry sync" });
    }
    return { item, piece };
  }

  async function softDeleteItem(id) {
    const item = findById(state.data.inventory, id);
    if (!item || !confirm("Soft delete this item? Admins can restore it later.")) return;
    await updateRecord(TABLES.inventory, id, { deleted_at: new Date().toISOString(), deleted_by: profileName(), last_updated: new Date().toISOString() }, "deleted", "inventory item", item);
    await loadData();
    render();
  }

  async function restoreItem(id) {
    const item = findById(state.data.inventory, id);
    if (!item) return;
    await updateRecord(TABLES.inventory, id, { deleted_at: null, deleted_by: null, last_updated: new Date().toISOString() }, "restored", "inventory item", item);
    await loadData();
    render();
  }

  async function insertRecord(table, payload, action, recordType, audit = true) {
    const enriched = { ...payload, created_by: payload.created_by || profileName(), updated_by: profileName() };
    if (state.supabase && state.dbReady) {
      const { data, error } = await state.supabase.from(table).insert(enriched).select().single();
      if (error) return fail(error);
      if (audit) await logAudit(action, recordType, data.id, null, data);
      notify(recordChangeMessage(action, recordType));
      return data;
    }
    const data = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...enriched };
    localInsert(table, data);
    if (audit) await logAudit(action, recordType, data.id, null, data);
    notify(recordChangeMessage(action, recordType));
    return data;
  }

  async function updateRecord(table, id, payload, action, recordType, oldValue, extraNewValue) {
    const enriched = { ...payload, updated_by: profileName() };
    if (state.supabase && state.dbReady) {
      const { data, error } = await state.supabase.from(table).update(enriched).eq("id", id).select().single();
      if (error) return fail(error);
      await logAudit(action, recordType, id, oldValue || null, { ...data, ...(extraNewValue || {}) });
      notify(recordChangeMessage(action, recordType));
      return data;
    }
    const data = localUpdate(table, id, enriched);
    await logAudit(action, recordType, id, oldValue || null, { ...data, ...(extraNewValue || {}) });
    notify(recordChangeMessage(action, recordType));
    return data;
  }

  async function logAudit(actionType, recordType, recordId, oldValue, newValue) {
    const payload = {
      action_type: actionType,
      record_type: recordType,
      record_id: recordId,
      old_value: oldValue || null,
      new_value: newValue || null,
      changed_by: profileName(),
      changed_role: currentRoleLabel()
    };
    if (state.supabase && state.dbReady) {
      await state.supabase.from(TABLES.audit).insert(payload);
    } else {
      localInsert(TABLES.audit, { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...payload });
    }
  }

  async function addRequestHistory(requestId, oldStatus, newStatus, note) {
    const payload = { request_id: requestId, old_status: oldStatus, new_status: newStatus, note, changed_by: profileName(), changed_role: currentRoleLabel() };
    if (state.supabase && state.dbReady) await state.supabase.from(TABLES.requestHistory).insert(payload);
    else localInsert(TABLES.requestHistory, { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...payload });
  }

  function openRequestHistory(id) {
    const request = findById(state.data.requests, id);
    const rows = state.data.requestHistory.filter((row) => row.request_id === id);
    openModal("Request History", `
      <div class="modal-body">
        <p><b>${escapeHtml(request?.item_requested || "Request")}</b></p>
        ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>From</th><th>To</th><th>By</th><th>Date</th><th>Note</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.old_status || "")}</td><td>${requestBadge(row.new_status)}</td><td>${escapeHtml(row.changed_by || "")}</td><td>${dateTime(row.created_at)}</td><td>${escapeHtml(row.note || "")}</td></tr>`).join("")}</tbody></table></div>` : emptyState("No history yet", "Status updates will appear here.")}
      </div>
      <div class="modal-actions"><button class="btn primary" data-close-modal>Done</button></div>
    `);
  }

  function openProfileModal() {
    openModal("Access Profile", `<div class="modal-body">${profileCard()}<p class="muted">This keeps the site easy to open. For strict enforcement, connect these roles to Supabase Auth or invite-only accounts later.</p></div><div class="modal-actions"><button class="btn primary" data-close-modal>Done</button></div>`, "small");
    modalRoot.querySelectorAll("[data-profile-field]").forEach((field) => field.addEventListener("change", updateProfileFromField));
  }

  function openQr(title, payload) {
    const qrId = "qr-" + Math.random().toString(36).slice(2);
    openModal(title, `
      <div class="modal-body">
        <div class="qr-box" data-label-box>
          <div id="${qrId}"></div>
          <b>${escapeHtml(payload.label)}</b>
          <span class="muted">${escapeHtml(payload.code)}</span>
          ${payload.assetTag ? `<span>Asset Tag: ${escapeHtml(payload.assetTag)}</span>` : ""}
          ${payload.room ? `<span>Room: ${escapeHtml(payload.room)}</span>` : ""}
          ${payload.serial ? `<span>Serial: ${escapeHtml(payload.serial)}</span>` : ""}
        </div>
      </div>
      <div class="modal-actions"><button class="btn" data-print-label>Print Label</button><button class="btn primary" data-close-modal>Done</button></div>
    `, "small");
    const text = payload.url || JSON.stringify(payload);
    if (window.QRCode) new window.QRCode(document.getElementById(qrId), { text, width: 180, height: 180 });
    else document.getElementById(qrId).textContent = text;
    modalRoot.querySelector("[data-print-label]")?.addEventListener("click", () => printQrLabel(payload, qrId));
  }

  function printQrLabel(payload, qrId) {
    const qrNode = document.querySelector(`#${qrId} canvas, #${qrId} img`);
    const qrSrc = qrNode?.tagName === "CANVAS" ? qrNode.toDataURL("image/png") : qrNode?.src || "";
    const logoUrl = new URL("hct-logo-navy.png", location.href).href;
    const win = window.open("", "_blank");
    if (!win) return notify("Allow popups to print labels.");
    win.document.write(`
      <html><head><title>${escapeHtml(payload.label)} Label</title>
      <style>
        body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#14213d}
        .label{width:320px;border:2px solid #14213d;border-radius:8px;padding:16px;text-align:center}
        img.logo{width:54px;height:54px;object-fit:contain}
        img.qr{width:170px;height:170px;margin:10px auto;display:block}
        h1{font-size:18px;margin:8px 0 4px}.meta{font-size:13px;margin:4px 0}.code{font-weight:700;color:#46c1c6}
      </style></head><body>
      <div class="label">
        <img class="logo" src="${logoUrl}" alt="HCT">
        <h1>${escapeHtml(payload.label)}</h1>
        ${qrSrc ? `<img class="qr" src="${qrSrc}" alt="QR code">` : ""}
        <div class="meta code">${escapeHtml(payload.code || "")}</div>
        ${payload.assetTag ? `<div class="meta">Asset Tag: ${escapeHtml(payload.assetTag)}</div>` : ""}
        ${payload.room ? `<div class="meta">Room: ${escapeHtml(payload.room)}</div>` : ""}
        ${payload.serial ? `<div class="meta">Serial: ${escapeHtml(payload.serial)}</div>` : ""}
      </div><script>print()</script></body></html>
    `);
    win.document.close();
  }

  function openModal(title, body, size) {
    modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal ${size || ""}" role="dialog" aria-modal="true"><div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="icon-button" data-close-modal>&times;</button></div>${body}</section></div>`;
    modalRoot.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
    modalRoot.querySelector(".modal-backdrop").addEventListener("click", (event) => {
      if (event.target.classList.contains("modal-backdrop")) closeModal();
    });
  }

  function closeModal() {
    const backdrop = modalRoot.querySelector(".modal-backdrop");
    if (!backdrop) return;
    backdrop.classList.add("closing");
    backdrop.querySelector(".modal")?.classList.add("closing");
    setTimeout(() => { modalRoot.innerHTML = ""; }, 200);
  }

  function exportView(kind) {
    const rows = exportRows(kind);
    if (!rows.length) return notify("Nothing to export yet.");
    const html = `<table>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? ""))}</td>`).join("")}</tr>`).join("")}</table>`;
    downloadBlob(`${kind}-${today()}.xls`, html, "application/vnd.ms-excel");
    notify("Excel export created.");
  }

  function pdfTitleFor(kind) {
    if (kind === "vr") return { title: "VR Asset Registry Report", subtitle: "Meta Quest 3 headset tracking by VR number, serial, and room" };
    if (kind === "requests") {
      const type = currentRequestType();
      return { title: `${type} Requests Report`, subtitle: type === "Deployment" ? "Employee deployment requests" : "Procurement requests for new items" };
    }
    if (kind === "audit") return { title: "Audit Log Report", subtitle: "System changes and record history" };
    if (kind === "inventory") {
      const room = state.view === "room" ? getRoom(state.viewArg) : null;
      return { title: "Inventory Report", subtitle: room ? `${room.name} - ${room.floor}` : "All Rooms" };
    }
    return { title: "Summary Report", subtitle: "" };
  }

  function exportPdf(kind) {
    const rows = exportRows(kind);
    if (!rows.length) return notify("Nothing to export yet.");
    const { title, subtitle } = pdfTitleFor(kind);
    const logoUrl = new URL("hct-logo-navy.png", location.href).href;
    const [head, ...body] = rows;
    const win = window.open("", "_blank");
    if (!win) return notify("Allow popups to print PDF.");
    win.document.write(`
      <html><head><title>HCT Institute - ${escapeHtml(title)}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:28px;color:#14213d}
        header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #46c1c6;padding-bottom:14px;margin-bottom:18px}
        header img{width:62px;height:62px;object-fit:contain} h1{margin:0;font-size:24px} p{margin:4px 0;color:#52616b}
        table{width:100%;border-collapse:collapse} th,td{border:1px solid #cfd8dc;padding:8px;text-align:left;font-size:12px} th{background:#eefafa;color:#14213d}
        tbody tr:nth-child(even){background:#f7fbfb}
        footer{margin-top:22px;font-size:11px;color:#8a978f;text-align:center}
        @media print{body{margin:18px}}
      </style></head><body>
      <header><img src="${logoUrl}" alt="HCT Institute"><div><h1>HCT Institute ${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}<p>Printed ${escapeHtml(new Date().toLocaleString())}</p></div></header>
      <table>
        <thead><tr>${head.map((cell) => `<th>${escapeHtml(String(cell ?? ""))}</th>`).join("")}</tr></thead>
        <tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? ""))}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${head.length}">No records found.</td></tr>`}</tbody>
      </table>
      <footer>How Care Transforms &middot; HCT Institute Inventory Management</footer>
      <script>print()<\/script></body></html>`);
    win.document.close();
  }

  function printRoomReport(roomCode) {
    const room = getRoom(roomCode);
    const rows = filteredInventory(roomCode, false);
    const logoUrl = new URL("hct-logo-navy.png", location.href).href;
    const win = window.open("", "_blank");
    if (!win) return notify("Allow popups to print room reports.");
    win.document.write(`
      <html><head><title>${escapeHtml(room?.name || "Room")} Inventory Report</title>
      <style>
        body{font-family:Arial,sans-serif;margin:28px;color:#14213d}
        header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #46c1c6;padding-bottom:14px;margin-bottom:18px}
        header img{width:62px;height:62px;object-fit:contain} h1{margin:0;font-size:24px} p{margin:4px 0;color:#52616b}
        table{width:100%;border-collapse:collapse} th,td{border:1px solid #cfd8dc;padding:8px;text-align:left;font-size:12px} th{background:#eefafa;color:#14213d}
      </style></head><body>
      <header><img src="${logoUrl}" alt="HCT Institute"><div><h1>HCT Institute Inventory Report</h1><p>${escapeHtml(room?.name || "All Rooms")} - ${escapeHtml(room?.floor || "")}</p><p>Printed ${escapeHtml(new Date().toLocaleString())}</p></div></header>
      <table><thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Unit</th><th>Status</th><th>Asset Tag</th><th>Last Updated</th><th>Remarks</th></tr></thead>
      <tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.item_name)}</td><td>${escapeHtml(item.category)}</td><td>${Number(item.quantity || 0)}</td><td>${escapeHtml(item.unit_measure || "")}</td><td>${escapeHtml(item.functional_status || "")}</td><td>${escapeHtml(item.asset_tag || "")}</td><td>${dateTime(item.last_updated)}</td><td>${escapeHtml(item.remarks || "")}</td></tr>`).join("") || `<tr><td colspan="8">No inventory records for this room.</td></tr>`}</tbody></table>
      <script>print()</script></body></html>
    `);
    win.document.close();
  }

  function printDeploymentRequest(request) {
    if (!request) return;
    const items = parseRequestItems(request);
    const logoUrl = new URL("hct-logo-teal.png", location.href).href;
    const requesterAllCaps = (request.requester_name || "").toUpperCase();
    const win = window.open("", "_blank");
    if (!win) return notify("Allow popups to print deployment reports.");
    win.document.write(`
      <html><head><title>Employee Accountability Form</title>
      <style>
        body{font-family:Arial,sans-serif;margin:28px;color:#111}
        .sheet{width:760px;margin:0 auto}
        .brand{display:flex;align-items:center;gap:10px;margin:0 0 6px 0}
        .brand img{height:50px;width:auto;object-fit:contain}
        .brand-name{font-size:38px;font-weight:700;color:#111;letter-spacing:-1px}
        .teal{height:31px;background:#46c1c6;color:#fff;font-size:18px;display:flex;align-items:center;padding-left:8px;margin:0 4px 20px}
        h1{font-size:20px;text-align:center;margin:16px 0 14px}
        .info,.assets{width:100%;border-collapse:collapse}
        .info{margin-bottom:0}
        .info td{border:1px solid #111;padding:7px 7px;font-size:14px;width:50%}
        .assets th{background:#171b26;color:#fff;border:1px solid #111;padding:10px 8px;font-size:14px;text-align:center}
        .assets td{border:1px solid #111;height:31px;padding:7px 8px;font-size:14px;text-align:center}
        .assets td:nth-child(2){text-align:left}
        .ack{width:520px;margin:36px auto 44px;font-size:14px;line-height:1.75;text-align:justify}
        .signatures{width:540px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;column-gap:98px;row-gap:42px;text-align:center;font-size:14px}
        .sig .printed-name{display:block;min-height:18px;margin-bottom:5px;font-weight:700}
        .sig .line{display:block;border-top:1px solid #111;margin-bottom:7px}
        @media print{body{margin:18px}.sheet{width:100%}}
      </style></head><body><div class="sheet">
      <div class="brand"><img src="${logoUrl}" alt="HCT"><span class="brand-name">HCT</span></div>
      <div class="teal">How Care Transforms</div>
      <table class="info">
        <tr><td>Name: ${escapeHtml(request.requester_name || "")}</td><td>Department: ${escapeHtml(request.department_program || "")}</td></tr>
        <tr><td>Position: ${escapeHtml(request.position || "")}</td><td>Date: ${escapeHtml(dateOnly(request.date_requested))}</td></tr>
        <tr><td>Designation: ${escapeHtml(request.designation || "")}</td><td>Immediate Superior: ${escapeHtml(request.immediate_superior || "")}</td></tr>
      </table>
      <h1>Employee Accountability Form</h1>
      <table class="assets"><thead><tr><th>Asset I.D</th><th>Item</th><th>Quantity</th><th>Serial Number</th></tr></thead>
      <tbody>${items.concat(Array(Math.max(0, 2 - items.length)).fill({})).map((item) => `<tr><td>${escapeHtml(item.asset_tag || "")}</td><td>${escapeHtml(item.item_name || "")}</td><td>${item.quantity ? Number(item.quantity || 0) : ""}</td><td>${escapeHtml(item.serial_number || "")}</td></tr>`).join("")}</tbody></table>
      <p class="ack">This is to acknowledge that I am accountable for the above listed items. I understand that I will pay or replace the same unit/or in any exact amount in-case of loss or damage due to my fault or negligence. In case of resignation, separation or transfer, I will turnover these items before issuance of my clearance. For any additional software protected with license installed that do not appear on the list above, or do not have any supporting document(s) coming from the company, it is my responsibility and obligation to properly handle and not to disclose any of company resources, comply with the set rules and regulations by any authority within the organization or imposed by the IT | Management | HR.</p>
      <div class="signatures">
        <div class="sig"><span class="printed-name"></span><span class="line"></span>Issued by | Admin Assistant</div>
        <div class="sig"><span class="printed-name">${escapeHtml(requesterAllCaps)}</span><span class="line"></span>Conforme | Signature over Printed Name</div>
        <div class="sig"><span class="printed-name"></span><span class="line"></span>Security Guard on Duty</div>
        <div class="sig"><span class="printed-name"></span><span class="line"></span>Approved By</div>
      </div>
      </div><script>print()</script></body></html>
    `);
    win.document.close();
  }

  function exportRows(kind) {
    if (kind === "inventory") return [["Item", "Category", "Quantity", "Unit", "Status", "Room", "Asset Tag", "Date Added", "Last Updated", "Remarks"]].concat(filteredInventory(state.view === "room" ? state.viewArg : null, false).map((item) => [item.item_name, item.category, item.quantity, item.unit_measure, item.functional_status, roomLabel(item.room_code), item.asset_tag, dateOnly(item.date_added), dateTime(item.last_updated), item.remarks]));
    if (kind === "vr") return [["VR Number", "Serial", "Brand", "Model", "Room", "Status", "Maintenance", "Notes"]].concat(filteredVr().map((row) => [row.vr_number, row.vr_serial_number, row.brand, row.model, roomLabel(row.assigned_room_code), row.functional_status, dateOnly(row.last_maintenance_date), row.notes]));
    if (kind === "requests") return [["Type", "Requester", "Department", "Position", "Designation", "Superior", "Items", "Quantity", "Status", "Date"]].concat(filteredRequests().map((row) => [row.request_type || "Deployment", row.requester_name, row.department_program, row.position, row.designation, row.immediate_superior, parseRequestItems(row).map((item) => `${item.item_name} x${item.quantity}${item.asset_tag ? ` (${item.asset_tag})` : ""}`).join("; "), row.quantity_requested, row.status, dateOnly(row.date_requested)]));
    if (kind === "audit") return [["Action", "Record Type", "Changed By", "Timestamp", "Old Value", "New Value"]].concat(state.data.audit.map((row) => [row.action_type, row.record_type, row.changed_by, dateTime(row.created_at), shortJson(row.old_value), shortJson(row.new_value)]));
    return [["Metric", "Value"], ["Inventory Items", activeInventory().length], ["Requests", state.data.requests.length], ["VR Assets", state.data.vr.length]];
  }

  function downloadBlob(filename, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function filteredInventory(roomCode, includeDeleted) {
    let rows = includeDeleted ? state.data.inventory.slice() : activeInventory();
    if (!includeDeleted) rows = rows.concat(virtualVrInventoryRows(roomCode === "3F-VR"));
    if (roomCode) rows = rows.map((item) => scopedInventoryRow(item, roomCode)).filter(Boolean);
    const term = state.filters.search.toLowerCase();
    if (term) rows = rows.filter((item) => [item.item_name, item.category, item.functional_status, roomLabel(item.room_code), item.asset_tag, item.remarks].some((value) => String(value || "").toLowerCase().includes(term)));
    if (state.filters.category !== "All") rows = rows.filter((item) => item.category === state.filters.category);
    if (state.filters.status !== "All") rows = rows.filter((item) => item.functional_status === state.filters.status);
    if (state.filters.sort === "name_asc") rows.sort((a, b) => a.item_name.localeCompare(b.item_name));
    if (state.filters.sort === "quantity_desc") rows.sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));
    if (state.filters.sort === "status_asc") rows.sort((a, b) => a.functional_status.localeCompare(b.functional_status));
    return rows;
  }

  function filteredVr() {
    const term = state.filters.search.toLowerCase();
    return state.data.vr.filter((row) => !row.deleted_at).filter((row) => {
      const matchesTerm = !term || [row.vr_number, row.vr_serial_number, row.brand, row.model].some((value) => String(value || "").toLowerCase().includes(term));
      const matchesStatus = state.filters.status === "All" || row.functional_status === state.filters.status;
      return matchesTerm && matchesStatus;
    });
  }

  function filteredRequests(type) {
    const term = state.filters.search.toLowerCase();
    return activeRequests().filter((row) => {
      const matchesTerm = !term || [row.request_type, row.requester_name, row.department_program, row.position, row.designation, row.immediate_superior, row.item_requested, row.reason, parseRequestItems(row).map((item) => `${item.item_name} ${item.asset_tag} ${item.serial_number} ${roomLabel(item.room_code)}`).join(" ")].some((value) => String(value || "").toLowerCase().includes(term));
      const matchesType = !type || type === "All" || (row.request_type || "Deployment") === type;
      const matchesStatus = state.filters.requestStatus === "All" || row.status === state.filters.requestStatus;
      return matchesTerm && matchesType && matchesStatus;
    });
  }
  
function syncRooms() {
    const map = new Map(DEFAULT_ROOMS.map((room) => [room.code, { ...room }]));
    (state.data.rooms || []).filter((room) => !room.deleted_at).forEach((room) => {
      map.set(room.code, {
        code: room.code,
        floor: room.floor,
        name: room.name,
        short: room.short || room.name,
        icon: room.icon || (room.floor === "5th Floor" ? "&#x1F3E5;" : "&#x2695;")
      });
    });
    const floorOrder = { "5th Floor": 1, "3rd Floor": 2, "Central Supply": 3 };
    ROOMS = Array.from(map.values()).sort((a, b) => {
      const fc = (floorOrder[a.floor] || 99) - (floorOrder[b.floor] || 99);
      return fc || a.name.localeCompare(b.name);
    });
  }
  
  function activeInventory() {
    return state.data.inventory.filter((item) => !item.deleted_at);
  }

  function virtualVrInventoryRows(forceVrRoom) {
    return (state.data.vr || []).filter((asset) => {
      const assetTag = forceVrRoom ? makeVrAssetTag({ ...asset, assigned_room_code: "3F-VR" }) : makeVrAssetTag(asset);
      return !activeInventory().some((item) => item.room_code === (forceVrRoom ? "3F-VR" : item.room_code) && (item.id === asset.inventory_item_id || item.asset_tag === assetTag));
    }).map((asset) => {
      const room = forceVrRoom ? getRoom("3F-VR") : (getRoom(asset.assigned_room_code || "3F-VR") || getRoom("3F-VR"));
      return {
        id: `virtual-vr-${asset.id}`,
        vr_asset_id: asset.id,
        inventory_piece_id: asset.inventory_piece_id || "",
        virtual_vr_asset: true,
        item_name: "VR Headset",
        category: "Technology",
        quantity: 1,
        unit_measure: "Piece(s)",
        functional_status: asset.functional_status || "Functional",
        floor_name: room.floor,
        room_code: room.code,
        room_name: room.name,
        location_detail: room.name,
        asset_tag: forceVrRoom ? makeVrAssetTag({ ...asset, assigned_room_code: "3F-VR" }) : makeVrAssetTag(asset),
        serial_number: asset.vr_serial_number || "",
        date_added: asset.created_at || today(),
        last_updated: asset.updated_at || asset.created_at || today(),
        remarks: [asset.vr_number, asset.brand, asset.model, asset.notes].filter(Boolean).join(" - ")
      };
    });
  }

  function makeVrAssetTag(asset) {
    const room = getRoom(asset?.assigned_room_code || "3F-VR") || getRoom("3F-VR");
    return `HCT-${room.code}-${slugCode(asset?.vr_number || "VR")}`;
  }

  function activePieces() {
    return (state.data.pieces || []).filter((piece) => !piece.deleted_at);
  }

  function inventoryPieces(item) {
    if (!item) return [];
    if (Array.isArray(item._visible_pieces)) return item._visible_pieces;
    return activePieces()
      .filter((piece) => piece.inventory_item_id === item.id)
      .sort((a, b) => Number(a.piece_number || 0) - Number(b.piece_number || 0));
  }
  
  function findPiece(id) {
    return (state.data.pieces || []).find((piece) => piece.id === id);
  }

  async function createPiecesForItem(item, quantity, options = {}) {
    const count = Math.max(0, Number(quantity || 0));
    if (!item || count <= 0) return [];
    const existing = inventoryPieces(item);
    const created = [];
    for (let index = 1; index <= count; index += 1) {
      const pieceNumber = existing.length + created.length + 1;
      const payload = {
        inventory_item_id: item.id,
        piece_number: pieceNumber,
        asset_tag: nextPieceAssetTag(item, pieceNumber),
        serial_number: options.serial_number || null,
        origin_room_code: options.origin_room_code || item.room_code,
        current_room_code: item.room_code,
        date_added: options.date_added || item.date_added || today(),
        functional_status: options.functional_status || item.functional_status || "Functional",
        remarks: options.reason || "",
        updated_at: new Date().toISOString()
      };
      const saved = await insertRecord(TABLES.pieces, payload, "created", "inventory piece");
      if (saved) created.push(saved);
    }
    return created;
  }

  function nextPieceAssetTag(item, pieceNumber) {
    const base = item.asset_tag || pieceTagBase(item);
    let candidate = `${base}-${String(pieceNumber).padStart(3, "0")}`;
    let suffix = pieceNumber;
    const used = new Set((state.data.pieces || []).map((piece) => piece.asset_tag));
    while (used.has(candidate)) {
      suffix += 1;
      candidate = `${base}-${String(suffix).padStart(3, "0")}`;
    }
    return candidate;
  }

  function pieceTag(item, pieceNumber) {
    return `${item.asset_tag || pieceTagBase(item)}-${String(pieceNumber).padStart(3, "0")}`;
  }

  function pieceTagBase(item) {
    return `HCT-${item.room_code}-${slugCode(item.item_name || "ITEM")}`;
  }

  function loadProfile() {
    try {
      return { name: "", role: "viewer", assignedRoom: "All", ...JSON.parse(localStorage.getItem("hct-profile") || "{}") };
    } catch {
      return { name: "", role: "viewer", assignedRoom: "All" };
    }
  }

  function loadAuthUser() {
    try {
      return JSON.parse(localStorage.getItem("hct-auth-user") || "null");
    } catch {
      return null;
    }
  }

  function updateProfileFromField(event) {
    state.profile[event.target.dataset.profileField] = event.target.value;
    localStorage.setItem("hct-profile", JSON.stringify(state.profile));
    render();
  }

  function loadLocalData() {
    try {
      return { ...emptyData(), ...JSON.parse(localStorage.getItem("hct-local-data") || "{}") };
    } catch {
      return emptyData();
    }
  }

  function emptyData() {
    return { inventory: [], pieces: [], transactions: [], vr: [], requests: [], requestHistory: [], audit: [], rooms: [] };
  }

  function loadLocalAccounts() {
    try {
      return JSON.parse(localStorage.getItem("hct-local-accounts") || "{}");
    } catch {
      return {};
    }
  }

  function saveLocalAccounts(accounts) {
    localStorage.setItem("hct-local-accounts", JSON.stringify(accounts));
  }

  function saveLocalData() {
    localStorage.setItem("hct-local-data", JSON.stringify(state.data));
  }

  function localInsert(table, row) {
    const key = tableKey(table);
    state.data[key].unshift(row);
    saveLocalData();
  }

  function localUpdate(table, id, payload) {
    const key = tableKey(table);
    const index = state.data[key].findIndex((row) => row.id === id);
    if (index < 0) return null;
    state.data[key][index] = { ...state.data[key][index], ...payload };
    saveLocalData();
    return state.data[key][index];
  }

  function tableKey(table) {
    return Object.keys(TABLES).find((key) => TABLES[key] === table);
  }

  function fail(error) {
    console.warn(error);
    notify(error.message || "Unable to save record.");
    return null;
  }

  function withTimeout(promise, ms, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
    ]);
  }

  function canEditInventory(roomCode) {
    if (!state.authUser) return false;
    if (isAdmin() || state.profile.role === "supply_officer") return true;
    return state.profile.role === "room_custodian" && hasAssignedRoom(roomCode);
  }

  function canEditAnyInventory() {
    return Boolean(state.authUser) && (isAdmin() || state.profile.role === "supply_officer" || state.profile.role === "room_custodian");
  }

  function canTransact(item) {
    return Boolean(state.authUser) && (isAdmin() || state.profile.role === "supply_officer" || canEditInventory(item.room_code));
  }

  function canCreateRequest() {
    return Boolean(state.authUser) && state.profile.role !== "viewer";
  }

  function canManageRequests() {
    return Boolean(state.authUser) && isAdmin();
  }

  function canEditRequest(request) {
    return canManageRequests() || (canCreateRequest() && request.status === "Pending");
  }

  function canManageVr() {
    return Boolean(state.authUser) && (isAdmin() || state.profile.role === "supply_officer" || (state.profile.role === "room_custodian" && hasAssignedRoom("3F-VR")));
  }

  function isAdmin() {
    return state.profile.role === "admin";
  }

  function hasAssignedRoom(roomCode) {
    return state.profile.assignedRoom === "All" || state.profile.assignedRoom === roomCode;
  }

  function getRoom(code) {
    return ROOMS.find((room) => room.code === code);
  }

  function roomLabel(code) {
    if (!code || code === "All") return code || "";
    const room = getRoom(code);
    return room ? `${room.short} - ${room.floor}` : code;
  }

  function profileName() {
    return clean(state.profile.name) || "Guest user";
  }

  function currentRoleLabel() {
    return ROLES.find((role) => role.value === state.profile.role)?.label || "Viewer";
  }

  function sectionHead(title, text, actions) {
    return `<section class="section-head"><div><div class="eyebrow">HCT Institute</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></div><div class="section-actions">${actions || ""}</div></section>`;
  }

  function field(label, control, full) {
    return `<label class="field ${full ? "full" : ""}"><span>${escapeHtml(label)}</span>${control}</label>`;
  }

  function statTile(value, label) {
    return `<div class="stat-tile"><b>${Number(value || 0)}</b><span>${escapeHtml(label)}</span></div>`;
  }

  function miniStat(value, label) {
    return `<div class="stat-pill"><b>${Number(value || 0)}</b><span>${escapeHtml(label)}</span></div>`;
  }

  function barPanel(title, rows) {
    const max = Math.max(1, ...rows.map((row) => row.count));
    return `<div class="mini-panel"><h3>${escapeHtml(title)}</h3><div class="bar-list">${rows.length ? rows.map((row) => `<div class="bar-row"><span>${escapeHtml(row.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (row.count / max) * 100)}%"></div></div><b>${row.count}</b></div>`).join("") : `<p class="muted">No records yet.</p>`}</div></div>`;
  }

  function recentPanel(title, rows, type) {
    return `<div class="mini-panel"><h3>${escapeHtml(title)}</h3>${rows.length ? `<div class="bar-list">${rows.map((row) => `<div><b>${escapeHtml(type === "item" ? row.item_name : row.item_requested)}</b><br><span class="muted">${escapeHtml(type === "item" ? roomLabel(row.room_code) : row.requester_name)} - ${dateTime(type === "item" ? row.last_updated : row.created_at)}</span></div>`).join("")}</div>` : `<p class="muted">No activity yet.</p>`}</div>`;
  }

  function groupCount(rows, key, labeler) {
    const map = new Map();
    rows.forEach((row) => map.set(row[key] || "Unassigned", (map.get(row[key] || "Unassigned") || 0) + 1));
    return Array.from(map, ([label, count]) => ({ label: labeler ? labeler(label) : label, count })).sort((a, b) => b.count - a.count);
  }

  function emptyState(title, text) {
    return `<div class="empty"><div><b>${escapeHtml(title)}</b><span>${escapeHtml(text)}</span></div></div>`;
  }

  function loadingState(title, text) {
    return `<div class="empty"><div><div class="spinner"></div><b>${escapeHtml(title)}</b><span>${escapeHtml(text)}</span></div></div>`;
  }

  function optionHtml(options, selected, labeler) {
    return options.map((option) => {
      const value = Array.isArray(option) ? option[0] : option;
      const label = Array.isArray(option) ? option[1] : (labeler ? labeler(option) : option);
      return `<option value="${escapeAttr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function badge(text) {
    return `<span class="badge">${escapeHtml(text || "")}</span>`;
  }

  function statusBadge(status) {
    const cls = status === "Functional" ? "success" : status === "Not Functional" || status === "Missing" ? "danger" : "warning";
    return `<span class="badge ${cls}">${escapeHtml(status || "")}</span>`;
  }

  function requestBadge(status) {
    const cls = status === "Approved" || status === "Released" ? "success" : status === "Denied" ? "danger" : status === "Returned" ? "violet" : "warning";
    return `<span class="badge ${cls}">${escapeHtml(status || "")}</span>`;
  }

  function priorityBadge(priority) {
    const cls = priority === "Urgent" || priority === "High" ? "danger" : priority === "Medium" ? "warning" : "success";
    return `<span class="badge ${cls}">${escapeHtml(priority || "")}</span>`;
  }

  function itemQrPayload(item) {
    return { type: "inventory_item", id: item?.id, code: item?.asset_tag || item?.id || "", assetTag: item?.asset_tag || "", label: item?.item_name || "Inventory Item", room: roomLabel(item?.room_code), roomCode: item?.room_code || "", url: deepLink("item", item?.id || "") };
  }

  function pieceQrPayload(piece) {
    const item = piece ? findById(state.data.inventory, piece.inventory_item_id) : null;
    return { type: "inventory_piece", id: piece?.id, code: piece?.asset_tag || "", assetTag: piece?.asset_tag || "", label: item?.item_name || "Inventory Piece", serial: piece?.serial_number || "", room: roomLabel(piece?.current_room_code || item?.room_code), roomCode: piece?.current_room_code || item?.room_code || "", url: deepLink("piece", piece?.id || "") };
  }

  function vrQrPayload(asset) {
    return { type: "vr_asset", id: asset?.id, code: asset?.vr_number || "", label: `${asset?.brand || "VR"} ${asset?.model || "Headset"}`.trim(), serial: asset?.vr_serial_number || "", room: roomLabel(asset?.assigned_room_code), roomCode: asset?.assigned_room_code || "", url: deepLink("vr", asset?.id || "") };
  }

  function roomQrPayload(code) {
    return { type: "room_inventory", code, label: code === "ALL" ? "All Inventory" : roomLabel(code), room: code === "ALL" ? "All Rooms" : roomLabel(code), url: deepLink("room", code) };
  }

  function deepLink(key, value) {
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set(key, value);
    return url.href;
  }

  function nextAssetTag(roomCode) {
    const count = activeInventory().filter((item) => item.room_code === roomCode).length + 1;
    return `HCT-${roomCode}-${String(count).padStart(4, "0")}`;
  }

  function nextVrNumber() {
    return `VR-${String(state.data.vr.length + 1).padStart(3, "0")}`;
  }

  function statusAction(oldStatus, newStatus) {
    if (oldStatus === newStatus) return "edited";
    if (newStatus === "Approved") return "approved";
    if (newStatus === "Released") return "released";
    return "edited";
  }

  function toggleTheme() {
    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem("hct-theme", isDark ? "dark" : "light");
    const logo = app.querySelector(".brand-logo");
    if (logo) logo.src = isDark ? "hct-logo-teal.png" : "hct-logo-navy.png";
  }

  function notify(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    playNotificationSound();
    setTimeout(() => toastEl.classList.remove("show"), 3200);
  }

  function dateOnly(value) {
    return value ? new Date(value).toLocaleDateString() : "";
  }

  function dateTime(value) {
    return value ? new Date(value).toLocaleString() : "";
  }

  function dateInput(value) {
    return value ? String(value).slice(0, 10) : "";
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function slugCode(value) {
    return clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 18) || "ITEM";
  }

  function findById(rows, id) {
    return rows.find((row) => row.id === id);
  }

  function shortJson(value) {
    if (!value) return "";
    const text = JSON.stringify(value, null, 2);
    return text.length > 320 ? text.slice(0, 320) + "..." : text;
  }

  function auditSummary(value) {
    if (!value) return "No previous value";
    if (typeof value !== "object") return String(value);
    const labels = [
      ["item_name", "Item"],
      ["asset_tag", "Asset Tag"],
      ["category", "Category"],
      ["quantity", "Quantity"],
      ["unit_measure", "Unit"],
      ["functional_status", "Status"],
      ["room_code", "Room"],
      ["vr_number", "VR Number"],
      ["vr_serial_number", "Serial"],
      ["requester_name", "Requester"],
      ["item_requested", "Requested Item"],
      ["status", "Request Status"],
      ["priority_level", "Priority"],
      ["transaction_type", "Transaction"],
      ["movement", "Movement"],
      ["format", "Format"],
      ["rows", "Rows"]
    ];
    const parts = labels
      .filter(([key]) => value[key] !== undefined && value[key] !== null && value[key] !== "")
      .map(([key, label]) => `${label}: ${key === "room_code" ? roomLabel(value[key]) : value[key]}`);
    if (value.room) parts.push(`Room: ${value.room}`);
    if (!parts.length) return "Record updated";
    return parts.slice(0, 8).join("; ");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function breadcrumbNav() {
    if (!state.authUser) return "";
    const crumbs = [{ label: "Home", view: "home" }];
    if (state.view === "floor") crumbs.push({ label: state.viewArg || "Floor" });
    if (state.view === "room") {
      const room = getRoom(state.viewArg);
      if (room) crumbs.push({ label: room.floor, view: "floor", arg: room.floor }, { label: room.name });
    }
    if (state.view === "all") crumbs.push({ label: "All Inventory" });
    if (state.view === "dashboard") crumbs.push({ label: "Dashboard" });
    if (state.view === "vr") crumbs.push({ label: "VR Registry" });
    if (state.view === "deploymentRequests" || state.view === "requests") crumbs.push({ label: "Deployment Requests" });
    if (state.view === "procurementRequests") crumbs.push({ label: "Procurement Requests" });
    if (state.view === "audit") crumbs.push({ label: "Audit Log" });
    if (state.view === "deleted") crumbs.push({ label: "Restore" });
    if (state.view === "itemDetail") {
      const item = findById(state.data.inventory, state.viewArg);
      crumbs.push({ label: roomLabel(item?.room_code) || "Inventory", view: item?.room_code ? "room" : "all", arg: item?.room_code }, { label: item?.item_name || "Item" });
    }
    if (state.view === "pieceDetail") {
      const piece = findPiece(state.viewArg);
      const item = piece ? findById(state.data.inventory, piece.inventory_item_id) : null;
      crumbs.push({ label: roomLabel(piece?.current_room_code || item?.room_code) || "Inventory", view: item?.room_code ? "room" : "all", arg: piece?.current_room_code || item?.room_code }, { label: piece?.asset_tag || "Piece" });
    }
    if (state.view === "vrDetail") crumbs.push({ label: "VR Registry", view: "vr" }, { label: findById(state.data.vr, state.viewArg)?.vr_number || "VR Asset" });
    return `<nav class="breadcrumbs" aria-label="Breadcrumb">${crumbs.map((crumb, index) => index < crumbs.length - 1 && crumb.view ? `<button data-view="${crumb.view}" ${crumb.arg ? `data-crumb-arg="${escapeAttr(crumb.arg)}"` : ""}>${escapeHtml(crumb.label)}</button>` : `<span>${escapeHtml(crumb.label)}</span>`).join("<span>/</span>")}</nav>`;
  }

  function scannedActionPanel(item, piece) {
    if (!item) return "";
    const moveButton = piece
      ? `<button class="btn primary" data-move-piece="${piece.id}" ${canTransact(item) ? "" : "disabled"}>Move to Another Room</button>`
      : `<button class="btn primary" data-move-scanned-item="${item.id}" ${canTransact(item) ? "" : "disabled"}>Move to Another Room</button>`;
    const cartButton = piece
      ? `<button class="btn success" data-cart-piece="${piece.id}">Add to Deployment Request</button>`
      : `<button class="btn success" data-cart-item="${item.id}">Add to Deployment Request</button>`;
    return `<section class="detail-actions"><div class="action-card"><h3>Item Actions</h3><p class="muted">Move this scanned record or collect it in your personal deployment cart.</p><div class="section-actions">${moveButton}${cartButton}<button class="btn" data-view="deploymentRequests">Open Deployment Requests</button></div></div></section>`;
  }

  function softDeletedPanel(title, rows) {
    return `<div class="mini-panel"><h3>${escapeHtml(title)}</h3>${rows.length ? `<div class="bar-list">${rows.slice(0, 8).map((row) => `<div>${escapeHtml(row)}</div>`).join("")}${rows.length > 8 ? `<p class="muted">+${rows.length - 8} more</p>` : ""}</div>` : `<p class="muted">None.</p>`}</div>`;
  }

  function deploymentCartKey() {
    const userKey = (state.authUser?.email || state.authUser?.name || profileName() || "guest").toLowerCase();
    return `hct-deployment-cart:${userKey}`;
  }

  function deploymentCartCount() {
    return loadDeploymentCart().length || "0";
  }

  function loadDeploymentCart() {
    try { return JSON.parse(localStorage.getItem(deploymentCartKey()) || "[]"); } catch { return []; }
  }

  function saveDeploymentCart(items) {
    localStorage.setItem(deploymentCartKey(), JSON.stringify(items));
  }

  function clearDeploymentCart() {
    localStorage.removeItem(deploymentCartKey());
  }

  function addDeploymentCartItem(nextItem) {
    if (!nextItem?.item_name) return notify("Unable to add this item to the deployment cart.");
    const items = loadDeploymentCart();
    const key = nextItem.inventory_piece_id || nextItem.inventory_item_id || nextItem.asset_tag || nextItem.item_name;
    const existing = items.find((item) => (item.inventory_piece_id || item.inventory_item_id || item.asset_tag || item.item_name) === key);
    if (existing) existing.quantity = Math.max(1, Number(existing.quantity || 1));
    else items.push(nextItem);
    saveDeploymentCart(items);
    notify(`Added to your deployment cart (${items.length} item${items.length === 1 ? "" : "s"}).`);
    render();
  }

  function removeDeploymentCartItem(index) {
    const items = loadDeploymentCart();
    items.splice(index, 1);
    saveDeploymentCart(items);
    closeModal();
    render();
    openDeploymentCartModal();
  }

  function openDeploymentCartModal() {
    const items = loadDeploymentCart();
    openModal("Deployment Cart", `
      <div class="modal-body">
        ${items.length ? `<div class="table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Asset Tag</th><th>Serial</th><th>Room</th><th>Action</th></tr></thead><tbody>${items.map((item, index) => `<tr><td><b>${escapeHtml(item.item_name || "")}</b></td><td>${Number(item.quantity || 0)}</td><td>${escapeHtml(item.asset_tag || "")}</td><td>${escapeHtml(item.serial_number || "")}</td><td>${escapeHtml(roomLabel(item.room_code))}</td><td><button class="btn danger" data-remove-cart-item="${index}">Remove</button></td></tr>`).join("")}</tbody></table></div>` : emptyState("Your deployment cart is empty", "Scan an item QR code, then add it to your deployment cart.")}
      </div>
      <div class="modal-actions">
        <button class="btn" data-close-modal>Close</button>
        <button class="btn" data-print-cart ${items.length ? "" : "disabled"}>Print</button>
        <button class="btn" data-docx-cart ${items.length ? "" : "disabled"}>DOCX</button>
        <button class="btn primary" data-cart-request ${items.length ? "" : "disabled"}>Create Deployment Request</button>
      </div>
    `);
    modalRoot.querySelectorAll("[data-remove-cart-item]").forEach((button) => button.addEventListener("click", () => removeDeploymentCartItem(Number(button.dataset.removeCartItem))));
    modalRoot.querySelector("[data-print-cart]")?.addEventListener("click", () => printDeploymentRequest(cartAsDeploymentRequest()));
    modalRoot.querySelector("[data-docx-cart]")?.addEventListener("click", () => downloadDeploymentRequestDocx(cartAsDeploymentRequest()));
    modalRoot.querySelector("[data-cart-request]")?.addEventListener("click", () => { closeModal(); openRequestModal(null, "Deployment"); });
  }

  function cartAsDeploymentRequest() {
    const items = loadDeploymentCart();
    return {
      id: "deployment-cart",
      requester_name: profileName(),
      department_program: "",
      position: "",
      date_requested: today(),
      designation: "",
      deployment_duration: "",
      immediate_superior: "",
      item_requested: items.map((item) => item.item_name).join(", "),
      quantity_requested: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      request_items: items,
      request_type: "Deployment",
      status: "Pending"
    };
  }

  function addItemToDeploymentCart(item) {
    if (!item) return;
    addDeploymentCartItem({ item_name: item.item_name, quantity: 1, serial_number: item.serial_number || "", asset_tag: item.asset_tag || "", room_code: item.room_code || "", inventory_item_id: item.id, inventory_piece_id: "" });
  }

  function addPieceToDeploymentCart(piece) {
    const item = piece ? findById(state.data.inventory, piece.inventory_item_id) : null;
    if (!piece || !item) return;
    addDeploymentCartItem({ item_name: item.item_name, quantity: 1, serial_number: piece.serial_number || "", asset_tag: piece.asset_tag || item.asset_tag || "", room_code: piece.current_room_code || item.room_code || "", inventory_item_id: item.id, inventory_piece_id: piece.id });
  }

  function addVrToDeploymentCart(asset) {
    if (!asset) return;
    addDeploymentCartItem({ item_name: "VR Headset", quantity: 1, serial_number: asset.vr_serial_number || "", asset_tag: makeVrAssetTag(asset), room_code: asset.assigned_room_code || "3F-VR", inventory_item_id: asset.inventory_item_id || "", inventory_piece_id: asset.inventory_piece_id || "" });
  }

  function openRoomModal(floorName) {
    if (!canManageRooms() || !["5th Floor", "3rd Floor"].includes(floorName)) return;
    openModal(`Add ${floorName} Room`, `
      <form id="room-form" class="modal-body">
        <div class="form-grid">
          ${field("Room Name", `<input name="name" required placeholder="Example: Skills Laboratory">`)}
          ${field("Short Label", `<input name="short" required placeholder="Example: Skills Lab">`)}
          ${field("Room Code", `<input name="code" required placeholder="${floorName === "5th Floor" ? "5F-SKILLS" : "3F-SKILLS"}">`)}
          ${field("Floor", `<input value="${escapeAttr(floorName)}" disabled><input type="hidden" name="floor" value="${escapeAttr(floorName)}">`)}
        </div>
      </form>
      <div class="modal-actions">
        <button class="btn" data-close-modal>Cancel</button>
        <button class="btn primary" form="room-form">Save Room</button>
      </div>
    `, "small");
    document.getElementById("room-form").addEventListener("submit", saveRoom);
  }

  async function saveRoom(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    const floor = form.get("floor");
    const payload = {
      code: slugCode(form.get("code")),
      floor,
      name: clean(form.get("name")),
      short: clean(form.get("short")),
      icon: floor === "5th Floor" ? "&#x1F3E5;" : "&#x2695;",
      updated_at: new Date().toISOString()
    };
    if (!payload.name || !payload.short || !payload.code) return notify("Room name, short label, and code are required.");
    if (!payload.code.startsWith(floor === "5th Floor" ? "5F-" : "3F-")) return notify(`Room code must start with ${floor === "5th Floor" ? "5F-" : "3F-"}.`);
    if (ROOMS.some((room) => room.code === payload.code)) return notify("That room code already exists.");
    const saved = await insertRecord(TABLES.rooms, payload, "created", "room");
    if (saved) { closeModal(); await loadData(); navigate("floor", floor); }
  }

  async function softDeleteRequest(id) {
    const request = findById(state.data.requests, id);
    if (!request || !canDeleteRequest(request) || !confirm("Delete this request?")) return;
    await updateRecord(TABLES.requests, id, { deleted_at: new Date().toISOString(), deleted_by: profileName(), updated_at: new Date().toISOString() }, "deleted", "request", request);
    await loadData();
    render();
  }

  async function softDeleteVr(id) {
    const asset = findById(state.data.vr, id);
    if (!asset || !canManageVr() || !confirm("Delete this VR headset record?")) return;
    await updateRecord(TABLES.vr, id, { deleted_at: new Date().toISOString(), deleted_by: profileName(), updated_at: new Date().toISOString() }, "deleted", "VR asset", asset);
    if (asset.inventory_item_id) {
      const item = findById(state.data.inventory, asset.inventory_item_id);
      if (item) await updateRecord(TABLES.inventory, item.id, { deleted_at: new Date().toISOString(), deleted_by: profileName(), last_updated: new Date().toISOString() }, "deleted", "inventory item", item, { movement: "VR asset deleted" });
    }
    await loadData();
    render();
  }

  async function purgeSoftDeletes() {
    if (!isAdmin() || !confirm("Permanently delete all soft-deleted records? This cannot be undone.")) return;
    const deletedPieces = state.data.pieces.filter((piece) => piece.deleted_at);
    const deletedVr = state.data.vr.filter((asset) => asset.deleted_at);
    const deletedRequests = state.data.requests.filter((request) => request.deleted_at);
    const deletedInventory = state.data.inventory.filter((item) => item.deleted_at);
    for (const piece of deletedPieces) await hardDeleteRecord(TABLES.pieces, piece.id, "inventory piece", piece);
    for (const asset of deletedVr) await hardDeleteRecord(TABLES.vr, asset.id, "VR asset", asset);
    for (const request of deletedRequests) await hardDeleteRecord(TABLES.requests, request.id, "request", request);
    for (const item of deletedInventory) await hardDeleteRecord(TABLES.inventory, item.id, "inventory item", item);
    await loadData();
    render();
    notify("Soft-deleted records were permanently deleted.");
  }

  async function hardDeleteRecord(table, id, recordType, oldValue) {
    if (state.supabase && state.dbReady) {
      const { error } = await state.supabase.from(table).delete().eq("id", id);
      if (error) return fail(error);
    } else {
      localDelete(table, id);
    }
    await logAudit("purged", recordType, id, oldValue || null, { purged: true, item_name: oldValue?.item_name, asset_tag: oldValue?.asset_tag, requester_name: oldValue?.requester_name, vr_number: oldValue?.vr_number });
    return true;
  }

  function localDelete(table, id) {
    const key = tableKey(table);
    state.data[key] = state.data[key].filter((row) => row.id !== id);
    saveLocalData();
  }

  function tableLabel(table) {
    return ({
      [TABLES.inventory]: "Inventory",
      [TABLES.pieces]: "Inventory piece",
      [TABLES.transactions]: "Transaction",
      [TABLES.vr]: "VR registry",
      [TABLES.requests]: "Request",
      [TABLES.requestHistory]: "Request history",
      [TABLES.audit]: "Audit log",
      [TABLES.rooms]: "Room list"
    })[table] || "Record";
  }

  function recordChangeMessage(action, recordType) {
    const label = recordType ? recordType.charAt(0).toUpperCase() + recordType.slice(1) : "Record";
    return `${label} ${action}.`;
  }

  function activeRequests() {
    return (state.data.requests || []).filter((request) => !request.deleted_at);
  }

  function currentRequestType() {
    if (state.view === "procurementRequests") return "Procurement";
    return "Deployment";
  }

  function canManageRooms() {
    return Boolean(state.authUser) && (isAdmin() || state.profile.role === "supply_officer");
  }

  function canDeleteRequest(request) {
    return canManageRequests() || (canCreateRequest() && request.status === "Pending");
  }

  async function markApprovedDeploymentItems(request) {
    const destination = clean(request.designation) || "approved deployment";
    const duration = clean(request.deployment_duration);
    const requester = clean(request.requester_name);
    const note = `Deployed to ${destination}${duration ? ` for ${duration}` : ""}${requester ? `; requester: ${requester}` : ""}`;
    for (const requestItem of parseRequestItems(request)) {
      if (requestItem.inventory_piece_id) {
        const piece = findPiece(requestItem.inventory_piece_id);
        if (piece) await updateRecord(TABLES.pieces, piece.id, { remarks: appendUniqueRemark(piece.remarks, note), updated_at: new Date().toISOString() }, "edited", "inventory piece", piece, { movement: "Deployment approved" });
        continue;
      }
      if (requestItem.inventory_item_id) {
        const item = findById(state.data.inventory, requestItem.inventory_item_id);
        if (item) await updateRecord(TABLES.inventory, item.id, { remarks: appendUniqueRemark(item.remarks, note), last_updated: new Date().toISOString() }, "edited", "inventory item", item, { movement: "Deployment approved" });
      }
    }
  }

  function appendUniqueRemark(current, note) {
    const text = clean(current);
    if (!note || text.includes(note)) return text;
    return [text, note].filter(Boolean).join(" | ");
  }

  function scopedInventoryRow(item, roomCode) {
    if (!roomCode || item.virtual_vr_asset) return item.room_code === roomCode ? item : null;
    const pieces = inventoryPieces(item);
    if (!pieces.length) return item.room_code === roomCode ? item : null;
    const roomPieces = pieces.filter((piece) => (piece.current_room_code || item.room_code) === roomCode);
    if (!roomPieces.length) return null;
    const room = getRoom(roomCode);
    return { ...item, _display_room_code: roomCode, _display_quantity: roomPieces.length, _visible_pieces: roomPieces, room_name: room?.name || item.room_name, floor_name: room?.floor || item.floor_name, location_detail: room?.name || item.location_detail };
  }

  function playNotificationSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      notificationAudioContext = notificationAudioContext || new AudioContext();
      const ctx = notificationAudioContext;
      if (ctx.state === "suspended") ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.17);
    } catch (error) { console.warn(error); }
  }

  function escapeXml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]));
    
  }
  function activeFilterFocus() {
    const el = document.activeElement;
    if (!el?.dataset?.filter) return null;
    return { filter: el.dataset.filter, selectionStart: el.selectionStart, selectionEnd: el.selectionEnd };
  }

  function restoreFilterFocus(focus) {
    if (!focus?.filter) return;
    const el = app.querySelector(`[data-filter="${focus.filter}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    if (typeof el.setSelectionRange === "function" && el.type !== "select-one") {
      const start = focus.selectionStart ?? el.value.length;
      el.setSelectionRange(start, focus.selectionEnd ?? start);
    }
  }
})();
