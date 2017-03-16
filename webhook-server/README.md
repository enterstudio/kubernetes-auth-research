# Sample webhook authorization server

## Build it

```
docker build -t webhook-server .
```

## Run it

```
docker run [options] webhook-server
```

## Configure kube-apiserver to use this service

1. Create a file like [token-auth/authz-webhook.conf.yml](../token-auth/authz-webhook.conf.yml) on your system. Change the hostname, port, or other details for your environment.
1. Configure Kubernetesto do authorization through this service by including the following flags:

  ```
  kube-apiserver \
  --authorization-mode="Webhook" \
  --authorization-webhook-config-file="/etc/kubernetes/webhook.conf.yml"
  ```
