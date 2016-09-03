const noble = require('noble');
const SBrickChannel = require('./SBrickChannel');

function SBrick (uuid) {
    this.uuid = uuid;
    this.connected = false;
    this.characteristic = null;
    this.runInterval = null;

    this.channels = [
        new SBrickChannel(0),
        new SBrickChannel(1),
        new SBrickChannel(2),
        new SBrickChannel(3)
    ];
}

SBrick.prototype.start = function (startFunction) {
    this.connect((err) => {
        if (!err) {
            if (startFunction) {
                startFunction(this);
            }
            this.run();
        }
    })
};

SBrick.prototype.connect = function (callback) {
    if (!this.connected) {
        if (noble.state === 'poweredOn') {
            this.startScan(callback);
        } else {
            noble.on('stateChange', (state) => {
                if (state === 'poweredOn') {
                    this.startScan(callback);
                }
            });
        }
    }
};

SBrick.prototype.startScan = function (callback) {
    console.log('scanning for', this.uuid);
    noble.on('discover', (peripheral) => {
        console.log('found', peripheral.uuid);
        if (peripheral.uuid === this.uuid) {
            console.log('done');
            noble.stopScanning();

            peripheral.connect((err) => {
                if (err) {
                    return callback(err);
                }

                this.connected = true;
                console.log('connected to peripheral: ' + peripheral.uuid, peripheral.advertisement);

                peripheral.once('disconnect', () => {
                    clearInterval(this.runInterval);
                    this.connected = false;
                    console.log('disconnect peripheral', this.uuid);
                    console.log('reconnecting');
                    this.connect();
                });

                peripheral.once('rssiUpdate', function(rssi) {
                    console.log('rssi updated');
                });

                peripheral.discoverServices(['4dc591b0857c41deb5f115abda665b0c'], (err, services) => {
                    if (err) {
                        console.log("service discovery error", err);
                        return callback(err);
                    }

                    console.log('remote control service found');

                    services[0].discoverCharacteristics(['02b8cbcc0e254bda8790a15f53e6010f'], (err, characteristics) => {
                        console.log('remote control characteristic found');
                        this.characteristic = characteristics[0];
                        return callback(null);
                    });
                });
            });
        }
    });


    noble.startScanning()
};

SBrick.prototype.run = function () {
    this.characteristic.on('data',function (data) {
        console.log('data', data);
    });

    this.characteristic.subscribe(function (err) {
        console.log('subscriptbe1', err);
    });

    this.readCommand("0a");

    this.runInterval = setInterval(() => {
        this.channels.forEach((channel) => {
            var b = channel.getCommand();
            this.writeCommand(b);
        });
    }, 200);
};

SBrick.prototype.writeCommand = function (cmd) {
    if (!(cmd instanceof Buffer)) {
        cmd = new Buffer(cmd, "hex");
    }

    this.characteristic.write(cmd, false, function (err) {
        if (err) {
            console.log("write error", err, cmd);
        }
    });
};

SBrick.prototype.readCommand = function (cmd, callback) {
    this.writeCommand(cmd);
    this.characteristic.read((err, data) => {
       if (err) {
           console.log("read error", err, cmd);
       } else {
           console.log(data);
       }

        if (callback) {
            callback(null, data);
        }
    });
};

module.exports = SBrick;