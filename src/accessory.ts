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
  private cache = {r: 0,g: 0,b: 0}; // Cache of RGB values
  private readonly informationService: Service;
  private readonly lightbulbService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.config = config;  //Reference to the config file one edits to set up the accessory
    this.name = config.name;

    this.bulb_on = config.bulb_on || 'on';    // Get config index, if empty take default
    this.bulb_off = config.bulb_off || 'off';
    
    this.bulbOn = false; // Default state of BULB
    this.brightness = 0;
    this.saturation = 0;
    this.hue = 0;
    this.cache = {r: 0, g: 0, b: 0};

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
      constructor(ident: string){
        this.http_method = config[ident].http_method || 'GET';
        this.url = config[ident].url || 'http://localhost';
        this.port = config[ident].port || '80';
        this.headers = config[ident].headers || null;
        this.body = JSON.stringify(config[ident].body) || '';
      }
    }
    //Checking if neccessary arguments are given in the conifg
    if(config.send_state == undefined) {
       log.error("No send_state specified! Please read " + PACKAGE.repository.url + " for more information.");
      } else if(config.send_update == undefined){
        log.error("No send_update specified! Please read " + PACKAGE.repository.url + " for more information.");
      } else if(config.get == undefined){
        log.error("No send_state_off specified! Please read " + PACKAGE.repository.url + " for more information.");
      } else {
        log.info("Successfully read configuration!");
      }

    // Initiate new HTTP
    let send_state = new HTTP("send_state");
    let send_update = new HTTP("send_update");
    let get = new HTTP("get");


    this.lightbulbService = new hap.Service.Lightbulb(this.name);
    this.lightbulbService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => { // Get current state of BULB
        log.info("GET of Bulb: " + (this.bulbOn? "ON":"OFF"));
        callback(undefined, this.bulbOn);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => { // Set current state of BULB
        this.bulbOn = value as boolean;
        this._setColor();
        var x = send_state;
        var y = this.bulbOn? this.bulb_on:this.bulb_off; // Use user preferred values of on and off 
        var url_p = x.url.replace('%s', y); // Replace value with placeholder in URL
        var body_p = JSON.stringify(x.body).replace('%s', y); //  Same for BODY and keep it in string
        this._httpRequest(x.http_method, url_p, x.port, x.headers, body_p, callback);
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
        var rlp = this._replaceColor(x.url, x.body);
        this._httpRequest(x.http_method, rlp.url, x.port, x.headers, rlp.body, callback);
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
        var rlp = this._replaceColor(x.url, x.body);
        this._httpRequest(x.http_method, rlp.url, x.port, x.headers, rlp.body, callback);
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
        var rlp = this._replaceColor(x.url, x.body);
        this._httpRequest(x.http_method, rlp.url, x.port, x.headers, rlp.body, callback);
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Joshua De Marco")
      .setCharacteristic(hap.Characteristic.Model, "Arduino Lightstrip LED")
      .setCharacteristic(hap.Characteristic.SerialNumber, "123-123-123");
    log.info("HTTP-PROG finished initializing!");
  }
  
  // Following function only replaces RGB palceholders like %r
  _replaceColor(url: string, body: string){
    var x = this.cache;
    var new_url = url.replace('%r', x.r.toString()).replace('%g', x.g.toString()).replace('%b', x.b.toString()); //url.replace(/%r|%g|%b/gi, (_,n) => mapRGB[+n-1].toString()); trying to implement this
    var new_body = body.replace('%r', x.r.toString()).replace('%g', x.g.toString()).replace('%b', x.b.toString());
    return {url: new_url, body: new_body};
  }

  // Transform HSV information to RGB
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
    var x = this.cache; // Updating the cache
    x.r = color.r 
    x.g = color.g
    x.b = color.b 
    this.log('RGB:', color.r, color.g, color.b );
  }

  // Main HTTP request
  _httpRequest(method: string, url: string, port: number, headers: JSON, body: string, callback: CharacteristicSetCallback) {
      request(url, {
        method: method,
        port: port,
        headers: headers,
        rejectUnauthorized: false,
        body: body
      }, function(error, response, body){
        if(error){
          console.warn('The HTTP equest returned an error ', error.message);
          callback(error);
        } else if (response.statusCode != 200){
          console.warn('Client returned an HTTP error code %s: "%s"', response.statusCode, response.body);
          callback(new Error("Received HTTP error code " + response.statusCode + ': "' + response.body + '"'));
        } else {
        callback(undefined);
      }
    });      
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