const mongoose = require('mongoose');
const User = require('./schemas/users');
const Product = require('./schemas/products');
const Inventory = require('./schemas/inventories');
const Cart = require('./schemas/carts');
const Role = require('./schemas/roles');
const slugify = require('slugify');

// Database Connection — chỉ seed sau khi đã kết nối
mongoose.connect('mongodb://localhost:27017/NNPTUD-S2')
  .then(async () => {
    console.log('Connected to MongoDB for seeding...');
    await seedDatabase();
  })
  .catch((err) => {
    console.error('Connection error:', err);
    process.exit(1);
  });

const seedDatabase = async () => {
  try {
    // Xóa index cũ cartItems.product_1 (unique) — nhiều giỏ rỗng gây trùng null
    try {
      await mongoose.connection.db.collection('carts').dropIndex('cartItems.product_1');
    } catch (e) {
      if (e.code !== 27 && e.codeName !== 'IndexNotFound') {
        console.warn('dropIndex cartItems.product_1:', e.message);
      }
    }

    // 1. Clear existing data
    console.log('Clearing existing data...');
    await Cart.deleteMany({});
    await User.deleteMany({});
    await Inventory.deleteMany({});
    await Product.deleteMany({});
    // Note: We don't delete Roles because app.js already creates them or we can query them.
    // However, to be safe, let's make sure they exist.
    const roles = ['ADMIN', 'SUPPORT', 'CUSTOMER'];
    let roleMap = {};
    
    for (let roleName of roles) {
      let roleExists = await Role.findOne({ name: roleName });
      if (!roleExists) {
        roleExists = await Role.create({ name: roleName, description: `Default ${roleName} role` });
      }
      roleMap[roleName] = roleExists._id;
    }

    console.log('Roles prepared.');

    // 2. Create Users
    console.log('Seeding Users...');
    const users = [
      {
        username: 'admin',
        password: 'password123',
        email: 'admin@example.com',
        fullName: 'System Admin',
        role: roleMap['ADMIN'],
      },
      {
        username: 'support_staff',
        password: 'password123',
        email: 'support@example.com',
        fullName: 'Support Staff 1',
        role: roleMap['SUPPORT'],
      },
      {
        username: 'john_doe',
        password: 'password123',
        email: 'john@example.com',
        fullName: 'John Doe',
        role: roleMap['CUSTOMER'],
      },
      {
        username: 'jane_smith',
        password: 'password123',
        email: 'jane@example.com',
        fullName: 'Jane Smith',
        role: roleMap['CUSTOMER'],
      }
    ];

    // Use .save() to trigger pre('save') hook for hashing passwords
    for (let u of users) {
      const userDoc = await new User(u).save();
      await new Cart({ user: userDoc._id, cartItems: [] }).save();
    }
    console.log('Users and carts seeded successfully!');

    // 3. Create Products
    console.log('Seeding Products...');
    const products = [
      {
        title: 'Iphone 15 Pro Max',
        sku: 'IP15PM-256-BLK',
        slug: slugify('Iphone 15 Pro Max', { lower: true }),
        price: 1200,
        description: 'Latest Apple smartphone with 256GB storage, Black.',
        category: 'Electronics',
        images: 'https://example.com/ip15pm.png',
        quantity: 10,
      },
      {
        title: 'Samsung Galaxy S24 Ultra',
        sku: 'SGS24U-512-WHT',
        slug: slugify('Samsung Galaxy S24 Ultra', { lower: true }),
        price: 1100,
        description: 'Newest Samsung flagship phone with AI features.',
        category: 'Electronics',
        images: 'https://example.com/s24u.png',
        quantity: 10,
      },
      {
        title: 'MacBook Pro M3 Max',
        sku: 'MBP-M3MAX-1TB',
        slug: slugify('MacBook Pro M3 Max', { lower: true }),
        price: 3200,
        description: 'Apple laptop for professionals. 1TB SSD, 36GB RAM.',
        category: 'Computers',
        images: 'https://example.com/mbp.png',
        quantity: 10,
      },
      {
        title: 'Sony WH-1000XM5',
        sku: 'SONY-WH1000XM5',
        slug: slugify('Sony WH-1000XM5', { lower: true }),
        price: 350,
        description: 'Noise-cancelling wireless headphones.',
        category: 'Accessories',
        images: 'https://example.com/sony-headphones.png',
        quantity: 10,
      }
    ];

    const insertedProducts = await Product.insertMany(products);

    // Tồn kho (stock) — mặc định 10 cho mọi sản phẩm seed
    const inventories = insertedProducts.map((p) => ({
      product: p._id,
      stock: 10,
    }));
    await Inventory.insertMany(inventories);
    console.log('Products and inventory (stock) seeded successfully!');

    console.log('Database seeding completed!');
    process.exit(0);

  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};
