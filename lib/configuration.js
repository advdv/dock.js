var arg = require('args-js');

/**
 * A class that represents configuration for individual containers,
 * it exposes easy to use methods for customizing them.
 *  
 * @param {Object} createConf configuration hash used during container creation
 * @param {Object} startConf  configuraiton hash used during container start
 */
var Configuration = function(){
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