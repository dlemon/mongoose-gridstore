'use strict';

(function() {    
    var Q = require('q');
    var mime = require('mime-types');
    var _mongoose = require('mongoose');
    var ReadWriteLock = require('rwlock');
    var _schema;    
    var _keys;
    var _lock;

    /**
     * private function that returns a promise to save to the gridstore
     *
     * ####Example:
     *
     *	saveToGridStore(attachment);
     *	.then(function() {
     *	})
     *	.catch(function(error) {
     *	});
     *	
     * ####Note:
     *      * 
     * @param {Object} attachment - the attachment to be stored.
     * @returns {Object} the promise
     */
    var saveToGridStore = function(attachment) {
        var deferred = Q.defer();    
        var db = _mongoose.connection.db;
        var metadata = {};
         //add keys to the metadata object
        [].concat(_keys).forEach(function(key){
            metadata[key] = attachment[key];
        });      
        metadata.filename = attachment.filename;
        metadata.mimetype = attachment.mimetype;
        var gridStore = new _mongoose.mongo.GridStore(db, attachment._gsId,attachment.filename, 'w', {metadata:metadata});           
        gridStore.open(function(err,gs){                
            if(err) {return deferred.reject(err);}    
            gs.write(attachment.buffer,function(err,gs) {
                if(err) {return deferred.reject(err); }    
                gs.close(function(err,gs) {
                    if(err) {return deferred.reject(err);} 
                    //Remove all attributes we do not want to store in mongodb
                    delete attachment.buffer;
                    delete attachment.filename;
                    delete attachment.mimetype;
                    [].concat(_keys).forEach(function(key){
                        delete attachment[key];
                    });      
                    deferred.resolve();                    
                })
            })            
        });

        return deferred.promise;    
    };

    /**
     * private function that returns a promise to read from the gridstore
     *
     * ####Example:
     *
     *	readFromGridStore(attachment);
     *	.then(function() {
     *	})
     *	.catch(function(error) {
     *	});
     *	
     * ####Note:
     *      * 
     * @param {Object} attachment - the attachment to be read.
     * @returns {Object} the promise
     */    
    var readFromGridStore = function(attachment) {
        var deferred = Q.defer();
        var db = _mongoose.connection.db;

        var gridStore = new _mongoose.mongo.GridStore(db,attachment._gsId,attachment.filename,'r');
        gridStore.open(function(err,gs) {
            if(err) return deferred.reject(err);
            gs.seek(0,function() {
                gs.read(function(err,data) {
                    if(err) return deferred.reject(err);
                    //Now restore the attachment with buffer and meta data
                    attachment.buffer = new Buffer(data.length);
                    data.copy(attachment.buffer);
                    if(gs.metadata) {
                        for(var key in gs.metadata) {
                            attachment[key] = gs.metadata[key];
                        }
                        attachment.filename = gs.metadata.filename;
                        attachment.mimetype = gs.metadata.mimetype;
                    }                    
                    deferred.resolve(attachment);
                });
           });
        });
        
        return deferred.promise;    
    };

     /**
     * private function that returns a promise to remove from the gridstore
     *
     * ####Example:
     *
     *	removeFromGridStore(attachment);
     *	.then(function() {
     *	})
     *	.catch(function(error) {
     *	});
     *	
     * ####Note:
     *      * 
     * @param {Object} attachment - the attachment to be removed.
     * @returns {Object} the promise
     */    
    var removeFromGridStore = function(attachment) {
        var deferred = Q.defer();
        var db = _mongoose.connection.db;

        var gridStore = new _mongoose.mongo.GridStore(db,attachment._gsId,attachment.filename,'w');
        gridStore.open(function(err,gs) {
            if(err) return deferred.reject(err);           
            gs.unlink(function(err,result) {
                if(err) return deferred.reject(err);
                deferred.resolve();
            });
        });
        
        return deferred.promise;    
    };

     /**
     * private function that decorated the given mongoose schema
     *
     * ####Example:
     *
     *	decorateSchema(mongoose);
     *	
     * ####Note:
     *      
     * @param {Object} attachment - the attachment to be read.
     * @returns {Object} the promise
     */    
    function decorateSchema(mongoose) {                       
    
        //Add attachments array to the schema
        _schema.add({attachments:[{type:mongoose.Schema.Types.Mixed}]});

        /**
         * schema method loadAttachments, returns a promise to load attachments
         *
         * ####Example:
         *
         *	email.loadAttachments()
         *	.then(function(doc) {
         *      //doc contains all attachments  
         *	})
         *	.catch(function(error) {
         *	});
         *	
         * ####Note:
         *      * 
         * @returns {Object} the promise
         */            
        _schema.methods.loadAttachments = function() {    
            var deferred = Q.defer();
            var promises = [];
            var that = this;
            
            [].concat(this.attachments).forEach(function(attachment) {
                promises.push(readFromGridStore(attachment));
            });
            
            Q.all(promises)
            .then(function(attachments) {
                deferred.resolve(that);
            })
            .catch(function(err) {
                deferred.reject(err);
            });
            
            return deferred.promise;        
        };

        /**
         * schema method addAttachment, returns a promise to load attachments
         *
         * ####Example:
         *
         *	email.upsertAttachment('file.json', new Buffer('test'))
         *	.then(function(doc) {
         *      //doc contains all attachments  
         *	})
         *	.catch(function(error) {
         *	});
         *	
         * ####Note:
         *
         * it does not check for existing name!        
         *
         * @returns {Object} the promise
         */                    
        _schema.methods.addAttachment = function(name, buffer) { 
            var deferred = Q.defer();

            var attachment = {
                filename: name,
                mimetype: mime.contentType(name),
                _gsId: mongoose.Types.ObjectId(),
            };               
            
            //add keys to the attachment
            [].concat(_keys).forEach(function(key){
                attachment[key] = null;
            });               
            
            attachment.buffer = new Buffer(buffer.length);
            buffer.copy(attachment.buffer);
            
            this.attachments.push(attachment);
            deferred.resolve(this);   

            return deferred.promise;                    
        };

        /**
         * schema method updateAttachment, returns a promise to load attachments
         *
         * ####Example:
         *
         *	email.upsertAttachment('file.json', new Buffer('test'))
         *	.then(function(doc) {
         *      //doc contains all attachments  
         *	})
         *	.catch(function(error) {
         *	});
         *	
         * ####Note:
         *      * 
         * @returns {Object} the promise
         */                    
        _schema.methods.updateAttachment = function(name, buffer) { 
            var deferred = Q.defer();
            var found = false;
            
            if (!name) return deferred.reject('name parameter missing');
            if (!buffer) return deferred.reject('buffer parameter missing');
            
            for(var i=0; i<this.attachments.length;i++) {
                if(this.attachments[i].filename == name) {
                    delete this.attachments[i].buffer;
                    this.attachments[i].buffer = new Buffer(buffer.length);
                    buffer.copy(this.attachments[i].buffer);  
                    found = true;
                    deferred.resolve(this);
                }
            }
            
            if (!found) {
                deferred.reject('attachment not found');   
            }
            
            return deferred.promise;                    
        };

        /**
         * schema method removeAttachment, returns a promise to remove an attachment
         *
         * ####Example:
         *
         *	email.removeAttachment('file.json')
         *	.then(function(doc) {
         *      //doc contains the update document
         *	})
         *	.catch(function(error) {
         *	});
         *	
         * ####Note:
         *      * 
         * @returns {Object} the promise
         */                    
        _schema.methods.removeAttachment = function(name) {            
            var deferred = Q.defer();
            var that = this;
            
            if (!name) return deferred.reject('name parameter missing');
            
            for(var i=0; i<this.attachments.length;i++) {
                if(this.attachments[i].filename == name) {
                    var index = i;
                    removeFromGridStore(this.attachments[index])
                    .then(function() {
                        that.attachments.splice(index,1);
                        return deferred.resolve(that);
                    })
                    .catch(function(err) {
                        return deferred.reject(err);    
                    });
                }
            }
            
            return deferred.promise;                            
        };
        
        /**
         * pre save middleware
         */                    
        _schema.pre('save', function(next) {
            var that = this;
            
            _lock.writeLock(function(release) {
                var promises = [];
                that.attachments.forEach(function(attachment){ 
                    var p1 = saveToGridStore(attachment);
                    promises.push(p1);
                });
                
                Q.all(promises)
                .then(function() {
                    release();
                    next();
                })
                .catch(function(err) {
                    release();
                    next(err);
                });
            });
        });                
    }
    
    /**
    * mongoose plugin for storing attachments to your document schema. 
    *
    * ####Example:
    *
    * var mongoose  = require('mongoose');
    * var gridStore = require('mongoose-gridstore');
    *
    * var emailSchema = new mongoose.Schema({
    *   from   : {type:String},
    *   to     : {type:String},
	*   subject: {type:String}
    * });
    *
    * emailSchema.plugin(gridStore);
    *  var Email = mongoose.model('Email', emailSchema);
    *
    * ####Note:
    */
    var gridStore = function(schema, options) {             
        if(!options) {
            options = {};
        }
        
        _keys = options.keys || [];
        _mongoose = options.mongoose || require('mongoose');
                        
        if (!_schema) {
            _schema = schema;
            decorateSchema(_mongoose);
        }            

        if(!_lock) {
            _lock = new ReadWriteLock();
        }
    };
    
    module.exports = exports = gridStore;
})();