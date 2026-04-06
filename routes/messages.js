var express = require('express');
var router = express.Router();
let { checkLogin } = require('../utils/authHandler');
let { uploadImage } = require('../utils/uploadHandler')
let messageSchema = require('../schemas/message')
let userSchema = require('../schemas/users');

router.post('/', checkLogin, uploadImage.single('file'), async function (req, res, next) {
    let user = req.userId;
    console.log(user);
    let to = req.body.to;
    let userTo = await userSchema.findOne({
        _id: to
    })
    if (!userTo) {
        res.status(404).send({
            message: "user khong ton tai"
        })
    }
    let messageContent = {}
    if (!req.file) {
        messageContent.type = 'text';
        messageContent.text = req.body.message
    } else {
        messageContent.type = 'file';
        messageContent.text = req.file.path
    }
    let mewMessage = new messageSchema({
        from: user,
        to: to,
        message: messageContent
    })
    await mewMessage.save();
    let io = req.app.get('socketio');
    if (io) {
        io.to(to.toString()).emit('new_message', mewMessage);
    }
    res.send(mewMessage)
})
router.get('/:userId', checkLogin, async function (req, res, next) {
    let user1 = req.userId;
    let user2 = await userSchema.findOne({
        _id: req.params.userId
    })
    console.log(user1 + "-" + user2);
    if (!user2) {
        res.status(404).send({
            message: "user khong ton tai"
        })
    }
    let messages = await messageSchema.find({
        $or: [{
            from: user1, to: user2._id
        }, {
            from: user2._id, to: user1
        }]
    }).sort({
        createdAt: -1
    })
    res.send(messages)
})
router.get('/', checkLogin, async function (req, res, next) {
    let user1 = req.userId;
    let messages = await messageSchema.find({
        $or: [{
            from: user1
        }, {
            to: user1
        }]
    }).sort({
        createdAt: -1
    }).populate('from to')
    let mapUser = new Map();
    let myId = user1.toString();
    for (const message of messages) {
        if (!message.from || !message.to) continue;
        let fromId = message.from._id.toString();
        let toId = message.to._id.toString();
        let otherUserId = (myId === fromId) ? toId : fromId;
        
        if (!mapUser.has(otherUserId)) {
            mapUser.set(otherUserId, message);
        }
    }
    let result = Array.from(mapUser.values());
    res.send(result)
})
module.exports = router;