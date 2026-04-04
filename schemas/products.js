let mongoose = require('mongoose')

let productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
         unique: true
    },
    sku: {
        type: String,
        required: true,
        unique: true
    },
    slug: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        default: 0
    },
    quantity: {
        type: Number,
        min: 0,
        default: 0
    },
    description: {
        type: String,
        default: ""
    },
    category: {
        type: String,
        default: "General"
    },
    images: {
        type: String,
        default: ""
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
})
module.exports = mongoose.model('product', productSchema)