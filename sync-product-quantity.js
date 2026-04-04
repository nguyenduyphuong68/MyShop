/** Đồng bộ product.quantity từ inventories.stock. Chạy: node sync-product-quantity.js */
const mongoose = require('mongoose');
const Product = require('./schemas/products');
const Inventory = require('./schemas/inventories');

mongoose
  .connect('mongodb://localhost:27017/NNPTUD-S2')
  .then(async () => {
    const invs = await Inventory.find({});
    let n = 0;
    for (const inv of invs) {
      await Product.updateOne({ _id: inv.product }, { quantity: inv.stock });
      n++;
    }
    await Product.updateMany(
      { _id: { $nin: invs.map((i) => i.product) } },
      { quantity: 0 }
    );
    console.log('Synced quantity from inventory for', n, 'products.');
    await mongoose.disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
