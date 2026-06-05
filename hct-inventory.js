(function () {
  "use strict";

  const TABLES = {
    inventory: "hct_inventory_items",
    pieces: "hct_inventory_pieces",
    transactions: "hct_inventory_transactions",
    vr: "hct_vr_assets",
    requests: "hct_requests",
    requestHistory: "hct_request_history",
    audit: "hct_audit_logs"
  };

  const ROOMS = [
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
      audit: []
    },
    filters: {
      search: "",
      category: "All",
      status: "All",
      sort: "last_updated_desc",
      requestStatus: "All"
    }
  };

  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastEl = document.getElementById("toast");

  init();

  async function init() {
    document.body.classList.toggle("dark", localStorage.getItem("hct-theme") === "dark");
    initSupabase();
    await loadAuthSession();
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
    } catch (error) {
      console.warn(error);
    }
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

    if (state.supabase?.auth) {
      try {
        const result = mode === "signup"
          ? await state.supabase.auth.signUp({ email, password, options: { data: { name, role, assignedRoom } } })
          : await state.supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        if (result.data?.user) applyAuthUser(result.data.user, { name, role, assignedRoom });
        notify(mode === "signup" ? "Account created. Check email confirmation if Supabase requires it." : "Logged in.");
        navigate("home");
        return;
      } catch (error) {
        notify(error.message || "Supabase Auth is not ready. Saving local profile instead.");
      }
    }

    state.authUser = { email, name };
    state.profile = { ...state.profile, name, role, assignedRoom };
    localStorage.setItem("hct-auth-user", JSON.stringify(state.authUser));
    localStorage.setItem("hct-profile", JSON.stringify(state.profile));
    notify(mode === "signup" ? "Local account profile created." : "Logged in locally.");
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
    navigate("home");
  }

  async function loadData() {
    state.loading = true;
    if (!state.supabase) {
      state.data = loadLocalData();
      state.loading = false;
      return;
    }

    try {
      const [inventory, pieces, transactions, vr, requests, requestHistory, audit] = await withTimeout(Promise.all([
        state.supabase.from(TABLES.inventory).select("*").order("last_updated", { ascending: false }),
        state.supabase.from(TABLES.pieces).select("*").order("piece_number", { ascending: true }),
        state.supabase.from(TABLES.transactions).select("*").order("created_at", { ascending: false }),
        state.supabase.from(TABLES.vr).select("*").order("updated_at", { ascending: false }),
        state.supabase.from(TABLES.requests).select("*").order("created_at", { ascending: false }),
        state.supabase.from(TABLES.requestHistory).select("*").order("created_at", { ascending: false }),
        state.supabase.from(TABLES.audit).select("*").order("created_at", { ascending: false }).limit(300)
      ]), 3500, "Supabase connection timed out");
      const errored = [inventory, pieces, transactions, vr, requests, requestHistory, audit].find((result) => result.error);
      if (errored) throw errored.error;
      state.data.inventory = inventory.data || [];
      state.data.pieces = pieces.data || [];
      state.data.transactions = transactions.data || [];
      state.data.vr = vr.data || [];
      state.data.requests = requests.data || [];
      state.data.requestHistory = requestHistory.data || [];
      state.data.audit = audit.data || [];
      state.dbReady = true;
    } catch (error) {
      state.dbReady = false;
      state.data = loadLocalData();
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
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => loadData().then(render));
    });
    state.channel = channel.subscribe();
  }

  function render() {
    app.innerHTML = `
      ${topbar()}
      <main class="page">
        ${state.loading ? emptyState("Loading inventory system", "Fetching shared records.") : route()}
      </main>
    `;
    bindGlobalEvents();
    bindViewEvents();
  }

  function topbar() {
    const navItems = [
      ["home", "Home"],
      ["dashboard", "Dashboard"],
      ["all", "All Inventory"],
      ["vr", "VR Registry"],
      ["requests", "Requests"],
      ["audit", "Audit Log"],
      ["deleted", "Restore"]
    ];
    const dbText = state.dbReady ? "Cloud sync active" : "Local preview";
    const authText = state.authUser ? escapeHtml(state.authUser.email || state.authUser.name || "Signed in") : "Guest access";
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
          ${state.authUser ? `<button data-sign-out>Sign Out</button>` : `<button class="${state.view === "login" ? "active" : ""}" data-view="login">Login</button><button class="${state.view === "signup" ? "active" : ""}" data-view="signup">Sign Up</button>`}
        </nav>
        <div class="top-actions">
          <button class="icon-button" data-profile title="Access profile">&#x263A;</button>
          <button class="icon-button" data-theme title="Toggle dark mode">&#x25D0;</button>
        </div>
      </header>
    `;
  }

  function route() {
    if (state.view === "home") return homeView();
    if (state.view === "floor") return floorView(state.viewArg);
    if (state.view === "room") return inventoryView(state.viewArg);
    if (state.view === "all") return inventoryView(null);
    if (state.view === "dashboard") return dashboardView();
    if (state.view === "vr") return vrView();
    if (state.view === "itemDetail") return itemDetailView(state.viewArg);
    if (state.view === "pieceDetail") return pieceDetailView(state.viewArg);
    if (state.view === "vrDetail") return vrDetailView(state.viewArg);
    if (state.view === "requests") return requestsView();
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
          <h2>Shared healthcare simulation inventory.</h2>
          <p>Open the website from any device to view records, submit requests, track stock movement, print QR labels, and monitor equipment status in real time.</p>
        </div>
        ${profileCard()}
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
    `;
  }

  function vrDetailView(id) {
    const asset = findById(state.data.vr, id);
    if (!asset) return sectionHead("VR Asset Not Found", "The scanned VR asset could not be found in the current database.", `<button class="btn" data-view="home">Home</button>`);
    return `
      ${sectionHead(asset.vr_number, "Scanned VR asset record.", `<button class="btn" data-room="${asset.assigned_room_code}">Open Room</button><button class="btn primary" data-qr-vr="${asset.id}">Print Label</button>`)}
      <section class="analytics-grid">
        <div class="mini-panel"><h3>VR Details</h3><p><b>VR Number:</b> ${escapeHtml(asset.vr_number)}</p><p><b>Serial Number:</b> ${escapeHtml(asset.vr_serial_number || "")}</p><p><b>Room:</b> ${escapeHtml(roomLabel(asset.assigned_room_code))}</p><p><b>Status:</b> ${statusBadge(asset.functional_status)}</p></div>
        <div class="mini-panel"><h3>Device</h3><p><b>Brand:</b> ${escapeHtml(asset.brand || "")}</p><p><b>Model:</b> ${escapeHtml(asset.model || "")}</p><p><b>Last Maintenance:</b> ${dateOnly(asset.last_maintenance_date)}</p><p>${escapeHtml(asset.notes || "")}</p></div>
      </section>
    `;
  }

  function floorView(floorName) {
    const rooms = ROOMS.filter((room) => room.floor === floorName);
    return `
      ${sectionHead(floorName, "Select a room to open its dedicated inventory page.", `<button class="btn" data-view="home">Back</button>`)}
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
    const requests = state.data.requests;
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

  function requestsView() {
    const requests = filteredRequests();
    const canCreate = canCreateRequest();
    return `
      ${sectionHead("Deployment Requests", "Request multiple inventory items in one deployment cart. Admin approval is required before release.", `<button class="btn" data-export="requests">Excel</button><button class="btn" data-pdf="requests">PDF</button><button class="btn primary" data-add-request ${canCreate ? "" : "disabled"}>New Request</button>`)}
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
    return `
      ${sectionHead("Deleted Inventory", "Soft-deleted inventory records can be restored by an Admin.", "")}
      <section class="panel">
        ${rows.length ? inventoryTable(rows, false, true) : emptyState("No deleted records", "Deleted inventory will appear here for restore review.")}
      </section>
    `;
  }

  function profileCard() {
    return `
      <aside class="profile-card">
        <h3>Access profile</h3>
        <div class="form-grid">
          <label class="field full"><span>Name</span><input data-profile-field="name" value="${escapeAttr(state.profile.name)}" placeholder="Guest user"></label>
          <label class="field full"><span>Role</span><select data-profile-field="role">${ROLES.map((role) => `<option value="${role.value}" ${role.value === state.profile.role ? "selected" : ""}>${role.label}</option>`).join("")}</select></label>
          <label class="field full"><span>Assigned room</span><select data-profile-field="assignedRoom">${optionHtml(["All"].concat(ROOMS.map((room) => room.code)), state.profile.assignedRoom, roomLabel)}</select></label>
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
                  <button class="btn" data-qr-item="${item.id}">QR</button>
                  ${deletedMode ? `<button class="btn success" data-restore-item="${item.id}" ${isAdmin() ? "" : "disabled"}>Restore</button>` : ""}
                  ${showActions ? `<button class="btn success" data-add-stock="${item.id}" ${canTransact(item) ? "" : "disabled"}>Add Stock</button><button class="btn" data-transaction="${item.id}" ${canTransact(item) ? "" : "disabled"}>Move</button><button class="btn" data-edit-item="${item.id}" ${canEditInventory(item.room_code) ? "" : "disabled"}>Edit</button><button class="btn danger" data-delete-item="${item.id}" ${isAdmin() ? "" : "disabled"}>Delete</button>` : ""}
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
              <td class="table-actions"><button class="btn" data-qr-vr="${row.id}">QR</button><button class="btn" data-edit-vr="${row.id}" ${canManageVr() ? "" : "disabled"}>Edit</button></td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function requestsTable(rows) {
    return `
      <div class="table-wrap">
        <table data-table="requests">
          <thead><tr><th>Requester</th><th>Department</th><th>Designation</th><th>Items</th><th>Qty</th><th>Status</th><th>Date</th><th>Superior</th><th>Actions</th></tr></thead>
          <tbody>${rows.map((row) => `
            <tr>
              <td><b>${escapeHtml(row.requester_name)}</b></td>
              <td>${escapeHtml(row.department_program || "")}</td>
              <td>${escapeHtml(row.designation || "")}</td>
              <td>${requestItemsSummary(row)}</td>
              <td>${Number(row.quantity_requested || 0)}</td>
              <td>${requestBadge(row.status)}</td>
              <td>${dateOnly(row.date_requested)}</td>
              <td>${escapeHtml(row.immediate_superior || "")}</td>
              <td class="table-actions"><button class="btn" data-print-request="${row.id}">Print</button><button class="btn" data-history-request="${row.id}">History</button><button class="btn" data-edit-request="${row.id}" ${canEditRequest(row) ? "" : "disabled"}>Edit</button></td>
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
    app.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.view)));
    app.querySelector("[data-theme]")?.addEventListener("click", toggleTheme);
    app.querySelector("[data-profile]")?.addEventListener("click", openProfileModal);
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
    app.querySelectorAll("[data-add-request]").forEach((el) => el.addEventListener("click", () => openRequestModal()));
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
          <div class="field full"><span>VR Headset Tracking</span><p class="muted">Complete these fields when the inventory item is an individual VR Headset.</p></div>
          ${field("VR Number", `<input name="vr_number" value="${escapeAttr(linkedVr?.vr_number || "")}" placeholder="VR-001">`)}
          ${field("VR Serial Number", `<input name="vr_serial_number" value="${escapeAttr(linkedVr?.vr_serial_number || "")}">`)}
          ${field("Brand", `<input name="vr_brand" value="${escapeAttr(linkedVr?.brand || "")}">`)}
          ${field("Model", `<input name="vr_model" value="${escapeAttr(linkedVr?.model || "")}">`)}
          ${field("Last Maintenance Date", `<input type="date" name="vr_last_maintenance_date" value="${escapeAttr(dateInput(linkedVr?.last_maintenance_date) || "")}">`)}
          ${field("VR Notes", `<textarea name="vr_notes">${escapeHtml(linkedVr?.notes || "")}</textarea>`, true)}
        </div>
      </form>
      <div class="modal-actions">
        <button class="btn" data-close-modal>Cancel</button>
        <button class="btn primary" form="inventory-form">Save</button>
      </div>
    `);
    document.getElementById("inventory-form").addEventListener("submit", (event) => saveInventory(event, item));
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

  function requestItemRow(item = {}) {
    return `
      <div class="request-cart-row" data-request-row>
        <input name="request_item_name" required value="${escapeAttr(item.item_name || "")}" placeholder="Item to be requested">
        <input type="number" min="1" step="1" name="request_item_quantity" required value="${escapeAttr(item.quantity || 1)}" aria-label="Quantity">
        <input name="request_item_serial" value="${escapeAttr(item.serial_number || "")}" placeholder="Serial number for VR">
        <input name="request_item_asset" value="${escapeAttr(item.asset_tag || "")}" placeholder="Asset tag">
        <button class="btn danger" type="button" data-remove-request-row>Delete</button>
      </div>
    `;
  }

  function addRequestItemRow(item) {
    const container = modalRoot.querySelector("[data-request-items]");
    if (!container) return;
    container.insertAdjacentHTML("beforeend", requestItemRow(item));
    container.lastElementChild?.querySelector("[data-remove-request-row]")?.addEventListener("click", (event) => removeRequestItemRow(event.currentTarget));
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
      asset_tag: clean(row.querySelector('[name="request_item_asset"]')?.value)
    })).filter((item) => item.item_name && item.quantity > 0);
  }

  function parseRequestItems(request) {
    if (Array.isArray(request?.request_items) && request.request_items.length) return request.request_items;
    return [{
      item_name: request?.item_requested || "",
      quantity: Number(request?.quantity_requested || 1),
      serial_number: request?.serial_number || "",
      asset_tag: request?.asset_tag || ""
    }];
  }

  function requestItemsSummary(request) {
    const items = parseRequestItems(request).filter((item) => item.item_name);
    return items.length ? items.map((item) => `<div><b>${escapeHtml(item.item_name)}</b><br><span class="muted">Qty ${Number(item.quantity || 0)}${item.serial_number ? ` - SN ${escapeHtml(item.serial_number)}` : ""}${item.asset_tag ? ` - ${escapeHtml(item.asset_tag)}` : ""}</span></div>`).join("") : escapeHtml(request.item_requested || "");
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

  async function receiveTransfer(item, quantity, destinationRoomCode) {
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
        asset_tag: nextAssetTag(room.code),
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
    const destinationItem = await receiveTransfer(item, quantity, destinationRoomCode);
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

  function openRequestModal(request) {
    const items = parseRequestItems(request);
    openModal(`${request ? "Edit" : "New"} Request`, `
      <form id="request-form" class="modal-body">
        <div class="form-grid">
          ${field("Requester Name", `<input name="requester_name" required value="${escapeAttr(request?.requester_name || profileName())}">`)}
          ${field("Department/Program", `<input name="department_program" required value="${escapeAttr(request?.department_program || "Education")}">`)}
          ${field("Position", `<input name="position" required value="${escapeAttr(request?.position || "Simulationist")}">`)}
          ${field("Date Requested", `<input type="date" name="date_requested" value="${escapeAttr(dateInput(request?.date_requested) || today())}">`)}
          ${field("Designation", `<input name="designation" required value="${escapeAttr(request?.designation || "")}" placeholder="Deployment area or activity">`)}
          ${field("Immediate Superior", `<input name="immediate_superior" required value="${escapeAttr(request?.immediate_superior || "")}">`)}
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
    modalRoot.querySelectorAll("[data-remove-request-row]").forEach((button) => button.addEventListener("click", () => removeRequestItemRow(button)));
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
      immediate_superior: clean(form.get("immediate_superior")),
      item_requested: requestItems.map((item) => item.item_name).join(", "),
      quantity_requested: quantity,
      request_items: requestItems,
      reason: clean(form.get("designation")) || "Deployment request",
      priority_level: "Medium",
      status: isAdmin() ? form.get("status") : (existing?.status || "Pending"),
      updated_at: new Date().toISOString()
    };
    let saved;
    if (existing) saved = await updateRecord(TABLES.requests, existing.id, payload, statusAction(existing.status, payload.status), "request", existing);
    else saved = await insertRecord(TABLES.requests, payload, "created", "request");
    if (saved) await addRequestHistory(saved.id, existing?.status || null, payload.status, payload.reason);
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
    const assetTag = `HCT-${room.code}-${slugCode(vrPayload.vr_number || "VR")}`;
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
      return data;
    }
    const data = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...enriched };
    localInsert(table, data);
    if (audit) await logAudit(action, recordType, data.id, null, data);
    return data;
  }

  async function updateRecord(table, id, payload, action, recordType, oldValue, extraNewValue) {
    const enriched = { ...payload, updated_by: profileName() };
    if (state.supabase && state.dbReady) {
      const { data, error } = await state.supabase.from(table).update(enriched).eq("id", id).select().single();
      if (error) return fail(error);
      await logAudit(action, recordType, id, oldValue || null, { ...data, ...(extraNewValue || {}) });
      return data;
    }
    const data = localUpdate(table, id, enriched);
    await logAudit(action, recordType, id, oldValue || null, { ...data, ...(extraNewValue || {}) });
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
    modalRoot.innerHTML = "";
  }

  function exportView(kind) {
    const rows = exportRows(kind);
    if (!rows.length) return notify("Nothing to export yet.");
    const html = `<table>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? ""))}</td>`).join("")}</tr>`).join("")}</table>`;
    downloadBlob(`${kind}-${today()}.xls`, html, "application/vnd.ms-excel");
    logAudit("exported", kind, kind, null, { rows: rows.length });
    notify("Excel export created.");
  }

  function exportPdf(kind) {
    const rows = exportRows(kind);
    if (!rows.length) return notify("Nothing to export yet.");
    const win = window.open("", "_blank");
    if (!win) return notify("Allow popups to print PDF.");
    win.document.write(`<html><head><title>HCT ${kind}</title><style>body{font-family:Arial,sans-serif}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;font-size:12px}</style></head><body><h1>HCT ${kind}</h1><table>${rows.map((row, index) => {
      const tag = index ? "td" : "th";
      return `<tr>${row.map((cell) => `<${tag}>${escapeHtml(String(cell ?? ""))}</${tag}>`).join("")}</tr>`;
    }).join("")}</table><script>print()</script></body></html>`);
    win.document.close();
    logAudit("exported", kind, kind, null, { rows: rows.length, format: "pdf" });
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
    logAudit("exported", "room report", roomCode, null, { room: room?.name || roomCode, rows: rows.length, format: "print" });
  }

  function printDeploymentRequest(request) {
    if (!request) return;
    const items = parseRequestItems(request);
    const logoUrl = new URL("hct-logo-navy.png", location.href).href;
    const win = window.open("", "_blank");
    if (!win) return notify("Allow popups to print deployment reports.");
    win.document.write(`
      <html><head><title>Employee Accountability Form</title>
      <style>
        body{font-family:Arial,sans-serif;margin:32px;color:#111827}
        .sheet{max-width:900px;margin:0 auto}
        header{display:grid;grid-template-columns:72px 1fr;gap:14px;align-items:center;border-bottom:3px solid #14213d;padding-bottom:12px;margin-bottom:18px}
        header img{width:64px;height:64px;object-fit:contain}
        h1{margin:0;text-align:center;font-size:22px;letter-spacing:.04em;text-transform:uppercase}
        .meta{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:16px 0}
        .fieldline{border:1px solid #9ca3af;padding:8px 10px;min-height:38px}
        .fieldline b{display:inline-block;min-width:140px;color:#374151}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid #9ca3af;padding:8px;text-align:left;font-size:13px}
        th{background:#eef7f5;text-transform:uppercase;font-size:12px}
        .signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:46px;text-align:center}
        .sig{border-top:1px solid #111827;padding-top:8px;font-size:12px}
        @media print{body{margin:18px}.sheet{max-width:none}}
      </style></head><body><div class="sheet">
      <header><img src="${logoUrl}" alt="HCT Institute"><h1>Employee Accountability Form</h1></header>
      <div class="meta">
        <div class="fieldline"><b>Name:</b> ${escapeHtml(request.requester_name || "")}</div>
        <div class="fieldline"><b>Date:</b> ${escapeHtml(dateOnly(request.date_requested))}</div>
        <div class="fieldline"><b>Department:</b> ${escapeHtml(request.department_program || "Education")}</div>
        <div class="fieldline"><b>Position:</b> ${escapeHtml(request.position || "Simulationist")}</div>
        <div class="fieldline"><b>Designation:</b> ${escapeHtml(request.designation || "")}</div>
        <div class="fieldline"><b>Immediate Superior:</b> ${escapeHtml(request.immediate_superior || "")}</div>
      </div>
      <table><thead><tr><th>Asset Tag</th><th>Item</th><th>Quantity</th><th>Serial Number</th></tr></thead>
      <tbody>${items.map((item) => `<tr><td>${escapeHtml(item.asset_tag || "")}</td><td>${escapeHtml(item.item_name || "")}</td><td>${Number(item.quantity || 0)}</td><td>${escapeHtml(item.serial_number || "")}</td></tr>`).join("")}</tbody></table>
      <div class="signatures"><div class="sig">Employee Signature</div><div class="sig">Immediate Superior</div><div class="sig">Approved By</div></div>
      </div><script>print()</script></body></html>
    `);
    win.document.close();
    logAudit("exported", "deployment request", request.id, null, { rows: items.length, format: "print" });
  }

  function exportRows(kind) {
    if (kind === "inventory") return [["Item", "Category", "Quantity", "Unit", "Status", "Room", "Asset Tag", "Date Added", "Last Updated", "Remarks"]].concat(filteredInventory(state.view === "room" ? state.viewArg : null, false).map((item) => [item.item_name, item.category, item.quantity, item.unit_measure, item.functional_status, roomLabel(item.room_code), item.asset_tag, dateOnly(item.date_added), dateTime(item.last_updated), item.remarks]));
    if (kind === "vr") return [["VR Number", "Serial", "Brand", "Model", "Room", "Status", "Maintenance", "Notes"]].concat(filteredVr().map((row) => [row.vr_number, row.vr_serial_number, row.brand, row.model, roomLabel(row.assigned_room_code), row.functional_status, dateOnly(row.last_maintenance_date), row.notes]));
    if (kind === "requests") return [["Requester", "Department", "Position", "Designation", "Superior", "Items", "Quantity", "Status", "Date"]].concat(filteredRequests().map((row) => [row.requester_name, row.department_program, row.position, row.designation, row.immediate_superior, parseRequestItems(row).map((item) => `${item.item_name} x${item.quantity}`).join("; "), row.quantity_requested, row.status, dateOnly(row.date_requested)]));
    if (kind === "audit") return [["Action", "Record Type", "Changed By", "Timestamp", "Old Value", "New Value"]].concat(state.data.audit.map((row) => [row.action_type, row.record_type, row.changed_by, dateTime(row.created_at), shortJson(row.old_value), shortJson(row.new_value)]));
    return [["Metric", "Value"], ["Inventory Items", activeInventory().length], ["Requests", state.data.requests.length], ["VR Assets", state.data.vr.length]];
  }

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function filteredInventory(roomCode, includeDeleted) {
    let rows = includeDeleted ? state.data.inventory.slice() : activeInventory();
    if (roomCode) rows = rows.filter((item) => item.room_code === roomCode);
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
    return state.data.vr.filter((row) => {
      const matchesTerm = !term || [row.vr_number, row.vr_serial_number, row.brand, row.model].some((value) => String(value || "").toLowerCase().includes(term));
      const matchesStatus = state.filters.status === "All" || row.functional_status === state.filters.status;
      return matchesTerm && matchesStatus;
    });
  }

  function filteredRequests() {
    const term = state.filters.search.toLowerCase();
    return state.data.requests.filter((row) => {
      const matchesTerm = !term || [row.requester_name, row.department_program, row.position, row.designation, row.immediate_superior, row.item_requested, row.reason, parseRequestItems(row).map((item) => `${item.item_name} ${item.asset_tag} ${item.serial_number}`).join(" ")].some((value) => String(value || "").toLowerCase().includes(term));
      const matchesStatus = state.filters.requestStatus === "All" || row.status === state.filters.requestStatus;
      return matchesTerm && matchesStatus;
    });
  }

  function activeInventory() {
    return state.data.inventory.filter((item) => !item.deleted_at);
  }

  function activePieces() {
    return (state.data.pieces || []).filter((piece) => !piece.deleted_at);
  }

  function inventoryPieces(item) {
    if (!item) return [];
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
      return { inventory: [], pieces: [], transactions: [], vr: [], requests: [], requestHistory: [], audit: [], ...JSON.parse(localStorage.getItem("hct-local-data") || "{}") };
    } catch {
      return { inventory: [], pieces: [], transactions: [], vr: [], requests: [], requestHistory: [], audit: [] };
    }
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
    return ["admin", "supply_officer", "room_custodian"].includes(state.profile.role);
  }

  function canEditAnyInventory() {
    return isAdmin() || state.profile.role === "supply_officer" || state.profile.role === "room_custodian";
  }

  function canTransact(item) {
    return isAdmin() || state.profile.role === "supply_officer" || canEditInventory(item.room_code);
  }

  function canCreateRequest() {
    return state.profile.role !== "viewer";
  }

  function canManageRequests() {
    return isAdmin();
  }

  function canEditRequest(request) {
    return canManageRequests() || (canCreateRequest() && request.status === "Pending");
  }

  function canManageVr() {
    return isAdmin() || state.profile.role === "room_custodian" || state.profile.role === "supply_officer";
  }

  function isAdmin() {
    return state.profile.role === "admin";
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
    document.body.classList.toggle("dark");
    localStorage.setItem("hct-theme", document.body.classList.contains("dark") ? "dark" : "light");
  }

  function notify(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
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
})();
