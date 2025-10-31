class Transaction{
  constructor( description, type,account, category ,amount,) {
    this.id = Date.now() + Math.random(),
    this.amount = amount,
    this.description = description
    this.type = type,
    this.category = category,
    this.account = account
  }
}

class TransactionManager{
  #transaction = [];

  AddTransaction(description, type,account, category ,amount){
    let numamount = parseFloat(amount)
    let transaction = new Transaction(description, type,account, category ,numamount)
    this.#transaction.push(transaction)
  }

  deleteTransaction(id){
    this.#transaction = this.#transaction.filter(d => d.id !== id);
  };

  
  calculateIncome(){
    return this.#transaction.filter(f => f.type === "income")
    .reduce((sum , f) => sum + f.amount ,0)
  };
  
  calculateExpense(){
    return this.#transaction.filter(f => f.type === "expense" )
    .reduce((sum , f) => sum + f.amount ,0)
  };
  
  netBalance(){
    return this.calculateIncome() - this.calculateExpense()
  }
  
  filterTransaction(filter){
    let transaction = this.getTransaction();
    if(filter === "income"){
      return transaction.filter(f => f.type === "income")
    } else if(filter === "expense"){
      return transaction.filter(f => f.type === "expense")
    }
    
    return transaction;
  };
  
  getTransaction(){
    return [...this.#transaction]
  }

}

class UIRenderer{
  constructor(manager) {
    this.manager = manager;
  }

  rendertransactionList(filter = "all"){
    let transactionList = document.getElementById("transactionList");
    let filters = this.manager.filterTransaction(filter)
    // let transaction = this.manager.getTransaction();

    if(filters.length === 0){

      transactionList.innerHTML = `
          <div class="emptyBox" >
          <h1>No Transaction ${filter === "all" ? "yet" : "here"}</h1>
          <p style="text-align: center">${filter === "income" || filter === "expense" ? "no transaction with this type" : "add your monthly expenses and incomes"}</p>
          </div>
        `
        return
    }


    transactionList.innerHTML = filters.map(trans => `
      <div class="transactionList" style="background-color: ${trans.type === "income" ? "lightgreen" : "lightcoral"}">
      <span>${trans.description}</span>
      <span>${trans.type}</span>
      <p> ${trans.account}</p>
      <p>${trans.category}</p>
      <h3>${trans.amount}</h3>
      <button class="delete-Btn" data-id="${trans.id}">Delete</button>
      </div>
      `).join('')
  };
  renderBalance(){
    let amountIn = document.getElementById("amountIn");
    let amountEx = document.getElementById("amountEx");
    let amountNet = document.getElementById("amountNet");

    let income = this.manager.calculateIncome();
   let expense = this.manager.calculateExpense();
   let netBalance = this.manager.netBalance();

   amountIn.textContent = `+$${income.toFixed(2)}`;
    amountEx.textContent = `-$${expense.toFixed(2)}`;
   amountNet.textContent = `$${netBalance.toFixed(2)}`;

  };

  renderAll(){
    this.rendertransactionList();
    this.renderBalance();
  }
}

class App{
 constructor() {
  this.manager = new TransactionManager();
  this.renderer = new UIRenderer(this.manager);
  this.currentFilter = "all";

  this.saveEventListener()
 };

 saveEventListener(){
  document.getElementById("addTransaction").addEventListener("click" , () => {
    let amountInput = document.getElementById("amountInput");
    let description = document.getElementById("description");
    let InExBox = document.getElementById("InExBox");
    let whereSpend = document.getElementById("whereSpend");
    let AccountName = document.getElementById("AccountName");
    let amount = amountInput.value.trim();
    let describe = description.value.trim();
    let type = InExBox.value
    let category = whereSpend.value
    let account = AccountName.value

    if(!amount){
      alert("please enter the amount")
      return
    } else if(!describe){
      alert("first enter the description")
      return
    }

    this.manager.AddTransaction(describe, type,account, category ,amount);
    amountInput.value = "";
    description.value = "";
    this.renderer.rendertransactionList(this.currentFilter);
    this.renderer.renderBalance();

  })
  document.getElementById("transactionList").addEventListener("click" ,(e) =>{
    if(e.target.classList.contains("delete-Btn")){
      let id = parseFloat(e.target.dataset.id)
      this.manager.deleteTransaction(id);
      this.renderer.rendertransactionList(this.currentFilter);
      this.renderer.renderBalance();
    }
  })

  document.querySelector(".filtered").addEventListener("click" , (e) =>{
    if(e.target.classList.contains("filter-Btn")){
      this.currentFilter = e.target.dataset.filter
      document.querySelectorAll(".filter-Btn").forEach(button => {
        button.classList.remove("active")
      });
      e.target.classList.add("active");
      this.renderer.rendertransactionList(this.currentFilter)
    }
  })
 }

}

let app = new App();
app.renderer.renderAll()
