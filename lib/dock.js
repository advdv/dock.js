var arg = require('args-js');
var winston = require('winston');
var Promise = require('bluebird');

var Processes = require('./processes');
var Service = require('./service');
var Repository = require('./repository');

/**
 * A class that represents service repository
 *   
 * @param {Object} docker  "dockerode" instance
 * @param {Logger} [logger] winston logger instance used for logging
 * @param {Array} [images] predefined array of images
 */
var Dock = function(){
  'use strict';
  var self = this;
  var args = arg([
    {docker:       arg.OBJECT | arg.Required},
    {prefix:       arg.STRING | arg.Optional, _default: ''},
    {logger:       arg.OBJECT | arg.Optional, _type: winston.Logger, _default: new winston.Logger()},
    {images:       arg.ARRAY | arg.Optional, _default: []}
  ], arguments);

  self.prefix = args.prefix; 
  self.docker = args.docker;
  self.logger = args.logger;
  
  self.repository = new Repository(self.docker, self.logger, args.images);
  self.processes     = new Processes(self.docker);

  //keep services private
  var _services = [];

  //consistently prefix servicenames for internal use
  var _prefix = function() {
    var args = arg([
      {serviceName:       arg.STRING | arg.Required},
      {prefix:       arg.STRING | arg.Optional, _default: self.prefix}
    ], arguments);

    //@todo this fails if the prefix is the same as the servicename
    if(args.serviceName.indexOf(args.prefix) === 0) {
      return args.serviceName;
    }

    return args.prefix + args.serviceName;
  };

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
   * Retrieve a service object by its name
   * @param  {String} serviceName name of the service
   * @return {Service} service instance or throw error
   */
  self.get = function get(){
    var args = arg([
      {serviceName:       arg.STRING | arg.Required}
    ], arguments);

    //apply prefix
    args.serviceName = _prefix(args.serviceName);
    
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

    //prefix service names
    args.serviceName = _prefix(args.serviceName);
    args.service.name = args.serviceName;

    _services[args.serviceName] = args.service;
    return self;
  };

  /**
   * Construct a new image and add it to this instance
   *   
   * @see Repository.create
   * @chainable
   */
  self.image = function image() {
    var args = arg([
      {imageTag:       arg.STRING | arg.Required},
      {contextDir:       arg.STRING | arg.Required},
      {buildConf:        arg.OBJECT | arg.Optional, _default: {}}
    ], arguments);

    self.repository.add(self.repository.create(args.imageTag, args.contextDir, args.buildConf));
    return self;
  };

  /**
   * Build all in the repository
   *
   * @see Repository.build
   * @return {Promise} a promise that completes when all images are build
   */
  self.build = function build() {
    return self.repository.build();
  };

  /**
   * Construct a new service and add it to this instance
   * @param  {String} serviceName  name the service will be referred to
   * @param  {Array} [dependencies] array of service names this service depends
   * @param  {Object} createConf configuration has for container creation
   * @return {Service} the service object
   */
  self.service = function service() {
    var args = arg([
      {serviceName:       arg.STRING | arg.Required},
      {dependencies:      arg.ARRAY | arg.Optional, _default: []},
      {tag:               arg.STRING | arg.Optional, _default: false},
      {createConf:        arg.OBJECT | arg.Optional, _default: {}}
    ], arguments);

    //transform all dependencies into .get() funtion calls
    args.dependencies.forEach(function(dep, i){
      if(typeof dep !== 'string') {
        throw new Error('Service definition expected dependencies to be specified as string received: ' + dep);
      }        

      args.dependencies[i] = function(){
        return self.get(dep);
      };
    });

    var s = new Service({docker: self.docker, 
                         dependencies: args.dependencies, 
                         logger: self.logger, 
                         tag: args.tag,
                         createConf: args.createConf,
                         processes: self.processes,
                         name: _prefix(args.serviceName)});

    self.add(args.serviceName, s);
    return s;
  };

  /**
   * Start all services
   *   
   * @return {Promise} a promse that completes when all services are started
   */
  self.start = function start() {
    var serviceNames = self.getRootServices();
    
    var started = [];
    serviceNames.forEach(function(name){
      started.push(self.get(name).start());
    });

    //return promise that completes when all services are started
    return Promise.all(started);
  };

  /**
   * Get the services that are not dependant on by other
   * services
   * 
   * @return {Array} list of service names
   */
  self.getRootServices = function analyseAll() {
    var serviceNames = Object.keys(_services);
    var roots = [];
    var analysed = [];

    serviceNames.forEach(function(name){
      if(analysed.indexOf(name) !== -1) {
        return;
      }

      var res = self.analyse(name).analysed;      
      analysed = analysed.concat(res);
      roots.push(res.pop());

      //if root is found to be a non root later on
      res.forEach(function(n){
        var idx = roots.indexOf(n);
        if(idx !== -1) {
          roots.splice(idx, 1);
        }
      });

    });

    return roots;
  };

  /**
   * Analyse a service dependencies and trow on circular references
   * @param {String|Service} service the service for which we want to analyse the dependencies
   * @param {Object} [info] an optional hash of info
   * 
   * @author Jonathan Barronville <https://gist.github.com/jonathanmarvens/7383902>
   */
  self.analyse = function analyse(){
    var args = arg([
      {serviceName:       arg.STRING | arg.Required},
      {info:       arg.OBJECT | arg.Optional, _default: {analysed: [], unanalysed: []}},
    ], arguments);
    
    var service = self.get(args.serviceName);
    var info = args.info;
    var idx = info.unanalysed.length;

    info.unanalysed.push(service.name);
    service.dependencies.forEach(function(dep){
      if(info.analysed.indexOf(dep.name) === -1) {
        if(info.unanalysed.indexOf(dep.name) === -1) {
          self.analyse(dep.name, info);
        } else {
          throw new Error('Circular dependency detected "'+service.name+'" -> "'+dep.name+'"');
        }
      }
    });

    info.analysed.push(service.name);
    info.unanalysed.splice(idx, 1);
    return info;
  };

  return self;
};

module.exports = Dock;