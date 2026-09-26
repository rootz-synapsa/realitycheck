'use strict';

function countIndent(line) {
  let indent = 0;
  while (indent < line.length && line[indent] === ' ') {
    indent += 1;
  }
  return indent;
}

function splitKeyValue(source) {
  const separatorIndex = source.indexOf(':');
  if (separatorIndex === -1) {
    throw new Error(`Invalid YAML mapping entry: ${source}`);
  }

  const key = source.slice(0, separatorIndex).trim();
  const rawValue = source.slice(separatorIndex + 1).trim();
  return [key, rawValue];
}

function splitInlineArray(source) {
  const items = [];
  let current = '';
  let quote = null;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if ((character === '"' || character === "'") && source[index - 1] !== '\\') {
      if (quote === character) {
        quote = null;
      } else if (quote === null) {
        quote = character;
      }
      current += character;
      continue;
    }

    if (character === ',' && quote === null) {
      items.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  if (current.trim() !== '') {
    items.push(current.trim());
  }

  return items;
}

function parseScalar(rawValue) {
  if (rawValue === '') {
    return '';
  }

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  if (rawValue === 'null') {
    return null;
  }

  if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
    const inner = rawValue.slice(1, -1).trim();
    if (inner === '') {
      return [];
    }

    return splitInlineArray(inner).map(parseScalar);
  }

  if ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
    return rawValue.slice(1, -1);
  }

  if (/^-?\d+$/.test(rawValue)) {
    return Number(rawValue);
  }

  return rawValue;
}

function skipIgnorable(lines, startIndex) {
  let index = startIndex;
  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      index += 1;
      continue;
    }
    break;
  }
  return index;
}

function parseNode(lines, indent, startIndex) {
  let index = skipIgnorable(lines, startIndex);
  if (index >= lines.length) {
    return [undefined, index];
  }

  const line = lines[index];
  const currentIndent = countIndent(line);
  if (currentIndent < indent) {
    return [undefined, index];
  }

  if (currentIndent !== indent) {
    throw new Error(`Unexpected indentation at line ${index + 1}`);
  }

  const trimmed = line.slice(indent);
  if (trimmed.startsWith('- ')) {
    return parseSequence(lines, indent, index);
  }

  return parseMapping(lines, indent, index);
}

function looksLikeInlineMappingEntry(source) {
  return /^[A-Za-z0-9_-]+:(?:\s.*)?$/.test(source);
}

function parseSequence(lines, indent, startIndex) {
  const sequence = [];
  let index = startIndex;

  while (index < lines.length) {
    index = skipIgnorable(lines, index);
    if (index >= lines.length) {
      break;
    }

    const line = lines[index];
    const currentIndent = countIndent(line);
    if (currentIndent < indent) {
      break;
    }
    if (currentIndent !== indent) {
      throw new Error(`Unexpected indentation in sequence at line ${index + 1}`);
    }

    const trimmed = line.slice(indent);
    if (!trimmed.startsWith('- ')) {
      break;
    }

    const content = trimmed.slice(2).trim();
    if (content === '') {
      const [value, nextIndex] = parseNode(lines, indent + 2, index + 1);
      sequence.push(value);
      index = nextIndex;
      continue;
    }

    if (looksLikeInlineMappingEntry(content)) {
      const [key, rawValue] = splitKeyValue(content);
      const item = {};
      if (rawValue === '') {
        const [value, nextIndex] = parseNode(lines, indent + 4, index + 1);
        item[key] = value;
        index = nextIndex;
      } else {
        item[key] = parseScalar(rawValue);
        index += 1;
      }

      const [mergedItem, nextIndex] = parseMappingEntries(lines, indent + 2, index, item);
      sequence.push(mergedItem);
      index = nextIndex;
      continue;
    }

    sequence.push(parseScalar(content));
    index += 1;
  }

  return [sequence, index];
}

function parseMapping(lines, indent, startIndex) {
  return parseMappingEntries(lines, indent, startIndex, {});
}

function parseMappingEntries(lines, indent, startIndex, target) {
  let index = startIndex;

  while (index < lines.length) {
    index = skipIgnorable(lines, index);
    if (index >= lines.length) {
      break;
    }

    const line = lines[index];
    const currentIndent = countIndent(line);
    if (currentIndent < indent) {
      break;
    }
    if (currentIndent !== indent) {
      break;
    }

    const trimmed = line.slice(indent);
    if (trimmed.startsWith('- ')) {
      break;
    }

    const [key, rawValue] = splitKeyValue(trimmed);
    if (rawValue === '') {
      const [value, nextIndex] = parseNode(lines, indent + 2, index + 1);
      target[key] = value;
      index = nextIndex;
      continue;
    }

    target[key] = parseScalar(rawValue);
    index += 1;
  }

  return [target, index];
}

function parseYaml(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const [document] = parseNode(lines, 0, 0);
  return document;
}

module.exports = {
  parseYaml,
};
