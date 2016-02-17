// MongoDB Functions
// .connect()
// .db() returns mongodb instance
// .close() closes mongodb instance

// Credit DB export to: http://kroltech.com/2015/01/02/simple-mongodb-node-js-client-module/
(function () {
    var client = require('mongodb').MongoClient,
        mongodb;
 	var mongoose = require('mongoose');

    module.exports =  {
        connect: function (dburl, callback) {
            client.connect(dburl,
                function (err, db) {
                    mongodb = db;
                    if(callback) { callback(); }
                });
            mongoose.connect(dburl);
        },
        db: function () {
            return mongodb;
        },
        close: function () {
            mongodb.close();
        }
    };
})();




// // Connect Mongoose
// var mongoose = require('mongoose');
// mongoose.connect('mongodb://Hittup:katyCherry1738@ds043981.mongolab.com:43981/hittup'); // connect to our database


// // Connect MongoClient
// var mongoClient = require('mongodb').MongoClient;
// mongoClient.connect("mongodb://Hittup:katyCherry1738@ds043981.mongolab.com:43981/hittup", function (err, db) {
//     if (err) {
//         console.log(err);
//         return(err);
//       }
//       else{
//         // console.log("success");
//         module.exports = db;
//         console.log("connected to db: " + db);
//   }
// });