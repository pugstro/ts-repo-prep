import fs from 'fs';
export function exportJSON(data: any, outPath: string) {
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
}
