/* globals setTimeout */
var Readable = require('stream').Readable;

module.exports = function stubDockerodeImage() {
  'use strict';
  var self = this;

  self.push = function(conf, cb) {
    setTimeout(function(){
      var stream = new Readable();

      // if(conf.t === 'failMe:latest') {
      //   stream.push(new Buffer(JSON.stringify({error: 'test error'})));
      // } else if(conf.t === 'statusMe:latest') {
      //   stream.push(new Buffer(JSON.stringify({status: 'Pulling repository stackbrew/ubuntu'})));
      // } else if(conf.t === 'downloadMe:latest') {
      //   stream.push(new Buffer(JSON.stringify({status: 'Downloading'})));
      // } else {
      //   stream.push(new Buffer('{"stream":"Successfully built 3d65aee0eaea"}'));  
      // }
      
      stream.push(null);

      cb(false, stream);
    },Math.floor((Math.random()*20)+1));
  };

};