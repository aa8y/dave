import fs from 'node:fs/promises'
import mustache from 'mustache'
import yaml from 'js-yaml'

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
function deepMerge(...sources) {
  const result = {}
  for (const source of sources) {
    if (!source) continue
    for (const key of Object.keys(source)) {
      const sv = source[key]
      const rv = result[key]
      result[key] = isPlainObject(sv) && isPlainObject(rv) ? deepMerge(rv, sv) : sv
    }
  }
  return result
}
// structureTest is the only block where arrays must concatenate across the
// trickle-down — a global `common.yaml` should survive even when a context
// adds its own configs. deepMerge intentionally overwrites arrays, so this
// merge is kept separate to keep that contract intact.
function pickStructureTest(obj) {
  if (!obj) return null
  return obj.structureTest || obj['structure_test'] || obj['structure-test'] || null
}
function mergeStructureTest(parent, child) {
  if (!parent && !child) return null
  if (!parent) return child
  if (!child) return parent
  const merged = deepMerge(parent, child)
  const parentConfigs = parent.configs || []
  const childConfigs = child.configs || []
  if (parentConfigs.length || childConfigs.length) {
    merged.configs = parentConfigs.concat(childConfigs)
  }
  return merged
}

export async function getMetadata(manifestFile = './manifest.yml') {
  const yamlStr = await fs.readFile(manifestFile, 'utf8')
  return yaml.load(yamlStr)
}
export function getGlobalDefaults(metadata) {
  const parameters = metadata.parameters || {}
  const templates = metadata.templates || {}
  return { parameters, templates }
}
export function getDefaults(childMeta, parentDefaults, type) {
  parentDefaults = parentDefaults || {}
  if (type) {
    return deepMerge(parentDefaults[type], childMeta[type])
  } else {
    const parameters = getDefaults(childMeta, parentDefaults, 'parameters')
    const templates = getDefaults(childMeta, parentDefaults, 'templates')
    return { parameters, templates }
  }
}
export function getContexts(metadata) {
  const contextMetaLookup = metadata.contexts || {}
  return Object.keys(contextMetaLookup).sort()
}
export function getContextMeta(context, metadata) {
  if (metadata.contexts && context in metadata.contexts) {
    const globalDefaults = getGlobalDefaults(metadata)
    const contextMeta = metadata.contexts[context]
    const defaults = getDefaults(contextMeta, globalDefaults)
    const structureTest = mergeStructureTest(
      pickStructureTest(metadata),
      pickStructureTest(contextMeta)
    )
    const merged = deepMerge({ parameters: { context }}, contextMeta, defaults)
    delete merged['structure_test']
    delete merged['structure-test']
    if (structureTest) merged.structureTest = structureTest
    else delete merged.structureTest
    return merged
  }
  return {}
}
export function getTags(contextMeta) {
  if (!contextMeta.tags) return []
  return Object.keys(contextMeta.tags).sort()
}
export function getTagKeys(contextMeta) {
  const tagKeys = contextMeta.tagKeys || contextMeta['tag_keys'] || contextMeta['tag-keys'] || []
  return ['tag'].concat(tagKeys).sort()
}
export function getTagKeyMeta(contextMeta, tag) {
  const keys = getTagKeys(contextMeta)
  return keys.reduce((acc, k) => {
    acc[k] = tag
    return acc
  }, {})
}
export function getTagMeta(tag, contextMeta) {
  if (!contextMeta.tags) return {}
  const tagEntry = contextMeta.tags[tag] || {}
  // Strip the structureTest block (and its aliases) so it doesn't leak into
  // Mustache rendering context as a parameter.
  const tagParameters = { ...tagEntry }
  delete tagParameters.structureTest
  delete tagParameters['structure_test']
  delete tagParameters['structure-test']
  const tagMeta = { parameters: tagParameters }
  const tagKeyMeta = { parameters: getTagKeyMeta(contextMeta, tag) }
  const defaults = getDefaults(tagKeyMeta, contextMeta)
  const merged = getDefaults(tagMeta, defaults)
  const structureTest = mergeStructureTest(
    contextMeta.structureTest || null,
    pickStructureTest(tagEntry)
  )
  if (structureTest) merged.structureTest = structureTest
  return merged
}
export function getTagCommands(tagMeta, types) {
  types = types && types.length > 0 ? types : ['build', 'test', 'push']
  const { parameters, structureTest, templates } = tagMeta

  return types.reduce((commands, type) => {
    if (type === 'structure-test') {
      if (!structureTest || !structureTest.configs || structureTest.configs.length === 0) {
        return commands
      }
      const imageTemplate = structureTest.image || '{{{repository}}}:{{tag}}'
      const image = mustache.render(imageTemplate, parameters)
      const cfgFlags = structureTest.configs
        .map((c) => `--config ${mustache.render(c, parameters)}`)
        .join(' ')
      commands[type] = `container-structure-test test --image ${image} ${cfgFlags}`
      return commands
    }
    if (templates && type in templates) {
      const command = mustache.render(templates[type], parameters)
      commands[type] = command
    }
    return commands
  }, {})
}
export function getContextCommands(contextMeta, types, tags) {
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
export function getCommands(metadata, types, context, tags) {
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
    return commands[type] ? allCommands.concat(commands[type]) : allCommands
  }, [])
}
