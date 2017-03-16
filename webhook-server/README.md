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
