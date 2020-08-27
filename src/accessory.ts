import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";
import request = require("request");
const colorsys = require('colorsys');
const PACKAGE = require('../package.json');
const mqtt = require('mqtt');
let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory('homebridge-http-prog', 'http-prog', Switch);
};

class Switch implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private readonly config: AccessoryConfig;
  private brightness: number;
  private saturation: number;
  private hue: number;
  private bulbOn: boolean; // State of the BULB
  private bulb_on: string; // The string sent when the bulb should turn on
  private bulb_off: string; // The string sent when the bulb should turn off
  private cache = { a: 0, b: 0, c: 0 }; // Cache of color values
  private color_method: string;
  private parse_method: RegExp;
  private send_protocol: string;
  private mqtt_url: string;
  private readonly informationService: Service;
  private readonly lightbulbService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.config = config;  //Reference to the config file one edits to set up the accessory
    this.name = config.name;

    this.bulb_on = config.bulb_on || 'on';    // Get config index, if empty take default
    this.bulb_off = config.bulb_off || 'off';
    this.color_method = config.color_method || 'RGB';

    this.bulbOn = false; // Default state of BULB
    this.brightness = 0;
    this.saturation = 0;
    this.hue = 0;
    this.cache = { a: 0, b: 0, c: 0 };

    this.send_protocol = config.send_protocol || 'MQTT';
    this.mqtt_url = config.mqtt.url || 'mqtt://localhost:1883';

    /*Ignore the fact that BODY is being declared as a string here.
    * It is being stringified in the constructor since the method REQUEST
    * only accepts string for the http body
    * Why not request config input as string? It's easier for the User */
    // Class of basic values needed for the HTTP transmission
    class HTTP {
      http_method: string;
      url: string;
      port: number;
      headers: JSON;
      body: string;
      constructor(ident: string) {
        this.http_method = config[ident].http_method || 'GET';
        this.url = config[ident].url || 'http://localhost';
        this.port = config[ident].port || '80';
        this.headers = config[ident].headers || null;
        this.body = JSON.stringify(config[ident].body) || '';
      }
    }
    this.parse_method = config.get.parse_method || ''; // If parse_methd is undefined, it means that the value is directly in the body and no REGEXP needed.


    var client = mqtt.connect(this.mqtt_url, { clientId: "Homebridge_PROG" });

    if (config.send_state == undefined) {
      log.error("No send_state specified! Please reead " + PACKAGE.repository.url + " for more information.");
    } else if (config.send_update == undefined) {
      log.error("No send_update specified! Please read " + PACKAGE.repository.url + " for more information.");
    } else if (config.get == undefined) {
      log.error("No send_state_off specified! Please read " + PACKAGE.repository.url + " for more information.");
    }


    // Initiate new HTTP
    let send_state = new HTTP("send_state");
    let send_update = new HTTP("send_update");
    //let get = new HTTP("get");


    client.on('connect', () => {
      client.subscribe('switch', (err: any) => {
        if (err) {
          log.info("An error occured: " + err.toString());
        } else {
          client.publish('switch', `{"state":"${this.bulbOn ? this.bulb_on : this.bulb_off}"}`);
          log.info("MQTT connected to: " + this.mqtt_url);
        }
      })
    });
    client.on('reconnect', () => {
      log.info("MQTT reconnecting...");
    });
    client.on('disconnect', () => {
      client.info("MQTT disconnecting...");
      client.publish('switch', `{"state":"${this.bulbOn ? this.bulb_on : this.bulb_off}"}`);
      client.unsubscribe('switch', (err: any) => {
        if (err) {
          log.info("An error occured: " + err.toString());
        } else {
          log.info("MQTT server disconnected");
        }
      })
    });



    this.lightbulbService = new hap.Service.Lightbulb(this.name);
    this.lightbulbService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => { // Get current state of BULB
        log.info("GET of Bulb: " + (this.bulbOn ? this.bulb_on : this.bulb_off));
        callback(undefined, this.bulbOn)
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => { // Set current state of BULB; IS bein run everytime HSV updates!!!
        if (this.bulbOn != value as boolean) {
          this.bulbOn = value as boolean;
          if (this._setColor()) {
            var y = this.bulbOn ? this.bulb_on : this.bulb_off; // Use user preferred values of on and off 
            switch (this.send_protocol) {
              case "HTTP":
                var x = send_state;
                log.info("SET of Bulb: " + y);
                var url_p = x.url.replace('%s', y); // Replace value with placeholder in URL
                var body_p = x.body.replace('%s', y); //  Same for BODY and keep it in string
                this._httpRequest(x.http_method, url_p, x.port, x.headers, body_p, (error, response, body) => { if (!this._httpError(error, response, callback)) { callback(); } });
                break;
              case "MQTT":
                log.info("SET of bulb: ", y);
                this.bulbOn ? (client.connected ? 0 : (client.reconnect())) : (client.publish('switch', `{"state":"${y}"}`)&&client.end());
                callback();
                break;
            }
          } else { callback() };
        } else { callback() };
      });
    this.lightbulbService.getCharacteristic(hap.Characteristic.Hue)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("GET Hue: " + (this.hue));
        callback(undefined, this.hue);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        if (this.hue != value as number) {
          this.hue = value as number;
          if (this._setColor()) {
            switch (this.send_protocol) {
              case "HTTP":
                var x = send_update;
                var rlp = this._replaceColor(x.url, x.body);
                this._httpRequest(x.http_method, rlp.url, x.port, x.headers, rlp.body, (error, response, body) => { if (!this._httpError(error, response, callback)) { callback(); } });
                break;
              case "MQTT":
                var z = this.cache;
                client.publish('switch', '{"a":' + z.a + ',"b":' + z.b + ',"c":' + z.c + '}');
                callback();
                break;
            }
          } else { callback() }
        }
      });
    this.lightbulbService.getCharacteristic(hap.Characteristic.Saturation)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("GET Saturation: " + (this.saturation));
        callback(undefined, this.saturation);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        if (this.saturation != value as number) {
          this.saturation = value as number;
          if (this._setColor()) {
            switch (this.send_protocol) {
              case "HTTP":
                var x = send_update;
                var rlp = this._replaceColor(x.url, x.body);
                this._httpRequest(x.http_method, rlp.url, x.port, x.headers, rlp.body, (error, response, body) => { if (!this._httpError(error, response, callback)) { callback(); } });
                break;
              case "MQTT":
                var z = this.cache;
                client.publish('switch', '{"a":' + z.a + ',"b":' + z.b + ',"c":' + z.c + '}');
                callback();
                break;
            }
          } else { callback() }
        }
      });
    this.lightbulbService.getCharacteristic(hap.Characteristic.Brightness)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("GET Brightness: " + (this.brightness));
        callback(undefined, this.brightness);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        if (this.brightness != value as number) {
          this.brightness = value as number;
          if (this._setColor()) {
            switch (this.send_protocol) {
              case "HTTP":
                var x = send_update;
                var rlp = this._replaceColor(x.url, x.body);
                this._httpRequest(x.http_method, rlp.url, x.port, x.headers, rlp.body, (error, response, body) => { if (!this._httpError(error, response, callback)) { callback(); } });
                break;
              case "MQTT":
                var z = this.cache;
                client.publish('switch', '{"r":' + z.a + ',"g":' + z.b + ',"b":' + z.c + '}');
                callback();
                break;
            }
          } else { callback() }
        }
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Joshua De Marco")
      .setCharacteristic(hap.Characteristic.Model, "Arduino Lightstrip LED")
      .setCharacteristic(hap.Characteristic.SerialNumber, "123-123-123");
    log.info("HTTP-PROG finished initializing!");
  }


  // Following function only replaces RGB palceholders like %r
  _replaceColor(url: string, body: string) {
    const x = this.cache;
    var new_url = url.replace(/%r|%h/g, x.a.toString()).replace(/%g|%s/g, x.b.toString()).replace(/%b|%v/g, x.c.toString()); //url.replace(/%r|%g|%b/gi, (_,n) => mapRGB[+n-1].toString()); trying to implement this
    var new_body = body.replace(/%r|%h/g, x.a.toString()).replace(/%g|%s/g, x.b.toString()).replace(/%b|%v/g, x.c.toString());
    return { url: new_url, body: new_body };
  }

  hsv_int = 255 / 360;
  // Transform HSV information to RGB
  _setColor() {
    var updated = false;
    var x = this.cache; // Updating the cache
    if (!this.bulbOn) {
      x.a = 0;
      x.b = 0;
      x.c = 0;
      return updated = true;
    }
    switch (this.color_method) {
      case "HSV":
        if (this.hue == x.a && this.saturation == x.b && this.brightness == x.c && this.bulbOn) {
          return updated;
          break;}
        x.a = this.hue;
        x.b = this.saturation;
        x.c = this.brightness;
        this.log.info('HSV: ', this.hue, this.saturation, this.brightness);
        return updated = true;
        break;
      case "RGB":
        const color = colorsys.hsv_to_rgb({
          h: this.hue,
          s: this.saturation,
          v: this.brightness
        });
        /* if color = cache, no need to send update. Problem from translating HSV to RGB:
         * Sometimes RGB resolves for multiple HSV. */
        if (color.r == x.a && color.g == x.b && color.b == x.c && this.bulbOn) {
          return updated;
          break;
        } else {
          x.a = color.r
          x.b = color.g
          x.c = color.b
          this.log.info('RGB: ', color.r, color.g, color.b);
          return updated = true;
          break;
        }
        break;

    }
  }

  // Main HTTP request
  _httpRequest(method: string, url: string, port: number, headers: JSON, body: string, reqCallback: request.RequestCallback) {
    request(url, {
      method: method,
      port: port,
      headers: headers,
      rejectUnauthorized: false,
      body: body
    }, function (error, response, body) {
      reqCallback(error, response, body);
    });
  }

  _httpError(error: Error, response: request.Response, callback: CharacteristicGetCallback | CharacteristicSetCallback) {
    var errOc = false;
    if (error) {
      errOc = true;
      this.log.warn('The HTTP equest returned an error ', error.message);
      callback(error);
    } else if (response.statusCode != 200) {
      errOc = true;
      this.log.warn('Client returned an HTTP error code %s: "%s"', response.statusCode, response.body);
      callback(new Error("Received HTTP error code " + response.statusCode + ': "' + response.body + '"'));
    } return errOc;
  }

  identify(): void {
    this.log("Identify!");
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.lightbulbService,
    ];
  }
}