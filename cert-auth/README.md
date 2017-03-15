# Certificate auth test lab

## TODO

* (maybe) write a tiny web app to demonstrate the end-to-end process

## Running the test environment

Tested on Ubuntu 16.04. Do everything as root unless you want to be `sudo`-ing all day.

1. Create a new certificate authority

  ```
  openssl genrsa -out ca-key.pem 4096
  openssl req -x509 -new -nodes -key ca-key.pem -days 10000 -out ca.pem -subj "/CN=client-ca"
  ```

1. Copy the CA certificate to `/etc/tls`

  ```
  mkdir -p /etc/tls/ && cp ca.pem $_
  ```

1. Copy [create-user-cert.sh](create-user-cert.sh) to the folder in which you created your certificate authority. `chmod +x` as necessary.

1. Invoke `create-user-cert.sh` to create a new certificate

  ```
  ./create-user-cert.sh -u <username> [-g <group1,group2>]
  ```

  The script will create a new key and certificate and place them in `certs/`. You’ll use these later when authenticating as a client with Kubernetes. If you would like to create a certificate that will always be denied access to the Kubernetes API (for testing), include `alwaysdeny` in the list of comma-separated groups passed to `create-user-cert.sh`:

  ```
  ./create-user-cert.sh -u johndoe -g alwaysdeny
  ```

1. Install Docker

  ```
  apt upgrade && apt install docker.io
  ```

1. Create a docker network named `k8s`

  ```
  docker network create --name k8s
  ```

1. Create a docker volume name `k8s-etcd-data`

  ```
  docker volume create --name k8s-etcd-data
  ```

1. Create the file `/etc/systemd/system/etcd.service` with the following contents:

  ```
[Unit]
Description=etcd

[Service]
Restart=always
ExecStart=/usr/bin/docker run \
--rm \
--net k8s \
-v k8s-etcd-data:/etcd \
--name etcd \
quay.io/coreos/etcd:v3.1.3 \
etcd \
--data-dir /etcd \
--listen-client-urls "http://0.0.0.0:2379" \
--advertise-client-urls "http://etcd:2379"
ExecStop=docker rm -f etcd

[Install]
WantedBy=multi-user.target

  ```

1. Create the file `/etc/systemd/system/kube-apiserver.service` with the following contents:

  ```
[Unit]
Description=kube-apiserver
Requires=etcd.service
Requires=webhook-server.service
After=etcd.service

[Service]
Restart=always
ExecStart=/usr/bin/docker run \
--net k8s \
--rm \
--name kube-apiserver \
-v /etc/tls:/etc/tls \
-v /etc/kubernetes:/etc/kubernetes \
gcr.io/google_containers/hyperkube-amd64:v1.5.4 \
/hyperkube apiserver \
--etcd-servers="http://etcd:2379" \
--service-cluster-ip-range="10.32.0.0/16" \
--client-ca-file="/etc/tls/ca.pem" \
--authorization-mode="Webhook" \
--authorization-webhook-config-file="/etc/kubernetes/webhook.conf.yml" \
ExecStop=/usr/bin/docker rm kube-apiserver

[Install]
WantedBy=multi-user.target

```

1. Follow the instructions in  [webhook-server/README.md](webhook-server/README.md) to build a sample webhook server image.

1. Create the file `/etc/systemd/system/webhook-server.service` with the following contents:

  ```
[Unit]
Description=webhook-server

[Service]
Restart=always
ExecStart=/usr/bin/docker run \
--net k8s \
--rm \
--name webhook-server \
webhook-server
ExecStop=/usr/bin/docker rm webhook-server

[Install]
WantedBy=multi-user.target

  ```

1. Reload the sytemd unit files and start your engines:

  ```
  systemctl daemon-reload
  systemctl enable etcd kube-apiserver webhook-server
  systemctl start kube-apiserver
  ```

  Because the kube-apiserver unit requires the etcd and webhook-server services, those will be started implicitly.
