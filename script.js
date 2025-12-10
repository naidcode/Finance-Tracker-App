/**************************************************
 * TRANSACTION MODEL
 **************************************************/
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

/**************************************************
 * MIDDLEWARE ENGINE
 **************************************************/
class MiddlewareEngine {
  constructor() {
    this.stack = [];
  }

  use(fn) {
    this.stack.push(fn);
  }

  async run(context) {
    let index = -1;

    const dispatch = async (i) => {
      if (i <= index) throw new Error("next() called twice");
      index = i;

      const fn = this.stack[i];
      if (!fn) return;

      return await fn(context, () => dispatch(i + 1));
    };

    return dispatch(0);
  }
}

/**************************************************
 * MIDDLEWARES
 **************************************************/

// 1. Validation
async function validateMW(ctx, next) {
  if (!ctx.description.trim()) throw new Error("Description required");
  if (isNaN(ctx.amount) || ctx.amount <= 0) throw new Error("Amount invalid");
  if (!["income", "expense"].includes(ctx.type)) throw new Error("Type invalid");
  await next();
}

// 2. Currency Conversion
async function currencyMW(ctx, next) {
  ctx.amount = Number(ctx.amount) * 84.52;
  await next();
}

// 3. Category Rules
async function categoryRuleMW(ctx, next) {
  if (ctx.category === "grocery" && ctx.type !== "expense")
    throw new Error("Grocery must be an expense");
  await next();
}

// 4. Analytics
async function analyticsMW(ctx, next) {
  console.log("📊 ANALYTICS:", ctx.description, ctx.amount);
  await next();
}

// 5. Auto Save
async function autosaveMW(ctx, next) {
  await next();
  ctx.manager.saveLocalstorage();
}

// 6. Final Handler
async function addTransactionHandler(ctx) {
  ctx.manager._pushTransaction(
    ctx.description,
    ctx.type,
    ctx.account,
    ctx.category,
    ctx.amount
  );
}

/**************************************************
 * REAL MANAGER (Uses Middleware)
 **************************************************/
class TransactionManager {
  #transaction = [];

  constructor() {
    this.loadlocalStorage();

    // build middleware pipeline
    this.engine = new MiddlewareEngine();
    this.engine.use(validateMW);
    this.engine.use(currencyMW);
    this.engine.use(categoryRuleMW);
    this.engine.use(analyticsMW);
    this.engine.use(autosaveMW);
    this.engine.use(addTransactionHandler);
  }

  async AddTransaction(description, type, account, category, amount) {
    const ctx = {
      description,
      type,
      account,
      category,
      amount,
      manager: this,
    };

    await this.engine.run(ctx);
  }

  _pushTransaction(description, type, account, category, amount) {
    const t = new Transaction(description, type, account, category, amount);
    this.#transaction.push(t);
  }

  deleteTransaction(id) {
    this.#transaction = this.#transaction.filter(t => t.id !== id);
    this.saveLocalstorage();
  }

  calculateIncome() {
    return this.#transaction
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
  }

  calculateExpense() {
    return this.#transaction
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
  }

  netBalance() {
    return this.calculateIncome() - this.calculateExpense();
  }

  filterTransaction(filter) {
    const t = [...this.#transaction];
    if (filter === "income") return t.filter(f => f.type === "income");
    if (filter === "expense") return t.filter(f => f.type === "expense");
    return t;
  }

  getTransaction() {
    return [...this.#transaction];
  }

  saveLocalstorage() {
    localStorage.setItem("transaction", JSON.stringify(this.#transaction));
  }

  loadlocalStorage() {
    const data = localStorage.getItem("transaction");
    this.#transaction = data ? JSON.parse(data) : [];
  }
}

/**************************************************
 * UI + APP (unchanged)
 **************************************************/
class UIRenderer {
  constructor(manager) {
    this.manager = manager;
  }

  rendertransactionList(filter = "all") {
    let transactionList = document.getElementById("transactionList");
    let filters = this.manager.filterTransaction(filter);

    if (filters.length === 0) {
      transactionList.innerHTML = `
        <div class="emptyBox"><h2>No Transactions</h2></div>
      `;
      return;
    }

    transactionList.innerHTML = filters
      .map(
        trans => `
      <div class="transactionListz" style="background-color: ${
        trans.type === "income" ? "lightgreen" : "tomato"
      }">
        <span>${trans.description}</span>
        <span>${trans.type}</span>
        <p>${trans.account}</p>
        <p>${trans.category}</p>
        <h3>$${trans.amount.toFixed(2)}</h3>
        <span>${trans.date}</span>
        <button class="delete-Btn" data-id="${trans.id}">🗑️</button>
      </div>`
      )
      .join("");
  }

  renderBalance() {
    let income = this.manager.calculateIncome();
    let expense = this.manager.calculateExpense();
    let net = this.manager.netBalance();

    document.getElementById("amountIn").textContent = `+$${income.toFixed(2)}`;
    document.getElementById("amountEx").textContent = `-$${expense.toFixed(2)}`;
    document.getElementById("amountNet").textContent = `$${net.toFixed(2)}`;
  }

  renderAll() {
    this.rendertransactionList();
    this.renderBalance();
  }
}

class App {
  constructor() {
    this.manager = new TransactionManager();
    this.renderer = new UIRenderer(this.manager);
    this.currentFilter = "all";

    this.saveEventListener();
    this.renderer.renderAll();
  }

  saveEventListener() {
    document.getElementById("addTransaction").addEventListener("click", async () => {
      const amount = amountInput.value.trim();
      const describe = description.value.trim();
      const type = InExBox.value;
      const category = whereSpend.value;
      const account = AccountName.value;

      try {
        await this.manager.AddTransaction(describe, type, account, category, amount);
        amountInput.value = "";
        description.value = "";
        this.renderer.renderAll();
      } catch (err) {
        alert(err.message);
      }
    });

    transactionList.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-Btn")) {
        this.manager.deleteTransaction(parseFloat(e.target.dataset.id));
        this.renderer.renderAll();
      }
    });
  }
}

new App();
