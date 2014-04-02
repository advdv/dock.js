var arg = require('args-js');
var winston = require('winston');
var Promise = require('bluebird');

var Configuration = require('./configuration');
var Processes = require('./processes');

var ClientError = require('../lib/errors').ClientError;
var ResponseError = require('../lib/errors').ResponseError;

/**
 * A class that represents a docker container
 *   
 * @param {Object} docker  the "dockerode" instance
 * @param {String} imageTag tag of the image that will be used
 * @param {Object} createConf configuration has for container creation
 */
var Container = function(){
  'use strict';
  var self = this;
  var args = arg([
    {docker:        arg.OBJECT | arg.Required},
    {imageTag:      arg.STRING | arg.Required},
    {name:          arg.STRING | arg.Optional, _default: false},
    {logger:        arg.OBJECT | arg.Optional, _type: winston.Logger, _default: new winston.Logger()},
    {config:        arg.OBJECT | arg.Optional, _type: Configuration, _default: new Configuration()},
    {processes:        arg.OBJECT | arg.Optional, _type: Processes, _default: null}
  ], arguments);

  //default value with arg deps
  if(args.processes === null) {
    args.processes = new Processes(args.docker);
  }

  self.id = false;
  self.name = args.name;
  self.docker = args.docker;
  self.logger = args.logger;
  self.configuration = args.config;
  self.imageTag = args.imageTag;
  self.created = false;
  self.started = false;
  self.attached = false;
  self.info = false;
  self.processes = args.processes;

  //the dockerode container instance
  var _stream = Promise.defer();

  /**
   * Pipe the the attached stream to a writeable stream
   */
  self.pipe = function pipe() {
    var args = arg([
      {target:        arg.OBJECT | arg.FUNCTION | arg.Required},
    ], arguments);

    var p = _stream.promise;
    p.then(function(source){
      if(typeof args.target === 'function') {
        return args.target(source);
      } 

      return source.pipe(args.target);
    });

    return p;
  };

  /**
   * Start the container on the daemon, container
   * should first be created
   *
   * @return {Promise} promise that resolves whenever the container is started
   */
  self.start = function start() {    
    if(self.started !== false)
      return self.started;

    self.logger.info('   [%s] starting container...', self.imageTag);

    //get configuration for starting
    var conf = self.configuration.starting;

    //capture stream
    var p;
    if(self.configuration.attaching.stream === true) {
      p = self.attach();
    } else {
      p = self.create();
    }

    self.started = p.then(function(){
      return new Promise(function(resolve, reject){
        var c = self.docker.getContainer(self.id);
        c.start(conf, function (err) {
          if (err) {
            reject(new ClientError(err.message));
            return;
          }

          c.inspect(function(err, info){
            if (err) {
              reject(new ClientError(err.message));
              return;
            }

            self.info = info;
            self.logger.info('   [%s] started! (%s)', self.imageTag, self.id);
            
            resolve(self.info);
          });
        });
      });
    });

    return self.started;
  };

  /**
   * Attach to the container
   * should first be created
   *
   * @return {Promise} promise that resolves with a stream 
   */
  self.attach = function attach() {
    if(self.attached !== false)
      return self.attached;

    //get configuration for starting
    var conf = self.configuration.attaching;
    self.attached = self.create().then(function(){
      return new Promise(function(resolve, reject){
        var container = self.docker.getContainer(self.id);
        if(container === false) {
          reject(new Error('Internal container should be defined'));
        }

        container.attach(conf, function(err, stream) {
          if(err){
            var e = new ClientError(err.message);
            reject(e);
            _stream.reject(e);
            return;
          }

          _stream.resolve(stream);
          resolve(stream);
        });
      });
    });

    return self.attached;
  };

  /**
   * Create the container on the docker deamon
   *
   * @return {Promise} Promise that completes with the container id
   */
  self.create = function create() {    
    if(self.created !== false)
      return self.created;

    //overwrite configuration with object properties
    var conf = self.configuration.creating;
    conf.Image = self.imageTag;
    if(self.name !== false && !conf.name) {
      conf.name = self.name;

      //if the container is named explicetly we might be able to reuse its id
      if(self.processes.has(conf.name)) {


        var info = self.processes.get(conf.name);        
        if(!Processes.isCreatedEqual(info, conf)) {
          return self.processes
                        .remove(conf.name)
                        .then(self.create);
        } else {
          self.logger.info('  [%s] re-using container %s', self.imageTag, info.ID);             
          self.created = Promise.cast(info.ID);
        }
      }
    }

    //if still not created, call the docker deamon to create it
    if(self.created === false) {
      self.logger.debug('  [%s] creating container...', self.imageTag);
      self.created = new Promise(function(resolve, reject){
        self.docker.createContainer(conf, function (err, con) {
          if(err) {
            reject(new ClientError(err.message));
            return;
          }

          if(!con.id) {
            reject(new ResponseError('Expected container creation to return an object with id, received:' + JSON.stringify(con)));
            return;
          }

          self.logger.debug('  [%s] created! (%s)', self.imageTag, self.id);
          resolve(con.id);
        });
      });
    }

    return self
      .created
      .then(function(id){
        self.id = id;        
        return id;
      });
  };

  return self;
};

module.exports = Container;