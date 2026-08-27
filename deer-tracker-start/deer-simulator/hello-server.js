const http = require("node:http");

const server = http.createServer(function (request, response) {
  // Somebody asked for something. Answer them.
  console.log("someone asked for", request.url);
  response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  response.end("Hello. You asked for " + request.url);
});

server.listen(5648, function () {
  console.log("listening on http://localhost:5648");
});