const Wallet = require('../models/walletSchema');

async function getOrCreate(userId) {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = await Wallet.create({ user: userId, balance: 0, transactions: [] });
  }
  return wallet;
}
 
async function getBalance(userId) {
  const wallet = await Wallet.findOne({ user: userId }).select('balance');
  return wallet ? wallet.balance : 0;
}
 
// ── Get wallet ────────────────────────────────────────────────────
async function getWallet(userId) {
  return getOrCreate(userId);
}
 
// ── Credit (add money) ────────────────────────────────────────────
async function credit(userId, amount, description, opts = {}) {
  if (!amount || amount <= 0) throw new Error('Credit amount must be positive');
 
  const {
    orderId = null,
    orderRef = '',
    idempotencyKey = null,
    type = 'credit',
    session = null,
  } = opts;

  if (idempotencyKey) {
    const existing = await Wallet.findOne({
      user: userId,
      'transactions.idempotencyKey': idempotencyKey,
    }).session(session);
    if (existing) {
      const tx = existing.transactions.find(t => t.idempotencyKey === idempotencyKey);
      return { wallet: existing, transaction: tx, duplicate: true };
    }
  }
 
  await getOrCreate(userId);
 
  const wallet = await Wallet.findOne({ user: userId });
  const newBalance = wallet.balance + amount;
 
  //transaction records
  const tx = {
    type,
    amount,
    description,
    orderId,
    orderRef,
    status: 'success',
    balanceAfter: newBalance,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
 
  const updated = await Wallet.findOneAndUpdate(
    { user: userId },
    {
      $inc: { balance: amount },
      $push: { transactions: { $each: [tx], $position: 0 } },
    },
    { new: true, session }
  );
 
  return { wallet: updated, transaction: updated.transactions[0], duplicate: false };
}
 

async function debit(userId, amount, description, opts = {}) {
  if (!amount || amount <= 0) throw new Error('Debit amount must be positive');
 
  const { orderId = null, orderRef = '', session = null } = opts;
 
  // Check balance first
  const wallet = await Wallet.findOne({ user: userId }).session(session);
  if (!wallet || wallet.balance < amount) {
    throw new Error('Insufficient wallet balance');
  }
 
  const newBalance = wallet.balance - amount;
 
  const tx = {
    type: 'debit',
    amount,
    description,
    orderId,
    orderRef,
    status: 'success',
    balanceAfter: newBalance,
  };
 
  const updated = await Wallet.findOneAndUpdate(
    { user: userId, balance: { $gte: amount } }, // safety check
    {
      $inc: { balance: -amount },
      $push: { transactions: { $each: [tx], $position: 0 } },
    },
    { new: true, session }
  );
 
  if (!updated) {
    throw new Error('Insufficient wallet balance');
  }
 
  return { wallet: updated, transaction: updated.transactions[0] };
}
 
// ── Refund for cancelled order item ───────────────────────────────
async function refundForCancellation(userId, amount, orderId, orderRef) {
  return credit(userId, amount, `Refund for cancelled order item (${orderRef})`, {
    type: 'refund_cancel',
    orderId,
    orderRef,
   idempotencyKey: `cancel_${orderId}_${orderRef}`,
  });
}
 
// ── Refund for approved return ─────────────────────────────────────
async function refundForReturn(userId, amount, orderId, orderRef, itemIdStr) {
  return credit(userId, amount, `Refund for approved return (${orderRef})`, {
    type: 'refund_return',
    orderId,
    orderRef,
    idempotencyKey: `return_${orderId}_${itemIdStr}`,
  });
}
 
module.exports = {
  credit,
  debit,
  refundForCancellation,
  refundForReturn,
  getWallet,
  getBalance,
};
