
var express = require('express');
var router = express.Router();
let path = require('path')

router.get('/', function (req, res, next) {
    res.sendFile(path.join(__dirname,'../resources/chat.html'))
 })

module.exports = router;