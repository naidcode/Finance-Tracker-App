class Transaction{
  constructor( description, type,account, category ,amount) {
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
    let Transaction = new Transaction(description, type,account, category ,amount)
    this.#transaction.push(Transaction)
  }

  deleteTransaction(id){
    this.#transaction = this.#transaction.filter(d => d.id !== id);
  };

  getTransaction(){
    return [...this.#transaction]
  }

  calculateIncome(){
  return this.#transaction.filter(f => f.type === "income")
  .reduce((sum , f) => sum + f.amount ,0)
  };

  calculateExpense(){
    return this.#transaction.filter(f => f.type === "expense" )
    .reduce((sum , f) => sum - f.amount ,0)
  };

  filterTransaction(filter){
    let transaction = this.getTransaction();
    if(filter === "income"){
      return transaction.filter(f => f.type === "income")
    } else if(filter === "expense"){
      return transaction.filter(f => f.type === "expense")
    }

    return transaction;
  };


}

class UIRenderer{
  constructor(manager) {
    this.manager = manager;
  }

  rendertransactionList(filter = "all"){
    let transactionList = document.getElementById("transactionList");
    let filter = manager.filterTransaction(filter)
    let transaction = manager.getTransaction();

    transactionList.innerHTML = filter.map(filter => `
        <div class="emptyBox" >
        <h1>No Transaction ${filter.type === "all" ? "yet" : "here"}</h1>
        <p>${filter.type === "income" || filter.type === "expense" ? "no transaction with this type" : "add your monthly expenses and incomes"}
        </div>
      `).join('');

    transactionList.innerHTML = transaction.map(trans => `
      <div class="transactionList" style="backgroung-color: ${trans.type = "income" ? "red" : "green"}>
      <span>${trans.description}</span>
      <span>${trans.type}</span>
      <p> ${trans.account}</p>
      <p>${trans.category}</p>
      <h3>${trans.amount}</h3>
      <button class="delete-Btn" data-id="${trans.id}">Delete</button>
      </div>
      `).join('')
  }
}

let manager = new TransactionManager()
console.log(manager.filterTransaction("income"))
