'use strict';
var should = require('chai').should();

var mongoose = require('mongoose');
var gridStore = require('../index.js');
var URI = 'mongodb://localhost/test';

describe('Schema decoration',function() {
   var email;

    before(function(done) {
       mongoose.connect(URI, function(err){
            if (err) {
              return done(err);
            } 
          
            var emailSchema = new mongoose.Schema({
                from   : {type:String, default:''},
                to     : {type:String, default:''},
                subject: {type:String, default:''}
            });
            
            emailSchema.plugin(gridStore);
            var Email = mongoose.model('Email', emailSchema);
            email = new Email();
            done();
       });
    });       
    
    it('should decorate with an attachments array', function() {
       email.should.have.property('attachments'); 
       email.attachments.should.be.an('Array');
    });
    
    
});
