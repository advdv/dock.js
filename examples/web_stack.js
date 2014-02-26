var Docker = require('dockerode'); // --> npm install dockerode
var Dock = require('../index.js'); // --> npm install dock.js
var Promise = require("bluebird"); // --> npm install bluebird
var winston = require('winston'); // -> npm install winston

//create the docker server using dockerocde
var server = new Docker({host: 'http://172.12.8.150', port: 4243});

//create a new dock
var dock = new Dock(server);

//add a winston console transport
dock.logger.add(winston.transports.Console, {colorize: true}); 
Promise.onPossiblyUnhandledRejection(function(error){
  'use strict';
  dock.logger.error(error.message);
});

//create services
dock.service('src', [], 'busybox:latest')
    .configure(function(){
      'use strict';
      return {
        Cmd: 'ls'
      };
    });

dock.start();