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
  Service,
  Int8
} from "homebridge";
import request = require("request");
import { timeStamp } from "console";
const colorsys = require('colorsys');
const PACKAGE = require('./package.json');
/**
 * Parse the config and instantiate the object.
 *
 * @summary 
 * @constructor
 * @param {function} log 
 * @param {object} config 
 */

// THIS IS A TEST TO SEE IF SOMETHING CHANGED


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
  private bulbOn = false;
  private bulb_on: string; //The string sent when the bulb should turn on
  private bulb_off: string; //The string sent when the bulb should turn off
  private cache ={r: 0,g: 0,b: 0};
  //private http_method: string;
  //private user_agent: string;
  //private url: string;
  //private port: number;
  //private timeout: number;
  //private state_on_body: JSON;
  //private state_off_body: JSON;
  //private update_rgb_body: JSON;
  //private send_http: Object;
  private readonly informationService: Service;
  private readonly lightbulbService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.config = config;
    this.name = config.name;

    this.bulb_on = config.bulb_on;
    this.bulb_off = config.bulb_off;
    
    this.bulbOn = false;
    this.brightness = 100;
    this.saturation = 0;
    this.hue = 0;

    this.cache = {r: 0, g: 0, b: 0};

    //this.send_http = config.send_http[config.send_http.url || 'http://localhost', config.send_http.http_method || 'GET'];


    //this.http_method = config.http_method || 'GET';
    //this.user_agent = config.user_agent || 'Homebridge UA';
    //this.url = config.url || 'http://localhost';
    //this.port = config.port || '80';
    //this.timeout = config.timeout || '100';
    //this.state_on_body = config.state_on_body || null;
    //this.state_off_body = config.state_off_body || null;
    //this.update_rgb_body = config.update_rgb__body || null;

    class HTTP {
      http_method: string;
      url: string;
      port: number;
      headers: JSON;
      body: JSON;
      constructor(ident: string){
        this.http_method = config[ident].http_method || 'GET';
        this.url = config[ident].url || 'http://localhost';
        this.port = config[ident].port || '80';
        this.headers = config[ident].headers || null;
        this.body = config[ident].body || null;
      }
    }
    //Checking if neccessary arguments are given
    if(!config.send_state_on){
       new Error("No send_state specified! Please read " + PACKAGE.repository.url + " for more information.");
    } else if(!config.send_state_off){
       new Error("No send_state_off specified! Please read " + PACKAGE.repository.url + " for more information.");
    } else if(!config.send_update){
       new Error("No send_update specified! Please read " + PACKAGE.repository.url + " for more information.");
    } else {
      log.info("Successfully read configuration!")
    }

    let send_state_on = new HTTP("send_state_on");
    let send_state_off = new HTTP("send_state_off");
    let send_update = new HTTP("send_update");


    this.lightbulbService = new hap.Service.Lightbulb(this.name);
    this.lightbulbService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("GET of Bulb: " + (this.bulbOn? "ON":"OFF"));
        callback(undefined, this.bulbOn);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.bulbOn = value as boolean;
        this._setColor();
        var x;
        this.bulbOn? x=send_state_on:x=send_state_off;
        for(let e in x){
          e.replace('%s', (this.bulbOn? this.bulb_on:this.bulb_off).toString());
        };
        this._httpRequest(x.http_method, x.url, x.port, x.headers, x.body, callback);
      });
    this.lightbulbService.getCharacteristic(hap.Characteristic.Hue)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("GET Hue: " + (this.hue));
        callback(undefined, this.hue);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.hue = value as number;
        this._setColor();
        var x = send_update;
        for(let e in x){
          e.replace('%r', this.cache.r.toString());
          e.replace('%g', this.cache.g.toString());
          e.replace('%b', this.cache.b.toString());
        };
        this._httpRequest(x.http_method, x.url, x.port, x.headers, x.body, callback);
      });
    this.lightbulbService.getCharacteristic(hap.Characteristic.Saturation)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("GET Saturation: " + (this.saturation));
        callback(undefined, this.saturation);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.saturation = value as number;
        this._setColor();
        var x = send_update;
        for(let e in x){
          e.replace('%r', this.cache.r.toString());
          e.replace('%g', this.cache.g.toString());
          e.replace('%b', this.cache.b.toString());
        };
        this._httpRequest(x.http_method, x.url, x.port, x.headers, x.body, callback);
      });
    this.lightbulbService.getCharacteristic(hap.Characteristic.Brightness)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("GET Brightness: " + (this.brightness));
        callback(undefined, this.brightness);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.brightness = value as number;
        this._setColor();
        var x = send_update;
        for(let e in x){
          e.replace('%r', this.cache.r.toString());
          e.replace('%g', this.cache.g.toString());
          e.replace('%b', this.cache.b.toString());
        };
        this._httpRequest(x.http_method, x.url, x.port, x.headers, x.body, callback);
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Joshua De Marco")
      .setCharacteristic(hap.Characteristic.Model, "Arduino Lightstrip LED")
      .setCharacteristic(hap.Characteristic.SerialNumber, "123-123-123");

    log.info("HTTP-PROG finished initializing!");
  }

  _setColor() {
    const color = colorsys.hsv_to_rgb({
      h: this.hue,
      s: this.saturation,
      v: this.brightness
    });
    if(!this.bulbOn){
      color.r = 0;
      color.g = 0;
      color.b = 0;
    }
     var x = this.cache //Would for loop make more sense? correct implementations failed until now --> for(let x in color){this.cache[x] = color[x]} - cache[x] failed
     x.r = color.r 
     x.g = color.g
     x.b = color.b 
    this.log('RGB: ' + this.cache.r + this.cache.g + this.cache.b );
  }


  _httpRequest(method: string, url: string, port: number, headers: JSON, body: JSON, callback: CharacteristicSetCallback) {
    request(url, {
      method: method,
      port: port,
      headers: headers,
      rejectUnauthorized: false,
      body: body
    }, function(error: Error, response: request.Response, body: JSON){callback()} //left in code for future error handling
    );
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