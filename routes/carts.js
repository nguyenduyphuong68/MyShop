var express = require("express");
var router = express.Router();
const mongoose = require('mongoose');
let { checkLogin } = require('../utils/authHandler')
let cartModel = require('../schemas/carts')
let inventoryModel = require('../schemas/inventories')
let productModel = require('../schemas/products')

function parsePositiveIntQuantity(value) {
    if (value === undefined || value === null) return NaN;
    var n = typeof value === 'string' ? parseInt(value, 10) : Number(value);
    if (!Number.isFinite(n) || n < 1) return NaN;
    if (Math.floor(n) !== n) return NaN;
    return n;
}

async function getOrCreateCart(userId) {
    let cart = await cartModel.findOne({ user: userId });
    if (!cart) {
        cart = await cartModel.create({ user: userId, cartItems: [] });
    }
    return cart;
}

function invalidProductIdResponse(productRaw) {
    if (!mongoose.Types.ObjectId.isValid(productRaw)) {
        return { status: 400, message: 'product id khong hop le' };
    }
    return null;
}

/** Tồn kho nằm ở collection inventories; nếu sản phẩm hợp lệ nhưng chưa có inventory thì tạo mặc định. */
async function resolveInventoryForProduct(productRaw) {
    const bad = invalidProductIdResponse(productRaw);
    if (bad) return { error: bad };
    const productId = new mongoose.Types.ObjectId(productRaw);
    let inv = await inventoryModel.findOne({ product: productId });
    if (inv) return { inventory: inv };
    const prod = await productModel.findOne({ _id: productId, isDeleted: false });
    if (!prod) {
        return { error: { status: 404, message: 'san pham khong ton tai hoac da ngung ban' } };
    }
    inv = await inventoryModel.create({ product: productId, stock: 10 });
    await productModel.updateOne({ _id: productId }, { quantity: 10 });
    return { inventory: inv };
}
router.get('/get-cart', checkLogin, async function (req, res, next) {
    let itemCart = await getOrCreateCart(req.userId);
    res.send(itemCart.cartItems);
})
router.post('/add-cart', checkLogin, async function (req, res, next) {
    let { product, quantity } = req.body || {};
    let qty = parsePositiveIntQuantity(quantity);
    if (Number.isNaN(qty)) {
        res.status(400).send({
            message: "quantity phai la so nguyen >= 1 (Postman: Body > raw > chon JSON, khong dung Text)"
        });
        return;
    }
    let currentCart = await getOrCreateCart(req.userId);
    const resolved = await resolveInventoryForProduct(product);
    if (resolved.error) {
        res.status(resolved.error.status).send({ message: resolved.error.message });
        return;
    }
    let getProduct = resolved.inventory;
    let result = currentCart.cartItems.filter(
        function (e) {
            return e.product == product
        }
    )
    let currentQty = result.length == 0 ? 0 : result[0].quantity;
    if (getProduct.stock < (currentQty + qty)) {
        res.status(400).send({ message: "Khong du so luong ton kho" })
        return;
    }
    if (result.length == 0) {
        currentCart.cartItems.push({
            product: product,
            quantity: qty
        })
    } else {
        result[0].quantity += qty
    }
    await currentCart.save();
    res.send(currentCart)
})
router.post('/add-one', checkLogin, async function (req, res, next) {
    let currentCart = await getOrCreateCart(req.userId);
    let { product } = req.body;
    const resolved = await resolveInventoryForProduct(product);
    if (resolved.error) {
        res.status(resolved.error.status).send({ message: resolved.error.message });
        return;
    }
    let getProduct = resolved.inventory;
    let result = currentCart.cartItems.filter(
        function (e) {
            return e.product == product
        }
    )
    let currentQty = result.length == 0 ? 0 : result[0].quantity;
    if (getProduct.stock < (currentQty + 1)) {
        res.status(400).send({ message: "Khong du so luong ton kho" })
        return;
    }
    if (result.length == 0) {
        currentCart.cartItems.push({
            product: product,
            quantity: 1
        })
    } else {
        result[0].quantity += 1
    }
    await currentCart.save();
    res.send(currentCart)
})
router.post('/reduce', checkLogin, async function (req, res, next) {
    let currentCart = await getOrCreateCart(req.userId);
    let { product } = req.body;
    const idErr = invalidProductIdResponse(product);
    if (idErr) {
        res.status(idErr.status).send({ message: idErr.message });
        return;
    }
    let index = currentCart.cartItems.findIndex(
        function (e) {
            return e.product == product
        }
    )
    if (index >= 0) {
        currentCart.cartItems[index].quantity -= 1;
        if (currentCart.cartItems[index].quantity === 0) {
            currentCart.cartItems.splice(index, 1);
        }
    }
    await currentCart.save();
    res.send(currentCart)
})
router.post('/remove', checkLogin, async function (req, res, next) {
    let currentCart = await getOrCreateCart(req.userId);
    let { product } = req.body;
    const idErr = invalidProductIdResponse(product);
    if (idErr) {
        res.status(idErr.status).send({ message: idErr.message });
        return;
    }
    let index = currentCart.cartItems.findIndex(
        function (e) {
            return e.product == product
        }
    )
    if (index >= 0) {
        currentCart.cartItems.splice(index,1);
    }
    await currentCart.save();
    res.send(currentCart)
})


module.exports = router;