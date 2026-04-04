let { Server } = require('socket.io')
let jwt = require('jsonwebtoken');
let userSchema = require('../schemas/users')
module.exports = {
    SocketServer: function (server) {
        const io = new Server(server);
        io.on('connection', async (socket) => {
            let token = socket.handshake.auth.token;
            let result = jwt.verify(token, 'HUTECH');
            if (result.exp > Date.now()) {
                let user = await userSchema.findOne({
                    _id: result.id
                })
                socket.join(result.id.toString());
                io.to(result.id.toString()).emit('welcome', user.username)
            }

        })
        return io;
    }
}