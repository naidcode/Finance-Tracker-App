/* =========================
   Transaction model + manager
   ========================= */

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
class AnalyticsProxy {
  constructor(realManager) {
    this.real = realManager;
    this.events = []; // simple in-memory event log
  }

  _track(event, meta = {}) {
    this.events.push({ event, meta, time: Date.now() });
    console.log("[ANALYTICS]", event, meta);
  }

  AddTransaction(...args) {
    this._track("AddTransaction", { args });
    return this.real.AddTransaction(...args);
  }

  deleteTransaction(id) {
    this._track("deleteTransaction", { id });
    return this.real.deleteTransaction(id);
  }

  calculateIncome() {
    this._track("calculateIncome");
    return this.real.calculateIncome();
  }

  calculateExpense() {
    this._track("calculateExpense");
    return this.real.calculateExpense();
  }

  netBalance() {
    this._track("netBalance");
    return this.real.netBalance();
  }

  filterTransaction(filter) {
    this._track("filterTransaction", { filter });
    return this.real.filterTransaction(filter);
  }

  getTransaction() {
    this._track("getTransaction");
    return this.real.getTransaction();
  }

  saveLocalstorage() {
    this._track("saveLocalstorage");
    return this.real.saveLocalstorage();
  }

}

class CachingProxy {
  constructor(realManager) {
    this.real = realManager;
    this.cache = new Map(); // key => result
  }

  _cacheKeyForFilter(filter) {
    return `filter:${filter}`;
  }

  filterTransaction(filter) {
    const key = this._cacheKeyForFilter(filter);
    if (this.cache.has(key)) {
      console.log("[CACHE] hit", key);
      // shallow copy for safety
      return [...this.cache.get(key)];
    }
    console.log("[CACHE] miss", key);
    const result = this.real.filterTransaction(filter);
    this.cache.set(key, result); // store array (objects)
    return [...result];
  }

  // clear cache when mutations happen
  AddTransaction(...args) {
    this.cache.clear();
    return this.real.AddTransaction(...args);
  }

  deleteTransaction(id) {
    this.cache.clear();
    return this.real.deleteTransaction(id);
  }

  // forward read-only / calculations and ensure caching for getTransaction if needed
  calculateIncome() { return this.real.calculateIncome(); }
  calculateExpense() { return this.real.calculateExpense(); }
  netBalance() { return this.real.netBalance(); }
  getTransaction() { return this.real.getTransaction(); }
  saveLocalstorage() { return this.real.saveLocalstorage(); }
}

/* FlexibleProxy: validation, auto-save, UI onChange hook, logging */
class FlexibleProxy {
  constructor(realManager) {
    this.real = realManager;
    this.onChange = null; // UI will set this
  }

  _afterMutate() {
    // auto-save
    if (typeof this.real.saveLocalstorage === "function") {
      try { this.real.saveLocalstorage(); } catch (e) { console.warn(e); }
    }
    // notify UI
    if (typeof this.onChange === "function") {
      try { this.onChange(); } catch (e) { console.warn("onChange failed", e); }
    }
  }

    notvalidmessage(){
      return `⚠️ Not Valid ${this.description} ${this.amount}`
    }

  AddTransaction(description, type, account, category, amount) {
    // validation
    if (!amount || isNaN(parseFloat(amount))) throw new Error( notvalidmessage());
    if (!description) throw new Error("Description required");
    if (!type || (type !== "income" && type !== "expense")) throw new Error("Invalid type");
    const result = this.real.AddTransaction(description, type, account, category, amount);
    console.log("[FLEX] Added transaction");
    this._afterMutate();
    return result;
  }

  deleteTransaction(id) {
   if(!id) this.notvalidmessage();
    const result = this.real.deleteTransaction(id);
    this._afterMutate();
    return result;
  }

  calculateIncome() {
    if(this.amount <=0) this.notvalidmessage();
     return this.real.calculateIncome();

   }
  calculateExpense() { 
    if(amount <=0) this.notvalidmessage()
    return this.real.calculateExpense();
   }
  netBalance() { if(amount <=0) this.notvalidmessage(); return this.real.netBalance(); }
  filterTransaction(filter) { return this.real.filterTransaction(filter); }
  getTransaction() { return this.real.getTransaction(); }

  saveLocalstorage() { // expose so other layers can call
    return this.real.saveLocalstorage();
  }
}

class UIRenderer {
  constructor(manager) {
    this.manager = manager;
  }

  rendertransactionList(filter = "all") {
    let transactionList = document.getElementById("transactionList");
    let filters = this.manager.filterTransaction(filter);

    if (!filters || filters.length === 0) {
      transactionList.innerHTML = `
        <div class="emptyBox" >
          <h1>No Transaction ${filter === "all" ? "yet" : "here"}</h1>
          <p style="text-align: center">${filter === "income" || filter === "expense" ? "no transaction with this type" : "add your monthly expenses and incomes"}</p>
        </div>
      `;
      return;
    }

    transactionList.innerHTML = filters.map(trans => `
      <div class="transactionListz" style="background-color: ${trans.type === "income" ? "lightgreen" : "tomato"}" >
        <span class="spanstyle" style="color: white">${trans.description}</span>
        <span class="spanstyle">${trans.type}</span>
        <p class="parastyle">${trans.account}</p>
        <p class="parastyle">${trans.category}</p>
        <h3 class="h3style">$${trans.amount}</h3>
        <span class="datestyle" style="font-size: 12px">${trans.date}</span>
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

  notvalidrenderer(){
    let heading = document.getElementById("aubithead")

    let invalid = this.manager.notvalidmessage();

    heading.textContent = `${invalid}`;
  }

  renderAll() {
    this.rendertransactionList();
    this.renderBalance();
  }
}

/* =========================
   App: wire everything, use proxy chain
   ========================= */

class App {
  constructor() {
    const real = new TransactionManager();
    const flexible = new FlexibleProxy(real);
    const caching = new CachingProxy(flexible);
    const analytics = new AnalyticsProxy(caching);

    this.manager = analytics; 
    this.renderer = new UIRenderer(this.manager);
    this.currentFilter = "all";
    flexible.onChange = () => {
      this.renderer.rendertransactionList(this.currentFilter);
      this.renderer.renderBalance();
      this.renderer.notvalidrenderer()
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
        // use manager.filterTransaction -> caching proxy will serve cached results if possible
        this.renderer.rendertransactionList(this.currentFilter);
        this.manager.saveLocalstorage && this.manager.saveLocalstorage();
      }
    });
  }
}

/* =========================
   Start the app
   ========================= */

const app = new App();
app.renderer.renderAll();
