var fs = require('fs');

module.exports = (req, res) => {
  console.log(JSON.stringify({
    event: 'received token authorization request',
    data: req.body
  }));

  var getAccessRules = (cb) => {
    var rules = [];

    fs.readFile('authz-rules.json', 'utf8', (err, contents) => {
      if (err) {
        return cb(err, null);
      }

      try {
        rules = JSON.parse(contents);
      } catch (e) {
        return cb(e, null);
      }

      return cb(null, rules);
    });
  };

  var findMatchingRules = (spec, rules, cb) => {
    var matchingRules = [];

    rules.forEach((rule) => {
      if (spec.group.indexOf(rule.role.groupName) !== -1) {
        matchingRules.push(rule);
      }
    });

    return cb(null, matchingRules);
  };

  var determineResourceAccess = (spec, rules, cb) => {
    var VERBS = {
      'none': [],
      'readOnly': [
        'get',
        'list',
        'watch'
      ],
      'readWrite': [
        'get',
        'list',
        'create',
        'update',
        'patch',
        'watch',
        'proxy',
        'redirect',
        'delete',
        'deletecollection'
      ]
    };

    var REASONS = {
      'readOnly': 0,
      'readWrite': 1,
      'none': 3
    };

    var access = {
      access: false,
      reason: REASONS['none']
    };

    rules.forEach((rule) => {
      rule.access.forEach((accessItem) => {
        spec.resourceAttributes.namespace = spec.resourceAttributes.namespace || '';
        if (accessItem.namespace !== '*' && accessItem.namespace !== spec.resourceAttributes.namespace) {
          return;
        }

        if (VERBS[accessItem.access].indexOf(spec.resourceAttributes.verb) !== -1) {
          access.access = true;
          access.reason = REASONS[accessItem.access];

          console.log(JSON.stringify({
            event: 'allowing access',
            resource: spec.resourceAttributes,
            rule: rule
          }));
        } else if (REASONS[accessItem.access] > access.reason) {
          console.log(JSON.stringify({
            event: 'denying access',
            resource: spec.resourceAttributes,
            rule: rule
          }));
          access.access = false;
        }
      });
    });

    return cb(null, access.access);
  };

  var authorize = (cb) => {
    // For now, allow all non-resource requests? They seem to be mostly plumbing
    if (req.body.spec.nonResourceAttributes) {
      return cb(null, true);
    }

    getAccessRules((err, rules) => {
      if (err) {
        err.http_status_code = 500;
        return cb(err, null);
      }

      findMatchingRules(req.body.spec, rules, (err, rules) => {
        if (err) {
          err.http_status_code = 403;
          return cb(err, null);
        }

        determineResourceAccess(req.body.spec, rules, (err, access) => {
          if (err) {
            err.http_status_code = 403;
            return cb(err, null);
          }

          return cb(null, access);
        });
      });
    });
  };

  var getAccessResponse = (allowed) => {
    var response = JSON.parse(JSON.stringify(req.body));
    response.status.allowed = allowed;
    return response;
  };

  authorize((err, allowed) => {
    if (err) {
      res.status(err.http_status_code || 500);
      res.end();
      return;
    }

    res.send(getAccessResponse(allowed));
  });
};
