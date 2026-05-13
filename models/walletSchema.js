const mongoose = require('mongoose');
const { Schema } = mongoose;

// ── Transaction sub-document ──────────────────────────────────────────────────
const transactionSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['credit', 'debit', 'refund_cancel', 'refund_return'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Amount must be positive'],
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'success',
    },
    description: { type: String, default: '' },
    // Reference to the source order (if any)
    orderId: { type: String, ref: 'Order', default: null },
    // Human-readable order reference string (e.g. "ORD123456")
    orderRef: { type: String, default: '' },
    // Idempotency key – prevents duplicate refunds for the same logical event
    idempotencyKey: { type: String },
    // Running balance AFTER this transaction
    balanceAfter: { type: Number, required: true },
  },
  { timestamps: true }
);

// ── Wallet document ───────────────────────────────────────────────────────────
const walletSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Wallet balance cannot go negative'],
    },
    transactions: [transactionSchema],
  },
  { timestamps: true }
);

// Index for fast idempotency lookups across all wallets
walletSchema.index({ 'transactions.idempotencyKey': 1 });

module.exports = mongoose.model('Wallet', walletSchema);