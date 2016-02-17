var mongoose  = require('mongoose');
var Schema  = mongoose.Schema;

var EventSchema = new Schema({
    title: String,
    duration: Number,
    dateCreated: Number,
    dateStarts: Number,
    description: String,
    emoji: String,
    images: [{
      lowQualityImageurl: String,
      highQualityImageurl: String
    }],
    owner: {
      name: String,
      imageurl: String,
      "_id": String
    },
    loc: { 
      type: { type: String },
      coordinates: [ ] ,// [<longitude>, <latitude>]
      city: String,
      state: String,
    },
    usersInvited: [{ type: Schema.ObjectId, ref: 'Users' }],
    usersJoined: [{ type: Schema.ObjectId, ref: 'Users' }]
}, {collection: 'RandomEventHittups'});

EventSchema.index({ loc: '2dsphere' });
module.exports = mongoose.model('RandomEventHittups', EventSchema);