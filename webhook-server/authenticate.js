var fs = require('fs');

module.exports = (req, res) => {
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
};
