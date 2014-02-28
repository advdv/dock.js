var arg = require('args-js');
var winston = require('winston');
var Promise = require('bluebird');
var Container = require('./container');

/**
 * A class that represents a single service with several
 * containers which are all started in the same fashion i.e
 * the same run command
 *   
 * @param {Object} docker  dockerode instance
 * @param {String} name service identifier
 * @param {Array} [dependencies] array of service instances
 * @param {String} [tag] shorthand to initiate one container immediately with this image
 * @param {Object} [createConf] shorthand for intial start config of container
 * @param {Object} [logger] winston logger instance, is created automaticly if not specified
 */
var Service = function () {
  'use strict';
  var self = this;
  var args = arg([
    {docker:        arg.OBJECT | arg.Required},
    {name:          arg.STRING | arg.Required},
    {dependencies:  arg.ARRAY  | arg.Optional, _default: []},
    {tag:           arg.STRING | arg.Optional, _default: false},
    {createConf:    arg.OBJECT | arg.Optional, _default: {}},
    {logger:        arg.OBJECT | arg.Optional, _type: winston.Logger, _default: new winston.Logger()},
  ], arguments);

  self.docker = args.docker;  
  self.logger = args.logger;
  self.containers = [];  
  self.instantiated = false;
  self.started = false;
  self.name = args.name;

  //privates
  var _dependencies = [];  

  /**
   * Specify an requirement for this service, can be a function that returns the service
   *   
   * @param  {Object|Function} dep the dependency
   * @return {Self} this service
   * @chainable
   */
  self.requires = function requires(dep) {
    var d = dep;
    if(!(dep instanceof Function)) {
      d = function(){ return dep; };
    }
    
    _dependencies.push(d);
    return self;
  };

  /**
   * Instantiate the service by creating containers without
   * starting them
   *   
   * @return {Promise} a promise that completes when each container is created
   */
  self.instantiate = function create() {
    var promises = [];
    if(self.instantiated !== false)
      return self.instantiated;

    //add all dep instatiations
    _dependencies.forEach(function(dep){
      promises.push(dep().instantiate());
    });

    //add own container promises
    self.containers.forEach(function(container){
      promises.push(container.create());
    });

    self.instantiated = Promise.all(promises);
    return self.instantiated;
  };

  /**
   * Specify a function that is called to create the start
   * configuration for all containers whenever they are ran
   * 
   * @param  {Function} confFn function that received all dependant services and should return config object
   * @return {self} the service itself
   */
  self.configure = function configure() {
    var args = arg([
      {confFn:        arg.FUNCTION | arg.Required},
    ], arguments);

    self.configurationFn = args.confFn;
    return self;
  };


  /**
   * Start the service by first starting all dependant services
   * and then starting this one
   * 
   * @return {Promise} a promise that completes when the service is started
   */
  self.start = function start() {
    if(self.started !== false)
      return self.started;

    //dependencies already started, prevents circular recursion  
    var startingDeps = [];
    _dependencies.forEach(function(dep){  
      startingDeps.push(dep().start());
    });

    //first start all dependencies, then start this service's containers
    self.started = Promise.all(startingDeps).then(function(){

      self.logger.info('%s starting...', self.name ? "["+self.name+"]": '');
      if(self.containers.length === 0) {
        throw new Error('Attempted to start a service "'+self.name+'" without containers');
      }

      var containersStarted = [];
      self.containers.forEach(function(con){
        
        //add dependencies to to args
        var confFnArgs = [con.configuration];
        _dependencies.forEach(function(dep){
          confFnArgs.push(dep());
        });

        self.configurationFn.apply(self, confFnArgs);
        // if(!conf || typeof conf !== 'object') {
        //   throw new Error('Expected object from configuration function, received: "'+conf+'"');
        // }

        containersStarted.push(con.create().then(con.start));
      });

      //attach logger when all containers are started
      var res = Promise.all(containersStarted);
      res.then(function(){
        self.logger.info('%s started!', self.name ? "["+self.name+"]": '');
      });

      //promise inception
      return res;
    });

    return self.started;
  };

  /**
   * Add a container to the service
   * @param {Object} container a container object
   * @return {self} the service
   * @chainable
   */
  self.add = function add(){
    var args = arg([
      {container:       arg.OBJECT | arg.Required}
    ], arguments);    

    self.containers.push(args.container);
    return self;
  };

  /**
   * Construct and add a new container to this service based on a
   * name image and a specified configuration
   *   
   * @param  {String} tag the tag name of the image that should be used 
   * @return {self} the service
   * @chainable
   */
  self.container = function container(){
    var args = arg([
      {tag:       arg.STRING | arg.Required}
    ], arguments);    

    var c = new Container({ docker: self.docker, 
                            imageTag: args.tag,
                            logger: self.logger});

    self.add(c);
    return self;
  };

  /**
   * Construction logic
   */

  //short hand one service one container  
  if(args.tag !== false) {  
    self.container(args.tag, args.createConf);
  }

  args.dependencies.forEach(function(dep){
    self.requires(dep);
  });

  Object.defineProperty(self, 'dependencies', {
    get: function(){
      var res = [];
      _dependencies.forEach(function(dep){
        res.push(dep());
      });
      return res;
    }
  });

  //default configuration function returns an empty object
  self.configurationFn = function(){ return {}; };

  return self;
};

module.exports = Service;