var arg = require('args-js');
var Service = require('./service');

/**
 * A class that represents service repository
 *   
 * @param {Object} docker  "dockerode" instance
 */
var Dock = function(){
  'use strict';
  var self = this;
  var args = arg([
    {docker:       arg.OBJECT | arg.Required}
  ], arguments);

  self.docker = args.docker;
  
  //keep services private
  var _services = [];

  /**
   * Returns wether the cluster has as service with the specified
   * service name
   * @param  {String}  serviceName the name of the service
   * @return {Boolean} wether it exists
   */
  self.has = function has(){
    var args = arg([
      {serviceName:       arg.STRING | arg.Required}
    ], arguments);

    try {
      if(self.get(args.serviceName) !== false) {      
        return true;
      }
    } catch(err) {
      return false;
    }
  };

  /**
   * Retrieve a service object by 
   * @param  {String} serviceName name of the service
   * @return {Service} service instance or throw error
   */
  self.get = function get(){
    var args = arg([
      {serviceName:       arg.STRING | arg.Required}
    ], arguments);

    var res = _services[args.serviceName];
    if(res === undefined) {
      throw new Error('Could not retrieve service with name "'+args.serviceName+'", available services: '+Object.keys(_services).join(', '));
    }

    return res;
  };

  /**
   * Add a Service object to the cluster
   * @param  {String} serviceName  name the service will be referred to
   * @param {Service} service the service object
   */
  self.add = function add(){
    var args = arg([
      {serviceName:       arg.STRING | arg.Required},
      {service:       arg.OBJECT | arg.Required}
    ], arguments);

    _services[args.serviceName] = args.service;
    return self;
  };

  /**
   * Construct a new service and add it to the cluster
   * @param  {String} serviceName  name the service will be referred to
   * @param  {Array} [dependencies] array of service names this service depends
   * @return {Service} the service object
   */
  self.service = function service() {
    var args = arg([
      {serviceName:       arg.STRING | arg.Required},
      {dependencies:       arg.ARRAY | arg.Optional, _default: []}
    ], arguments);

    //transform all dependenciees .get() calls
    args.dependencies.forEach(function(dep, i){
      if(typeof dep !== 'string') {
        throw new Error('Service definition expected dependencies to be specified as string received: ' + dep);
      }        

      args.dependencies[i] = function(){
        return self.get(dep);
      };
    });

    var s = new Service(self.docker, args.dependencies);
    self.add(args.serviceName, s);
    return s;
  };

  return self;
};

module.exports = Dock;