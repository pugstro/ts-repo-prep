import fs from 'fs';
import path from 'path';

export interface ConfigEntry {
    key: string;
    value: string;
    kind: 'Env' | 'Port' | 'Image' | 'Service' | 'Dependency' | 'Database Model' | 'Database Enum' | 'Database Config' | 'GraphQL Type' | 'GraphQL Input' | 'GraphQL Interface' | 'GraphQL Enum';
}

export interface ParseResult {
    configs: ConfigEntry[];
    classification: string;
}

// Assuming ConfigParseResult is the same as ParseResult for consistency
type ConfigParseResult = ParseResult;

export function parseConfigFile(filePath: string): ParseResult {
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const configs: ConfigEntry[] = [];
    if (fileName.endsWith('.prisma')) {
        return parsePrisma(content, filePath);
    }
    if (fileName.endsWith('.graphql') || fileName.endsWith('.gql')) {
        return parseGraphQL(content, filePath);
    }
    let classification = 'Configuration';

    if (fileName.includes('Dockerfile')) {
        classification = 'Infrastructure (Docker)';
        parseDockerfile(content, configs);
    } else if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
        classification = 'Infrastructure (YAML)';
        parseYaml(content, configs);
    } else if (fileName === '.env.example') {
        classification = 'Configuration (Env Template)';
        parseEnvExample(content, configs);
    }

    return { configs, classification };
}

function parseDockerfile(content: string, configs: ConfigEntry[]) {
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('FROM ')) {
            configs.push({ key: 'base_image', value: trimmed.substring(5).trim(), kind: 'Image' });
        } else if (trimmed.startsWith('EXPOSE ')) {
            configs.push({ key: 'port', value: trimmed.substring(7).trim(), kind: 'Port' });
        } else if (trimmed.startsWith('ENV ')) {
            const parts = trimmed.substring(4).trim().split(/\s+|=/);
            if (parts[0]) {
                configs.push({ key: parts[0], value: parts.slice(1).join('=').trim() || 'undefined', kind: 'Env' });
            }
        }
    }
}

function parseYaml(content: string, configs: ConfigEntry[]) {
    // Basic regex-based YAML parsing for common patterns (compose/ci)
    // Avoids adding a heavy YAML dependency for simple metadata

    // Extract service names from docker-compose
    const serviceMatch = content.match(/^\s{2}([a-z0-9_-]+):/gm);
    if (serviceMatch) {
        serviceMatch.forEach(m => {
            const name = m.trim().replace(':', '');
            if (name !== 'services' && name !== 'version' && name !== 'volumes' && name !== 'networks') {
                configs.push({ key: 'service', value: name, kind: 'Service' });
            }
        });
    }

    // Extract image names
    const imageMatch = content.match(/^\s+image:\s*(.+)$/gm);
    if (imageMatch) {
        imageMatch.forEach(m => {
            const image = m.replace(/^\s+image:\s*/, '').trim();
            configs.push({ key: 'image', value: image, kind: 'Image' });
        });
    }

    // Extract env vars
    const envMatch = content.match(/^\s+-?\s*([A-Z0-9_-]+)=/gm);
    if (envMatch) {
        envMatch.forEach(m => {
            const key = m.trim().replace('-', '').replace('=', '').trim();
            configs.push({ key, value: 'defined in yaml', kind: 'Env' });
        });
    }
}

function parseEnvExample(content: string, configs: ConfigEntry[]) {
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const parts = trimmed.split('=');
            if (parts[0]) {
                configs.push({ key: parts[0].trim(), value: 'template', kind: 'Env' });
            }
        }
    }
}

function parsePrisma(content: string, filePath: string): ConfigParseResult {
    const configs: ConfigEntry[] = [];
    const classification = 'Contract (Prisma)';

    // Extract models and enums
    const modelRegex = /^model\s+(\w+)/gm;
    let match;
    while ((match = modelRegex.exec(content)) !== null) {
        configs.push({
            key: 'model',
            value: match[1],
            kind: 'Database Model'
        });
    }

    const enumRegex = /^enum\s+(\w+)/gm;
    while ((match = enumRegex.exec(content)) !== null) {
        configs.push({
            key: 'enum',
            value: match[1],
            kind: 'Database Enum'
        });
    }

    // Datasource provider
    const providerRegex = /provider\s*=\s*"([^"]+)"/;
    const providerMatch = content.match(providerRegex);
    if (providerMatch) {
        configs.push({
            key: 'datasource_provider',
            value: providerMatch[1],
            kind: 'Database Config'
        });
    }

    return { classification, configs };
}

function parseGraphQL(content: string, filePath: string): ConfigParseResult {
    const configs: ConfigEntry[] = [];
    const classification = 'Contract (GraphQL)';

    // Basic regex extraction for types, inputs, interfaces
    const typeRegex = /^(?:type|input|interface|enum)\s+(\w+)/gm;
    let match;
    while ((match = typeRegex.exec(content)) !== null) {
        // Determine specific kind based on the line prefix
        const line = match[0];
        let kind: ConfigEntry['kind'] = 'GraphQL Type';
        if (line.startsWith('input')) kind = 'GraphQL Input';
        if (line.startsWith('interface')) kind = 'GraphQL Interface';
        if (line.startsWith('enum')) kind = 'GraphQL Enum';

        configs.push({
            key: 'type_definition',
            value: match[1],
            kind
        });
    }

    return { classification, configs };
}
