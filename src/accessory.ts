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
import { callbackify } from "util";
import { hasUncaughtExceptionCaptureCallback } from "process";
import { url } from "inspector";
import request = require("request");
const colorsys = require('colorsys');
/**
 * Parse the config and instantiate the object.
 *
 * @summary 
 * @constructor
 * @param {function} log 
 * @param {object} config 
 */

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory('homebridge-http-prog', 'http-prog', Switch);
};

class Switch implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private readonly config: AccessoryConfig;
  private power: number;
  private brightness: number;
  private saturation: number;
  private hue: number;
  private bulbOn = false;
  private http_method: string;
  private user_agent: string;
  private url: string;
  private port: number;
  private timeout: number;
  private state_body: JSON;
  private update_rgb_body: JSON;
  private readonly informationService: Service;
  private readonly lightbulbService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.config = config;
    this.name = config.name;
    
    this.power = 0;
    this.brightness = 100;
    this.saturation = 0;
    this.hue = 0;

    this.http_method = config.http_method || 'GET';
    this.user_agent = config.user_agent || 'Homebridge UA';
    this.url = config.url || 'localhost';
    this.port = config.port || '80';
    this.timeout = config.timeout || '100';
    this.state_body = config.state_body || null;
    this.update_rgb_body = config.update_rgb__body || null;


    this.lightbulbService = new hap.Service.Lightbulb(this.name);
    this.lightbulbService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("GET of Bulb: " + (this.bulbOn? "ON":"OFF"));
        callback(undefined, this.bulbOn);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.bulbOn = value as boolean;
        this.setColor();
        this._httpRequest(this.url, this.update_rgb_body, this.http_method, this.timeout, callback)
        log.info("SET of Bulb: " + (this.bulbOn? "ON":"OFF"));
        callback();
      });
    this.lightbulbService.getCharacteristic(hap.Characteristic.Hue)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("GET Hue: " + (this.hue));
        callback(undefined, this.hue);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.hue = value as number;
        this.setColor();
        log.info("SET Hue: " + (this.hue));
        callback();
      });
    this.lightbulbService.getCharacteristic(hap.Characteristic.Saturation)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("GET Saturation: " + (this.saturation));
        callback(undefined, this.saturation);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue ,callback: CharacteristicSetCallback) => {
        this.saturation = value as number;
        this.setColor();
        log.info("SET Saturation: " + (this.saturation));
        callback();
      });
    this.lightbulbService.getCharacteristic(hap.Characteristic.Brightness)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("GET Brightness: " + (this.brightness));
        callback(undefined, this.power);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.brightness = value as number;
        this.setColor();
        log.info("SET of Bulb: " + (this.brightness))
        callback();
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Joshua De Marco")
      .setCharacteristic(hap.Characteristic.Model, "Arduino Lightstrip LED")
      .setCharacteristic(hap.Characteristic.SerialNumber, "123-123-123");

    log.info("Switch finished initializing!");
  }

  setColor(): void{
    const color = colorsys.hsv_to_rgb({
      h: this.hue,
      s: this.saturation,
      v: this.brightness
    });
    if(!this.power){
      color.r = 0;
      color.g = 0;
      color.b = 0;
    }
  }


  _httpRequest(url: string, body: JSON, method: string, timeout: number, callback: CharacteristicSetCallback) {
    request(url, {
      method: method,
      timeout: timeout,
      rejectUnauthorized: false,
      body: body
    });
    callback();
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