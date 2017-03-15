var express = require('express');
var bodyparser = require('body-parser');
var app = express();

app.post('/authorize', bodyparser.json(), (req, res) => {
  var getAccessResponse = (allowed) => {
    // Default to no access if a non-bool was provided.
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

  // In our contrived authz scenario, all users are allowed unless they have the
  // "alwaysdeny" group
  try {
    let groups = req.body.spec.group;

    if (groups.indexOf('alwaysdeny') !== -1) {
      res.send(JSON.stringify(getAccessResponse(false)) + '\n');
    } else {
      res.send(JSON.stringify(getAccessResponse(true)) + '\n');
    }
  } catch (e) {
    res.send(JSON.stringify(getAccessResponse(true)) + '\n');
  }
});

app.listen(process.env.NODE_PORT || 3000);
