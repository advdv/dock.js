var arg = require('args-js');

var Configuration = function(createConf, startConf){
  'use strict';
  var self = this;
  var args = arg([
    {createConf:    arg.OBJECT | arg.Optional, _default: {}},
    {startConf:    arg.OBJECT | arg.Optional, _default: {}}
  ], arguments);

  self.starting = args.startConf;
  self.creating = args.createConf;

  return self;
};

module.exports = Configuration;