export function chunkFile(exports: any[], maxTokens = 500) {
  // naive token estimation: 1 word ~ 1 token
  const chunks: any[] = [];
  let current: any[] = [];
  let tokens = 0;

  exports.forEach(exp => {
    const est = exp.doc?.split(/\s+/).length || 0;
    if (tokens + est > maxTokens) {
      chunks.push(current);
      current = [];
      tokens = 0;
    }
    current.push(exp);
    tokens += est;
  });

  if (current.length) chunks.push(current);
  return chunks;
}
