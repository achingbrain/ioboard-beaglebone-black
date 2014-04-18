
# ioboard-beaglebone-black

An implementation of ioboard for the BeagleBone Black.

```javascript
var BeagleBoneBlack = require('ioboard-beaglebone-black'),
  five = require('johnny-five');

var bone = new BeagleBoneBlack();
bone.on("ready", function() {
  var board = five.Board({io: bone});

  var led = new five.Led(30);
  led.strobe();
});
```

## Pin numbers

The GPIO pins are accessed by their kernel names.  E.g. in the example above the LED is connected to `P9_11`, which is `GPIO_30` so `30` is passed to the LED constructor.
