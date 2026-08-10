# Dave

[![CI](https://github.com/aa8y/dave/actions/workflows/ci.yml/badge.svg)](https://github.com/aa8y/dave/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/aa8y/dave/branch/master/graph/badge.svg)](https://codecov.io/gh/aa8y/dave)

Dave is a tool which is intended to help with Docker image authoring. It tries to fill the gaps Docker Hub has around building images, which are:
* Lack of support for build arguments.
* The only way to build multiple tags being the usage of a different `Dockerfile` for each tag which goes against the DRY philosophy.
* No testing infrastructure so that tags are published only after passing (a) test(s).

**Dave** is an acronym for _Docker Authoring made Very Easy_. Actually that's not completely true since I came up with the name first and then the acronym. And if you're wondering where the name came from, here's a hint.

![](https://raw.githubusercontent.com/aa8y/dave/master/.images/dave.gif)

*NOTE:* It is still work in progress. So suffice to many things might change. Hopefully not too many though.

## Features

Dave performs its operations by using metadata in a [YAML](http://yaml.org/) serialized manifest file. The format is explained [later](#manifest-file). The following operations are supported.

* **all**: Executes `build`, `test`, `structure-test` and `push` in order.
* **build**: Builds one or more images using the given Docker build command template and its arguments.
* **push**: Pushes a local image using the given Docker push command template and its arguments.
* **structure-test**: Runs [container-structure-test][cst] against a built image using configs declared in the manifest. Requires the `container-structure-test` binary on `PATH`.
* **test**: Tests a Docker image by invoking a certain command on the image. A non-zero exit status code fails the test.

[cst]: https://github.com/GoogleContainerTools/container-structure-test

All templating is done using [Mustache](https://mustache.github.io/).

## Usage

The command-line utility requires at least one command to be passed.
```
dave <command1> [<command2> ...] [OPTIONS]
```
The options that it accepts are:

* `--context` or `-c`: Accepts a string denoting the location of the `Dockerfile`. If just the context is passed, the command(s) would be invoked on all tags pertaining to the context.
* `--tags` or `-t`: Accepts a list tags separated by spaces. Requires the context to be passed as well. If the context is not passed, the tags would be ignored.
* `--manifest` or `-m`: Accepts a path to the manifest file. Defaults to `manifest.yml` in the current directory.
* `--jobs` or `-j`: Accepts a whole number `N` >= 1 denoting how many commands of the same type may run concurrently. Defaults to `1`.
* `--keep-going` or `-k`: A flag. On a failure, keeps running the remaining commands of the same type instead of stopping at the first one.

If no other parameters are passed, the command(s) would be executed for all contexts and all tags in the manifest.

### Running Commands Concurrently

By default Dave runs one command at a time. `--jobs`/`-j` lets the commands of a single type run concurrently, which is worth it when a context has several tags whose builds do not depend on each other.

```
dave all --jobs 4
```

The guarantees are:

* Command types remain strictly ordered: `build` → `test` → `structure-test` → `push`, with a barrier between types. Every command of a type finishes before the first command of the next type starts, so nothing is ever tested or pushed before it has been built. Only commands *within* a type run concurrently.
* At `-j 1`, which is the default, the behavior is identical to previous versions: commands run one at a time and each command's output streams live to your terminal as it is produced.
* At `-j` greater than `1`, each command's output is buffered and printed as one contiguous block when that command finishes, so concurrent commands never interleave their output. The trade-off is that you see a command's output only after it completes.

### Continuing After a Failure

Without `--keep-going`, the first failing command ends the run. With `--keep-going`/`-k`, the remaining commands *of the same type* still run.

```
dave build --keep-going
```

Later types never start, with or without the flag — if any `build` fails, no `test`, `structure-test` or `push` command is run. All the failures are summarized at the end and the exit code is non-zero.

`--keep-going` combines with `--jobs`, e.g. `dave build -j 4 -k` builds every tag it can, four at a time, and reports every tag that failed.

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

### Skipping a Command for a Tag

A template which renders to nothing (or to only whitespace) for a tag produces **no** command for that tag, rather than handing an empty command to the shell. That is how a tag opts out of a command type it doesn't need.

The typical use is an alias tag, i.e. a tag which is only a retag of another image and therefore has nothing of its own to build. Wrap the template in a Mustache inverted section and set the flag on the tags to be skipped.

```yaml
templates:
  build: '{{^retagFrom}}docker build -t {{{repository}}}:{{tag}} {{context}}{{/retagFrom}}'
  push: docker push {{{repository}}}:{{tag}}
contexts:
  .:
    tags:
      base:
      latest:
        retagFrom: base
```

Here the `latest` tag gets no `build` command, while it is still pushed like any other tag. Note that the template has to be quoted, since a YAML scalar starting with `{` would otherwise be read as a flow mapping.

This applies to the templated command types. The `structure-test` command is synthesized by Dave rather than templated, so it has its own opt-out, described below.

### Structure Tests

`dave structure-test` runs [container-structure-test][cst] natively against built images, without you having to write a Mustache template for the command. Declare a `structureTest` block at any level; `configs` is the only required field.

```yaml
parameters:
  repository: aa8y/core
templates:
  build: docker build -t {{{repository}}}:{{tag}} {{{context}}}
structureTest:
  configs:
    - script/test/common.yaml
contexts:
  alpine:
    structureTest:
      configs:
        - script/test/alpine.yaml
    tags:
      alpine:
  jdk/8:
    structureTest:
      configs:
        - script/test/jdk-8.yaml
    tags:
      jdk8:
```

The `configs` list **concatenates** as it trickles global → context → tag (unlike every other field, which child-overrides-parent). So in the snippet above, the `alpine` tag is tested against both `common.yaml` and `alpine.yaml`.

The image reference defaults to `{{{repository}}}:{{tag}}` rendered against the trickled-down parameters. Override it by adding `image: '...'` inside the `structureTest` block.

#### Opting Out

Since `configs` concatenate on the way down, a global config would otherwise apply to every tag. Set `structureTest: false` on a context or a tag to opt it out: everything inherited from above is dropped, so that tag gets no `structure-test` command at all.

```yaml
structureTest:
  configs:
    - script/test/common.yaml
contexts:
  alpine:
    tags:
      alpine:
  # No structure test for anything in this context.
  scratch:
    structureTest: false
    tags:
      scratch:
  jdk/8:
    tags:
      jdk8:
      # ...or for just this one tag.
      jdk8-slim:
        structureTest: false
```

A tag under an opted-out context can still re-enable structure testing by declaring its own `configs`; it simply starts from nothing instead of inheriting the configs from above.

#### Multiple tags per context

When a context has more than one tag, you can declare configs per tag, or template the path at the context level so it expands per tag. Config paths are Mustache-rendered against the same parameters as build/push templates, so `{{tag}}`, `{{{repository}}}`, and any `tagKeys` you declare all work.

```yaml
contexts:
  # Per-tag, explicit — use when file names don't follow a pattern.
  multi-explicit:
    tags:
      tag-a:
        structureTest:
          configs:
            - script/test/tag-a.yaml
      tag-b:
        structureTest:
          configs:
            - script/test/tag-b.yaml

  # Templated path at the context level — one line, expands per tag.
  multi-templated:
    structureTest:
      configs:
        - script/test/{{tag}}.yaml
    tags:
      tag-a:
      tag-b:
```

The two patterns mix freely: a templated default at the context level can be augmented (not replaced) by tag-level configs, since the lists concatenate.

The `container-structure-test` binary is not bundled with `dave` — install it separately (`brew install container-structure-test` on macOS, or download from the [release page][cst-releases]).

[cst-releases]: https://github.com/GoogleContainerTools/container-structure-test/releases

## Examples

Here are projects where Dave is being utilized to build, test and push images. See `manifest.yml` to see how the metadata has been stored.

* [aa8y/docker-scala](https://github.com/aa8y/docker-scala): A simple Docker project with one `Dockerfile` (i.e. one context) from which all Docker images are built.

## CI Builds

### GitHub Actions

Here's an example workflow to use Dave with GitHub Actions:

```yaml
name: Docker images

on:
  push:
    branches: [main]

env:
  CST_VERSION: 1.22.1

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm install -g dave
      - name: Install container-structure-test
        run: |
          curl -fsSL -o /tmp/cst \
            "https://github.com/GoogleContainerTools/container-structure-test/releases/download/v${CST_VERSION}/container-structure-test-linux-amd64"
          chmod +x /tmp/cst
          sudo mv /tmp/cst /usr/local/bin/container-structure-test
      - run: dave build
      - run: dave structure-test
      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      - run: dave push
```

Drop the CST install + `dave structure-test` steps if your manifest doesn't declare any `structureTest:` blocks, and drop the login + `dave push` steps if you only want to build and test.

## Future Work

* Verify the metadata read from the manifest against a schema. Maybe use [JSON Schema](http://json-schema.org/)?

## License

MIT
