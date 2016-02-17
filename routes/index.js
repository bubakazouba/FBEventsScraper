//http://localhost:3000/events?lat=40.710803&lng=-73.964040&distance=1000&sort=venue&access_token=1645233332355281|dUU_R1ksZlyDlpZtHXjVRbmSG8I
var express = require('express');
var router = express.Router();
var Promise = require("bluebird");
var rp = require('request-promise');
var RandomSchema = require('./models/random');
var RandomUnconfirmedSchema = require('./models/randomunconfirmed');

router.get('/', function(req, res, next) {
  res.json({ "message": "Welcome to the Facebook Event Search service!" });
});

router.get('/events', function(req, res, next) {

    if (!req.query.lat || !req.query.lng || !req.query.distance || !req.query.access_token) {
        res.status(500).send({error: "Please specify the lat, lng, distance and access_token query parameters"});
        return;
    }
    var hittup = new RandomUnconfirmedSchema({
        owner: {
          name: "test",
          imageurl: "someimageurl",
          "_id": "smth smth"
        },
        title: "title",
        duration: 500,
        dateStarts: 342432,
        description: "description",
        images : [{
            lowQualityImageurl: "LQ",
            highQualityImageurl: "HQ"
        }],
        dateCreated: Math.floor(Date.now()/1000),
        loc: {
            type: "Point",
            coordinates: body.coordinates
        }
    });
    hittup.save();

    res.send("hi");
    return;
    var idLimit = 50, //FB only allows 50 ids per /?ids= call
        currentTimestamp = (new Date().getTime()/1000).toFixed(),
        placeUrl = "https://graph.facebook.com/v2.5/search?type=place&q=*&center=" + req.query.lat + "," + req.query.lng + "&distance=" + req.query.distance + "&limit=1000&fields=id,name&access_token=" + req.query.access_token;
    //Get places as specified
    rp.get(placeUrl).then(function(responseBody) {
      var ids = [],
          tempArray = [],
          data = JSON.parse(responseBody).data;

      //Create array of 50 places each
      data.forEach(function(idObj, index, arr) {
        tempArray.push(idObj.id);
        if (tempArray.length >= idLimit) {
          ids.push(tempArray);
          tempArray = [];
        }
      });

      // Push the remaining places
      if (tempArray.length > 0) {
        ids.push(tempArray);
      }

      return ids;
    }).then(function(ids) {

      var urls = [];

      //Create a Graph API request array (promisified)
      ids.forEach(function(idArray, index, arr) {
        urls.push(rp.get("https://graph.facebook.com/v2.5/?ids=" + idArray.join(",") + "&fields=id,name,cover.fields(id,source),picture.type(large),location,events.fields(id,name,cover.fields(id,source),picture.type(large),description,start_time,end_time,owner.fields(id,name,picture.type(large))).since(" + currentTimestamp + ")&access_token=" + req.query.access_token));
      });

      return urls;

    }).then(function(promisifiedRequests) {

      //Run Graph API requests in parallel
      return Promise.all(promisifiedRequests)

    })
    .then(function(results){

      var events = [];

      //Handle results
      results.forEach(function(resStr, index, arr) {
        var resObj = JSON.parse(resStr);
        Object.getOwnPropertyNames(resObj).forEach(function(venueId, index, array) {
            var venue = resObj[venueId];
            if (!venue.events || venue.events.data.length == 0) 
                return;
            venue.events.data.forEach(function(event, index, array) {
                var eventResultObj = {
                    title: event.name,
                    images: [{
                        lowQualityImageurl: event.picture ? event.picture.data.url : null,
                        highQualityImageurl: event.cover ? event.cover.source : null 
                    }],
                    loc: {
                        city: venue.location.city,
                        state: venue.location.state,
                        coordinates: [venue.location.longitude, venue.location.latitude]
                    },
                    description: (event.description ? event.description : null),
                    owner: {
                        name: event.owner.name,
                        imageurl: event.owner.picture.data.url
                    },
                    fbeventid: event.id
                };
                eventResultObj.dateStarts = new Date(event.start_time).getTime()/1000;
                if(event.end_time)
                    eventResultObj.duration = new Date(event.end_time).getTime()/1000 - eventResultObj.dateStarts;
                else 
                    eventResultObj.duration = 4*3600;
                eventResultObj.description= "@"+venue.name+"\n"+eventResultObj.description;
                events.push(eventResultObj);
            });//looping on venues events
        });//looping on result properties(which are venues)
      });//looping on results


      res.send(events);

    }).catch(function (e) {
      res.status(500).send({error: e});
    });

});

module.exports = router;
