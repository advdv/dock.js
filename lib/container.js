var arg = require('args-js');
var winston = require('winston');
var Promise = require('bluebird');
var Configuration = require('./configuration');

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
    {docker:       arg.OBJECT | arg.Required},
    {imageTag:       arg.STRING | arg.Required},
    {name: arg.STRING | arg.Optional, _default: false},
    {logger:        arg.OBJECT | arg.Optional, _type: winston.Logger, _default: new winston.Logger()},
    {config:        arg.OBJECT | arg.Optional, _type: Configuration, _default: new Configuration()},
  ], arguments);

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

  //the dockerode container instance
  var _container = false;

  /**
   * Attach to the container
   * should first be created
   *
   * @param {Object} [createConfig] configuration for the create container endpoint
   * @param {Object} [attachConf]  configuration for container attachment
   * @return {Promise} promise that resolves with a stream 
   */
  self.attach = function attach() {
    var args = arg([
      {createConf: arg.OBJECT | arg.Optional, _default: self.configuration.creating},
      {attachConf: arg.OBJECT | arg.Optional, _default: self.configuration.attaching}
    ], arguments);

    if(self.attached !== false)
      return self.attached;

    self.attached = self.create(args.createConf).then(function(){
      return new Promise(function(resolve, reject){
        if(_container === false) {
          reject(new Error('Internal container should be defined'));
        }

        _container.attach(args.attachConf, function(err, stream) {
          if(err){
            reject(new ClientError(err.message));
          }

          resolve(stream);
        });
      });
    });

    return self.attached;
  };


  /**
   * Start the container on the daemon, container
   * should first be created
   *
   * @param {Object} [createConfig] configuration for the create container endpoint
   * @param {Object} [startConf]  configuration for container start
   * @return {Promise} promise that resolves whenever the container is started
   */
  self.start = function start() {
    var args = arg([
      {createConf: arg.OBJECT | arg.Optional, _default: self.configuration.creating},
      {startConf: arg.OBJECT | arg.Optional, _default: self.configuration.starting}
    ], arguments);

    if(self.started !== false)
      return self.started;

    self.logger.info('   [%s] starting container...', self.imageTag);

    self.started = self.create(args.createConf).then(function(){
      return new Promise(function(resolve, reject){
        var c = self.docker.getContainer(self.id);
        c.start(args.startConf, function (err) {
          if (err) {
            reject(new ClientError(err.message));
          }

          c.inspect(function(err, info){
            if (err) {
              reject(new ClientError(err.message));
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
   * Create the container on the docker deamon
   *
   * @param {Object} [createConfig] configuration for the create container endpoint
   * @return {Promise} Promise that completes with the container id
   */
  self.create = function create() {
    var args = arg([
      {createConf: arg.OBJECT | arg.Optional, _default: self.configuration.creating}
    ], arguments);

    if(self.created !== false)
      return self.created;

    //overwrite configuration with object properties
    args.createConf.Image = self.imageTag;
    if(self.name !== false) {
      args.createConf.name = self.name;
    }

    self.logger.debug('  [%s] creating container...', self.imageTag);
    self.created = new Promise(function(resolve, reject){
      self.docker.createContainer(args.createConf, function (err, con) {
        if(err) {
          reject(new ClientError(err.message));
          return;
        }

        if(!con.id) {
          reject(new ResponseError('Expected container creation to return an object with id, received:' + JSON.stringify(con)));
          return;
        }

        _container = con;
        self.id = con.id;
        self.logger.debug('  [%s] created! (%s)', self.imageTag, self.id);

        resolve(self.id);
      });
    });

    return self.created;
  };

  return self;
};

module.exports = Container;