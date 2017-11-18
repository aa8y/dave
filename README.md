# Dave

[![Build Status](https://travis-ci.org/aa8y/dave.svg?branch=master)](https://travis-ci.org/aa8y/dave)
[![codecov](https://codecov.io/gh/aa8y/dave/branch/master/graph/badge.svg)](https://codecov.io/gh/aa8y/dave)

Dave is a tool which is intended to help with Docker image authoring. It tries to fill the gaps Docker Hub has around building images, which are:
* Lack of support for build arguments.
* The only way to build multiple tags being the usage of a different `Dockerfile` for each tag which goes against the DRY philosophy.
* No testing infrastructure so that tags are published only after passing (a) test(s).

**Dave** is an acronym for _Docker Authoring made Very Easy_. Actually that's not completely true since I came up with the name first and then the acronym. And if you're wondering where the name came from, here's a hint.

![](https://raw.githubusercontent.com/aa8y/dave/master/.images/dave.gif)

*NOTE:* It is still work in progress. So suffice to many things might change. Hopefully not too many though.

## Features

Dave would do perform its operations by using metadata in a [YAML](http://yaml.org/) serialized manifest file. The format is explained [later](#manifest_file). The following operations are supported.

* **all**: This command will execute all commands except `template` in the order of `pull`, `build`, `test` and `push`.
* **build**: Builds one or more images using the given Docker build command template and its arguments.
* **pull**: Pulls one or more images from a Docker registry like Docker Hub.
* **push**: Pushes a local image using the given Docker push command template and its arguments.
* **template**: Builds one or more `Dockerfile`s using the given template. This helps keep your `Dockerfile`s DRY.
* **test**: Tests a Docker image by invoking a certain command on the image. A non-zero exit status code fails the test.

All templating is done using [Mustache](https://mustache.github.io/). `pull` and `template` commands won't be supported in the first release which would be `0.1.0`.

## Usage

The command-line utility requires at least one command to be passed.
```
dave <command1> [<command2> ...] [OPTIONS]
```
The options that it accepts are:

* `--context` or `-c`: Accepts a string denoting the location of the `Dockerfile`. If just the context is passed, the command(s) would be invoked on all tags pertaining to the context.
* `--tags` or `-t`: Accepts a list tags separated by spaces. Requires the context to be passed as well. If the context is not passed, the tags would be ignored.
* `--manifest` or `-m`: Accepts a path to the manifest file. Defaults to `manifest.yml` in the current directory.

If no other parameters are passed, the command(s) would be executed for all contexts and all tags in the manifest.

## Manifest File

The manifest file follows a trickle down format. What this means that all the values in the parent node trickle down but can be overridden by the child node. Here's a sample format.

```yaml
parameters:
  repository: aa8y/spark
  hadoopVersion: 2.7.4
templates:
  push: docker push {{{repository}}}:{{tag}}
  test: docker run --rm -it {{{repository}}}:{{tag}} spark-shell --version
contexts:
  stable:
    tagKeys:
      - sparkVersion
    templates:
      build: >
        docker build -t {{{repository}}}:{{tag}}
          --build-arg HADOOP_VERSION={{hadoopVersion}}
          --build-arg SPARK_VERSION={{sparkVersion}} {{context}}
    tags:
      '1.6.3':
        hadoopVersion: 2.6.5
      '2.2.0':
      '1.6':
        hadoopVersion: 2.6.5
        sparkVersion: 1.6.3
      '2.2':
        sparkVersion: 2.2.0
      'latest':
        sparkVersion: 2.2.0
  edge:
    parameters:
      scalaVersion: '2.11'
    templates:
      build: >
        docker build -t {{{repository}}}:{{tag}}
          --build-arg HADOOP_VERSION={{hadoopVersion}}
          --build-arg SCALA_VERSION={{scalaVersion}}
          --build-arg SPARK_BRANCH={{branch}} {{context}}
    tags:
      edge-1.6:
        branch: branch-1.6
        hadoopVersion: 2.6.5
        scalaVersion: '2.10'
      edge-2.2:
        branch: branch-2.2
      edge:
        branch: master
```

Let's go through it part by part. Here's the first part.

```yaml
parameters:
  repository: aa8y/spark
  hadoopVersion: 2.7.4
templates:
  push: docker push {{{repository}}}:{{tag}}
  test: docker run --rm -it {{{repository}}}:{{tag}} spark-shell --version
```

This is the first part of the manifest, which refers to the global defaults will get assigned to all contexts and from there to all tags. Supported keys are `parameters` and `templates`. `parameters` contains parameters for the `build`, `pull`, `push` and `test` templates. And `templates` contains the Docker build, pull, push and test [Mustache](https://mustache.github.io/) command templates. Here, we used the `{{{}}}` for the repository vs `{{}}` for the tag as the former contains a `/` which would otherwise be HTML-encoded. These defaults can be overridden by redefining the keys on any level from where they'll trickle down to the lowest level, i.e. for each tag.

Here's the second part.

```yaml
contexts:
  stable:
    ...
  edge:
    ...
```

The second part of the manifest, `contexts` refers to a Docker context. That basically means the location where the `Dockerfile` would exist and which would also be the source for the `COPY` commands in the said `Dockerfile`. Each context key is automatically assigned as a value to a key called `context` in the parameters, which can be used in the templates.

Here's the next part.

```yaml
stable:
  tagKeys:
    - sparkVersion
  templates:
    build: >
      docker build -t {{{repository}}}:{{tag}}
        --build-arg HADOOP_VERSION={{hadoopVersion}}
        --build-arg SPARK_VERSION={{sparkVersion}} {{context}}
  tags:
    '1.6.3':
      hadoopVersion: 2.6.5
    '2.2.0':
    '1.6':
      hadoopVersion: 2.6.5
      sparkVersion: 1.6.3
    '2.2':
      sparkVersion: 2.2.0
    'latest':
      sparkVersion: 2.2.0
```

`tags` refers to the tags which would be built. In the aforementioned snippet, we would therefore be building 5 tags for the `stable` context. The build command for each of these tags would be the one defined in the context templates and the push command would be the one which would trickle down from the global templates discussed before. A tag key gets automatically assigned as a value to the `tag` key along with any other tag keys defined in `tagKeys`, if present, and can be used in templates. So, for example, in the above snippet the value of `sparkVersion` for tag `1.6.3` would be `1.6.3` whereas `2.2` would override the value from its tag-specific parameters.

And here's the last part.

```yaml
edge:
  parameters:
    scalaVersion: '2.11'
  templates:
    build: >
      docker build -t {{{repository}}}:{{tag}}
        --build-arg HADOOP_VERSION={{hadoopVersion}}
        --build-arg SCALA_VERSION={{scalaVersion}}
        --build-arg SPARK_BRANCH={{branch}} {{context}}
  tags:
    edge-1.6:
      branch: branch-1.6
      hadoopVersion: 2.6.5
      scalaVersion: '2.10'
    edge-2.2:
      branch: branch-2.2
    edge:
      branch: master
```

In the last part, the only special thing to be seen is a new local global parameter, `scalaVersion` has been defined. This would then be assigned to each tag and can also be overridden as it is for the `edge-1.6` tag.

And while the manifest file can be named anything, the default name assumed is `manifest.yml` in the current directory. Also, although the sample manifest has keys in `lowerCamelCase`, `lower_snake_case` and `lower-kebab-case` are also supported.

## Examples

Here are projects where Dave is being utilized to build, test and push images. See `manifest.yml` to see how the metadata has been stored and `.travis.yml` to see how Dave can be leveraged.

* [aa8y/docker-scala](https://github.com/aa8y/docker-scala): A simple Docker project with one `Dockerfile` (i.e. one context) from which all Docker images are built.

## CI Builds

### TravisCI

Here's an example `.travis.yml` to use it with TravisCI.

```
sudo: required
services:
  - docker
language: node_js
node_js:
  - stable
before_install:
  - git clone https://github.com/aa8y/dave.git
install:
  - npm install -g dave/
before_script:
  - dave build
script:
  - dave test
after_success:
  - docker login -u <username> -p "$DOCKER_PASSWORD"
  - dave push
```

If all you want to do is build and test the images, you can ignore the `after_success` section. But if you do want to push the images after they have been tested, you would need a way to authenticate your Docker user. For that, follow [this guide](https://docs.travis-ci.com/user/docker/#Pushing-a-Docker-Image-to-a-Registry). I, personally, only like to encrypt my password as the username for Docker registry is usually also the namespace for the images. Also, I am working on acquiring the [Dave package namespace](https://www.npmjs.com/package/dave) on NPM, so that the installation process is easier.

## Future Work

* Add support to pull images. This should help pulling cached layers which can make building images faster on a CI instance. I expect to add this in the 0.2.0 release.
* Add support for templating `Dockerfile`s. I expect to add this in the 0.3.0 release.
* Verify the metadata read from the manifest against a schema. Maybe use [JSON Schema](http://json-schema.org/)?

## License

MIT
