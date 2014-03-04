/* global setTimeout */;
var arg = require('args-js');
var winston = require('winston');
var Promise = require('bluebird');
var fs = require('fs');

var Image = require('./image');

/**
 * A class that represents a collection of images
 * 
 * @param {Object} docker dockerode client instance
 * @param {Array} [images] optional initial array of images
 */
var Repository = function() {
  'use strict';
  var self = this;
  var args = arg([
    {docker:  arg.OBJECT | arg.Required},
    {logger:       arg.OBJECT | arg.Optional, _type: winston.Logger, _default: new winston.Logger()},
    {images:  arg.ARRAY  | arg.Optional, _default: []},
    {options:      arg.OBJECT   | arg.Optional, _default: {
      fromMatcher: /FROM +([^\s\\]+) *[\n\r]?/m
    }},
  ], arguments);

  self.docker =  args.docker;
  self.logger = args.logger;
  self.options = args.options;
  self.images = args.images;


  /**
   * Build all images in the repository
   * 
   * @return {Promise} a promise that completes when all images are build
   */
  self.build = function build() {
    var built = [];
    self.images.forEach(function(img){
      built.push(img.build());
    });

    return Promise.all(built);
  };


  /**
   * Convenient function that autmatically sets
   * the image dependency based on the Dockerfile
   * 
   * @param  {String} imageTag   name of the image
   * @param  {String} contextDir path to the directory that contains the Dockerfile
   * @param  {Object} [buildConf] opti
   * @return {[type]} [description]
   */
  self.create = function create() {
    var args = arg([
      {imageTag:       arg.STRING | arg.Required},
      {contextDir:       arg.STRING | arg.Required},
      {buildConf:        arg.OBJECT | arg.Optional, _default: {}}
    ], arguments);

    //try to create a promise for the image dep
    var from = new Promise(function(resolve, reject){
      fs.readFile(args.contextDir + '/Dockerfile', {encoding: 'utf8'}, function(err, data){
        if(err) {
          reject(err);
        }

        if(data) {
          var fromTag = data.match(self.options.fromMatcher);
          if(fromTag !== null) {
            fromTag = fromTag[1];
            if(self.has(fromTag)) {

              // we have an image that this image depends on            
              resolve(function(){
                return self.get(fromTag);
              });
            } 
            //image is not included in this repository
          }
          //no dependency in the dockerfile
        }
        
        //no date returned from the file;
        resolve(function(){return false;});
      });
    });

    //return a new image instance
    return new Image({
      docker: self.docker,
      contextDir: args.contextDir,
      from: from,
      imageTag: args.imageTag,
      buildConf: args.buildConf,
      logger: self.logger
    });
  };


  /**
   * Add an image to the repository
   * @param {Image} image the image instance
   * @return {self} the repository
   */
  self.add = function add() {
    var args = arg([
      {image:  arg.OBJECT | arg.Required, _type: Image},
    ], arguments);

    if(self.has(args.image.imageTag) === true) {
      throw new Error('Image with tag "'+args.image.imageTag+'" already exists');  
    }

    self.images.push(args.image);
    return self;
  };

  /**
   * Returns wether an image with the tag exists in this repository
   *   
   * @param  {[String} imageTag the tag we're looking for
   * @return {Image}  the image
   */
  self.has = function has() {
    var args = arg([
      {imageTag:  arg.STRING | arg.Required},
    ], arguments);

    var res;
    try {
      res = self.get(args.imageTag);
    } catch(err) {
      return false;
    }

    return true;
  };

  /**
   * Return an image associated with a certain tag
   *   
   * @param  {[String} imageTag the tag we're looking for
   * @return {Image}  the image
   */
  self.get = function get() {
    var args = arg([
      {imageTag:  arg.STRING | arg.Required},
    ], arguments);

    //normalize to rep:tag
    args.imageTag = Image.normalizeTag(args.imageTag);

    var tags = [];
    var res = false;
    self.images.forEach(function(img){
      tags.push(img.imageTag);
      if(img.imageTag === args.imageTag) {
        res = img;
      }
    });

    if(res === false) {
      throw new Error('Could not retrieve image with tag "'+args.imageTag+'", available images: "'+tags.join('", "')+'"');
    }

    return res;
  };



  return self;
};

module.exports = Repository;