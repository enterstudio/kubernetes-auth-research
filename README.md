# Kubernetes + Web UI Combined Auth

Auth methods available (per the Kubernetes docs):

> Kubernetes uses client certificates, bearer tokens, an authenticating proxy, or HTTP basic auth to authenticate API requests through authentication plugins

* Client certificates: Easy provisioning within the API server, as any certificate issued by the CA is considered valid. How to revoke? Can't be used directly in a browser context, but CA generation could be something that is done in the Web UI or via the CLI.
* Bearer tokens: Static, easy to revoke, easy to use in plaintext (`--token <token>`). Otherwise arbitrary, and not easy to save to a file as with certs. Arguably less secure than certs? Also not usable directly by a browser, as sending the `Authorization: Bearer <token>` header isn't doable out of the box. Requires API Server restart whenever a token is added or removed, which is probably a deal-breaker
* Auth proxy: An OpenID connect service. This has the most open-ended potential, as we could create an OpenID connect endpoint with arbitrary back-end behaviors but a k8s-compatible interface
* Basic auth: Compatible with web browsers, but not necessarily with external auth sources. Require API Server restart whenever credentials are added or removed, which is probably a deal-breaker

## Client certificates

Using a web UI, provision certificates for authenticated users, signing them with a single, trusted CA. The CA is created when the cluster is provisioned and passed to the Kubernetes API server using the `--client-ca-file` flag

### Provisioning access

1. A user logs in to the web UI using the customer's chosen auth method (typically SSO of some sort).
1. Within the web UI, the user requests access to a cluster
  1. The web UI creates a random, unique ID _{id}_ for the new certificate pair.
  1. The web UI creates a strong private key
  1. The web UI creates a CSR using _{id}_ as the common name, and the user's username and/or group memberships in the organization fields. e.g:

      ```
      openssl req -subj "/CN={id}/O=user:johndoe/O=group1/O=group2"
      ```

  1. The web UI creates and signs a certificate and sends the certificate and private key to the user
  1. The web UI stores _{id}_ in a list as an indicator that it is a valid certificate
1. The user sees the newly-created certificate added to the list of certificates they've provisioned and can download the certificate and private key

### Using access

1. A user configures the `kubectl` client to use their client certificate, either through static config or command-line flags.
1. kube-apiserver verifies that the user's certificate was issued by the predetermined CA, then parses the common name and group information for use by the webhook authorization service.
1. kube-apiserver sends a webhook to the authorization service, including identifying information extracted from the client certificate, including _{id}_.
1. The authorization service:
  1. verifies that the certificate with the ID _{id}_ has not been revoked.
  1. verifies that the user (identified by the group `user:{username}`) has access to the requested resource
  1. Responds with an appropriate `SubjectAccessReview` response (allowed: true/false)

### Updating access

When using certificates for auth, all authorization info is derived from the certificate in use. Since certificates can’t be updated after issuance, a user may end up using out-of-date authorization information if their roles change after the certificate is issued. The only way to ensure that a user can no longer use out-of-date certificates would be to revoke them. However, most directory systems don’t post webhooks or otherwise notify external services when role information changes. Detecting such changes would require polling the directory system and looking for changes.

### Revoking access

**Note:** Kubernetes does not support certificate revocation lists, so any certificate issued by the CA will be valid for as long as the CA’s private key remains the same (probably forever). Thus, we cannot prevent _authentication_ from revoked certificates, but we can prevent _authorization_.

1. To revoke a certificate, a user or admin would "delete" it using the web UI.
1. The Web UI would mark the certificate with ID _{id}_ as having been revoked
1. On future authorization requests, the authorization will see that the certificate with ID _{id}_ has been revoked and will disallow access.

## Webhook Token authentication

Kubernetes supports the use of an outside service to verify bearer tokens and provide identity and authentication information. The use of the token webhook service is configured by passing the `--authentication-token-webhook-config-file` option to kube-apiserver. Using a webhook service for authentication has the benefit of being able to make authentication decisions in real time, as opposed granting authentication once when a certificate is provisioned.

### Provisioning access

1. A user logs in to the web UI using the customer's chosen auth method (typically SSO of some sort).
1. Within the web UI, the user creates an API key
1. The web UI creates and stores an API key consisting of random characters, probably hex
1. The user sees the newly-created API key added to the list of API keys they've provisioned and can copy the API key for future use

### Using access

1. A user configures the `kubectl` client to use their API key as a bearer token, either through static config or in the `--token` flag
1. kube-apiserver sends a webhook to the authentication service, including the token received from the user.
  1. The authentication service finds the user who owns the token and returns identifying information about them (username, groups, etc.) to kube-apiserver.
1. kube-apiserver sends a webhook to the authorization service, including identifying information received from the authentication service.
1. The authorization service:
  1. verifies that the user has access to the requested resource
  1. Responds with an appropriate `SubjectAccessReview` response (allowed: true/false)

### Updating access

Because the authentication service validates the API key on every request and the authorization service retrieves permissions information on every request, changes to user access will be propagated to kubectl requests very quickly (the responses from the authentication and authorization services are cached for a short amount of time).

### Revoking access

1. To revoke a certificate, a user or admin would "delete" it using the web UI.
1. On future requests, the authentication service will see that the provided token has been revoked and will disallow access.
