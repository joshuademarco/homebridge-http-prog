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

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("ExamplezSwitch", ExampleSwitch);
};

class ExampleSwitch implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private switchOn = false;

  private readonly switchService: Service;
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;

    this.switchService = new hap.Service.Switch(this.name);
    this.switchService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("Current state of the switch was returned: " + (this.switchOn? "ON": "OFF"));
        callback(undefined, this.switchOn);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.switchOn = value as boolean;
        log.info("Switch state was set to: " + (this.switchOn? "ON": "OFF"));
        callback();
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Custom Manufacturer")
      .setCharacteristic(hap.Characteristic.Model, "Custom Model");

    log.info("Switch finished initializing!");
  }


  identify(): void {
    this.log("Identify!");
  }


  
  getServices(): Service[] {
    return [
      this.informationService,
      this.switchService,
    ];
  }

}
