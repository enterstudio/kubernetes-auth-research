#!/bin/bash

set -ueo pipefail

dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

certid=""
user=""
groups=""
subj=""
key=""
req=""

while getopts ":u:g:" opt; do
  case $opt in
    u)
      user=${OPTARG}
      ;;
    g)
      groups=${OPTARG//, /,}
      ;;
    \?)
      echo "invalid flag: -${OPTARG}" >&2
      exit 1
      ;;
    :)
      echo "flag -${OPTARG} requires an argument." >&2
      exit 1
      ;;
  esac
done

if [ "${user}" == "" ];then
  echo "flag -u <username> is required" >&2
  exit 1
fi

if [ ! -f ${dir}/ca.pem ];then
  echo "Unable to find ca.pem" >&2
  exit 1
fi

if [ ! -f ${dir}/ca-key.pem ];then
  echo "Unable to find ca-key.pem" >&2
  exit 1
fi

certid=$(uuidgen -r)
subj="/CN=${certid}/O=user:${user}"

if [ "${groups}" != "" ];then
subj=${subj}"/O="${groups//,//O=}
fi

key=$(openssl genrsa 2048 2>/dev/null)
req=$(echo "${key}" | openssl req -new -key /dev/stdin -subj "${subj}")
cert=$(echo "${req}" | openssl x509 -req -CA ca.pem -CAkey ca-key.pem -CAcreateserial -days 3652 2>/dev/null)

mkdir -p ${dir}/certs
echo "${key}" > certs/${certid}.key
echo "${cert}" > certs/${certid}.pem
echo "created certificate ${certid}"

exit 0
