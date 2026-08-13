/**
 * Embeddings run locally (all-MiniLM-L6-v2, 384-dim) so the immune system keeps
 * working on venue wifi and needs no API key. Swap in a hosted embedder only if
 * one is configured.
 */
import { pipeline } from '@huggingface/transformers';

let embedder = null;

export async function initEmbedder() {
  if (embedder) return embedder;
  const t0 = Date.now();
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log(`[embed] local model ready in ${Date.now() - t0}ms`);
  return embedder;
}

export async function embed(text) {
  const model = await initEmbedder();
  const out = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data);
}
