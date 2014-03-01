var util = require('util');

/**
 * Error that is thrown whenever the Dockerode client throws
 * @param {String} message [description]
 */
function ClientError(message) {
  'use strict';
  Error.call(this); //super constructor
  Error.captureStackTrace(this, this.constructor); //super helper method to include stack trace in error object

  this.name = this.constructor.name; //set our function’s name as error name.
  this.message = message; //set the error message
}

util.inherits(ClientError, Error);


/**
 * Error that is thrown whenever we get an response(format) we didn't expect
 * @param {String} message [description]
 */
function ResponseError(message) {
  'use strict';
  Error.call(this); //super constructor
  Error.captureStackTrace(this, this.constructor); //super helper method to include stack trace in error object

  this.name = this.constructor.name; //set our function’s name as error name.
  this.message = message; //set the error message
}

util.inherits(ResponseError, Error);


/**
 * An error that is thrown on unexpected service behaviour
 * @param {String} message [description]
 */
function ServiceError(message) {
  'use strict';
  Error.call(this); //super constructor
  Error.captureStackTrace(this, this.constructor); //super helper method to include stack trace in error object

  this.name = this.constructor.name; //set our function’s name as error name.
  this.message = message; //set the error message
}

util.inherits(ServiceError, Error);


module.exports = {
  ClientError: ClientError,
  ResponseError: ResponseError,
  ServiceError: ServiceError
};