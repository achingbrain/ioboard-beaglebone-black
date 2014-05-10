var util = require('util'),
  IOBoard = require('ioboard'),
  async = require('async'),
  fs = require('fs'),
  exec = require('child_process').exec,
  linear = function(x) {return x},
  map = require('map-range');

var GPIO_PINS = [2, 3, 4, 5, 7, 14, 15, 20, 22, 23, 26, 27, 30, 31, 40, 44, 45, 46, 47, 48, 49, 51, 60, 61, 65, 66, 67, 68, 69, 117, 122, 125];
var PWM_PINS = [];
PWM_PINS[3] = 'P9_21';
PWM_PINS[7] = 'P9_42';
PWM_PINS[23] = 'P8_13';
PWM_PINS[40] = 'P9_14';

var PWM_FREQUENCY = 2000;
var SERVO_FREQUENCY = 60;

var PWM_PERIOD = 500000; // 2KHz
var SERVO_PERIOD = 16666666; // 60Hz

BeagleBoneBlack = function() {
  IOBoard.call(this);

  this.name = 'BeagleBone Black';

  process.nextTick(function() {
    this.emit("connected");

    var tasks = [];
    this._slots;

    // find the cape manager file
    tasks.push(function(callback) {
      for(var i = 0; i < 20; i++) {
        var capeManager = '/sys/devices/bone_capemgr.' + i;

        // get the cape manager configuration
        if(fs.existsSync(capeManager)) {
          return callback(null, capeManager);
        }
      }

      callback("Could not locate cape manager");
    });

    // get the cape manager's config
    tasks.push(function(capeManager, callback) {
      exec('cat ' + capeManager + "/slots", callback);
    });

    // store the slots
    tasks.push(function(stdout, stderr, callback) {
      this._slots = stdout;
      callback();
    }.bind(this));

    // enable am33xx chip PWM pins
    tasks.push(function(callback) {
      if(this._slots.indexOf('a33xx') == -1) {
        fs.writeFile('/sys/devices/bone_capemgr.9/slots', 'am33xx_pwm', {encoding: 'ascii'}, callback);
      } else {
        callback();
      }
    }.bind(this));

    // configure GPIO pins
    GPIO_PINS.forEach(function(pin) {
      // enable every pin for gpio
      var supportedModes = [];

      // these pins also support pwm mode
      if(PWM_PINS[pin]) {
        supportedModes.push(this.MODES.PWM);
        supportedModes.push(this.MODES.SERVO);
      } else {
        supportedModes.push(this.MODES.OUTPUT);
        supportedModes.push(this.MODES.INPUT);
      }

      this._pins[pin] = {
        supportedModes: supportedModes,
        mode: this.MODES.OUTPUT,
        value : 0,
        report: 0,
        analogChannel: 127
      };
    }.bind(this));

    async.waterfall(tasks, function(error) {
      if(error) throw error;

      this.emit("ready");
    }.bind(this));
  }.bind(this));
}
util.inherits(BeagleBoneBlack, IOBoard);

BeagleBoneBlack.prototype.pinMode = function(pin, mode) {
  if(mode == this.MODES.OUTPUT) {
    this._enableDigital(pin);
  } else if(mode == this.MODES.PWM) {
    this._enablePWM(pin, PWM_FREQUENCY);
  } else if(mode == this.MODES.SERVO) {
    this._enablePWM(pin, SERVO_FREQUENCY);
  } else {
    console.info('what is', mode);
  }
};

BeagleBoneBlack.prototype._enableDigital = function(pin) {
  if(fs.existsSync('/sys/class/gpio/gpio' + pin)) {
    return console.info('pin', pin, 'already digital output');
  }

  console.info('pin', pin, 'becoming digital output');

  fs.writeFileSync('/sys/class/gpio/export', pin, {encoding: 'ascii'});
  fs.writeFileSync('/sys/class/gpio/gpio' + pin + "/direction", 'low', {encoding: 'ascii'});
};

BeagleBoneBlack.prototype._enablePWM = function(pin, frequency) {
  if(this._slots.indexOf('bone_pwm_' + PWM_PINS[pin]) != -1) {
    console.info('pin', pin, 'already pwm');
  } else {
    console.info('pin', pin, 'becoming pwm');

    fs.writeFileSync('/sys/devices/bone_capemgr.9/slots', 'bone_pwm_' + PWM_PINS[pin], {encoding: 'ascii'});
  }

  for(var i = 0; i < 10; i++) {
    var ocp = '/sys/devices/ocp.' + i;

    if(fs.existsSync(ocp)) {
      for(var j = 0; j < 50; j++) {
        var pwm = ocp + '/pwm_test_' + PWM_PINS[pin] + '.' + j;

        if(fs.existsSync(pwm)) {
          console.info('found pwm at', pwm);
          this._pins[pin].pwm = {
            path: pwm
          };

          break;
        }
      }

      break;
    }
  }

  if(!this._pins[pin].pwm.path) {
    throw new Error('Could not locate pwm for ' + pin.name);
  }

  var period = Math.round(1e9 / frequency);

  // set the duty to 0 - have to do this before changing the period
  fs.writeFileSync(this.pins[pin].pwm.path + '/duty', 0);

  // set the period
  fs.writeFileSync(this.pins[pin].pwm.path + '/period', period);

  // set the polarity of the pin to 0
  fs.writeFileSync(this._pins[pin].pwm.path + "/polarity", 0);

  this._pins[pin].pwm.period = period;
  this._pins[pin].pwm.polarity = 0;
  this._pins[pin].pwm.duty = 0;
};

BeagleBoneBlack.prototype.digitalWrite = function(pin, value) {
  console.info('digital write', pin, value);
  fs.writeFileSync('/sys/class/gpio/gpio' + pin + "/value", value, {encoding: 'ascii'});
};

BeagleBoneBlack.prototype.digitalRead = function(pin, callback) {
  fs.readFile('/sys/class/gpio/gpio' + pin + "/value", function(error, data) {
    callback(error, data ? parseInt(data, 10) : undefined);
  });
};

BeagleBoneBlack.prototype.analogRead = function(pin, callback) {
  log("BeagleBoneBlack", "analogRead of pin", pin);
};

BeagleBoneBlack.prototype.analogWrite = function(pin, value) {
  console.info("IOBoard", "analogWrite", value, "to pin", pin);

  var mapper = map(linear, 0, 255, 0, 100);
  var mapped = mapper(value);

  this._pwmWrite(pin, mapped);
};

BeagleBoneBlack.prototype.servoWrite = function(pin, value) {
  console.info("IOBoard", "servoWrite", value, "to pin", pin);

  var mapper = map(linear, 0, 180, 3, 14);
  var mapped = mapper(value);

  this._pwmWrite(pin, mapped);
};

BeagleBoneBlack.prototype._pwmWrite = function(pin, duty) {
  if(!this.pins[pin].pwm) {
    throw new Error("Pin " + pin + " is not a PWM pin");
  }

  var value = Math.round(this.pins[pin].pwm.period * (duty / 100));

  console.info('writing duty', duty, '% = ', value, 'to', this.pins[pin].pwm.path + '/duty');
  fs.writeFileSync(this.pins[pin].pwm.path + '/duty', value);
};

module.exports = BeagleBoneBlack;
