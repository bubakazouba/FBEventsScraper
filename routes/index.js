//http://localhost:3000/events?lat=40.710803&lng=-73.964040&distance=1000&sort=venue&access_token=1645233332355281|dUU_R1ksZlyDlpZtHXjVRbmSG8I
var express = require('express');
var router = express.Router();
var Promise = require("bluebird");
var rp = require('request-promise');
var RandomSchema = require('../models/random');
var mongodb = require('../modules/db');
var ObjectID = require('mongodb').ObjectID;
function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}

router.get('/confirm', function(req, res, next){
  console.log("/confirm got smth");

  var fbeventid = req.query.fbeventid;
  var emoji = req.query.emoji;
  RandomSchema.findOneAndUpdate({fbeventid: fbeventid}, {emoji: emoji, confirmed: true}, {upsert: true}, function(err, updatedHittup){
    if(err){
      return res.send({"error": "err.message"});
    }
    res.send({"success": true});
  });
});

router.get('/', function(req, res, next) {
  RandomSchema.find({confirmed: false}, function(err, hittups){
    // console.log(hittups);
    var ajaxgetscript='<script>$( document ).ready(function() {\n\
        $(".btn").click(function(){\n\
            var fbeventid = $(this).parent().attr("id");\n\
            var emoji = $(this).parent().children(".emoji").val();\n\
            alert(emoji);\n\
            $.ajax({\n\
                url: "confirm",\n\
                data: {\n\
                   emoji: emoji,\n\
                   fbeventid: fbeventid\n\
                },\n\
                error: function(err) {\n\
                   alert("An error has occurred");\n\
                   console.log(err);\n\
                },\n\
                dataType: "json",\n\
                success: function(data) {\n\
                    alert("got smth from server:");\n\
                    alert(data);\n\
                },\n\
                type: "GET"\n\
             });\n\
        });\n\
    });</script>';

    var a = '<html><script src="http://ajax.googleapis.com/ajax/libs/jquery/1.4.3/jquery.min.js"></script>\n\
         '+ajaxgetscript+' \n\
        <body>';
    for (var i = hittups.length - 1; i >= 0; i--) {
      var fbeventid = hittups[i].fbeventid;
      a+=hittups[i].title+"-----"+hittups[i].description;
      a+='<div id="'+fbeventid+'" > Emoji: \n\
            <input class="emoji" name="emoji" >\n\
            <button class="btn" type="button">Submit</button>\n\
          </div><br><br>';
    }
    a+="</body>\
      </html>\
    ";
    res.send(a);
  });
});

router.get('/events', function(req, res, next) {
    if (!req.query.lat || !req.query.lng || !req.query.distance || !req.query.access_token) {
        res.status(500).send({error: "Please specify the lat, lng, distance and access_token query parameters"});
        return;
    }
    
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

      var newEvents = [];

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
                    dateCreated: Math.floor(Date.now()/1000),
                    loc: {
                        type: "Point",
                        city: venue.location.city,
                        state: venue.location.state,
                        coordinates: [venue.location.longitude, venue.location.latitude]
                    },
                    description: (event.description ? event.description : null),
                    usersJoined: [],
                    usersInvited: [],
                    owner: {
                        name: event.owner.name,
                        imageurl: event.owner.picture.data.url,
                        _id: ObjectID().toString()
                    },
                    fbeventid: event.id
                };
                eventResultObj.dateStarts = new Date(event.start_time).getTime()/1000;
                if(event.end_time)
                    eventResultObj.duration = new Date(event.end_time).getTime()/1000 - eventResultObj.dateStarts;
                else 
                    eventResultObj.duration = 4*3600;
                eventResultObj.description= "@"+venue.name+"\n"+eventResultObj.description;
                newEvents.push(eventResultObj);
            });//looping on venues events
        });//looping on result properties(which are venues)
      });//looping on results

      var query = RandomSchema.find({});
      query.exec(function (err, randomEvents){

        for (var i = randomEvents.length - 1; i >= 0; i--) {
          for (var j = newEvents.length - 1; j >= 0; j--) {
            if(!newEvents[j])continue;
            if(newEvents[j].fbeventid == randomEvents.fbeventid){
              var thisevent = clone(newEvents[j]);
              delete newEvents[j];
              RandomSchema.findOneAndUpdate({fbeventid: thisevent.fbeventid, confirmed: true}, thisevent, {upsert:true}, function(err, updatedHittup){
                if(err){
                  console.log("error updating1: "+err.message);
                  return;
                }
                console.log("upserted succesffully1")
                // console.log(updatedHittup.fbeventid);                  
              });

            }//end if =
          }//end for loop on newEvents
          
        }//end loop on randomEvents

        //the missing just update or insert them into randomunconfirmed and thats it
        for (var i = newEvents.length - 1; i >= 0; i--) {
          if(!newEvents[i])continue;
          newEvents[i].confirmed = false;
          RandomSchema.findOneAndUpdate({fbeventid: newEvents[i].fbeventid, confirmed: false}, newEvents[i], {upsert:true}, function(err, updatedHittup){
            if(err){
              console.log("error updating2: "+err.message);
              return;
            }
            console.log("upserted succesffully2")
            // console.log(updatedHittup.fbeventid);                  
          });
        }//end loop on missing newEvents
        res.send({"hi":"bye"});
      });

    }).catch(function (e) {
      res.status(500).send({error: e});
    });

});

module.exports = router;
