var arg = require('args-js');
var Promise = require('bluebird');

var Container = require('./container');

/**
 * A class that represents a single service with several
 * containers which are all started in the same fashion i.e
 * the same run command
 *   
 * @param {[type]} docker       [description]
 * @param {[type]} dependencies [description]
 */
var Service = function () {
  'use strict';
  var self = this;
  var args = arg([
    {docker:        arg.OBJECT | arg.Required},
    {dependencies:  arg.ARRAY  | arg.Optional, _default: []},
    {tag:           arg.STRING | arg.Optional, _default: false},
    {createConf:    arg.OBJECT | arg.Optional, _default: {}}
  ], arguments);

  self.docker = args.docker;  
  self.containers = [];  
  self.instantiated = false;
  self.started = false;

  //dependencies are private
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
    var depsStarted = [];
    _dependencies.forEach(function(dep){
      depsStarted.push(dep().start());
    });

    if(self.started !== false)
      return self.started;

    //first start all dependencies, then start this service's containers
    self.started = Promise.all(depsStarted).then(function(){

      var containersStarted = [];
      self.containers.forEach(function(con){
        
        //add dependencies to to args
        var confFnArgs = [con];
        _dependencies.forEach(function(dep){
          confFnArgs.push(dep());
        });

        var conf = self.configurationFn.apply(self, confFnArgs);

        if(!conf || typeof conf !== 'object') {
          throw new Error('Expected object from configuration function, received: "'+conf+'"');
        }

        containersStarted.push(con.start(conf));
      });

      //promise inception
      return Promise.all(containersStarted);
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
   * @param  {Object} creationConfig hash of options
   * @return {self} the service
   * @chainable
   */
  self.container = function container(){
    var args = arg([
      {tag:       arg.STRING | arg.Required},
      {creationConfig:       arg.OBJECT | arg.Optional, _default: {}}
    ], arguments);    

    var c = new Container(self.docker, args.tag, args.creationConfig);
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