const SBrick = require('sbrick-protocol');
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const bodyParser = require('body-parser');
const storage = require('node-persist');
const async = require('async');
const Ajv = require('ajv');
const request = require('request');
const schema = require('./SBrickSchema');

const ajv = new Ajv();

storage.initSync({
    dir: __dirname + '/data'
});

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

app.put('/sbricks/:uuid', function (req, res) {
    if (!ajv.validate(schema, req.body)) {
        res.status(400).send(ajv.errors);
    } else {
        storage.setItem(req.params.uuid, req.body).then(() => {
            res.sendStatus(200);
        });
    }
});

app.get('/sbricks/:uuid/video', function (req, res) {
    storage.getItem(req.params.uuid)
        .then((value) => {
            if (value) {
                if (value.streamUrl) {
                    request
                        .get(value.streamUrl)
                        .on('error', function (err) {
                            console.log(err);
                        })
                        .pipe(res);
                } else {
                    res.status(400).send('no stream url found');
                }
            } else {
                res.sendStatus(404);
            }
        })
        .catch((err) => {
            console.log(err);
            res.send(err);
        });
});

io.on('connection', function (socket) {
    socket.sbricks = {};

    socket.on('SBrick.scan', () => {
        Object.keys(socket.sbricks).forEach((uuid) => {
            socket.sbricks[uuid].disconnect();
        });

        SBrick.scanSBricks().then((sbricks) => {
            async.map(sbricks, (sbrick, callback) => {
                storage.getItem(sbrick.uuid).then((value) => {
                    callback(null, Object.assign({}, value, sbrick));
                });
            }, (err, results) => {
                io.emit('SBrick.scanResponse', results);
            });
        });
    });

    socket.on('SBrick.connect', (uuid, password) => {
        const sbrick = new SBrick(uuid);
        sbrick.connect().then(() => {
            io.emit('SBrick.connected', uuid);
            sbrick.on('SBrick.voltAndTemp', (voltage, temperature) => {
                io.emit('SBrick.voltAndTemp', uuid, voltage, temperature);
            });
            sbrick.on('SBrick.disconnected', () => {
                io.emit('SBrick.disconnected', uuid);
            });

            return sbrick.start(password);
        }).catch((err) => {
            io.emit('SBrick.error', uuid, err);
            sbrick.disconnect();
        });
        socket.sbricks[uuid] = sbrick;
    });

    socket.on('SBrick.controlChannel', (uuid, channel, pwm) => {
        if (socket.sbricks.hasOwnProperty(uuid)) {
            socket.sbricks[uuid].channels[channel].pwm = pwm;
        }
    });

    socket.on('SBrick.disconnect', (uuid) => {
        if (socket.sbricks.hasOwnProperty(uuid)) {
            socket.sbricks[uuid].disconnect();
        }
    });

    socket.on('SBrick.command', (uuid, command, args) => {
        console.log(uuid, command, args);
        if (socket.sbricks.hasOwnProperty(uuid)) {
            if (typeof socket.sbricks[uuid][command] === 'function') {
                socket.sbricks[uuid][command].apply(socket.sbricks[uuid], args).then(console.log).catch(console.log);
            }
        }
    });

    socket.on('disconnect', () => {
        Object.keys(socket.sbricks).forEach((uuid) => {
            socket.sbricks[uuid].disconnect();
        });
    });
});

server.listen(8000);
console.log('Open your browser at http://localhost:8000');
