/* globals setTimeout */
var crypto = require('crypto');
var arg = require('args-js');

module.exports = function stubDockerodeContainer(id) {
  'use strict';
  var self = this;
  var args = arg([
    {id:       arg.STRING | arg.Optional, _default: crypto.randomBytes(20).toString('hex')},
  ], arguments);
  
  self.id = args.id;

  self.attach = function(conf, cb) {

    cb(false, {
      on: function(){},
      pipe: function(){}
    });
  };

  self.start = function(conf, cb) {
    setTimeout(function(){
      cb();
    },Math.floor((Math.random()*20)+1));
  };

  self.inspect = function(cb) {
    setTimeout(function(){
      cb(false, {
        "NetworkSettings": {
          "IpAddress": "",
          "IpPrefixLen": 0,
          "Gateway": "",
          "Bridge": "",
          "PortMapping": null
        },
      });
    },Math.floor((Math.random()*20)+1));
  };

  return self;
};