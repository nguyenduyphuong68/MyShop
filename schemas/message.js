let mongoose = require('mongoose');
let messageContent = mongoose.Schema({
    type: {
        type: String,
        enum: ['text', 'file']
    },
    text: {
        type: String
    }
},{
    _id:false
})
let messageSchema = mongoose.Schema({
    from: {
        type: mongoose.Types.ObjectId,
        ref: "user"
    }, to: {
        type: mongoose.Types.ObjectId,
        ref: "user"
    },
    message: {
        type: messageContent
    }
}, {
    timestamps: true
})
module.exports = new mongoose.model('message', messageSchema);