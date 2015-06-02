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
        
        if(!attachment) {return deferred.reject('attachment parameter missing');}
        if(!attachment.buffer) {return deferred.resolve();}
        if(attachment.buffer.length <= 0) {return deferred.resolve();}
        
        var db = _mongoose.connection.db;
        var metadata = {};
         //add keys to the metadata object
        [].concat(_keys).forEach(function(key){
            if (attachment[key]) {
                metadata[key] = attachment[key];
            } else {
                metadata[key] = '';
            }
            
        });      
        metadata.filename = attachment.filename;
        metadata.mimetype = attachment.mimetype;
        var options = {
            "content_type": attachment.mimetype,
            "metadata": metadata
        };
        var gridStore = new _mongoose.mongo.GridStore(db, attachment.filename,'w', options);           
        gridStore.open(function(err,gs){                
            if(err) {return deferred.reject(err);}    
            gs.write(attachment.buffer,function(err,gs) {
                if(err) {return deferred.reject(err); }    
                gs.close(function(err,gs) {
                    if(err) {return deferred.reject(err);} 
                    //Remove all attributes we do not want to store in mongodb
                    delete attachment.buffer;
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
    var readFromGridStore = function(attachment, partial) {
        var deferred = Q.defer();
        
        if(!attachment) {return deferred.reject('attachment parameter missing');}
        
        var db = _mongoose.connection.db;
        var loadPartial = partial || false;

        var gridStore = new _mongoose.mongo.GridStore(db,attachment.filename,'r');
        gridStore.open(function(err,gs) {
            if(err) return deferred.reject(err);
            gs.seek(0,function() {
                gs.read(function(err,data) {
                    if(err) return deferred.reject(err);
                    
                    if (loadPartial) {
                        attachment.buffer = ''
                    } else {
                        attachment.buffer = data;
                    }
                    if(gs.metadata) {
                        for(var key in gs.metadata) {
                            attachment[key] = gs.metadata[key];
                        }
                        attachment.filename = gs.metadata.filename;
                        attachment.mimetype = gs.metadata.mimetype;
                    }  
                    gs.close(function(err) {
                        if(err) return deferred.reject(err);
                        deferred.resolve(attachment);
                    });                    
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

        _mongoose.mongo.GridStore.unlink(db, attachment.filename, function (err, gs) {
            if (err) {return deferred.reject(err); }
            deferred.resolve(attachment);
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
         * schema method partialLoadAttachments, returns a promise to partially load attachments
         *
         * ####Example:
         *
         *	email.partialLoadAttachments()
         *	.then(function(doc) {
         *      //doc contains all attachments  except buffers
         *	})
         *	.catch(function(error) {
         *	});
         *	
         * ####Note:
         *      * 
         * @returns {Object} the promise
         */            
        _schema.methods.partialLoadAttachments = function() {    
            var deferred = Q.defer();
            var promises = [];
            var that = this;
            
            [].concat(this.attachments).forEach(function(attachment) {               
                promises.push(readFromGridStore(attachment, true));
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
         * schema method loadSingleAttachment, returns a promise to load a single attachment
         *
         * ####Example:
         *
         *	email.loadSingleAttachment('file.txt')
         *	.then(function(doc) {
         *      //doc contains all attachments  except buffers
         *	})
         *	.catch(function(error) {
         *	});
         *	
         * ####Note:
         *      * 
         * @returns {Object} the promise
         */            
        _schema.methods.loadSingleAttachment = function(filename) {    
            var deferred = Q.defer();
            
            if (!filename) return deferred.reject('filename parameter missing');
            
            var promises = [];
            var that = this;
            
            [].concat(this.attachments).forEach(function(attachment) {
                if(attachment.filename == filename) {
                    promises.push(readFromGridStore(attachment));
                }
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
         * schema method partialLoadSingleAttachment, returns a promise to partially load a single attachment
         *
         * ####Example:
         *
         *	email.loadSingleAttachment('file.txt')
         *	.then(function(doc) {
         *      //doc contains all attachments  except buffers
         *	})
         *	.catch(function(error) {
         *	});
         *	
         * ####Note:
         *      * 
         * @returns {Object} the promise
         */            
        _schema.methods.partialLoadSingleAttachment = function(filename) {    
            var deferred = Q.defer();
            
            if (!filename) return deferred.reject('filename parameter missing');
                       
            var promises = [];
            var that = this;
            
            [].concat(this.attachments).forEach(function(attachment) {
                if(attachment.filename == filename) {
                    promises.push(readFromGridStore(attachment,true));
                }
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

            if (!name) return deferred.reject('name parameter missing');
            if (!buffer) return deferred.reject('buffer parameter missing');

            var attachment = {
                filename: name,
                mimetype: mime.contentType(name),
                _gsId: mongoose.Types.ObjectId(),
            };               
            
            //add keys to the attachment
            [].concat(_keys).forEach(function(key){
                attachment[key] = null;
            });               
            
            attachment.buffer = buffer.toString('base64');
            
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
            
            if (!name) return deferred.reject('name parameter missing');
            if (!buffer) return deferred.reject('buffer parameter missing');
            
            for(var i=0; i<this.attachments.length;i++) {
                if(this.attachments[i].filename == name) {
                    this.attachments[i].buffer = buffer.toString('base64');
                }
            }
            
            deferred.resolve(this);
            
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
            var newAttachments = [];
            for(var i=0; i<this.attachments.length;i++) {
                if (this.attachments[i].filename == name) {
                    var index = i;
                    removeFromGridStore(this.attachments[index])
                    .catch(function (err) {
                        return deferred.reject(err);
                    });
                } else {
                    newAttachments.push(this.attachments[i]);
                }
            }
            
            delete this.attachments;
            this.attachments = newAttachments;
            deferred.resolve(this);
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
    }
    
    module.exports = exports = gridStore;
})();