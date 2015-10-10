var
http = require('http'),
path = require('path'),
fs = require('fs');

var PORT = 3000;
 
function requestHandler(req, res) {
  var content = __dirname + '/' + req.url;

  fs.readFile(content,function(err,contents){
    if(!err){
      res.end(contents);
    } else {
      console.dir(err);
    };
  });
};

http.createServer(requestHandler).listen(PORT);
console.log("Server is listening on port " + PORT);