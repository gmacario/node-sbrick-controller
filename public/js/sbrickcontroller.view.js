var SBrickControllerView = Backbone.View.extend({
    events: {
        "keydown": "keydown",
        "keyup": "keyup",
        "click #sbrick-list-scan": "scan"
    },

    initialize: function () {
        this.model = new SBrickCollection();

        this.listenTo(this.model, 'add', this.addSBrickView);
        this.listenTo(this.model, 'remove', this.removeSBrickView);
        this.listenTo(this.model, 'connect', this.connect)
    },

    addSBrickView: function (sbrick) {
        var sbrickView = new SBrickView({model: sbrick});
        sbrickView.render().$el.appendTo(this.$('#sbricks'));
    },

    removeSBrickView: function (sbrick) {
        this.$('#sbrick-control-panel-' + sbrick.get('uuid')).destroy();
    },

    keydown: function (event) {
        var keycode = event.which;

        this.model.forEach((sbrick) => {
            sbrick.channels.forEach((channel) => {
                if (channel.get('keyDec') === keycode) {
                    Socket.controlChannel(sbrick.get('uuid'), channel.get('channelId'), channel.get('min'));
                }

                if (channel.get('keyInc') === keycode) {
                    Socket.controlChannel(sbrick.get('uuid'), channel.get('channelId'), channel.get('max'));
                }
            });
        });
    },

    keyup: function (event) {
        var keycode = event.which;

        this.model.forEach((sbrick) => {
            sbrick.channels.forEach((channel) => {
                if (channel.get('keyDec') === keycode || channel.get('keyInc') === keycode) {
                    Socket.controlChannel(sbrick.get('uuid'), channel.get('channelId'), 0);
                }
            });
        });
    },

    scan: function () {
        this.$('#sbrick-list-connect').attr('disabled', 'disabled');
        this.$('#sbrick-list-scan').attr('disabled', 'disabled');
        Socket.scan();
    },

    scanResponse: function (sbricks) {
        this.$('#sbrick-list-scan').removeAttr('disabled');
        this.model.set(sbricks, {parse: true});
        if (sbricks.length > 0) {
            this.$('#sbrick-list-connect').removeAttr('disabled');
        } else {
            this.$('#sbrick-list-connect').attr('disabled', 'disabled');
        }
    },

    error: function (uuid, err) {
        console.log('error', uuid, err);
    },

    connect: function (sbrick) {
        var uuid = sbrick.get('uuid');
        Socket.connect(uuid);
    },

    connected: function (uuid) {
        this.$('#sbrick-list-connect').removeAttr('disabled');
        this.model.get(uuid).set('connected', true);
    },

    voltAndTemp: function (uuid, voltage, temperature) {
        var time = new Date().getTime();
        this.model.get(uuid).addVoltage(time, voltage);
        this.model.get(uuid).addTemperature(time, temperature);
    }
});
