const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'DELIVERED', 'CANCELLED'],
      default: 'PENDING'
    },
    shippingAddress: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('order', orderSchema);
