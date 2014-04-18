var util = require('util'),
  IOBoard = require('ioboard'),
  async = require('async'),
  fs = require('fs');

BeagleBoneBlack = function(path, callback) {
  IOBoard.call(this, {quiet: true});

  // pretend we've connected to firmata
  process.nextTick(function() {
    this.emit("connected");

    // configure GPIO pins
    var gpio = [2, 3, 4, 5, 7, 14, 15, 20, 22, 23, 26, 27, 30, 31, 40, 44, 45, 46, 47, 48, 49, 51, 60, 61, 65, 66, 67, 68, 69, 117, 122, 125];
    var tasks = [];

    gpio.forEach(function(pin) {
      // enable every pin for gpio
      tasks.push(function(callback) {
        var supportedModes = [];
        supportedModes.push(this.MODES.OUTPUT);
        supportedModes.push(this.MODES.INPUT);
        supportedModes.push(this.MODES.SERVO);

        // these pins also support pwm mode
        if([3, 7, 23, 40].indexOf(i) != -1) {
          supportedModes.push(this.MODES.PWM);
        }

        this._pins.push({
          supportedModes: supportedModes,
          mode: this.MODES.OUTPUT,
          value : 0,
          report: 0,
          analogChannel: 127
        });

        fs.writeFile('/sys/class/gpio/export', pin, 'ascii', callback);
      }.bind(this));
    }.bind(this));

    async.parallel(tasks, function(error) {
      if(error) throw error;

      this.emit("ready");

      callback();
    }.bind(this));
  }.bind(this));
/*
  setTimeout(function() {


    // would now query the board's capabilities
    setTimeout(function() {

      // set digital pin capabilities
      for(var i = 0; i < 20; i++) {
        var supportedModes = [];
        var mode = this.MODES.OUTPUT;
        var analogChannel = 127;

        // set analog pin capabilities
        if(i < 13) {
          // standard modes supported by digital pins
          if(i > 1) {
            supportedModes.push(this.MODES.OUTPUT);
            supportedModes.push(this.MODES.INPUT);
            supportedModes.push(this.MODES.SERVO);
          }

          // these pins also support pwm mode
          if([3, 5, 6, 9, 10, 11].indexOf(i) != -1) {
            supportedModes.push(this.MODES.PWM);
          }
        } else {
          // pins > 13 are analog
          mode = this.MODES.ANALOG;
          analogChannel = i - 14;
          supportedModes = [this.MODES.OUTPUT, this.MODES.INPUT, this.MODES.ANALOG];
        }

        // populate pins array

      }


    }.bind(this), 200);
  }.bind(this), 200);*/
}
util.inherits(BeagleBoneBlack, IOBoard);

BeagleBoneBlack.prototype.digitalWrite = function(pin, value) {
  fs.writeFileSync('/sys/class/gpio/gpio' + pin + "/value", value, 'ascii');
};

BeagleBoneBlack.prototype.digitalRead = function(pin, callback) {
  fs.readFile('/sys/class/gpio/gpio' + pin + "/value", function(error, data) {
    callback(error, data ? parseInt(data, 10) : undefined);
  });
};

module.exports = BeagleBoneBlack;
