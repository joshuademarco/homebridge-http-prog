# homebridge-http-prog


[![NPM](https://img.shields.io/npm/v/homebridge-http-prog?style=for-the-badge)](https://www.npmjs.com/package/homebridge-http-prog)
[![Downloads](https://img.shields.io/npm/dt/homebridge-http-prog?style=for-the-badge)](https://www.npmjs.com/package/homebridge-http-prog)
[![ISSUES](https://img.shields.io/github/issues/joshuademarco/homebridge-http-prog?style=for-the-badge)](https://github.com/joshuademarco/homebridge-http-prog/issues)  
An example accessory plugin for programmable http


## How to install
Open up your Homeridge in the browser, go to the plugins page and just search for homebridge-http-prog. Don't have a Homebridge? Follow [these](https://github.com/homebridge/homebridge#installation) instructions.  
If you wish to install this plugin manually, open up your Terminal and type in:
```
npm install -g homebridge-http-prog
```
Make sure to use the global tag `-g` since Homebridge only reads globally installed packages.


## How to implement this plugin?
Once you installed the plugin via Homebridge, go to your configuration page and add the following:  
```
"accessories": [{
        "accessory": "http-prog",
        "name": "Programmable HTTP",
        "send_state": {},
        "send_update": {}
        }],
```
Change the value of "name" to whatever you wish the plugin to be displayed as. Please look at the Syntax section to configure the plugin

## Syntax
Here is a list of all the properties that can be declared.
* `bulb_on` (*string*, default: "on") The string when the bulb is set on. This is important if the device is listening to a specific key other than "on".
* `bulb_off` (*string*, default: "off") The string when the bulb is set off. This is important if the device is listening to a specific key other than "off".
* `send_state` (*object*, **must implement**) Object that will be called when the state of the bulb changes (either on or off). It contains the following properties:
    * `http_method` (*string*, default "GET") The method to be used.
    * `url` (*string*, default: "http://<i></i>localhost") The url to send the request to.
        * `%s` This sequence is being reserved as a placeholder for the state. It can be implemented at any point in the url and will be parsed as `bulb_on` or `bulb_off`. Make sure to implement it as a string (see example).
    * `port` (*number*, default: 80) The port to send the request to.
    * `headers` (*JSON*, default: null) Some custom headers to send. It accepts any values. For further information read [Wikipedia - Headers](https://en.wikipedia.org/wiki/List_of_HTTP_header_fields). Placeholders here will **not** be parsed.
    * `body` (*JSON/string*, default: null) The body of the request. I can contain anything you want to be transmitted.
* `send_update` (*object*, **must implement**) Object that will be called when the RGB of the bulb updates .it contains the following properties: (similar to send_state)
    * `http_method` (similar to send_state)
    * `url` (similar to send_state)
        * `%r`, `%g`, `%b`, This sequence is being reserved as a placeholder for the values of R, G, B. It can be implemented at any point in the url and will be parsed as a number from 0 to 255. Make sure to implement it as a string (see example).
    * `port` (similar to send_state)
    * `headers` (similar to send_state) Placeholders here will **not** being parsed.
    * `body` (*JSON*, default: null) The body of the request. 
        * `%r`,`%g`,`%b` Like the *%s*, These placeholders are being reserved for RGB values. They can be placed anywhere in the body. Make sure to implement them as a string (see example).
* `get` (*object*, default: null) Coming soon...

**NOTE:** Defining properties in send_state (for example url), does not automatically change the properties send_update

## Example
In this example I use the following configuration for my [Arduino Uno Wifi rev 2](https://store.arduino.cc/arduino-uno-wifi-rev2). The code uploaded on the board can be found [here](https://github.com/joshuademarco/Arduino-HTTP-RGB).

```
"accessories": [{
        "accessory": "http-prog",
        "name": "Programmable HTTP",
        "send_state": {
            "url": "http://192.168.x.x/api/send",
            "body": {
                "state": '%s'
            }
        },
        "send_update": {
            "url": "http://192.168.x.x/api/send",
            "body": {
                "r": '%r',
                "g": '%g',
                "b": '%b'
            }
        }
        }],
```

### If you have any suggestions for improvement, don't hesitate sending me a message :)