var express = require("express");
var router = express.Router();
let { uploadImage, uploadExcel } = require('../utils/uploadHandler')
let path = require('path')
let fs = require('fs')
let exceljs = require('exceljs')
let productModel = require('../schemas/products')
let InventoryModel = require('../schemas/inventories')
const { default: mongoose } = require('mongoose');
var slugify = require('slugify')

router.post('/single', uploadImage.single('file'), function (req, res, next) {
    if (!req.file) {
        res.status(404).send({
            message: "file not found"
        })
    }
    res.send({
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
    })
})
router.post('/multiple', uploadImage.array('files', 5), function (req, res, next) {
    if (!req.files) {
        res.status(404).send({
            message: "file not found"
        })
    }
    console.log(req.files);
    let filesInfor = req.files.map(e => {
        return {
            filename: e.filename,
            path: e.path,
            size: e.size
        }
    })
    res.send(filesInfor)
})
router.get('/:filename', function (req, res, next) {
    let pathFile = path.join(__dirname, '../uploads', req.params.filename)
    res.sendFile(pathFile)
})

router.post('/excel/v1', uploadExcel.single('file'), async function (req, res, next) {
    let filePath = path.join(__dirname, '../uploads', req.file.filename);
    //workbook->n x worksheet-> n x row -> n x cell
    let workBook = new exceljs.Workbook();
    await workBook.xlsx.readFile(filePath);
    let workSheet = workBook.worksheets[0];
    let errors = [];
    let products = await productModel.find({});
    let productTitles = products.map(e => {
        return e.title
    })
    let productSkus = products.map(e => {
        return e.sku
    })
    let result = []
    for (let index = 2; index < workSheet.rowCount; index++) {
        let rowError = []
        let row = workSheet.getRow(index);
        let sku = row.getCell(1).value;
        let title = row.getCell(2).value;
        let category = row.getCell(3).value;
        let price = Number.parseInt(row.getCell(4).value);
        let stock = Number.parseInt(row.getCell(5).value);
        if (productSkus.includes(sku)) {
            rowError.push("sku bi trung "+sku)
        }
        if (productTitles.includes(title)) {
            rowError.push("title bi trung "+title)
        }
        if (price < 0 || isNaN(price)) {
            rowError.push("price khong hop le:  " + row.getCell(4).value)
        }
        if (stock < 0 || isNaN(stock)) {
            rowError.push("stock khong hop le " + row.getCell(5).value)
        }
        if (rowError.length > 0) {
            errors.push(rowError)
            result.push(rowError)
        } else {
            let session = await mongoose.startSession();
            session.startTransaction()
            try {
                let newItem = new productModel({
                    sku: sku,
                    title: title,
                    slug: slugify(title, {
                        replacement: '-',
                        remove: undefined,
                        lower: false,
                        strict: false,
                        locale: 'vi'
                    }),
                    price: price,
                    description: title,
                    category: category
                })
                //replica set
                let newProduct = await newItem.save({ session });
                console.log(newProduct);
                let newInventory = new InventoryModel({
                    product: newProduct._id,
                    stock: stock
                })
                newInventory = await newInventory.save({ session });
                await newInventory.populate('product')
                await session.commitTransaction()
                await session.endSession()
                productTitles.push(title);
                productSkus.push(sku)
                result.push(newInventory)
                //res.send(newInventory);
            } catch (errorCreate) {
                await session.abortTransaction()
                await session.endSession();
                errors.push(errorCreate.message)
                result.push(errorCreate.message)
            }
        }
    }
    res.send(result);
    fs.unlinkSync(filePath)

})

module.exports = router;