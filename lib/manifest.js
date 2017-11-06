const fs = require('fs')
const mustache = require('mustache')
const yaml = require('js-yaml')
const _ = require('lodash')

function getMetadata(manifestFile, cb) {
  if (typeof manifestFile == 'function') {
    cb = manifestFile
    manifestFile = './manifest.yml'
  }
  fs.readFile(manifestFile, 'utf8', (err, yamlStr) => {
    if (err) return cb(err)
    cb(null, yaml.safeLoad(yamlStr))
  })
}
function getGlobalDefaults(metadata) {
  return metadata.defaults || {}
}
function getDefaults(contextMeta, globalDefaults, type) {
  if (type) {
    const global = globalDefaults[type] || {}
    const context = contextMeta[type] || {}
    return _.merge(global, context)
  } else {
    const parameters = getDefaults(contextMeta, globalDefaults, 'parameters')
    const templates = getDefaults(contextMeta, globalDefaults, 'templates')
    return { parameters, templates }
  }
}
function getContexts(metadata) {
  const contextMetaLookup = metadata.contexts || {}
  return Object.keys(contextMetaLookup).sort()
}
function getContextMeta(context, metadata) {
  const contextMetaLookup = metadata.contexts || {}
  return _.merge({ context }, contextMetaLookup[context])
}
function getTags(contextMeta) {
  const tagMetaLookup = contextMeta.tags || {}
  return Object.keys(tagMetaLookup).sort()
}
function getTagKeys(contextMeta) {
  return contextMeta.tagKeys || contextMeta['tag_keys'] || contextMeta['tag-keys'] || []
}
function getTagKeyMeta(contextMeta, tag) {
  const keys = getTagKeys(contextMeta)
  return keys.reduce((acc, k) => {
    acc[k] = tag
    return acc
  }, { tag })
}
function getTagMeta(tag, contextMeta, globalDefaults) {
  const tagMetaLookup = contextMeta.tags || {}
  const tagKeyMeta = getTagKeyMeta(contextMeta, tag)
  const rawTagMeta = _.merge(tagKeyMeta, tagMetaLookup[tag])
  const defaults = getDefaults(contextMeta, globalDefaults)
  const { parameters, templates } = defaults
  return _.merge(templates, parameters, rawTagMeta)
}
function getTagCommands(tagMeta) {
  let { build, push, test } = tagMeta
  build = mustache.render(build, tagMeta)
  push = mustache.render(push, tagMeta)
  const commands = { build, push }
  if (!test) return commands
  test = mustache.render(test, tagMeta)
  return _.merge(commands, { test })
}

module.exports = {
  getContextMeta,
  getContexts,
  getDefaults,
  getGlobalDefaults,
  getMetadata,
  getTagCommands,
  getTagKeyMeta,
  getTagKeys,
  getTagMeta,
  getTags
}
