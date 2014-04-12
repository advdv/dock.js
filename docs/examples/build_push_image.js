/* globals console */
/* jshint strict: false */
var Dock = require('../../index.js'); // --> npm install dock.js
var Docker = require('dockerode'); // --> npm install dockerode
var winston = require('winston'); // --> npm install winston

//create client
var client = new Docker({host: 'http://172.12.8.150', port: 4243});

//create api
var dock = new Dock(client);

//display logging in console
dock.logger.add(winston.transports.Console, {colorize: true}); 
 
//define images
dock.image('reg.stepshape.com:5000/sandbox:0.3', __dirname + '/sandbox', {nocache: true});

//build then start
dock.repository.get('reg.stepshape.com:5000/sandbox:0.3')
    .push()
    .then(function(){
      console.log('done!');
    }).catch(function(err){
      console.error(err);
    });