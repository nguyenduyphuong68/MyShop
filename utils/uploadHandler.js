const { model } = require('mongoose');
let multer = require('multer');
let path = require('path')

//storage - luu o dau (destination), luu la gi?(filename)
let storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        let ext = path.extname(file.originalname);
        let fileName = Date.now() + '-' + Math.round(Math.random() * 1_000_000_000) + ext;
        cb(null, fileName)
    }
})

let customFileFilterImage = function (req, file, cb) {
    if (file.mimetype.startsWith('image')) {
        cb(null, true)
    } else {
        cb(new Error("dinh dang khong dung", false))
    }
}

let customFileFilterExcel = function (req, file, cb) {
    if (file.mimetype.includes('spreadsheetml')) {
        cb(null, true)
    } else {
        cb(new Error("dinh dang khong dung", false))
    }
}

module.exports = {
    uploadImage: multer({
        storage: storage,
        limits: 5 * 1024 * 1024,
        fileFilter: customFileFilterImage
    }),
    uploadExcel: multer({
        storage: storage,
        limits: 5 * 1024 * 1024,
        fileFilter: customFileFilterExcel
    })
}
