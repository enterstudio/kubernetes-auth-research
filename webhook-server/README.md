# Sample Kubernetes webhook authn/authz server

This simple web server exposes `POST /authenticate` and `POST /authorize` routes for use with Kubernetes as an authentication and authorization source. User information is derived from [users.json](users.json), and authorization is always granted unless the user belongs to the `alwaysdeny` group.

## Build the container

```
docker build -t webhook-server .
```

## Run the container

```
docker run [options] webhook-server
```

By default, the container exposes and listens on port `3000`, but this can be overridden by specifying a different port number in the `NODE_PORT` environment variable.

## Configure kube-apiserver to use this service for authentication

When configured to do so, Kubernetes will send a `POST /authenticate` request to this service, with the user’s token in the request body (see [v1beta1.TokenReview](https://kubernetes.io/docs/api-reference/authentication.k8s.io/v1beta1/definitions/#_v1beta1_tokenreview) for the full request body). This service will search [users.json](users.json) for the provided token, and return the corresponding user if one was found. If no matching token is found, the service returns a [TokenReviewStatus](https://kubernetes.io/docs/api-reference/authentication.k8s.io/v1beta1/definitions/#_v1beta1_tokenreviewstatus) containing `"authenticated": false`, causing Kubernetes to return a 401.

1. Create a file like [token-auth/authn-webhook.conf.yml](../token-auth/authn-webhook.conf.yml) on your system. Change the hostname, port, or other details for your environment.
1. Configure Kubernetes to do authentication through this service by including the following flags:

  ```
  kube-apiserver \
  --authentication-token-webhook-config-file="/etc/kubernetes/authn-webhook.conf.yml"
  ```

## Configure kube-apiserver to use this service for authorization

When configured to do so, Kubernetes will send a `POST /authorize` request to this service, with the user's identifying information (username, groups, etc) in the request body (see [v1beta1.SubjectAccessReview](https://kubernetes.io/docs/api-reference/authorization.k8s.io/v1beta1/definitions/#_v1beta1_subjectaccessreview) for the full request body). This service will return `"status": {"allowed": true}` unless the user belongs to the `alwaysdeny` group. In a production environment, a service like this would also evaluate the API request being attempted and consult RBAC rules to determine whether or not to allow the request.

1. Create a file like [token-auth/authz-webhook.conf.yml](../token-auth/authz-webhook.conf.yml) on your system. Change the hostname, port, or other details for your environment.
1. Configure Kubernetes to do authorization through this service by including the following flags:

  ```
  kube-apiserver \
  --authorization-mode="Webhook" \
  --authorization-webhook-config-file="/etc/kubernetes/authz-webhook.conf.yml"
  ```

## Understanding the sample authorization scheme

Users' authentication info comes from [users.json](users.json), where in a production environment it would probably come from an LDAP, Keystone, or SAML endpoint. At minimum, we need the user's name, and the security groups or roles to which they belong. The groups borrow some Active Directory conventions: users belonging to the group `Domain Admins` are essentially super-users, and all users belong to `Domain Users`. Other users belong to groups based on the projects they're working on (`project-one` and `project-two`).

Users' authorization information is derived from [authz-rules.json](authz-rules.json). Each rule  specifies the authentication group to which it applies, and the corresponding permissions for certain Kubernetes namespaces.

The namespace property is either the exact name of a namespace, or `"namespace": ""`, which matches entities that are not namespaced (like namespaces themselves, or nodes), or `"namespace": "*"`, which matches any namespace.

The access property is one of `readOnly`, `readWrite`, or `none`. Users do not have access to anything unless access is explicitly granted. Of the access types, `readWrite` will supersede a previous `readOnly` rule, and `none` will supersede a previous `readOnly` or `readWrite` rule.

In plain English, referencing the users in [users.json](users.json):

* Stephen (stephen@random.corp) is a sysadmin and has read/write access to everything in the Kubernetes API.
* Anthony (anthony@random.corp) is a user who doesn't belong to any projects. Because of the default authorization settings, he doesn't have access to anything in any namespace.
* Lisa (lisa@random.corp) is a developer for "project one" and has read/write access to everything in the `project-one` namespace.
* Evelyn (evelyn@random.corp) is a developer for both "project one" and "project two". She has read/write access to everything in both the `project-one` and `project-two` namespaces.
* Joseph (joseph@random.corp) is a contractor on "project one", and the company does not want him to have access to the Kubernetes cluster. He doesn't have access to anything in any namespace, even though he's a member of the `project-one-devs` group.
