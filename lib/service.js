var arg = require('args-js');
var winston = require('winston');
var Promise = require('bluebird');
var Container = require('./container');
var Configuration = require('./configuration');

var Processes = require('./processes');
var ServiceError = require('../lib/errors').ServiceError;

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
    {processes:        arg.OBJECT | arg.Optional, _type: Processes, _default: null}
  ], arguments);

  //default to service scoped process monitoring
  if(args.processes === null) {
    args.processes = new Processes(args.docker);
  }

  self.docker = args.docker;  
  self.logger = args.logger;
  self.containers = [];  
  self.instantiated = false;
  self.started = false;
  self.name = args.name;
  self.processes = args.processes;

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
      if(!(dep instanceof Service)) {
        throw new Error('Expected Service instance during extending, received: "'+dep+'"');
      }

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
   * Get a container by it name
   * @param  {String} containerName the container name
   * @return {Container}               container instance
   */
  self.get = function get() {
    var args = arg([
      {containerName:  arg.STRING | arg.Required},
    ], arguments);

    var names = [];
    var res = false;
    self.containers.forEach(function(c){
      names.push(c.name);
      if(c.name === args.containerName) {
        res = c;
      }
    });

    if(res === false) {
      throw new Error('Could not retrieve container with name "'+args.containerName+'", available: "'+names.join('", "')+'"');
    }

    return res;
  };

  /**
   * Pipe output of a container to an writeable stream, this is basicly an shortcut
   * for an configurationFn that sets all necessary container configurations
   * 
   * @param  {WritableStream} target        the writeable stream
   * @param  {String} containerName name of the container, defaults to the first
   * @param  {Bool} stdout        @see remote api
   * @param  {Bool} stderr        @see remote api
   * @param  {Bool} tty           @see remote api
   * @return {Self}               this service instance
   */
  self.pipe = function pipe() {
    var args = arg([
      {target:  arg.OBJECT | arg.FUNCTION | arg.Required},
      {containerName:  arg.STRING | arg.Optional, _default: false},
      {stdout:  arg.BOOLEAN | arg.Optional, _default: true},
      {stderr:  arg.BOOLEAN | arg.Optional, _default: true},
      {tty:     arg.BOOLEAN | arg.Optional, _default: false}
    ], arguments);

    self.pipeFn = function() {      
      if(args.containerName === false) {
        args.containerName = this.containers[0].name;
      }

      var container =  this.get(args.containerName);

      //apply streaming configuration
      container.configuration.attaching.stream = true;
      container.configuration.attaching.stdout = args.stdout;
      container.configuration.attaching.stderr = args.stderr;
      container.configuration.attaching.tty = args.tty;
      container.pipe(args.target);
    };

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

    //start deps first
    var startingDeps = [];
    _dependencies.forEach(function(dep){  
      startingDeps.push(dep().start());
    });

    //first start all dependencies, then start this service's containers
    self.started = Promise.all(startingDeps).then(function(){

      self.logger.info('%s starting...', self.name ? "["+self.name+"]": '');
      if(self.containers.length === 0) {
        throw new ServiceError('Attempted to start service "'+self.name+'" without containers');
      }

      var containersStarted = [];
      self.containers.forEach(function(con){
        
        //add dependencies to args
        var confFnArgs = [con.configuration];
        _dependencies.forEach(function(dep){
          confFnArgs.push(dep());
        });

        //apply the function to modify configuration
        self.configurationFn.apply(self, confFnArgs);
        
        //call fn that configures the container for piping
        self.pipeFn.apply(self, []);

        //call the start and create fn
        containersStarted.push(con.create().then(con.start));
      });

      //resolve when all containers are starte
      return Promise.all(containersStarted);
    }).then(function(){
      self.logger.info('%s started!', self.name ? "["+self.name+"]": '');
      return arguments[0];
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

    //if the container doesn't have an explicit name set it here
    if(args.container.name === false) {
      args.container.name = self.name + '_' + self.containers.length;
    }

    self.containers.push(args.container);
    return self;
  };

  /**
   * Construct and add a new container to this service based on a
   * name image and a specified configuration
   *   
   * @param  {String} tag the tag name of the image that should be used 
   * @param {Object} [createConf] shorthand for intial start config of container
   * @return {self} the service
   * @chainable
   */
  self.container = function container(){
    var args = arg([
      {tag:           arg.STRING | arg.Required},
      {createConf:    arg.OBJECT | arg.Optional, _default: {}}
    ], arguments);    

    var conf = new Configuration({createConf: args.createConf});
    var c = new Container({ docker: self.docker, 
                            imageTag: args.tag,
                            config: conf,
                            processes: self.processes,
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
  self.pipeFn = function(){ return {}; };

  return self;
};

module.exports = Service;