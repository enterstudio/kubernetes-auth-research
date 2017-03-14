const http = require('http');

var getAccessResponse = (allowed) => {
  // Default is no access.
  if (allowed !== true && allowed !== false) {
    allowed = false;
  }

  var response = {
    apiVersion: 'authorization.k8s.io/v1beta1',
    kind: 'SubjectAccessReview',
    status: {
      allowed: allowed
    }
  };

  return response;
};

const server = http.createServer((req, res) => {
  var chunks = [];

  req.on('data', (data) => {
    chunks.push(data);
  });

  req.on('end', () => {
    console.log(Buffer.concat(chunks).toString());
    res.end(JSON.stringify(getAccessResponse(true)) + '\n');
  });
});

server.listen(process.env.NODE_PORT || 3000);
