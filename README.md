# Dave

I've recently started authoring Docker images and I realized that the Docker Hub automation around building images is a little inadequate. There is no support for build arguments and the only way to build multiple tags is to use a different `Dockerfile` for each tag which goes against the DRY philosophy. Also, there is no way to auto-build only if the images pass certain tests.

So I've decided to build **Dave**. It is an acronym for _Docker Authoring made Very Easy_. Not really. But it did come from somewhere. Here's a hint.

![](https://raw.githubusercontent.com/aa8y/dave/master/.images/dave.gif)

It is still work in progress. So suffice to many things might change. Hopefully not too many though.

### Features

Dave would do perform its operations by using metadata in a [YAML](http://yaml.org/) serialized manifest file. The format is explained [later](#manifest_file_format). The following operations are supported.

* **build**: Builds one or more images using the given Docker build command template and its arguments.
* **test**: Tests a Docker image by invoking a certain command on the image. A non-zero exit status code fails the test.
* **push**: Pushes a local image using the given Docker push command template and its arguments.
* **template**: Builds one or more `Dockerfile`s using the given template. This helps keep your `Dockerfile`s DRY.

All templating is done using [Mustache](https://mustache.github.io/)

### Manifest File Format

Here's a sample format.

```yaml
defaults:
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
defaults:
  parameters:
    repository: aa8y/spark
    hadoopVersion: 2.7.4
  templates:
    push: docker push {{{repository}}}:{{tag}}
    test: docker run --rm -it {{{repository}}}:{{tag}} spark-shell --version
```

This first part of the manifest, `defaults` refers to the global defaults that would be assigned to all tags. Supported default keys are `parameters` and `templates`. `parameters` contains parameters for the build, push and test templates. And `templates` contains the Docker build, push and test Mustache templates. Here, we used the `{{{}}}` for the repository vs `{{}}` for the tag as the former contains a `/` which would otherwise be HTML-encoded. These defaults can be overridden by redefining the keys on any level from where they'll trickle down to the lowest level, i.e. for each tag.

Here's the second part.

```yaml
contexts:
  stable:
    ...
  edge:
    ...
```

The second part of the manifest, `contexts` refers to a Docker context. That basically means the location where the `Dockerfile` would exist and which would also be the source for the `COPY` commands in the said `Dockerfile`. Each context key is assigned to a variable called `context` which can be used in the templates.

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

`tags` refers to the tags which would be built. In the aforementioned snippet, we would therefore be building 5 tags for the `stable` context. The build command for each of these tags would be the one defined in the local templates and the push command would be the one in the global templates discussed before (`defaults`). The key of the tags always populates the `tag` variable along with any tag keys, if present, and can be used in templates. If the same value needs to be assigned to additional keys, they can be defined using the `tagKeys` key. So, for example, in the above snippet the value of `sparkVersion` for tag `1.6.3` would be `1.6.3` whereas `2.2` would override the value from its tag-specific parameters.

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

And while the manifest file can be named anything, the default name assumed is `manifest.yml`. Also, although the sample has keys in `lowerCamelCase`, `lower_snake_case` and `lower-kebab-case` is also supported.

### Examples

TODO

### Usage

The plan is to publish this to [NPM](https://www.npmjs.com) so that it can be installed and used like a common binary. More instructions to follow once that has been done.

### Future Work

* Add support for templating `Dockerfile`s. I expect to add this in the 0.2.0 release.
* Verify the metadata read from the manifest against a schema.

### License

MIT
