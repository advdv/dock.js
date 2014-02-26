var arg = require('args-js');
var winston = require('winston');
var Promise = require('bluebird');

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
    {createConf: arg.OBJECT | arg.Optional, _default: {}},
    {logger:        arg.OBJECT | arg.Optional, _type: winston.Logger, _default: new winston.Logger()},
  ], arguments);

  self.id = false;
  self.docker = args.docker;
  self.logger = args.logger;
  self.imageTag = args.imageTag;
  self.createConf = args.createConf;
  self.created = false;
  self.started = false;
  self.info = false;

  //merge mandatory image tag into create config
  self.createConf.Image = self.imageTag;

  /**
   * Start the container on the daemon, container
   * should first be created
   *   
   * @return {Promise} promise that resolves whenever the container is started
   * @param {Object} startConf  configuration for container start
   */
  self.start = function start() {
    var args = arg([
      {startConf: arg.OBJECT | arg.Optional, _default: {}}
    ], arguments);

    if(self.started !== false)
      return self.started;

    self.logger.info('   [%s] starting container...', self.imageTag);

    self.started = self.create().then(function(){
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
   * @return {Promise} Promise that completes with the container id
   */
  self.create = function create() {
    if(self.created !== false)
      return self.created;

    self.logger.debug('  [%s] creating container...', self.imageTag);
    self.created = new Promise(function(resolve, reject){
      self.docker.createContainer(self.createConf, function (err, res) {
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