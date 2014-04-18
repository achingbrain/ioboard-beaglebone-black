var util = require('util'),
  IOBoard = require('ioboard'),
  async = require('async'),
  fs = require('fs');

var GPIO_PINS = [2, 3, 4, 5, 7, 14, 15, 20, 22, 23, 26, 27, 30, 31, 40, 44, 45, 46, 47, 48, 49, 51, 60, 61, 65, 66, 67, 68, 69, 117, 122, 125];

BeagleBoneBlack = function() {
  IOBoard.call(this, {quiet: true});

  this.name = 'BeagleBoneBlack';

  // pretend we've connected to firmata
  process.nextTick(function() {
    this.emit("connected");

    // configure GPIO pins

    var tasks = [];

    GPIO_PINS.forEach(function(pin) {
      // enable every pin for gpio
      tasks.push(function(callback) {
        var supportedModes = [];
        supportedModes.push(this.MODES.OUTPUT);
        supportedModes.push(this.MODES.INPUT);
        supportedModes.push(this.MODES.SERVO);

        // these pins also support pwm mode
        if([3, 7, 23, 40].indexOf(pin) != -1) {
          supportedModes.push(this.MODES.PWM);
        }

        this._pins[pin] = {
          supportedModes: supportedModes,
          mode: this.MODES.OUTPUT,
          value : 0,
          report: 0,
          analogChannel: 127
        };

        // turn pins on for GPIO usage
        fs.exists('/sys/class/gpio/gpio' + pin, function(exists) {
          if(exists) {
            return callback();
          }

          fs.writeFile('/sys/class/gpio/export', pin, 'ascii', callback);
        });
      }.bind(this));
    }.bind(this));

    async.series(tasks, function(error) {
      if(error) throw error;

      this.emit("ready");
    }.bind(this));
  }.bind(this));
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

BeagleBoneBlack.prototype.pinMode = function(pin, mode) {
  if(mode == this.MODES.OUTPUT) {
    fs.writeFileSync('/sys/class/gpio/gpio' + pin + "/direction", 'low', 'ascii');
  }
};

BeagleBoneBlack.prototype.reset = function() {
  var tasks = [];

  // turn pins off for GPIO usage
  GPIO_PINS.forEach(function() {
    tasks.push(function(callback) {
      fs.exists('/sys/class/gpio/gpio' + pin, function(exists) {
        if(!exists) {
          return callback();
        }

        fs.writeFile('/sys/class/gpio/unexport', pin, 'ascii', callback);
      });
    });
  });

  async.series(tasks, function(error) {
    if(error) throw error;

    this.emit("ready");
  }.bind(this));
}

module.exports = BeagleBoneBlack;
