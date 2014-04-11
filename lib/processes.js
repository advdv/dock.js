var arg = require('args-js');
var Promise = require('bluebird');

/**
 * Represents the current process process (ps)
 *
 * @param {Object} docker  the "dockerode" instance
 */
var Processes = function(){
  'use strict';
  var self = this;

  var args = arg([
    {docker:       arg.OBJECT   | arg.Required},
    {options:      arg.OBJECT   | arg.Optional, _default: {
      waitToKill: 10 //number of seconds to wait before killing the container
    }},
  ], arguments);

  self.list = [];
  self.docker = args.docker;
  self.refreshing = false;
  self.options = args.options;

  /**
   * Static funtion that compares the info hash with the container creation configuration
   * and returns wether it is equal
   * @return {Boolean} true on equal, false in inequal
   */
  Processes.isCreatedEqual = function() {
    var args = arg([
      {info:  arg.OBJECT | arg.Required},
      {conf:  arg.OBJECT | arg.Required},
    ], arguments);


    //@todo this will certainly fail except in unit tests
    //since info.Image returns the hash, while args.conf.Image a human readable version
    if(args.info.Image === args.conf.Image) {
      return true;
    }

    return false;
  };

  /**
   * Remove a container by name, stop it first
   * @param {String} name name of the container
   * @return {[type]} [description]
   */
  self.remove = function remove() {
    var args = arg([
      {name:  arg.STRING | arg.Required},
    ], arguments);

    var info = self.get(args.name);

    return self.stop(args.name).then(function(){
      return new Promise(function(resolve,reject){
        self.docker.getContainer(info.ID).remove(function(err){
          if(err) {
            reject(err);
            return;
          }

          //and remove from process list
          self.list.splice(self.list.indexOf(info), 1);
          resolve();
        });

      });
    });

  };

  /**
   * Stop a container by its name
   * @param  {String} name the container to stop
   * @return {Promise} promise that completes when the container is stoped
   */
  self.stop = function stop() {
    var args = arg([
      {name:  arg.STRING | arg.Required},
    ], arguments);


    var info = self.get(args.name);

    return new Promise(function(resolve, reject){
      self.docker.getContainer(info.ID).stop({t: self.options.waitToKill}, function(err){
        if(err) {
          reject(err);
          return;
        }

        resolve();
      });
    });
  };

  /**
   * Add an info hash to the process
   * @param {Object} info the info object returned from docker inspect
   */
  self.add = function add() {
    var args = arg([
      {info:  arg.OBJECT | arg.Required},
    ], arguments);

    self.list.push(args.info);
  };

  /**
   * Get a running container by its name
   * @param  {String} name container name
   * @return {Sting}  id of the container or throws when not found
   */
  self.get = function get() {
    var res = false;
    var args = arg([
      {name:  arg.STRING | arg.Required},
    ], arguments);

    self.list.forEach(function(c){
      if(c.Name && (c.Name.indexOf(args.name) === 1 || c.Name.indexOf(args.name) === 0)) {
        if(res === false) {
          res = c;
        } else {
          throw new Error('Multipe running containers with name "'+args.name+'"');
        }
      }
    });

    if(res === false) {
      throw new Error('No running container with name "'+args.name+'"');
    }

    return res;
  };

  /**
   * Returns wether there is a running container with the provided name
   * @param {String} name container name
   * @return {Boolean} [description]
   */
  self.has = function has() {
    var res = false;
    var args = arg([
      {name:  arg.STRING | arg.Required},
    ], arguments);

    try {
      res = self.get(args.name);
    } catch(err) {
      if(err.message.match(/No running container with name/))
        return false;
      else 
        throw err;
    }

    return true;
  };

  /**
   * Refresh container processes
   * @return {Promise} the promise that completes
   */
  self.refresh = function refresh() {

    if(self.refreshing !== false) {
      return self.refreshing;
    }

    self.refreshing = new Promise(function(resolve, reject){
      self.docker.listContainers({all: true}, function(err, list){
        if(err) {
          reject(err);
          return;
        }
        
        //inspect all running containers
        var inspects = [];
        list.forEach(function(c){
          inspects.push(new Promise(function(resolve,reject){
            var cont = self.docker.getContainer(c.Id);
            cont.inspect(function(err, info){
              if(err) {
                reject(err);
                return;
              }

              resolve(info);
            });
          }));
        });

        //add them to info
        Promise
          .all(inspects)
          .then(function(infos){
            self.list.length = 0;
            infos.forEach(function(c){
              self.add(c);
            });

            self.refreshing = false;
            resolve(infos);
          })
          .catch(function(err){
            reject(err);
          });
      });
    });

    return self.refreshing;
  };

  return self;
};

module.exports = Processes;