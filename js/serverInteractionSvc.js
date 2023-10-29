angular
  .module("sampleApp")
  //Created when working to integrate InterSystems and needing send an api key with all calls...

  .service("serverInteractionSvc", function (appConfigSvc) {
    return {
      getServerConfig() {
        let config = {};
        let dataServer = appConfigSvc.getCurrentDataServer();
        if (dataServer.apiKey) {
          config.headers = { "x-api-key": dataServer.apiKey };
        }
        return config;
      },
    };
  });
