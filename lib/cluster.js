var arg = require('args-js');
var Service = require('./service');

/**
 * A class that represents a cluster of services
 *   
 * @param {Object} docker  "dockerode" instance
 * @param {Array} [services] predefined array of services 
 */
var Cluster = function(){
  'use strict';
  var self = this;
  var args = arg([
    {docker:       arg.OBJECT | arg.Required}
  ], arguments);

  self.docker = args.docker;
  self.services = [];

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

    if(self.get(args.serviceName) !== false) {      
      return true;
    }

    return false;
  };

  /**
   * Retrieve a service object by 
   * @param  {[type]} serviceName [description]
   * @return {[type]}             [description]
   */
  self.get = function get(){
    var args = arg([
      {serviceName:       arg.STRING | arg.Required}
    ], arguments);

    var res = false;
    self.services.forEach(function(service){
      if(service.name == args.serviceName)
        res = service;
    });

    return res;
  };

  /**
   * Add a Service object to the cluster
   * @param {Service} service the service object
   */
  self.add = function add(){
    var args = arg([
      {service:       arg.OBJECT | arg.Required},
    ], arguments);

    return self.services.push(args.service);
  };

  /**
   * Construct a new service and add it to the cluster
   * @param  {String} serviceName  name the service will be referred to
   * @param  {Array} [dependencies] array of service names this service depends @readOnly
   * @return {Service} the service object
   */
  self.service = function service() {
    var args = arg([
      {serviceName:       arg.STRING | arg.Required},
      {dependencies:       arg.ARRAY | arg.Optional, _default: []}
    ], arguments);

    var s = new Service(self.docker, args.serviceName, args.dependencies);
    self.add(s);
    return s;
  };


  return self;
};

module.exports = Cluster;