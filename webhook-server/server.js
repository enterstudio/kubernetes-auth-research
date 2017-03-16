var fs = require('fs');
var express = require('express');
var bodyparser = require('body-parser');
var app = express();

app.post('/authenticate', bodyparser.json(), (req, res) => {
  console.log(JSON.stringify({
    event: 'received token authentication request',
    data: req.body
  }));

  var findUserWithToken = (token, cb) => {
    fs.readFile('users.json', 'utf8', (err, contents) => {
      if (err) {
        return cb(err, null);
      }

      var users = JSON.parse(contents);
      var matchingUser = null;

      for (var i = 0; i < users.length; i++) {
        if (users[i].tokens.indexOf(token) !== -1) {
          matchingUser = users[i].user;
          break;
        }
      }

      if (matchingUser === null) {
        return cb(new Error('No user found with token ' + token), null);
      }

      return cb(null, matchingUser);
    });
  };

  // Find the user with the provided token
  findUserWithToken(req.body.spec.token, (err, user) => {
    if (err) {
      console.log(JSON.stringify({
        event: 'error authenticating user by token',
        error: err,
        stack: err.stack
      }));

      res.status(401);
      res.send({
        apiVersion: 'authentication.k8s.io/v1beta1',
        kind: 'TokenReview',
        status: {
          authenticated: false
        }
      });
      return;
    }

    console.log(JSON.stringify({
      event: 'sucessfully authenticated user',
      username: user.username
    }));

    res.send({
      apiVersion: 'authentication.k8s.io/v1beta1',
      kind: 'TokenReview',
      status: {
        authenticated: true,
        user: user
      }
    });
  });
});

app.post('/authorize', bodyparser.json(), (req, res) => {
  console.log(JSON.stringify({
    event: 'received token authorization request',
    data: req.body
  }));

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
