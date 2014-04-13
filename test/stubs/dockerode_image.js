/* globals setTimeout */
var Readable = require('stream').Readable;

module.exports = function stubDockerodeImage() {
  'use strict';
  var self = this;

  self.tag = function(conf, cb) {
    setTimeout(function(){
      cb();
    },Math.floor((Math.random()*20)+1));
  };

  self.push = function(conf, cb) {
    setTimeout(function(){
      var stream = new Readable();

      stream.push(null);

      cb(false, stream);
    },Math.floor((Math.random()*20)+1));
  };

};