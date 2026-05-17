# 重构手法详解

> 常用重构手法的代码示例。主 skill 保留决策框架，此处为具体操作。

## 提取函数 (Extract Function)

```javascript
// 重构前
function printOwing(invoice) {
  console.log('Customer: ' + invoice.customer);

  let outstanding = 0;
  for (const o of invoice.orders) {
    outstanding += o.amount;
  }

  console.log('Amount: ' + outstanding);
  console.log('Due Date: ' + new Date());
}

// 重构后
function printOwing(invoice) {
  logCustomer(invoice.customer);
  const outstanding = calculateOutstanding(invoice.orders);
  logPayment(outstanding);
}

function logCustomer(customer) {
  console.log('Customer: ' + customer);
}
function calculateOutstanding(orders) {
  return orders.reduce((sum, o) => sum + o.amount, 0);
}
function logPayment(amount) {
  console.log('Amount: ' + amount);
  console.log('Due Date: ' + new Date());
}
```

## 内联函数 (Inline Function)

```javascript
// 重构前
function getRating(driver) {
  return moreThanFiveLateDeliveries(driver) ? 2 : 1;
}
function moreThanFiveLateDeliveries(driver) {
  return driver.numberOfLateDeliveries > 5;
}

// 重构后
function getRating(driver) {
  return driver.numberOfLateDeliveries > 5 ? 2 : 1;
}
```

## 拆分循环 (Split Loop)

```javascript
// 重构前
let youngest = people[0]?.age;
let totalSalary = 0;
for (const p of people) {
  if (p.age < youngest) youngest = p.age;
  totalSalary += p.salary;
}

// 重构后
const youngest = Math.min(...people.map((p) => p.age));
const totalSalary = people.reduce((sum, p) => sum + p.salary, 0);
```

## 替换条件为多态 (Replace Conditional with Polymorphism)

```typescript
// 重构前
function getShippingCost(order: Order): number {
  if (order.type === 'standard') return 5.0;
  else if (order.type === 'express') return 12.0;
  else if (order.type === 'overnight') return 25.0;
  throw new Error('Unknown type');
}

// 重构后
interface Shipping {
  cost(): number;
}
class Standard implements Shipping {
  cost() {
    return 5.0;
  }
}
class Express implements Shipping {
  cost() {
    return 12.0;
  }
}
class Overnight implements Shipping {
  cost() {
    return 25.0;
  }
}
```

## 引入参数对象 (Introduce Parameter Object)

```typescript
// 重构前
function createEvent(start: Date, end: Date, title: string, location: string, capacity: number) {}

// 重构后
interface EventParams {
  start: Date;
  end: Date;
  title: string;
  location: string;
  capacity: number;
}
function createEvent(params: EventParams) {}
```
