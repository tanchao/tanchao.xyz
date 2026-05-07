---
title: "First Setups and Issues with Thursday"
description: "alias pem file and command"
date: "2016-07-13"
tags: ["thur"]
originalUrl: "https://tanchao.github.io/2016/07/13/thursday-init.html"
---

### how to access ec2 better?

* alias pem file and command

```bash
    # AWS related
    export AWS='ec2-52-77-227-119.ap-southeast-1.compute.amazonaws.com'
    export PEM='/Users/tanchao/workspace/credentials/thursday-ec2-t2micro.pem'
    alias sshaws='ssh -i $PEM ec2-user@$AWS'
    alias scpaws='scp -i /Users/tanchao/workspace/credentials/aws9517.pem'
```

* define ssh config [mac way](https://developer.apple.com/legacy/library/documentation/Darwin/Reference/ManPages/man5/ssh_config.5.html) (recommand)

```bash
    host aws
        HostName ec2-52-77-227-119.ap-southeast-1.compute.amazonaws.com
        Port 22
        User ec2-user
        IdentityFile /Users/tanchao/workspace/credentials/thursday-ec2-t2micro.pem
```

* we host a git repo on ec2 and i need checkout without login/pem file

```bash
    git clone ssh://aws/~/gitrepo/recruiter-webapp
```

### a good markdown online editor place [mahua](http://mahua.jser.me/)

### lombok

### tomcat 7

### maven rebuild project
