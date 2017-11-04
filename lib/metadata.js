const fs = require('fs')
const yaml = require('js-yaml')
const _ = require('lodash')

function getManifest(manifestFile, cb) {
  if (typeof manifestFile == 'function') {
    cb = manifestFile
    manifestFile = './manifest.yml'
  }
  fs.readFile(manifestFile, 'utf8', (err, yamlStr) => {
    if (err) return cb(err)
    cb(null, yaml.safeLoad(yamlStr))
  })
}
function getGlobalDefaults(manifest) {
  return manifest['defaults'] || {}
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
function getContexts(manifest) {
  const contextMetaLookup = manifest['contexts'] || {}
  return Object.keys(contextMetaLookup).sort()
}
function getContextMeta(context, manifest) {
  const contextMetaLookup = manifest['contexts'] || {}
  return contextMetaLookup[context] || {}
}
function getTags(contextMeta) {
  const tagMetaLookup = contextMeta['tags'] || {}
  return Object.keys(tagMetaLookup).sort()
}
function getTagMeta(tag, contextMeta, defaults) {
  const tagMetaLookup = contextMeta['tags'] || {}
  const rawTagMeta = tagMetaLookup[tag] || {}
  const { parameters, templates } = defaults
  return _.merge(templates, _.merge(parameters, rawTagMeta))
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
  getManifest,
  getTagCommands,
  getTagMeta,
  getTags
}
