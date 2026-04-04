var express = require("express");
var router = express.Router();
let mongoose = require('mongoose');

let { checkLogin } = require('../utils/authHandler');
let cartModel = require('../schemas/carts');
let productModel = require('../schemas/products');
let inventoryModel = require('../schemas/inventories');
let orderModel = require('../schemas/orders');
let orderDetailModel = require('../schemas/orderDetails');

// Lấy danh sách Order của người dùng hiện tại
router.get('/', checkLogin, async function (req, res, next) {
    try {
        let orders = await orderModel.find({ user: req.userId }).sort({ createdAt: -1 });
        // Nếu cần lấy chi tiết, ta có thể viết 1 vòng lặp thủ công hoặc dùng tính năng virtual của mongose.
        // Ở đây lấy danh sách đơn giản.
        res.send(orders);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// Xem chi tiết 1 Order
router.get('/:id', checkLogin, async function (req, res, next) {
    try {
        let order = await orderModel.findOne({ _id: req.params.id, user: req.userId });
        if (!order) return res.status(404).send({ message: "Không tìm thấy đơn hàng" });
        
        // Fetch order details
        let details = await orderDetailModel.find({ order: order._id }).populate('product', 'title sku price images');
        
        res.send({ order, details });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// Post: Thanh toán (Checkout)
router.post('/checkout', checkLogin, async function (req, res, next) {
    let session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Lấy Cart
        let currentCart = await cartModel.findOne({ user: req.userId }).session(session);
        if (!currentCart || currentCart.cartItems.length === 0) {
            throw new Error("Giỏ hàng trống, không thể thanh toán");
        }

        let totalPrice = 0;
        let orderDetailsData = [];

        // 2. Tính tiền & trừ Tồn kho
        for (let item of currentCart.cartItems) {
            let productInfo = await productModel.findById(item.product).session(session);
            if (!productInfo || productInfo.isDeleted) {
                throw new Error("Có sản phẩm không tồn tại hoặc đã bị xóa");
            }

            // Find Inventory
            let inventory = await inventoryModel.findOne({ product: item.product }).session(session);
            if (!inventory || inventory.stock < item.quantity) {
                throw new Error(`Sản phẩm ${productInfo.title} không đủ số lượng tồn kho (Còn: ${inventory ? inventory.stock : 0})`);
            }

            // Deduct Inventory
            inventory.stock -= item.quantity;
            await inventory.save({ session });
            productInfo.quantity = inventory.stock;
            await productInfo.save({ session });

            // Accumulate total
            totalPrice += (productInfo.price * item.quantity);

            // Prepare OrderDetail data
            orderDetailsData.push({
                product: productInfo._id,
                quantity: item.quantity,
                price: productInfo.price // giá tại thời điểm hiện tại
            });
        }

        // 3. Tạo Order mới
        let newOrder = new orderModel({
            user: req.userId,
            totalPrice: totalPrice,
            status: 'PENDING',
            shippingAddress: req.body.shippingAddress || "Địa chỉ mặc định"
        });
        await newOrder.save({ session });

        // 4. Tạo các OrderDetail
        let detailsToSave = orderDetailsData.map(d => ({
            ...d,
            order: newOrder._id
        }));
        await orderDetailModel.insertMany(detailsToSave, { session });

        // 5. Làm rỗng giỏ hàng
        currentCart.cartItems = [];
        await currentCart.save({ session });

        // 6. Hoàn tất chuỗi hành động bảo mật
        await session.commitTransaction();
        session.endSession();

        res.send({
            message: "Đặt hàng thành công",
            order: newOrder
        });

    } catch (err) {
        // Rollback nếu có lỗi bất kỳ (hết hàng, API đứt gãy...)
        await session.abortTransaction();
        session.endSession();
        res.status(400).send({ message: err.message });
    }
});

module.exports = router;
