var arg = require('args-js');
var winston = require('winston');
var Promise = require('bluebird');
var Configuration = require('./configuration');

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
    {logger:        arg.OBJECT | arg.Optional, _type: winston.Logger, _default: new winston.Logger()},
    {config:        arg.OBJECT | arg.Optional, _type: Configuration, _default: new Configuration()},
  ], arguments);

  self.id = false;
  self.docker = args.docker;
  self.logger = args.logger;
  self.configuration = args.config;
  self.imageTag = args.imageTag;
  self.created = false;
  self.started = false;
  self.info = false;

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
            reject(err);
          }

          c.inspect(function(err, info){
            if (err) {
              reject(err);
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

    //image should be set to the specified imagetag
    args.createConf.Image = self.imageTag;

    self.logger.debug('  [%s] creating container...', self.imageTag);
    self.created = new Promise(function(resolve, reject){
      self.docker.createContainer(args.createConf, function (err, res) {
        if(err) {
          reject(err);
          return;
        }

        if(!res.id) {
          reject(new Error('Expected container creation to return an object with id, received:' + JSON.stringify(res)));
          return;
        }

        self.id = res.id;
        self.logger.debug('  [%s] created! (%s)', self.imageTag, self.id);
        resolve(self.id);
      });
    });

    return self.created;
  };

  return self;
};

module.exports = Container;