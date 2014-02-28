/* global describe, it, beforeEach */

var Configuration = require('../lib/configuration');


describe('Dock()', function(){
  'use strict';


  it('should construct as expected', function(){

    var sc = {};
    var cc = {};
    var c = new Configuration(cc, sc);

    c.should.have.property('creating').and.equal(cc);
    c.should.have.property('starting').and.equal(sc);

  });

});