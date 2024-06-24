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
    cb(null, yaml.load(yamlStr))
  })
}
function getGlobalDefaults(metadata) {
  const parameters = metadata.parameters || {}
  const templates = metadata.templates || {}
  return { parameters, templates }
}
function getDefaults(childMeta, parentDefaults, type) {
  parentDefaults = parentDefaults || {}
  if (type) {
    return _.merge({}, parentDefaults[type], childMeta[type])
  } else {
    const parameters = getDefaults(childMeta, parentDefaults, 'parameters')
    const templates = getDefaults(childMeta, parentDefaults, 'templates')
    return { parameters, templates }
  }
}
function getContexts(metadata) {
  const contextMetaLookup = metadata.contexts || {}
  return Object.keys(contextMetaLookup).sort()
}
function getContextMeta(context, metadata) {
  if (metadata.contexts && context in metadata.contexts) {
    const globalDefaults = getGlobalDefaults(metadata)
    const contextMeta = metadata.contexts[context]
    const defaults = getDefaults(contextMeta, globalDefaults)
    return _.merge({ parameters: { context }}, contextMeta, defaults)
  }
  return {}
}
function getTags(contextMeta) {
  if (!contextMeta.tags) return []
  return Object.keys(contextMeta.tags).sort()
}
function getTagKeys(contextMeta) {
  const tagKeys = contextMeta.tagKeys || contextMeta['tag_keys'] || contextMeta['tag-keys'] || []
  return ['tag'].concat(tagKeys).sort()
}
function getTagKeyMeta(contextMeta, tag) {
  const keys = getTagKeys(contextMeta)
  return keys.reduce((acc, k) => {
    acc[k] = tag
    return acc
  }, {})
}
function getTagMeta(tag, contextMeta) {
  if (!contextMeta.tags) return {}
  const tagMeta = { parameters: contextMeta.tags[tag] }
  const tagKeyMeta = { parameters: getTagKeyMeta(contextMeta, tag) }
  const defaults = getDefaults(tagKeyMeta, contextMeta)
  return getDefaults(tagMeta, defaults)
}
function getTagCommands(tagMeta, types) {
  types = types && types.length > 0 ? types : ['build', 'test', 'push']
  const { parameters, templates } = tagMeta

  return types.reduce((commands, type) => {
    if (templates && type in templates) {
      const command = mustache.render(templates[type], parameters)
      commands[type] = command
    }
    return commands
  }, {})
}
function getContextCommands(contextMeta, types, tags) {
  types = types && types.length > 0 ? types : ['build', 'test', 'push']
  tags = tags && tags.length > 0 ? tags : getTags(contextMeta)

  return tags.reduce((contextCommands, tag) => {
    const tagMeta = getTagMeta(tag, contextMeta)
    const tagCommands = getTagCommands(tagMeta, types)
    for (let type of types) {
      if (type in tagCommands) {
        let typeCommands = contextCommands[type] || []
        typeCommands.push(tagCommands[type])
        contextCommands[type] = typeCommands
      }
    }
    return contextCommands
  }, {})
}
function getCommands(metadata, types, context, tags) {
  types = types && types.length > 0 ? types : ['build', 'test', 'push']
  const contexts = context ? [context] : getContexts(metadata)

  const commands = contexts.reduce((commands, context) => {
    const contextMeta = getContextMeta(context, metadata)
    const contextCommands = getContextCommands(contextMeta, types, tags)
    for (let type of types) {
      if (type in contextCommands) {
        let typeCommands = commands[type] || []
        commands[type] = typeCommands.concat(contextCommands[type])
      }
    }
    return commands
  }, {})

  return types.reduce((allCommands, type) => {
    return allCommands.concat(commands[type])
  }, [])
}

module.exports = {
  getCommands,
  getContextCommands,
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
