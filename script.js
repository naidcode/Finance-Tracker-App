// ========== TRANSACTION MODEL ==========
class Transaction {
  constructor(description, type, account, category, amount) {
    this.id = Date.now() + Math.random();
    this.amount = parseFloat(amount);
    this.description = description;
    this.type = type;
    this.category = category;
    this.account = account;
    this.date = new Date().toLocaleDateString();
  }
}

// ========== REAL MANAGER (Business Logic) ==========
class TransactionManager {
  #transaction = [];

  constructor() {
    this.loadlocalStorage();
  }

  AddTransaction(description, type, account, category, amount) {
    const t = new Transaction(description, type, account, category, amount);
    this.#transaction.push(t);
    return t;
  }

  deleteTransaction(id) {
    this.#transaction = this.#transaction.filter(d => d.id !== id);
  }

  calculateIncome() {
    return this.#transaction
      .filter(f => f.type === "income")
      .reduce((sum, f) => sum + f.amount, 0);
  }

  calculateExpense() {
    return this.#transaction
      .filter(f => f.type === "expense")
      .reduce((sum, f) => sum + f.amount, 0);
  }

  netBalance() {
    return this.calculateIncome() - this.calculateExpense();
  }

  filterTransaction(filter) {
    const transaction = this.getTransaction();
    if (filter === "income") return transaction.filter(f => f.type === "income");
    if (filter === "expense") return transaction.filter(f => f.type === "expense");
    return transaction;
  }

  getTransaction() {
    return [...this.#transaction];
  }

  saveLocalstorage() {
    try {
      localStorage.setItem("transaction", JSON.stringify(this.#transaction));
    } catch (e) {
      console.warn("saveLocalstorage failed", e);
    }
  }

  loadlocalStorage() {
    let data = localStorage.getItem("transaction");
    if (data) {
      try {
        this.#transaction = JSON.parse(data) || [];
      } catch {
        this.#transaction = [];
      }
    }
  }
}

// ========== PROXY 1: VALIDATION + AUTO-SAVE ==========
class ValidationProxy {
  constructor(realManager, auditLog) {
    this.real = realManager;
    this.auditLog = auditLog;
    this.onChange = null; // UI callback
  }

  _afterMutate() {
    // Auto-save
    if (typeof this.real.saveLocalstorage === "function") {
      try { 
        this.real.saveLocalstorage(); 
        this._logSuccess("Auto-saved to localStorage");
      } catch (e) { 
        this._logError(`Auto-save failed: ${e.message}`);
      }
    }
    // Notify UI
    if (typeof this.onChange === "function") {
      try { this.onChange(); } catch (e) { console.warn("onChange failed", e); }
    }
  }

  _logError(message) {
    this.auditLog.push({
      type: "error",
      icon: "⚠️",
      message: message,
      timestamp: new Date().toLocaleTimeString()
    });
    console.error(`[VALIDATION] ${message}`);
  }

  _logSuccess(message) {
    this.auditLog.push({
      type: "success",
      icon: "✅",
      message: message,
      timestamp: new Date().toLocaleTimeString()
    });
    console.log(`[VALIDATION] ${message}`);
  }

  AddTransaction(description, type, account, category, amount) {
    // Validation 1: Amount
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount)) {
      this._logError(`Invalid amount: "${amount}"`);
      throw new Error("Amount must be a valid number");
    }
    if (numAmount <= 0) {
      this._logError(`Amount must be positive: ${numAmount}`);
      throw new Error("Amount must be greater than 0");
    }

    // Validation 2: Description
    if (!description || description.trim() === "") {
      this._logError("Description is empty");
      throw new Error("Description is required");
    }

    // Validation 3: Type
    if (!type || (type !== "income" && type !== "expense")) {
      this._logError(`Invalid type: "${type}"`);
      throw new Error("Type must be 'income' or 'expense'");
    }

    // Validation 4: Category
    if (!category || category.trim() === "") {
      this._logError("Category is empty");
      throw new Error("Category is required");
    }

    // All validations passed!
    this._logSuccess(`Validation passed: ${description} $${numAmount}`);

    const result = this.real.AddTransaction(description, type, account, category, amount);
    this._logSuccess(`Transaction added: ${description} ${type === "income" ? "+" : "-"}$${numAmount}`);
    this._afterMutate();
    return result;
  }

  deleteTransaction(id) {
    if (!id) {
      this._logError("Transaction ID is required");
      throw new Error("ID is required for deletion");
    }

    this._logSuccess(`Deleting transaction ID: ${id}`);
    const result = this.real.deleteTransaction(id);
    this._afterMutate();
    return result;
  }

  // Read-only operations - no validation needed
  calculateIncome() { return this.real.calculateIncome(); }
  calculateExpense() { return this.real.calculateExpense(); }
  netBalance() { return this.real.netBalance(); }
  filterTransaction(filter) { return this.real.filterTransaction(filter); }
  getTransaction() { return this.real.getTransaction(); }
  saveLocalstorage() { return this.real.saveLocalstorage(); }
}

// ========== PROXY 2: CACHING ==========
class CachingProxy {
  constructor(realManager, auditLog) {
    this.real = realManager;
    this.auditLog = auditLog;
    this.cache = new Map();
  }

  _logCache(message) {
    this.auditLog.push({
      type: "cache",
      icon: "🚀",
      message: message,
      timestamp: new Date().toLocaleTimeString()
    });
    console.log(`[CACHE] ${message}`);
  }

  _cacheKeyForFilter(filter) {
    return `filter:${filter}`;
  }

  filterTransaction(filter) {
    const key = this._cacheKeyForFilter(filter);
    if (this.cache.has(key)) {
      this._logCache(`Cache HIT for filter "${filter}"`);
      return [...this.cache.get(key)];
    }
    
    this._logCache(`Cache MISS for filter "${filter}" - calculating...`);
    const result = this.real.filterTransaction(filter);
    this.cache.set(key, result);
    return [...result];
  }

  // Clear cache on mutations
  AddTransaction(...args) {
    this.cache.clear();
    this._logCache("Cache cleared - data changed");
    return this.real.AddTransaction(...args);
  }

  deleteTransaction(id) {
    this.cache.clear();
    this._logCache("Cache cleared - data changed");
    return this.real.deleteTransaction(id);
  }

  // Forward other methods
  calculateIncome() { return this.real.calculateIncome(); }
  calculateExpense() { return this.real.calculateExpense(); }
  netBalance() { return this.real.netBalance(); }
  getTransaction() { return this.real.getTransaction(); }
  saveLocalstorage() { return this.real.saveLocalstorage(); }
  
  // Forward onChange from ValidationProxy
  set onChange(fn) { 
    if (this.real.onChange !== undefined) {
      this.real.onChange = fn; 
    }
  }
}

// ========== PROXY 3: ANALYTICS/LOGGING ==========
class AnalyticsProxy {
  constructor(realManager, auditLog) {
    this.real = realManager;
    this.auditLog = auditLog;
  }

  _logAnalytics(event, meta = {}) {
    this.auditLog.push({
      type: "analytics",
      icon: "📊",
      message: `${event} ${JSON.stringify(meta)}`,
      timestamp: new Date().toLocaleTimeString()
    });
    console.log(`[ANALYTICS] ${event}`, meta);
  }

  AddTransaction(...args) {
    this._logAnalytics("AddTransaction", { args: args.slice(0, 2) }); // First 2 args for brevity
    return this.real.AddTransaction(...args);
  }

  deleteTransaction(id) {
    this._logAnalytics("deleteTransaction", { id });
    return this.real.deleteTransaction(id);
  }

  calculateIncome() {
    this._logAnalytics("calculateIncome");
    return this.real.calculateIncome();
  }

  calculateExpense() {
    this._logAnalytics("calculateExpense");
    return this.real.calculateExpense();
  }

  netBalance() {
    this._logAnalytics("netBalance");
    return this.real.netBalance();
  }

  filterTransaction(filter) {
    this._logAnalytics("filterTransaction", { filter });
    return this.real.filterTransaction(filter);
  }

  getTransaction() {
    this._logAnalytics("getTransaction");
    return this.real.getTransaction();
  }

  saveLocalstorage() {
    this._logAnalytics("saveLocalstorage");
    return this.real.saveLocalstorage();
  }

  // Forward onChange
  set onChange(fn) { 
    if (this.real.onChange !== undefined) {
      this.real.onChange = fn; 
    }
  }
}

// ========== UI RENDERER ==========
class UIRenderer {
  constructor(manager, auditLog) {
    this.manager = manager;
    this.auditLog = auditLog;
  }

  rendertransactionList(filter = "all") {
    let transactionList = document.getElementById("transactionList");
    let filters = this.manager.filterTransaction(filter);

    if (!filters || filters.length === 0) {
      transactionList.innerHTML = `
        <div class="emptyBox" style="text-align: center; padding: 40px; color: #666;">
          <h2>No Transactions ${filter === "all" ? "Yet" : "Here"}</h2>
          <p>${filter === "income" || filter === "expense" ? "No transactions with this type" : "Add your monthly expenses and incomes"}</p>
        </div>
      `;
      return;
    }

    transactionList.innerHTML = filters.map(trans => `
      <div class="transactionListz" style="background-color: ${trans.type === "income" ? "lightgreen" : "tomato"}">
        <span class="spanstyle" style="color: white">${trans.description}</span>
        <span class="spanstyle">${trans.type}</span>
        <p class="parastyle">${trans.account}</p>
        <p class="parastyle">${trans.category}</p>
        <h3 class="h3style">$${trans.amount.toFixed(2)}</h3>
        <span class="datestyle">${trans.date}</span>
        <button class="delete-Btn" data-id="${trans.id}">🗑️</button>
      </div>
    `).join('');
  }

  renderBalance() {
    let amountIn = document.getElementById("amountIn");
    let amountEx = document.getElementById("amountEx");
    let amountNet = document.getElementById("amountNet");

    let income = this.manager.calculateIncome();
    let expense = this.manager.calculateExpense();
    let netBalance = this.manager.netBalance();

    amountIn.textContent = `+$${income.toFixed(2)}`;
    amountEx.textContent = `-$${expense.toFixed(2)}`;
    amountNet.textContent = `$${netBalance.toFixed(2)}`;
  }

  renderAuditLog() {
    let auditBox = document.getElementById("auditBox");
    if (!auditBox) return;

    const recentLogs = this.auditLog.slice(-10).reverse(); // Last 10, newest first

    if (recentLogs.length === 0) {
      auditBox.innerHTML = '<h2 style="text-align: center; color: #666;">No audit logs yet</h2>';
      return;
    }

    auditBox.innerHTML = `
      <h2 style="padding: 20px; font-family: Arial;">📋 Audit Log (Last 10 Events)</h2>
      ${recentLogs.map(log => `
        <div class="log-entry ${log.type}" style="
          padding: 10px 15px;
          margin: 10px 20px;
          background: white;
          border-left: 4px solid ${log.type === 'error' ? '#ff5252' : log.type === 'cache' ? '#2196f3' : '#4caf50'};
          border-radius: 4px;
          font-family: Arial;
          font-size: 0.9rem;
        ">
          ${log.icon} ${log.message}
          <span style="color: #999; font-size: 0.85em; margin-left: 10px;">${log.timestamp}</span>
        </div>
      `).join('')}
    `;
  }

  renderAll() {
    this.rendertransactionList();
    this.renderBalance();
    this.renderAuditLog();
  }
}

// ========== APP ==========
class App {
  constructor() {
    // Shared audit log
    this.auditLog = [];

    // Build proxy chain
    const real = new TransactionManager();
    const validation = new ValidationProxy(real, this.auditLog);
    const caching = new CachingProxy(validation, this.auditLog);
    const analytics = new AnalyticsProxy(caching, this.auditLog);

    this.manager = analytics;
    this.renderer = new UIRenderer(this.manager, this.auditLog);
    this.currentFilter = "all";

    // Set onChange callback
    validation.onChange = () => {
      this.renderer.rendertransactionList(this.currentFilter);
      this.renderer.renderBalance();
      this.renderer.renderAuditLog();
    };

    this.saveEventListener();
    this.renderer.renderAll();
  }

  saveEventListener() {
    document.getElementById("addTransaction").addEventListener("click", () => {
      const amountInput = document.getElementById("amountInput");
      const description = document.getElementById("description");
      const InExBox = document.getElementById("InExBox");
      const whereSpend = document.getElementById("whereSpend");
      const AccountName = document.getElementById("AccountName");

      const amount = amountInput.value.trim();
      const describe = description.value.trim();
      const type = InExBox.value;
      const category = whereSpend.value;
      const account = AccountName.value;

      try {
        this.manager.AddTransaction(describe, type, account, category, amount);
        amountInput.value = "";
        description.value = "";
      } catch (err) {
        alert(err.message || "Error adding transaction");
      }
    });

    document.getElementById("transactionList").addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-Btn")) {
        let id = parseFloat(e.target.dataset.id);
        try {
          this.manager.deleteTransaction(id);
        } catch (err) {
          alert(err.message || "Error deleting");
        }
      }
    });

    document.querySelector(".filtered").addEventListener("click", (e) => {
      if (e.target.classList.contains("filter-Btn")) {
        this.currentFilter = e.target.dataset.filter;
        document.querySelectorAll(".filter-Btn").forEach(button => button.classList.remove("active"));
        e.target.classList.add("active");
        this.renderer.rendertransactionList(this.currentFilter);
      }
    });
  }
}

// ========== START APP ==========
const app = new App();